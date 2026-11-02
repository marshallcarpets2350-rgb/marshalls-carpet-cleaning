/**
 * Receipt delivery. Sent once per job, when the job is marked done —
 * either from the board's status change or the "complete & thank" button.
 * Never throws: a receipt hiccup must never block marking a job done.
 */
import { eq } from "drizzle-orm";
import { getDb } from "./queries/connection";
import { leads } from "@db/schema";
import { loadSmtpConfig, isSmtpConfigured, sendMail } from "./mailer";
import { bookingReference, receiptEmail, type LeadRow } from "./messages";
import { receiptPdfBuffer } from "./receiptPdf";
import { brandedEmailHtml, EMAIL_CID } from "./emailTemplate";
import { brandLogo } from "./brand";

export interface ReceiptResult {
  sent: boolean;
  alreadySent?: boolean;
  detail: string;
}

export async function sendReceiptFor(leadId: number): Promise<ReceiptResult> {
  try {
    const db = getDb();
    const [row] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    if (!row) return { sent: false, detail: "Booking not found" };
    if (row.receiptSentAt) return { sent: false, alreadySent: true, detail: "Receipt already sent" };

    const lead = row as never as LeadRow;
    const smtp = await loadSmtpConfig();
    if (!isSmtpConfigured(smtp)) {
      return { sent: false, detail: "Receipt not sent — Gmail settings aren't saved yet" };
    }
    const ref = bookingReference(lead);
    const pdf = await receiptPdfBuffer(lead);
    const em = receiptEmail(lead);
    await sendMail(smtp, lead.email, em.subject, em.text, [
      { filename: `Receipt-${ref}.pdf`, content: pdf, contentType: "application/pdf" },
      { filename: "logo.png", content: brandLogo(), contentType: "image/png", cid: EMAIL_CID.logo },
    ], brandedEmailHtml(em.text));
    await db.update(leads).set({ receiptSentAt: new Date() }).where(eq(leads.id, leadId));
    return { sent: true, detail: `Receipt emailed to ${lead.email}` };
  } catch (err) {
    return { sent: false, detail: `Receipt failed (${String(err).slice(0, 120)})` };
  }
}
