/**
 * Job-complete delivery — the ONE email every customer gets when their job
 * is finished (owner call 10 Nov 2026: invoice, receipt and review ask all
 * ride in a single professional email instead of separate messages).
 *
 * Paid jobs   → job summary + TOTAL PAID + review ask; the receipt PDF is
 *               attached when it hasn't already gone out (card payers get it
 *               at payment time via verifyPayment / markLeadPaid).
 * Unpaid jobs → job summary + TOTAL DUE + card pay link + PayID/bank + the
 *               invoice PDF attached + review ask. Stamps invoiceSentAt so
 *               the board's "Send invoice" button won't double-send.
 *
 * Sent from the 5pm batch (followUps.ts), the board's "complete & thank"
 * button, and the rug Monday-return tick-off. Never throws — a hiccup must
 * never block marking a job done.
 */
import { eq } from "drizzle-orm";
import { getDb } from "./queries/connection";
import { leads } from "@db/schema";
import { getSetting } from "./queries/settings";
import { loadSmtpConfig, isSmtpConfigured, type MailAttachment } from "./mailer";
import {
  bookingReference,
  jobCompleteEmail,
  jobCompleteEmailHtml,
  jobCompleteSms,
  deliver,
  type LeadRow,
} from "./messages";
import { invoicePdfBuffer } from "./invoicePdf";
import { receiptPdfBuffer } from "./receiptPdf";
import { cardPayLink } from "./invoices";

export interface JobCompleteResult {
  sent: boolean;
  emailSent: boolean;
  smsSent: boolean;
  paid: boolean;
  payUrl?: string | null;
  receiptAttached?: boolean;
  invoiceAttached?: boolean;
  detail: string;
}

export async function sendJobCompleteFor(leadId: number): Promise<JobCompleteResult> {
  const none = (detail: string, paid = false): JobCompleteResult => ({
    sent: false,
    emailSent: false,
    smsSent: false,
    paid,
    detail,
  });
  try {
    const db = getDb();
    const [row] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    if (!row) return none("Booking not found");

    const lead = row as never as LeadRow;
    const smtp = await loadSmtpConfig();
    if (!isSmtpConfigured(smtp)) {
      return none("Job-complete email not sent — Gmail settings aren't saved yet", !!(row.paidOnline || row.paidOfflineAt));
    }

    const ref = bookingReference(lead);
    const paid = !!(row.paidOnline || row.paidOfflineAt);
    const reviewUrl = (await getSetting("google_review_url"))?.trim() || null;
    const pdfs: MailAttachment[] = [];

    let payUrl: string | null = null;
    let receiptAttached = false;
    let invoiceAttached = false;
    if (paid) {
      // Receipt PDF rides along only if the customer doesn't have it yet —
      // card payers already received it the moment they paid.
      if (!row.receiptSentAt) {
        pdfs.push({ filename: `Receipt-${ref}.pdf`, content: await receiptPdfBuffer(lead), contentType: "application/pdf" });
        receiptAttached = true;
      }
    } else {
      payUrl = await cardPayLink(lead.id, lead.email, lead.total, ref);
      pdfs.push({ filename: `Invoice-${ref}.pdf`, content: await invoicePdfBuffer(lead), contentType: "application/pdf" });
      invoiceAttached = true;
    }

    const sent = await deliver(
      lead,
      jobCompleteEmail(lead, payUrl, reviewUrl, receiptAttached),
      jobCompleteSms(lead, reviewUrl),
      { html: jobCompleteEmailHtml(lead, payUrl, reviewUrl, receiptAttached), attachments: pdfs },
    );

    const stamps: Partial<{ receiptSentAt: Date; invoiceSentAt: Date }> = {};
    if (receiptAttached) stamps.receiptSentAt = new Date();
    if (invoiceAttached && !row.invoiceSentAt) stamps.invoiceSentAt = new Date();
    if (Object.keys(stamps).length > 0) {
      await db.update(leads).set(stamps).where(eq(leads.id, leadId));
    }

    return {
      sent: sent.emailSent || sent.smsSent,
      emailSent: sent.emailSent,
      smsSent: sent.smsSent,
      paid,
      payUrl,
      receiptAttached,
      invoiceAttached,
      detail:
        sent.detail ||
        (paid
          ? `Job-complete email to ${lead.email}${receiptAttached ? " (receipt attached)" : " (receipt already sent)"}`
          : `Job-complete email to ${lead.email} (invoice attached${payUrl ? ", card link included" : ", PayID/bank only"})`),
    };
  } catch (err) {
    return none(`Job-complete email failed (${String(err).slice(0, 120)})`);
  }
}
