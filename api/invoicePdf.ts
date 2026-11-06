/**
 * Builds the invoice PDF for a completed-but-unpaid job: reference, dates,
 * customer, address, itemised breakdown from the stored quote, total due and
 * how to pay (PayID / bank transfer / card link). Sent in the 5pm batch for
 * jobs that haven't been paid, and from the board's "Send invoice" button.
 *
 * pdfkit is loaded at runtime from node_modules rather than bundled:
 * its own `import { createRequire } from "module"` collides with the
 * esbuild bundle banner. node_modules is present wherever the server runs.
 */
import type PDFDocumentT from "pdfkit";
import { BUSINESS, rugReturnDay } from "@contracts/rates";
import { bookingReference, type LeadRow } from "./messages";
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

export type InvoiceLead = Pick<
  LeadRow,
  "id" | "name" | "address" | "suburb" | "total" | "quoteJson" | "bookingJson"
> & { createdAt: Date | string };

interface Breakdown {
  lines?: { label: string; amount: number }[];
  travelFee?: number;
  total?: number;
  rugDiscount?: number;
  maintenanceDiscount?: number;
  codeDiscount?: number;
  volumeDiscount?: number;
  undercutDiscount?: number;
}

function money(n: number): string {
  return `$${n.toFixed(2).replace(/\.00$/, "")}`;
}

function jobDateOf(lead: InvoiceLead): Date {
  let iso: string | null = null;
  try {
    if (lead.bookingJson) iso = (JSON.parse(lead.bookingJson) as { preferredDate?: string }).preferredDate ?? null;
  } catch { /* fall through */ }
  return iso ? new Date(`${iso}T12:00:00`) : new Date(lead.createdAt);
}

function auDate(d: Date): string {
  return d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function invoiceDueDate(lead: InvoiceLead): Date {
  const d = jobDateOf(lead);
  d.setDate(d.getDate() + 7); // 7-day terms, from the day the job was done
  return d;
}

export async function invoicePdfBuffer(lead: InvoiceLead): Promise<Buffer> {
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
  // Every discount shows as its own line, so the invoice always adds up
  // exactly to the total due. (Discounts live on the breakdown, not in
  // `lines`, apart from the cross-sell line which is already there.)
  if (breakdown.rugDiscount) lines.push({ label: "Bulk rug discount", amount: -breakdown.rugDiscount });
  if (breakdown.maintenanceDiscount) lines.push({ label: "2-cleans-a-year plan discount", amount: -breakdown.maintenanceDiscount });
  if (breakdown.codeDiscount) lines.push({ label: "Discount code", amount: -breakdown.codeDiscount });
  if (breakdown.volumeDiscount) lines.push({ label: "Volume discount ($10 off every $150)", amount: -breakdown.volumeDiscount });
  if (breakdown.undercutDiscount) lines.push({ label: "Price-beat discount", amount: -breakdown.undercutDiscount });
  // If the minimum charge lifted the total past the listed lines, show the
  // top-up as its own line.
  const listed = lines.reduce((s, l) => s + l.amount, 0) + travelFee;
  const gap = Math.round((lead.total - listed) * 100) / 100;
  if (gap > 0.009) lines.push({ label: "Minimum charge adjustment", amount: gap });
  if (lines.length === 0) lines.push({ label: "Cleaning services", amount: lead.total });

  return new Promise((resolve, reject) => {
    const doc = new PDF({ size: "A4", margin: MARGIN, info: { Title: `Invoice ${ref} — ${BUSINESS.legalName}` } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ── Branded header band ─────────────────────────────────────────
    doc.rect(0, 0, PAGE_W, 108).fill(BRAND.light);
    doc.image(brandLogo(), 44, 18, { height: 72 });
    doc.font("Helvetica-Bold").fontSize(24).fillColor(BRAND.charcoal)
      .text("INVOICE", 132, 24, { width: PAGE_W - 132 - 40 });
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
    row("Invoice no.", ref);
    row("Job date", auDate(jobDateOf(lead)));
    row("Customer", lead.name);
    if (where) row("Service address", where);
    y += 14;

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

    // ── Total-due box ───────────────────────────────────────────────
    doc.rect(MARGIN, y, CONTENT_W, 30).fill(BRAND.light);
    doc.rect(MARGIN, y, 3, 30).fill(BRAND.blue);
    doc.font("Helvetica-Bold").fontSize(12).fillColor(BRAND.charcoal).text("Total due", MARGIN + 14, y + 9, { width: 300, lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(12).fillColor(BRAND.blue).text(money(lead.total), RIGHT - 117, y + 9, { width: 103, align: "right" });
    y += 44;

    // ── How to pay ──────────────────────────────────────────────────
    doc.font("Helvetica-Bold").fontSize(11).fillColor(BRAND.blue).text("How to pay", MARGIN, y, { width: CONTENT_W });
    y = doc.y + 8;
    const payLines = [
      `PayID (instant bank transfer): ${BUSINESS.payId}`,
      `Bank transfer: contact us for the account details`,
      `Card: use the secure payment link in the email this invoice came with`,
    ];
    for (const p of payLines) {
      doc.font("Helvetica").fontSize(10).fillColor(BRAND.charcoal).text(`•  ${p}`, MARGIN, y, { width: CONTENT_W });
      y = doc.y + 4;
    }
    y += 4;
    // Loud payment reference — customers paying by PayID/bank quote this in
    // the description, so it has to be unmissable: big, red, underlined.
    doc.rect(MARGIN, y, CONTENT_W, 48).fill("#FEF2F2");
    doc.rect(MARGIN, y, 3, 48).fill("#B91C1C");
    doc.font("Helvetica-Bold").fontSize(9).fillColor(BRAND.grey)
      .text("PAYMENT REFERENCE — PUT THIS IN THE PAYMENT DESCRIPTION", MARGIN + 14, y + 8, { width: CONTENT_W - 28, lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(19).fillColor("#B91C1C")
      .text(ref, MARGIN + 14, y + 21, { width: CONTENT_W - 28, lineBreak: false, underline: true });
    y += 48 + 10;
    row("Terms", `5 days — due ${auDate(invoiceDueDate(lead))}`, { bold: true });
    y += 10;
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
