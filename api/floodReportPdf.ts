/**
 * Builds the flood & water damage job report PDF: what happened, what was
 * done, moisture/drying status, and the itemised charges at our published
 * flood rates. Written for the customer's insurer — registered business
 * name and ABN on the header, no marketing furniture.
 *
 * pdfkit is loaded at runtime from node_modules rather than bundled (see
 * receiptPdf.ts for why).
 */
import type PDFDocumentT from "pdfkit";
import { BUSINESS, money as moneyFmt, type FloodPrices } from "@contracts/rates";
import { bookingReference, type FloodRequest, type LeadRow } from "./messages";
import { BRAND, brandLogo } from "./brand";

let PDFDocument: typeof PDFDocumentT | null = null;

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;
const RIGHT = PAGE_W - MARGIN;

async function loadPdfKit(): Promise<typeof PDFDocumentT> {
  if (!PDFDocument) {
    const dynamicImport = new Function("s", "return import(s)") as (s: string) => Promise<{ default: typeof PDFDocumentT }>;
    PDFDocument = (await dynamicImport("pdfkit")).default;
  }
  return PDFDocument;
}

/** The report blob stored inside the lead's quoteJson.floodReport. */
export interface FloodReportData {
  attendedAt: string; // yyyy-mm-dd
  technicians: number;
  standardHours: number;
  afterHoursHours: number;
  saturdayHours?: number; // weekend bands added 12 Nov 2026
  sundayHours?: number;
  travelKm?: number; // distance from Armidale, insurer-itemised
  travelHours?: number; // technician time on the road
  adminCharged?: boolean; // administration & coordination fee
  reportCharged?: boolean; // written insurer report fee
  fans: number;
  fanDays: number;
  inspectionCharged: boolean;
  summary: string; // what we found on arrival
  workDone: string; // extraction, drying, treatment
  readings: string; // moisture readings / drying status
  insurerNotes: string; // optional, for the assessor
  rates: FloodPrices; // prices in force when the report was saved
  savedAt: string;
  emailedAt?: string;
}

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/** pdfkit's built-in Helvetica is WinAnsi-only — arrows and emoji would
 *  render as garbage, so map or strip them before they hit the page. */
function safe(text: string): string {
  return text.replace(/→/g, "->").replace(/[←↑↓]/g, "-").replace(/[^\x20-\x7E\u0080-\u00FF\u2018\u2019\u201C\u201D\u2013\u2014\u2026]/g, " ");
}

