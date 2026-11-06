/**
 * Invoice delivery. Sent once per unpaid job — in the 5pm follow-up batch
 * (owner call 5 Nov 2026: invoices go out automatically at end of day) or
 * from the board's "Send invoice" button. Creates a Stripe checkout link for
 * the card option; the PDF also lists PayID (Hnry) and bank transfer.
 * Never throws: an invoice hiccup must never block marking a job done.
 */
import { eq } from "drizzle-orm";
import { getDb } from "./queries/connection";
import { leads } from "@db/schema";
import { getSetting } from "./queries/settings";
import { loadSmtpConfig, isSmtpConfigured, sendMail } from "./mailer";
import { bookingReference, invoiceEmail, invoiceSms, type LeadRow } from "./messages";
import { invoicePdfBuffer } from "./invoicePdf";
import { brandedEmailHtml, EMAIL_CID } from "./emailTemplate";
import { brandLogo } from "./brand";
import { getStripe } from "./payments";

const SITE_ORIGIN = "https://marshallscarpetcleaning.com.au";

export interface InvoiceResult {
  sent: boolean;
  alreadySent?: boolean;
  alreadyPaid?: boolean;
  payUrl?: string | null;
  detail: string;
}

/** A Stripe "pay by card" link for the job's full total, or null when
 *  Stripe isn't configured / hiccups. The session id lands on the lead so
 *  verifyPayment can tick the job paid when the customer comes back. */
async function cardPayLink(leadId: number, email: string, total: number, ref: string): Promise<string | null> {
  const stripe = await getStripe();
  if (!stripe) return null;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "aud",
            unit_amount: Math.round(total * 100),
            product_data: {
              name: `Marshall's Carpet Cleaning — invoice ${ref}`,
              description: "Balance due on completed clean (5-day terms)",
            },
          },
        },
      ],
      success_url: `${SITE_ORIGIN}/quote?paid={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_ORIGIN}/quote?payment=cancelled`,
    });
    await getDb().update(leads).set({ stripeSessionId: session.id }).where(eq(leads.id, leadId));
    return session.url;
  } catch (err) {
    console.error("Invoice Stripe link failed:", err);
    return null;
  }
}

export async function sendInvoiceFor(leadId: number): Promise<InvoiceResult> {
  try {
    const db = getDb();
    const [row] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    if (!row) return { sent: false, detail: "Booking not found" };
    if (row.invoiceSentAt) return { sent: false, alreadySent: true, detail: "Invoice already sent" };
    if (row.paidOnline || row.paidOfflineAt)
      return { sent: false, alreadyPaid: true, detail: "Already paid — no invoice needed" };

    const lead = row as never as LeadRow;
    const smtp = await loadSmtpConfig();
    if (!isSmtpConfigured(smtp)) {
      return { sent: false, detail: "Invoice not sent — Gmail settings aren't saved yet" };
    }
    const ref = bookingReference(lead);
    const payUrl = await cardPayLink(lead.id, lead.email, lead.total, ref);
    const reviewUrl = (await getSetting("google_review_url"))?.trim() || null;
    const pdf = await invoicePdfBuffer(lead);
    const em = invoiceEmail(lead, payUrl, reviewUrl);
    // The reference is what customers quote when paying by PayID/bank — make
    // it big, red and underlined everywhere it appears in the email body.
    const refHtml = `<span style="font-size:1.25em;font-weight:800;color:#B91C1C;text-decoration:underline">${ref}</span>`;
    const html = brandedEmailHtml(em.text).split(ref).join(refHtml);
    await sendMail(smtp, lead.email, em.subject, em.text, [
      { filename: `Invoice-${ref}.pdf`, content: pdf, contentType: "application/pdf" },
      { filename: "logo.png", content: brandLogo(), contentType: "image/png", cid: EMAIL_CID.logo },
    ], html);
    await db.update(leads).set({ invoiceSentAt: new Date() }).where(eq(leads.id, leadId));
    return {
      sent: true,
      payUrl,
      detail: `Invoice emailed to ${lead.email}${payUrl ? " (card link included)" : " (PayID/bank only — no card link)"}`,
    };
  } catch (err) {
    return { sent: false, detail: `Invoice failed (${String(err).slice(0, 120)})` };
  }
}

/** SMS-preference customers get a short text pointing at the emailed
 *  invoice — used by the 5pm batch alongside the email. */
export function invoiceSmsFor(lead: LeadRow): string {
  return invoiceSms(lead);
}
