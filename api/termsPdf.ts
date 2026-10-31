/**
 * Builds the Terms & Conditions PDF from contracts/terms.ts — the same
 * source as the /terms page, so the attachment can never drift out of date.
 * Generated once and cached in memory.
 *
 * pdfkit is loaded at runtime from node_modules rather than bundled:
 * its own `import { createRequire } from "module"` collides with the
 * esbuild bundle banner. node_modules is present wherever the server runs.
 */
import type PDFDocumentT from "pdfkit";
import { TERMS_HEADER, TERMS_SECTIONS } from "@contracts/terms";
import { BRAND, brandLogo, brandVan } from "./brand";

let PDFDocument: typeof PDFDocumentT | null = null;
let cached: Buffer | null = null;

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;

async function loadPdfKit(): Promise<typeof PDFDocumentT> {
  if (!PDFDocument) {
    // Indirect dynamic import so the bundler leaves pdfkit in node_modules.
    const dynamicImport = new Function("s", "return import(s)") as (s: string) => Promise<{ default: typeof PDFDocumentT }>;
    PDFDocument = (await dynamicImport("pdfkit")).default;
  }
  return PDFDocument;
}

export async function termsPdfBuffer(): Promise<Buffer> {
  if (cached) return cached;
  const PDF = await loadPdfKit();
  return new Promise((resolve, reject) => {
    const doc = new PDF({ size: "A4", margin: MARGIN, info: { Title: `${TERMS_HEADER.title} — ${TERMS_HEADER.business}` } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => { cached = Buffer.concat(chunks); resolve(cached); });
    doc.on("error", reject);

    // ── Branded header band (page 1) ────────────────────────────────
    doc.rect(0, 0, PAGE_W, 108).fill(BRAND.light);
    doc.image(brandLogo(), 44, 18, { height: 72 });
    doc.font("Helvetica-Bold").fontSize(15).fillColor(BRAND.blue)
      .text(TERMS_HEADER.business, 132, 30, { width: PAGE_W - 132 - 40 });
    doc.font("Helvetica").fontSize(9.5).fillColor(BRAND.grey)
      .text(`${TERMS_HEADER.abn}  ·  ${TERMS_HEADER.phone}  ·  ${TERMS_HEADER.email}`, 132, 52, { width: PAGE_W - 132 - 40 });
    doc.font("Helvetica-Bold").fontSize(19).fillColor(BRAND.charcoal)
      .text(TERMS_HEADER.title, 132, 72, { width: PAGE_W - 132 - 40 });
    doc.rect(0, 108, PAGE_W, 3).fill(BRAND.blue);

    doc.y = 136;
    doc.font("Helvetica").fontSize(9.5).fillColor(BRAND.grey)
      .text(`Last updated: ${TERMS_HEADER.updated}`, MARGIN, doc.y, { width: CONTENT_W });
    doc.moveDown(0.8);

    // ── Sections ────────────────────────────────────────────────────
    for (const s of TERMS_SECTIONS) {
      doc.font("Helvetica-Bold").fontSize(12.5).fillColor(BRAND.blue).text(s.title, { continued: false });
      doc.moveDown(0.35);
      for (const part of s.body) {
        if (typeof part === "string") {
          doc.font("Helvetica").fontSize(10).fillColor(BRAND.charcoal)
            .text(part, { lineGap: 2.5, align: "left" });
          doc.moveDown(0.35);
        } else {
          for (const b of part.bullets) {
            doc.font("Helvetica").fontSize(10).fillColor(BRAND.charcoal)
              .text(`•  ${b}`, { indent: 14, lineGap: 2.5 });
          }
          doc.moveDown(0.35);
        }
      }
      doc.moveDown(0.55);
    }

    // ── Sign-off + van banner, filling out the last page ────────────
    const vanW = CONTENT_W;
    const vanH = Math.round((vanW * 753) / 1400);
    const signoffH = 30;
    const needed = vanH + signoffH + 20;
    if (doc.y > PAGE_H - MARGIN - needed) doc.addPage();
    doc.moveDown(0.4);
    doc.font("Helvetica-Oblique").fontSize(9.5).fillColor(BRAND.grey).text(
      `${TERMS_HEADER.business} — ${TERMS_HEADER.phone} — ${TERMS_HEADER.email}`,
      MARGIN, doc.y, { width: CONTENT_W, align: "center" },
    );
    doc.moveDown(0.8);
    doc.image(brandVan(), MARGIN, doc.y, { width: vanW });
    doc.end();
  });
}
