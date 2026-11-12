/**
 * Builds the payment receipt PDF for a completed job: reference, date,
 * customer, address, itemised breakdown from the stored quote and payment
 * method. Sent automatically when a job is marked done.
 *
 * pdfkit is loaded at runtime from node_modules rather than bundled:
 * its own `import { createRequire } from "module"` collides with the
 * esbuild bundle banner. node_modules is present wherever the server runs.
 */
import type PDFDocumentT from "pdfkit";
import { BUSINESS } from "@contracts/rates";
import { bookingReference, invoiceAddressee, workOrderNumberOf, type LeadRow } from "./messages";
import { BRAND, brandLogo, brandVan } from "./brand";

let PDFDocument: typeof PDFDocumentT | null = null;

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;
const RIGHT = PAGE_W - MARGIN;

async function loadPdfKit(): Promise<typeof PDFDocumentT> {
  if (!PDFDocument) {
    // Indirect dynamic import so the bundler leaves pdfkit in node_modules.
    const dynamicImport = new Function("s", "return import(s)") as (s: string) => Promise<{ default: typeof PDFDocumentT }>;
    PDFDocument = (await dynamicImport("pdfkit")).default;
  }
  return PDFDocument;
}

export type ReceiptLead = Pick<
  LeadRow,
  "id" | "name" | "address" | "suburb" | "total" | "paidOnline" | "quoteJson" | "bookingJson"
> & { createdAt: Date | string };

interface Breakdown {
  lines?: { label: string; amount: number }[];
  travelFee?: number;
  total?: number;
  rugDiscount?: number;
  maintenanceDiscount?: number;
  codeDiscount?: number;
  seasonalDiscount?: number;
  seasonalPromo?: { percent: number; label: string } | null;
  volumeDiscount?: number;
  undercutDiscount?: number;
}

function money(n: number): string {
  return `$${n.toFixed(2).replace(/\.00$/, "")}`;
}