export async function floodReportPdfBuffer(
  lead: Pick<LeadRow, "id" | "name" | "address" | "suburb" | "phone" | "email">,
  flood: FloodRequest | null,
  report: FloodReportData,
  lines: { label: string; amount: number }[],
  total: number,
): Promise<Buffer> {
  const PDF = await loadPdfKit();
  const ref = bookingReference({ id: lead.id } as never);
  const where = [lead.address, lead.suburb].filter(Boolean).join(", ");

  return new Promise((resolve, reject) => {
    const doc = new PDF({ size: "A4", margin: MARGIN, info: { Title: `Flood report ${ref} — ${BUSINESS.legalName}` } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ── Branded header band ─────────────────────────────────────────
    doc.rect(0, 0, PAGE_W, 108).fill(BRAND.light);
    doc.image(brandLogo(), 44, 18, { height: 72 });
    doc.font("Helvetica-Bold").fontSize(20).fillColor(BRAND.charcoal)
      .text("FLOOD & WATER DAMAGE REPORT", 132, 24, { width: PAGE_W - 132 - 40 });
    doc.font("Helvetica-Bold").fontSize(12).fillColor(BRAND.blue)
      .text(`${BUSINESS.legalName} — Armidale NSW`, 132, 54, { width: PAGE_W - 132 - 40 });
    doc.font("Helvetica").fontSize(9.5).fillColor(BRAND.grey)
      .text(`${BUSINESS.abn}  ·  ${BUSINESS.phone}  ·  ${BUSINESS.email}`, 132, 72, { width: PAGE_W - 132 - 40 });
    doc.rect(0, 108, PAGE_W, 3).fill(BRAND.blue);

    let y = 136;
    const row = (label: string, value: string) => {
      doc.font("Helvetica-Bold").fontSize(10).fillColor(BRAND.grey).text(label, MARGIN, y, { width: 130, lineBreak: false });
      doc.font("Helvetica").fontSize(10).fillColor(BRAND.charcoal).text(safe(value), MARGIN + 140, y, { width: CONTENT_W - 140 });
      y = doc.y + 5;
    };
    const section = (title: string, body: string) => {
      if (!body.trim()) return;
      if (y > PAGE_H - 160) { doc.addPage(); y = MARGIN; }
      doc.font("Helvetica-Bold").fontSize(11).fillColor(BRAND.blue).text(title, MARGIN, y, { width: CONTENT_W });
      y = doc.y + 6;
      doc.font("Helvetica").fontSize(10).fillColor(BRAND.charcoal).text(safe(body.trim()), MARGIN, y, { width: CONTENT_W, lineGap: 2 });
      y = doc.y + 14;
    };

    // ── Details block ───────────────────────────────────────────────
    row("Report ref.", ref);
    row("Report date", fmtDate(report.savedAt.slice(0, 10)));
    row("Date attended", fmtDate(report.attendedAt));
    row("Customer", lead.name);
    if (where) row("Property", where);
    row("Contact", [lead.phone, lead.email].filter(Boolean).join("  ·  "));
    y += 12;

    // ── Emergency details (from the customer's request) ─────────────
    if (flood) {
      doc.font("Helvetica-Bold").fontSize(11).fillColor(BRAND.blue).text("Emergency details", MARGIN, y, { width: CONTENT_W });
      y = doc.y + 8;
      row("Cause of water", flood.cause);
      row("Area affected", flood.rooms);
      row("Leak on arrival", flood.activeLeak);
      row("Insurance claim", flood.insurance);
      if (flood.notes) row("Reported notes", flood.notes);
      y += 12;
    }

    // ── Narrative sections ──────────────────────────────────────────
    section("What we found", report.summary);
    section("Work performed", report.workDone);
    section("Moisture readings & drying status", report.readings);
    section("Notes for the insurer", report.insurerNotes);

    // ── Attendance & equipment summary ──────────────────────────────
    if (y > PAGE_H - 200) { doc.addPage(); y = MARGIN; }
    doc.font("Helvetica-Bold").fontSize(11).fillColor(BRAND.blue).text("Attendance & equipment", MARGIN, y, { width: CONTENT_W });
    y = doc.y + 8;
    row("Technicians on site", String(report.technicians));
    row("Standard hours", `${report.standardHours}h`);
    if (report.afterHoursHours > 0) row("After-hours (Mon–Fri 7 PM – 7 AM)", `${report.afterHoursHours}h`);
    if ((report.saturdayHours ?? 0) > 0) row("Saturday hours", `${report.saturdayHours}h`);
    if ((report.sundayHours ?? 0) > 0) row("Sunday hours", `${report.sundayHours}h`);
    if ((report.travelKm ?? 0) > 0) {
      row("Travel", `${report.travelKm} km from Armidale${(report.travelHours ?? 0) > 0 ? ` · ${report.travelHours}h on the road` : ""}`);
    }
    if (report.fans > 0) row("Drying fans", `${report.fans} fan${report.fans > 1 ? "s" : ""} × ${report.fanDays} day${report.fanDays > 1 ? "s" : ""}`);
    y += 12;

    // ── Charges ─────────────────────────────────────────────────────
    if (y > PAGE_H - 220) { doc.addPage(); y = MARGIN; }
    doc.font("Helvetica-Bold").fontSize(11).fillColor(BRAND.blue).text("Charges", MARGIN, y, { width: CONTENT_W });
    y = doc.y + 10;
    for (const l of lines) {
      doc.font("Helvetica").fontSize(10).fillColor(BRAND.charcoal).text(safe(l.label), MARGIN, y, { width: 360 });
      const labelBottom = doc.y;
      doc.font("Helvetica").fontSize(10).fillColor(BRAND.charcoal).text(moneyFmt(l.amount), RIGHT - 103, y, { width: 103, align: "right" });
      y = Math.max(labelBottom, doc.y) + 6;
    }
    y += 6;
    doc.rect(MARGIN, y, CONTENT_W, 30).fill(BRAND.light);
    doc.rect(MARGIN, y, 3, 30).fill(BRAND.blue);
    doc.font("Helvetica-Bold").fontSize(12).fillColor(BRAND.charcoal).text("Total", MARGIN + 14, y + 9, { width: 300, lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(12).fillColor(BRAND.blue).text(moneyFmt(total), RIGHT - 117, y + 9, { width: 103, align: "right" });
    y += 48;

    doc.font("Helvetica").fontSize(9).fillColor(BRAND.grey)
      .text("Charged at our published flood restoration rates. No GST has been charged — not registered for GST.", MARGIN, y, { width: CONTENT_W });
    y = doc.y + 8;
    doc.font("Helvetica").fontSize(9).fillColor(BRAND.grey)
      .text("Questions about this report: " + `${BUSINESS.phone}  ·  ${BUSINESS.email}`, MARGIN, y, { width: CONTENT_W });

    doc.end();
  });
}
