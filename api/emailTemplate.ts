/**
 * Branded HTML wrapper for customer emails — logo header, blue palette
 * and a formal footer with the registered name and ABN. The logo rides
 * along as a CID inline attachment, so nothing depends on hosted files.
 * Deliberately image-light: heavy HTML emails with big banners trip
 * content filters (Bigpond's IB703 bounce), so the van photo stays in
 * the PDFs and on the site, not in the email body.
 */
import { BUSINESS, money } from "@contracts/rates";
import { BRAND } from "./brand";

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function linkify(s: string): string {
  return s.replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" style="color:${BRAND.blue}">${u}</a>`);
}

/** Plain-text email body → branded HTML blocks (bullets, section headings). */
function bodyToHtml(text: string): string {
  let html = "";
  let inList = false;
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (/^•\s+/.test(line)) {
      if (!inList) { html += `<ul style="margin:6px 0 6px;padding-left:20px">`; inList = true; }
      html += `<li style="margin:3px 0;font-size:14px;line-height:1.5">${linkify(esc(line.replace(/^•\s+/, "")))}</li>`;
      continue;
    }
    if (inList) { html += "</ul>"; inList = false; }
    if (!line.trim()) continue;
    if (/^[A-Z0-9][A-Z0-9 &—\-()]{2,}$/.test(line.trim())) {
      html += `<div style="margin:18px 0 4px;font-size:13px;font-weight:bold;letter-spacing:1px;color:${BRAND.blue}">${esc(line.trim())}</div>`;
    } else {
      html += `<p style="margin:10px 0;font-size:14px;line-height:1.55">${linkify(esc(line))}</p>`;
    }
  }
  if (inList) html += "</ul>";
  return html;
}

/** CID references used by the inline attachments. */
export const EMAIL_CID = { logo: "brand-logo@marshalls" } as const;