function jobDateOf(lead: ReceiptLead): string {
  let iso: string | null = null;
  try {
    if (lead.bookingJson) iso = (JSON.parse(lead.bookingJson) as { preferredDate?: string }).preferredDate ?? null;
  } catch { /* fall through */ }
  const d = iso ? new Date(`${iso}T12:00:00`) : new Date(lead.createdAt);
  return d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function paymentLineOf(lead: ReceiptLead): string {
  if (lead.paidOnline) return "Paid in full online by card — thank you";
  try {
    const p = lead.bookingJson ? (JSON.parse(lead.bookingJson) as { payment?: string }).payment : undefined;
    if (p === "pay-now") return "Paid in full online by card — thank you";
    if (p === "payid") return `Paid by PayID — ${BUSINESS.payId}`;
    if (p === "bank-transfer") return "Paid by bank transfer — Hnry business account";
    if (p === "invoice") return "Payment on invoice — 5-day terms";
  } catch { /* fall through */ }
  return "Paid — thank you";
}

export async function receiptPdfBuffer(lead: ReceiptLead): Promise<Buffer> {
  const PDF = await loadPdfKit();
  const ref = bookingReference(lead as never);
  let breakdown: Breakdown = {};
  try {
    // quoteJson is stored as a wrapper: { input: {...}, breakdown: {...} }
    const parsed = JSON.parse(lead.quoteJson) as { breakdown?: Breakdown } & Breakdown;
    breakdown = parsed.breakdown ?? parsed;
  } catch { /* fall through */ }
  const lines = [...(breakdown.lines ?? [])];
  const travelFee = breakdown.travelFee ?? 0;
  const where = [lead.address, lead.suburb].filter(Boolean).join(", ");
  // Every discount shows as its own line, so the receipt always adds up
  // exactly to the total paid. (Discounts live on the breakdown, not in
  // `lines`, apart from the cross-sell line which is already there.)
  if (breakdown.rugDiscount) lines.push({ label: "Bulk rug discount", amount: -breakdown.rugDiscount });
  if (breakdown.maintenanceDiscount) lines.push({ label: "2-cleans-a-year plan discount", amount: -breakdown.maintenanceDiscount });
  if (breakdown.codeDiscount) lines.push({ label: "Discount code", amount: -breakdown.codeDiscount });
  if (breakdown.seasonalDiscount) lines.push({ label: `${breakdown.seasonalPromo?.label ?? "Seasonal deal"} — ${breakdown.seasonalPromo?.percent ?? ""}% off`.replace(" — %", ""), amount: -breakdown.seasonalDiscount });
  if (breakdown.volumeDiscount) lines.push({ label: "Volume discount ($10 off every $150)", amount: -breakdown.volumeDiscount });
  if (breakdown.undercutDiscount) lines.push({ label: "Price-beat discount", amount: -breakdown.undercutDiscount });
  // If the minimum charge lifted the total past the listed lines, show the
  // top-up as its own line.
  const listed = lines.reduce((s, l) => s + l.amount, 0) + travelFee;
  const gap = Math.round((lead.total - listed) * 100) / 100;
  if (gap > 0.009) lines.push({ label: "Minimum charge adjustment", amount: gap });
  if (lines.length === 0) lines.push({ label: "Cleaning services", amount: lead.total });

  return new Promise((resolve, reject) => {
    const doc = new PDF({ size: "A4", margin: MARGIN, info: { Title: `Receipt ${ref} — ${BUSINESS.legalName}` } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ── Branded header band ─────────────────────────────────────────
    doc.rect(0, 0, PAGE_W, 108).fill(BRAND.light);
    doc.image(brandLogo(), 44, 18, { height: 72 });
    doc.font("Helvetica-Bold").fontSize(24).fillColor(BRAND.charcoal)
      .text("RECEIPT", 132, 24, { width: PAGE_W - 132 - 40 });
    doc.font("Helvetica-Bold").fontSize(12).fillColor(BRAND.blue)
      .text(`${BUSINESS.legalName} — Armidale NSW`, 132, 54, { width: PAGE_W - 132 - 40 });
    doc.font("Helvetica").fontSize(9.5).fillColor(BRAND.grey)
      .text(`${BUSINESS.abn}  ·  ${BUSINESS.phone}  ·  ${BUSINESS.email}`, 132, 72, { width: PAGE_W - 132 - 40 });
    doc.rect(0, 108, PAGE_W, 3).fill(BRAND.blue);

    // Every row uses explicit coordinates and a cursor we control —
    // pdfkit's continued/flow positioning is too fragile for forms.
    let y = 136;
    const row = (label: string, value: string, opts?: { bold?: boolean; valueGrey?: boolean }) => {
      doc.font("Helvetica-Bold").fontSize(10).fillColor(BRAND.grey).text(label, MARGIN, y, { width: 130, lineBreak: false });
      doc.font(opts?.bold ? "Helvetica-Bold" : "Helvetica").fontSize(10)
        .fillColor(opts?.valueGrey ? BRAND.grey : BRAND.charcoal)
        .text(value, MARGIN + 140, y, { width: CONTENT_W - 140 });
      y = doc.y + 5;
    };

    // ── Details block ───────────────────────────────────────────────
    row("Receipt no.", ref);
    row("Job date", jobDateOf(lead));
    // Agency work-order number (12 Nov 2026) — same matching aid as the invoice.
    const wo = workOrderNumberOf(lead);
    if (wo) row("Work order", wo, { bold: true });
    y += 8;

    // ── Properly addressed to the customer (same addressee block as
    //  the invoice, 11 Nov 2026) — not a flat "Customer:" row. ────────
    doc.font("Helvetica-Bold").fontSize(11).fillColor(BRAND.blue).text("Receipt for", MARGIN, y, { width: CONTENT_W });
    y = doc.y + 3;
    // Agency jobs: made out to the tenant/owner (booking.invoiceTo), not the
    // agency contact the email went to (12 Nov 2026).
    doc.font("Helvetica-Bold").fontSize(12).fillColor(BRAND.charcoal).text(invoiceAddressee(lead), MARGIN, y, { width: CONTENT_W });
    y = doc.y + 1;
    if (where) {
      doc.font("Helvetica").fontSize(10).fillColor(BRAND.charcoal).text(where, MARGIN, y, { width: CONTENT_W });
      y = doc.y + 1;
    }
    y += 12;

    // ── Line items ──────────────────────────────────────────────────
    doc.font("Helvetica-Bold").fontSize(11).fillColor(BRAND.blue).text("What was done", MARGIN, y, { width: CONTENT_W });
    y = doc.y + 10;
    for (const l of lines) {
      doc.font("Helvetica").fontSize(10).fillColor(BRAND.charcoal).text(l.label, MARGIN, y, { width: 360 });
      const labelBottom = doc.y;
      doc.font("Helvetica").fontSize(10).fillColor(BRAND.charcoal).text(money(l.amount), RIGHT - 103, y, { width: 103, align: "right" });
      y = Math.max(labelBottom, doc.y) + 6;
    }
    if (travelFee > 0) {
      doc.font("Helvetica").fontSize(10).fillColor(BRAND.charcoal).text("Travel", MARGIN, y, { width: 360 });
      const travelBottom = doc.y;
      doc.font("Helvetica").fontSize(10).fillColor(BRAND.charcoal).text(money(travelFee), RIGHT - 103, y, { width: 103, align: "right" });
      y = Math.max(travelBottom, doc.y) + 6;
    }
    y += 6;

    // ── Total box ───────────────────────────────────────────────────
    doc.rect(MARGIN, y, CONTENT_W, 30).fill(BRAND.light);
    doc.rect(MARGIN, y, 3, 30).fill(BRAND.blue);
    doc.font("Helvetica-Bold").fontSize(12).fillColor(BRAND.charcoal).text("Total", MARGIN + 14, y + 9, { width: 300, lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(12).fillColor(BRAND.blue).text(money(lead.total), RIGHT - 117, y + 9, { width: 103, align: "right" });
    y += 44;

    // ── Payment ─────────────────────────────────────────────────────
    row("Payment", paymentLineOf(lead));
    y += 12;
    doc.font("Helvetica").fontSize(9).fillColor(BRAND.grey)
      .text("No GST has been charged — not registered for GST.", MARGIN, y, { width: CONTENT_W });

    // ── Van banner anchored to the bottom of the page ───────────────
    const vanW = CONTENT_W;
    const vanH = Math.round((vanW * 753) / 1400);
    const vanY = PAGE_H - 40 - vanH;
    doc.image(brandVan(), MARGIN, vanY, { width: vanW });
    doc.font("Helvetica-Oblique").fontSize(10).fillColor(BRAND.blue)
      .text("Thanks for having us — see you next clean.", MARGIN, vanY - 22, { width: CONTENT_W, align: "center" });
    doc.end();
  });
}
