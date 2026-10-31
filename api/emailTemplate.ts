/**
 * Branded HTML wrapper for customer emails — logo header, blue palette,
 * van banner and a formal footer with the registered name and ABN.
 * Images ride along as CID inline attachments (see deliver/sendReceiptFor),
 * so nothing depends on hosted files.
 */
import { BUSINESS } from "@contracts/rates";
import { BRAND } from "./brand";

function esc(s: string): string {
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
export const EMAIL_CID = { logo: "brand-logo@marshalls", van: "brand-van@marshalls" } as const;

export function brandedEmailHtml(text: string): string {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f6f8">
<div style="max-width:600px;margin:0 auto;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:${BRAND.charcoal}">
  <div style="background:${BRAND.light};padding:16px 24px;border-bottom:3px solid ${BRAND.blue}">
    <img src="cid:${EMAIL_CID.logo}" width="54" alt="" style="vertical-align:middle">
    <span style="display:inline-block;vertical-align:middle;margin-left:12px;font-size:17px;font-weight:bold;color:${BRAND.blue}">${esc(BUSINESS.name)}</span>
  </div>
  <div style="padding:20px 28px 8px">
    ${bodyToHtml(text)}
  </div>
  <img src="cid:${EMAIL_CID.van}" width="600" alt="The Marshall's Carpet Cleaning van" style="width:100%;display:block;margin-top:14px">
  <div style="background:${BRAND.blue};color:#ffffff;padding:14px 24px;font-size:12px;line-height:1.6;text-align:center">
    <strong>${esc(BUSINESS.legalName)}</strong> — Armidale NSW · ${esc(BUSINESS.abn)}<br>
    ${esc(BUSINESS.phone)} · ${esc(BUSINESS.email)}
  </div>
</div>
</body></html>`;
}