/** The shared branded frame — logo header + registered-name footer. */
export function emailFrame(innerHtml: string): string {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f6f8">
<div style="max-width:600px;margin:0 auto;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:${BRAND.charcoal}">
  <div style="background:${BRAND.light};padding:16px 24px;border-bottom:3px solid ${BRAND.blue}">
    <img src="cid:${EMAIL_CID.logo}" width="54" alt="" style="vertical-align:middle">
    <span style="display:inline-block;vertical-align:middle;margin-left:12px;font-size:17px;font-weight:bold;color:${BRAND.blue}">${esc(BUSINESS.name)}</span>
  </div>
  <div style="padding:20px 28px 16px">
    ${innerHtml}
  </div>
  <div style="background:${BRAND.blue};color:#ffffff;padding:14px 24px;font-size:12px;line-height:1.6;text-align:center">
    <strong>${esc(BUSINESS.legalName)}</strong> — Armidale NSW · ${esc(BUSINESS.abn)}<br>
    ${esc(BUSINESS.phone)} · ${esc(BUSINESS.email)}
  </div>
</div>
</body></html>`;
}

export function brandedEmailHtml(text: string): string {
  return emailFrame(bodyToHtml(text));
}

// ---------------------------------------------------------------------------
// Formal quotation email (admin "New quote" → email it to them). Built 9 Nov
// 2026 after Ben sent the Town and Country Real Estate quote with no property
// address and a cramped layout: every part of the clean now sits in its own
// spaced, blue-bordered box, discounts are shown so the maths adds up, the
// recommended package + total sit in a green-bordered box with the total in
// large type, and the property address is up top — agents file by address.
// ---------------------------------------------------------------------------

export interface QuoteEmailData {
  name: string;
  reference: string;
  lines: { label: string; detail?: string; amount: number }[];
  /** Money-off rows (positive amounts, shown as −$X) so total = lines − discounts. */
  discounts?: { label: string; amount: number }[];
  total: number;
  travelFee: number;
  town?: string | null;
  address?: string | null;
  suburb?: string | null;
  /** When the quote was first issued; "valid 30 days" counts from here. */
  issuedAt?: Date | string;
  /** One-line reason this package is recommended; sensible default if omitted. */
  recommendation?: string;
}

export const QUOTE_GREEN = "#15803D";
export const QUOTE_GREEN_BG = "#F0FDF4";
export const QUOTE_GREEN_SOFT = "#BBF7D0";

/** "166 Taylor St, Armidale NSW 2350, Australia" → "166 Taylor St, Armidale". */
export function shortAddress(address: string): string {
  return address.replace(/,?\s*(NSW\s*\d{4})?,?\s*Australia\s*$/i, "").trim();
}

function auDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Australia/Sydney",
  });
}

function quoteItemBox(label: string, detail: string | undefined, amount: number): string {
  return `<div style="border:1.5px solid ${BRAND.blue};border-radius:8px;padding:14px 16px;margin:0 0 14px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:15px;font-weight:bold;color:${BRAND.charcoal};vertical-align:top">${esc(label)}</td>
      <td style="font-size:16px;font-weight:bold;color:${BRAND.blue};text-align:right;vertical-align:top;white-space:nowrap;padding-left:16px">${amount < 0 ? `−${money(-amount)}` : money(amount)}</td>
    </tr></table>
    ${detail ? `<div style="font-size:13px;color:${BRAND.grey};line-height:1.5;margin-top:4px">${esc(detail)}</div>` : ""}
  </div>`;
}

/** The formal quotation body — used inside emailFrame. */
export function quoteBodyHtml(d: QuoteEmailData): string {
  const issued = d.issuedAt ? new Date(d.issuedAt) : new Date();
  const validTo = new Date(issued.getTime() + 30 * 24 * 60 * 60 * 1000);
  const addr = d.address?.trim() || "";
  const propertyLine = addr || [d.suburb, d.town].filter(Boolean).join(", ");
  const items = d.lines.map((l) => quoteItemBox(l.label, l.detail, l.amount)).join("\n");
  const travel =
    d.travelFee > 0
      ? quoteItemBox(`Travel${d.town ? ` — ${d.town}` : ""}`, "Return trip, equipment and setup", d.travelFee)
      : "";
  const discounts = (d.discounts ?? []).filter((x) => x.amount > 0);
  const savings = discounts.length
    ? `<div style="margin:2px 0 16px">
        <div style="font-size:12px;font-weight:bold;letter-spacing:1px;color:${QUOTE_GREEN};margin-bottom:6px">SAVINGS APPLIED</div>
        ${discounts
          .map(
            (x) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0"><tr>
              <td style="font-size:13.5px;color:${BRAND.charcoal}">${esc(x.label)}</td>
              <td style="font-size:14px;font-weight:bold;color:${QUOTE_GREEN};text-align:right;white-space:nowrap;padding-left:16px">−${money(x.amount)}</td>
            </tr></table>`,
          )
          .join("\n")}
      </div>`
    : "";
  const recommendation =
    d.recommendation?.trim() ||
    "The complete package above — each part priced separately, all done in the one visit.";
  const greeting = d.name.trim().split(/\s+/).length > 2 ? "Hello" : `Hi ${esc(d.name.trim().split(/\s+/)[0])}`;

  return `
  <div style="font-size:22px;font-weight:bold;letter-spacing:2px;color:${BRAND.charcoal}">QUOTATION</div>
  <div style="font-size:13px;color:${BRAND.grey};margin:4px 0 18px">
    Reference <strong>${esc(d.reference)}</strong> &nbsp;·&nbsp; Issued ${auDate(issued)} &nbsp;·&nbsp; Valid to ${auDate(validTo)}
  </div>

  <div style="background:${BRAND.light};border-radius:8px;padding:14px 16px;margin:0 0 20px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-size:12px;font-weight:bold;letter-spacing:1px;color:${BRAND.blue};width:110px;vertical-align:top">PREPARED FOR</td>
        <td style="font-size:14.5px;font-weight:bold;color:${BRAND.charcoal}">${esc(d.name)}</td>
      </tr>
      ${
        propertyLine
          ? `<tr>
        <td style="font-size:12px;font-weight:bold;letter-spacing:1px;color:${BRAND.blue};vertical-align:top;padding-top:10px">PROPERTY</td>
        <td style="font-size:14.5px;font-weight:bold;color:${BRAND.charcoal};padding-top:10px">${esc(propertyLine)}</td>
      </tr>`
          : ""
      }
    </table>
  </div>

  <p style="font-size:14px;line-height:1.6;margin:0 0 18px">${greeting},<br><br>
  Thanks for the opportunity to quote${propertyLine ? " this property" : ""} — here it is in writing, with each part of the job set out separately.</p>

  ${items}
  ${travel}
  ${savings}

  <div style="border:2.5px solid ${QUOTE_GREEN};border-radius:10px;background:${QUOTE_GREEN_BG};padding:16px 20px;margin:6px 0 20px">
    <div style="font-size:12px;font-weight:bold;letter-spacing:1px;color:${QUOTE_GREEN}">✔ &nbsp;RECOMMENDED FOR THIS PROPERTY</div>
    <div style="font-size:14px;line-height:1.55;color:${BRAND.charcoal};margin:8px 0 12px">${esc(recommendation)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-size:13px;font-weight:bold;letter-spacing:1px;color:${BRAND.grey};vertical-align:middle">TOTAL</td>
        <td style="font-size:30px;font-weight:bold;color:${BRAND.charcoal};text-align:right;vertical-align:middle">${money(d.total)}</td>
      </tr>
    </table>
  </div>

  <p style="font-size:13.5px;line-height:1.6;color:${BRAND.grey};margin:0 0 18px">
  Every clean includes a commercial pre-vacuum and pre-spray, and the price above is the price on the day — no surprises. The work is covered by our 7-day fix-it promise: if anything isn't right, we come back and put it right, free.</p>

  <div style="background:${BRAND.light};border-radius:8px;padding:14px 16px;margin:0 0 8px">
    <div style="font-size:14px;line-height:1.6;color:${BRAND.charcoal}">
    <strong>Ready to lock it in?</strong> Call or text
    <a href="tel:+61423581223" style="color:${BRAND.blue};font-weight:bold">${esc(BUSINESS.phone)}</a>,
    or just reply to this email quoting <strong>${esc(d.reference)}</strong> and we'll find a day that suits.
    No date is locked in yet — this price is held for 30 days from the issue date.</div>
  </div>

  <p style="font-size:14px;line-height:1.6;margin:18px 0 0">Kind regards,<br>
  <strong>The ${esc(BUSINESS.name)} team</strong></p>`;
}

export function quoteEmailHtmlForCustomer(d: QuoteEmailData): string {
  return emailFrame(quoteBodyHtml(d));
}
