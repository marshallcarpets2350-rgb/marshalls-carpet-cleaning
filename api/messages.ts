// Customer messages — booking confirmations and post-job thank-you/review.
// Email goes through the Gmail SMTP settings; SMS goes through Twilio when
// the keys are saved in Settings. Nothing here ever names the operator —
// messages come from "Marshall's Carpet Cleaning" / "the Marshall's team".
import {
  BUSINESS,
  HOME_BASE,
  SLOT_MINUTES,
  SLOT_START_MINUTES,
  TIME_SLOTS,
  TIME_MODEL,
  clockLabel,
  firstNameOf,
  longDateLabel,
  money,
  promoText,
  slotsNeededFor,
  serviceSummary,
  serviceKinds,
  rugReturnDay,
  paymentDueDay,
  type QuoteInput,
} from "@contracts/rates";
import { loadSmtpConfig, isSmtpConfigured, sendMail, type MailAttachment } from "./mailer";
import { termsPdfBuffer } from "./termsPdf";
import { brandedEmailHtml, emailFrame, esc, EMAIL_CID, shortAddress, QUOTE_GREEN, QUOTE_GREEN_BG, type QuoteEmailData } from "./emailTemplate";
import { brandLogo, BRAND } from "./brand";
import { getSettings } from "./queries/settings";

export interface LeadRow {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string | null;
  suburb: string | null;
  total: number;
  quoteJson: string;
  bookingJson: string | null;
  paidOnline: boolean;
  paidOfflineAt?: Date | string | null;
  createdAt?: Date | string;
}

interface BookingDetails {
  preferredDate: string | null;
  preferredSlot: number | null;
  confirmBy: "either" | "phone" | "email";
  payment: "pay-now" | "payid" | "bank-transfer" | "invoice" | "cash" | null;
  town: string;
  jobMinutes: number;
  rugPickup: boolean;
  // 2-cleans-a-year plan — visit 2 rides on the first booking's record (and
  // lands as its own booking row the moment it's accepted).
  secondVisit?: { date: string; slot: number } | null;
  notes?: string;
  access?: {
    method: "be-there" | "agent" | "lockbox" | "someone-else" | "leave-out" | null;
    agency?: string;
    spot?: string;
    code?: string;
    name?: string;
    mobile?: string;
    parking?: "close" | "stairs-or-far" | null;
  };
  /** Agency jobs (12 Nov 2026): invoice/receipt addressee when it's not the
   *  booking contact — tenant/owner name, email still goes to the agency. */
  invoiceTo?: string | null;
  /** Agency work-order number + uploaded document file name (12 Nov 2026). */
  workOrderNumber?: string | null;
  workOrderDoc?: string | null;
}

function parseQuote(lead: LeadRow): QuoteInput | null {
  try {
    return (JSON.parse(lead.quoteJson) as { input: QuoteInput }).input;
  } catch {
    return null;
  }
}

export function parseBooking(lead: LeadRow): BookingDetails | null {
  if (!lead.bookingJson) return null;
  try {
    return JSON.parse(lead.bookingJson) as BookingDetails;
  } catch {
    return null;
  }
}

function firstName(name: string): string {
  // Titles stripped, caps fixed — "Mr Rob Smith" greets as "Rob" (11 Nov 2026,
  // after a customer booked as "Mr …" and got "Thanks Mr" on /thanks).
  return firstNameOf(name);
}

function whenLine(b: BookingDetails): string {
  if (!b.preferredDate) return "Time to be confirmed — we'll call you";
  const day = longDateLabel(b.preferredDate);
  if (b.rugPickup) return `${day}, between 3:00 – 5:00 PM (rug pick-up run)`;
  if (b.preferredSlot === null || b.preferredSlot === undefined) return `${day} — arrival to be confirmed`;
  return `${day}, arrival between ${TIME_SLOTS[b.preferredSlot]}`;
}

function paymentLine(b: BookingDetails, lead: LeadRow): string {
  const ref = bookingReference(lead);
  if (lead.paidOnline) return "Paid in full online — thank you";
  if (b.payment === "pay-now") return "Paying online — we'll send the secure link if it hasn't reached you";
  if (b.payment === "payid")
    return `PayID to ${BUSINESS.payId} — instant from your banking app, any time before your clean. Put ${ref} in the description so it lands straight against your job`;
  if (b.payment === "bank-transfer")
    return `Bank transfer to our Hnry business account (BSB ${BUSINESS.bankBsb} · account ${BUSINESS.bankAccount}) — any time before your clean. Put ${ref} in the description so it lands straight against your job`;
  // Legacy choices from before 9 Nov 2026 — kept so their bookings still read right.
  if (b.payment === "invoice")
    return `Invoice after the job (5-day terms) — pay by PayID to ${BUSINESS.payId}, by bank transfer or by card. Put ${ref} in the payment description so it lands straight against your job`;
  return `Pay on the day — cash, or instant bank transfer to our PayID: ${BUSINESS.payId} (put ${ref} in the description)`;
}

export function bookingReference(lead: LeadRow): string {
  return `MCC-${String(lead.id).padStart(4, "0")}`;
}

/** Who the invoice/receipt PDF is made out to. Agency jobs (owner call
 *  12 Nov 2026): the booking contact is often the real estate, but the
 *  paperwork is made out to the tenant or owner while the email passes
 *  through the agency — booking.invoiceTo overrides the booking name. */
export function invoiceAddressee(lead: { name: string; bookingJson: string | null }): string {
  try {
    if (lead.bookingJson) {
      const to = (JSON.parse(lead.bookingJson) as { invoiceTo?: string }).invoiceTo?.trim();
      if (to) return to;
    }
  } catch { /* fall through */ }
  return lead.name;
}

/** The agency work-order number for a job (12 Nov 2026) — prints on the
 *  invoice/receipt so the agency accounts team can match the payment to
 *  their work order. Null when the job has none. */
export function workOrderNumberOf(lead: { bookingJson: string | null }): string | null {
  try {
    if (lead.bookingJson) {
      const wo = (JSON.parse(lead.bookingJson) as { workOrderNumber?: string }).workOrderNumber?.trim();
      if (wo) return wo;
    }
  } catch { /* fall through */ }
  return null;
}

// ---------------------------------------------------------------------------
// Shared HTML email blocks — confirmation, reminder, follow-up, rug pickup,
// invoice, receipt and nudge are all built from these so the whole customer
// set matches the formal standard Ben approved on 9 Nov 2026 (boxed details,
// big total, blue borders).
// ---------------------------------------------------------------------------

function mailHeading(title: string, sub?: string): string {
  return `<div style="font-size:22px;font-weight:bold;letter-spacing:2px;color:${BRAND.charcoal}">${title}</div>
  ${sub ? `<div style="font-size:13px;color:${BRAND.grey};margin:4px 0 18px">${sub}</div>` : '<div style="margin-bottom:14px"></div>'}`;
}

function detailRow(k: string, v: string): string {
  return `<tr>
      <td style="font-size:12px;font-weight:bold;letter-spacing:1px;color:${BRAND.blue};width:120px;vertical-align:top;padding:6px 0">${k}</td>
      <td style="font-size:14.5px;line-height:1.5;color:${BRAND.charcoal};vertical-align:top;padding:4px 0">${v}</td>
    </tr>`;
}

function detailsBox(rows: string): string {
  return `<div style="background:${BRAND.light};border-radius:8px;padding:12px 16px;margin:0 0 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${rows}
    </table>
  </div>`;
}

function totalBox(amount: number, subline: string, label = "TOTAL"): string {
  return `<div style="border:1.5px solid ${BRAND.blue};border-radius:8px;padding:14px 16px;margin:0 0 20px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-size:13px;font-weight:bold;letter-spacing:1px;color:${BRAND.grey};vertical-align:middle">${label}</td>
        <td style="font-size:30px;font-weight:bold;color:${BRAND.charcoal};text-align:right;vertical-align:middle">${money(amount)}</td>
      </tr>
    </table>
    <div style="font-size:13px;line-height:1.5;color:${BRAND.grey};margin-top:6px">${esc(subline)}</div>
  </div>`;
}

function ctaBox(inner: string): string {
  return `<div style="background:${BRAND.light};border-radius:8px;padding:14px 16px;margin:0 0 8px">
    <div style="font-size:14px;line-height:1.6">${inner}</div>
  </div>`;
}

function promiseBox(): string {
  // 11 Nov 2026 (owner call): the 7-day fix-it promise is retired from
  // customer-facing copy — "it suggests we make mistakes". Kept as a no-op
  // so old call sites can't break a build if one is ever restored.
  return "";
}

function bulletList(items: string[]): string {
  return `<ul style="margin:0 0 18px;padding-left:20px">
    ${items.map((i) => `<li style="margin:6px 0;font-size:14px;line-height:1.5">${i}</li>`).join("\n    ")}
  </ul>`;
}

function signOff(closing: string): string {
  return `<p style="font-size:14px;line-height:1.6;margin:18px 0 0">${closing},<br>
  <strong>The ${esc(BUSINESS.name)} team</strong></p>`;
}

// ---------------------------------------------------------------------------
// Booking confirmation
// ---------------------------------------------------------------------------

/** Shared pieces for the confirmation email (text + rich HTML versions). */
function confirmationParts(lead: LeadRow) {
  const b = parseBooking(lead);
  const input = parseQuote(lead);
  const ref = bookingReference(lead);
  const where = [lead.address, lead.suburb].filter(Boolean).join(", ") || "your place";
  const fullDay = !!(b && slotsNeededFor(b.jobMinutes) >= TIME_SLOTS.length);
  const collection = b?.rugPickup
    ? b.access?.method === "leave-out"
      ? `Rugs left out — ${b.access.spot || "where we discussed"}; we'll grab them between 3:00 and 5:00 PM`
      : "Someone home between 3:00 and 5:00 PM to hand them over"
    : null;
  return {
    b,
    ref,
    where,
    fullDay,
    collection,
    summary: serviceSummary(input, b?.rugPickup ?? false),
    when: b ? whenLine(b) : "Time to be confirmed — we'll call you",
    plan: b?.secondVisit
      ? `2 cleans a year — visit 2 is booked in too: ${longDateLabel(b.secondVisit.date)}, arrival between ${TIME_SLOTS[b.secondVisit.slot]} (10% off every clean)`
      : null,
    payment: b ? paymentLine(b, lead) : "pay on the day",
  };
}

export function confirmationEmail(lead: LeadRow): { subject: string; text: string } {
  const pt = confirmationParts(lead);
  const big = pt.fullDay
    ? `\nThis is a big one — a full day on the tools, starting at 8:00 AM sharp. The whole day is yours.\n`
    : "";
  const collection = pt.collection ? `\n• Collection: ${pt.collection}` : "";
  return {
    subject: `Booking confirmed — ${BUSINESS.name} (${pt.ref})`,
    text: `Hi ${firstName(lead.name)},

Beauty — you're booked in with ${BUSINESS.name}.

YOUR BOOKING
• ${pt.summary}
• When: ${pt.when}${pt.plan ? `\n• Plan: ${pt.plan}` : ""}
• Where: ${pt.where}${collection}
• Total: ${money(lead.total)} — ${pt.payment}
• Reference: ${pt.ref}
${big}
Every clean includes a commercial pre-vacuum and pre-spray. We'll call or text the day before to confirm the exact arrival time. Anything change? Call or text ${BUSINESS.phone} and we'll sort it.

A copy of our Terms & Conditions is attached as a PDF — plain-English, two pages, yours to keep. They're also on our website any time under "Terms & conditions" in the footer.

See you soon,
The ${BUSINESS.name} team
${BUSINESS.phone} · ${BUSINESS.email}`,
  };
}

/** Rich HTML twin of the confirmation email (9 Nov 2026 — same formal,
 *  spaced-out standard as the quotation email: boxed details, big total,
 *  blue borders, clear next steps). */
export function confirmationEmailHtml(lead: LeadRow): string {
  const pt = confirmationParts(lead);
  const row = (k: string, v: string) => `<tr>
      <td style="font-size:12px;font-weight:bold;letter-spacing:1px;color:${BRAND.blue};width:120px;vertical-align:top;padding:6px 0">${k}</td>
      <td style="font-size:14.5px;line-height:1.5;color:${BRAND.charcoal};vertical-align:top;padding:4px 0">${v}</td>
    </tr>`;
  const bookedOn = lead.createdAt
    ? new Date(lead.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Sydney" })
    : null;
  return emailFrame(`
  <div style="font-size:22px;font-weight:bold;letter-spacing:2px;color:${BRAND.charcoal}">✔ BOOKING CONFIRMED</div>
  <div style="font-size:13px;color:${BRAND.grey};margin:4px 0 18px">
    Reference <strong>${esc(pt.ref)}</strong>${bookedOn ? ` &nbsp;·&nbsp; Booked ${bookedOn}` : ""}
  </div>

  <p style="font-size:14px;line-height:1.6;margin:0 0 18px">Hi ${esc(firstName(lead.name))},<br><br>
  Beauty — you're booked in with ${esc(BUSINESS.name)}. Here are your booking details:</p>

  <div style="background:${BRAND.light};border-radius:8px;padding:12px 16px;margin:0 0 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${row("THE JOB", `<strong>${esc(pt.summary)}</strong>`)}
      ${row("WHEN", `<strong>${esc(pt.when)}</strong>`)}
      ${pt.plan ? row("PLAN", `<strong>${esc(pt.plan)}</strong>`) : ""}
      ${row("WHERE", `<strong>${esc(pt.where)}</strong>`)}
      ${pt.collection ? row("COLLECTION", esc(pt.collection)) : ""}
    </table>
  </div>

  ${
    pt.fullDay
      ? `<div style="border:1.5px solid ${BRAND.blue};border-radius:8px;padding:14px 16px;margin:0 0 16px;font-size:14px;line-height:1.55">
    <strong>This is a big one</strong> — a full day on the tools, starting at 8:00 AM sharp. The whole day is yours.</div>`
      : ""
  }

  <div style="border:1.5px solid ${BRAND.blue};border-radius:8px;padding:14px 16px;margin:0 0 20px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-size:13px;font-weight:bold;letter-spacing:1px;color:${BRAND.grey};vertical-align:middle">TOTAL</td>
        <td style="font-size:30px;font-weight:bold;color:${BRAND.charcoal};text-align:right;vertical-align:middle">${money(lead.total)}</td>
      </tr>
    </table>
    <div style="font-size:13px;line-height:1.5;color:${BRAND.grey};margin-top:6px">${esc(pt.payment)}</div>
  </div>

  <div style="font-size:13px;font-weight:bold;letter-spacing:1px;color:${BRAND.blue};margin:0 0 6px">WHAT HAPPENS NEXT</div>
  <ul style="margin:0 0 18px;padding-left:20px">
    <li style="margin:6px 0;font-size:14px;line-height:1.5">Every clean includes a commercial pre-vacuum and pre-spray.</li>
    <li style="margin:6px 0;font-size:14px;line-height:1.5">We'll call or text the day before to confirm the exact arrival time.</li>
    ${pt.b?.rugPickup ? `<li style="margin:6px 0;font-size:14px;line-height:1.5">Your rugs come back washed, dried and ready for the floor on the Monday.</li>` : ""}
  </ul>

  <div style="background:${BRAND.light};border-radius:8px;padding:14px 16px;margin:0 0 8px">
    <div style="font-size:14px;line-height:1.6">Anything changed? Call or text
    <a href="tel:+61423581223" style="color:${BRAND.blue};font-weight:bold">${esc(BUSINESS.phone)}</a>
    quoting <strong>${esc(pt.ref)}</strong> and we'll sort it.</div>
  </div>

  <p style="font-size:13px;line-height:1.6;color:${BRAND.grey};margin:18px 0 0">A copy of our Terms &amp; Conditions is attached as a PDF — plain-English, two pages, yours to keep. They're also on our website any time under "Terms &amp; conditions" in the footer.</p>

  <p style="font-size:14px;line-height:1.6;margin:18px 0 0">See you soon,<br>
  <strong>The ${esc(BUSINESS.name)} team</strong></p>`);
}

export function confirmationSms(lead: LeadRow): string {
  const b = parseBooking(lead);
  const ref = bookingReference(lead);
  const when = b?.preferredDate
    ? `${longDateLabel(b.preferredDate)} ${b.rugPickup ? "3–5 PM" : b.preferredSlot !== null ? TIME_SLOTS[b.preferredSlot] : ""}`
    : "time TBC";
  const collection =
    b?.rugPickup && b.access?.method
      ? b.access.method === "leave-out"
        ? ` Rugs left out: ${b.access.spot || "as arranged"}.`
        : " Someone home 3–5 PM."
      : "";
  return `${BUSINESS.name}: you're booked in — ${when}. Total ${money(lead.total)}. Ref ${ref}.${collection} We'll confirm the exact arrival time the day before. Questions? Call ${BUSINESS.phone}.`;
}

// ---------------------------------------------------------------------------
// Owner alert — every new booking pings the business inbox. Loud subject
// (type + price), full job details in the body. Best-effort, never throws.
// ---------------------------------------------------------------------------

export function ownerNotification(lead: LeadRow): { subject: string; text: string } {
  const input = parseQuote(lead);
  const b = parseBooking(lead);
  const ref = bookingReference(lead);
  const kinds = serviceKinds(input);
  const typeWord = b?.rugPickup
    ? "RUG PICKUP"
    : kinds.length
      ? kinds.map((k) => (k === "rug" ? "RUG" : k === "carpet" ? "CARPET" : "LOUNGE")).join(" + ")
      : "NEW";
  const where = [lead.address, lead.suburb].filter(Boolean).join(", ") || "—";
  const when = b
    ? b.preferredDate
      ? b.rugPickup
        ? `${longDateLabel(b.preferredDate)} — 3–5 PM rug run`
        : b.preferredSlot !== null && b.preferredSlot !== undefined
          ? `${longDateLabel(b.preferredDate)}, ${TIME_SLOTS[b.preferredSlot]} (~${Math.round(((b.jobMinutes ?? 60) / 60) * 2) / 2}h on site)`
          : `${longDateLabel(b.preferredDate)} — arrival TBC`
      : "Time to be confirmed"
    : "No date booked (quote only)";
  let lines: { label: string; amount: number }[] = [];
  let travel: number | null = null;
  try {
    const bd = (JSON.parse(lead.quoteJson) as {
      breakdown?: {
        lines?: { label: string; amount: number }[];
        travelFee?: number;
        rugDiscount?: number;
        maintenanceDiscount?: number;
        codeDiscount?: number;
        seasonalDiscount?: number;
        seasonalPromo?: { percent: number; label: string } | null;
        volumeDiscount?: number;
        undercutDiscount?: number;
      };
    }).breakdown;
    lines = [...(bd?.lines ?? [])];
    // Discount rows, so the listed lines always add up to the TOTAL below.
    if (bd?.rugDiscount) lines.push({ label: "Bulk rug discount", amount: -bd.rugDiscount });
    if (bd?.maintenanceDiscount) lines.push({ label: "2-cleans-a-year plan", amount: -bd.maintenanceDiscount });
    if (bd?.codeDiscount) lines.push({ label: "Discount code", amount: -bd.codeDiscount });
    if (bd?.seasonalDiscount) lines.push({ label: bd.seasonalPromo ? promoText(bd.seasonalPromo) : "Seasonal deal", amount: -bd.seasonalDiscount });
    if (bd?.volumeDiscount) lines.push({ label: "Volume discount ($10 off every $150)", amount: -bd.volumeDiscount });
    if (bd?.undercutDiscount) lines.push({ label: "Price-beat discount", amount: -bd.undercutDiscount });
    travel = bd?.travelFee ?? null;
  } catch {
    // no breakdown — details below still stand
  }
  return {
    subject: `NEW ${typeWord} BOOKING!!! 🎉 ${money(lead.total)}`,
    text: `NEW BOOKING — ${ref}

${lead.name}
${lead.phone} · ${lead.email}

WHAT
• ${serviceSummary(input, b?.rugPickup ?? false)}

WHEN
• ${when}${b?.secondVisit ? `\n• PLAN: 2 cleans a year — visit 2 auto-booked ${longDateLabel(b.secondVisit.date)}, ${TIME_SLOTS[b.secondVisit.slot]}` : ""}

WHERE
• ${where}

PRICE
${lines.map((l) => `• ${l.label} — ${money(l.amount)}`).join("\n")}${travel !== null ? `\n• Travel — ${money(travel)}` : ""}
• TOTAL: ${money(lead.total)}${lead.paidOnline ? " — PAID ONLINE ✓" : ""}

DETAILS
• Payment: ${b?.payment === "pay-now" ? "paying online" : b?.payment === "payid" ? "PayID (Hnry)" : b?.payment === "bank-transfer" ? "bank transfer (Hnry)" : b?.payment === "invoice" ? "invoice after the job" : "on the day"}${b?.access?.method ? `\n• Access: ${{ "be-there": "customer home", agent: "real-estate agent", lockbox: "lockbox", "someone-else": "someone else letting us in", "leave-out": "rugs left out" }[b.access.method]}${b.access.spot ? ` — ${b.access.spot}` : ""}` : ""}${b?.notes ? `\n• Notes: ${b.notes}` : ""}

It's in the admin Jobs list — ${ref}.`,
  };
}

// ---------------------------------------------------------------------------
// Flood & water damage emergency — instant alerts, no queue.
// ---------------------------------------------------------------------------

export interface FloodRequest {
  name: string;
  phone: string;
  email?: string;
  address: string;
  suburb: string;
  cause: string;
  rooms: string;
  activeLeak: string;
  insurance: string;
  notes?: string;
}

/** Someone unlocked the 24/7 flood number — they're dialling right now. */
export function floodUnlockOwnerAlert(d: { name: string; phone: string; email?: string; address: string; suburb?: string }, ref: string): { subject: string; text: string } {
  return {
    subject: `🚨 FLOOD — ${d.name} just got the emergency number — expect their call`,
    text: `FLOOD NUMBER UNLOCKED — ${ref}

${d.name}
${d.phone}${d.email ? ` · ${d.email}` : ""}

WHERE
• ${d.address}${d.suburb ? `, ${d.suburb}` : ""}

They've just been shown the 24/7 emergency number on the flood page — the phone should ring any second. If it doesn't, CALL THEM: ${d.phone}

— ${BUSINESS.name} website
`,
  };
}

export function floodOwnerAlert(d: FloodRequest, ref: string, inspectionPrice: number): { subject: string; text: string } {
  return {
    subject: `🚨 FLOOD EMERGENCY — ${d.name} — ${d.suburb || d.address}`,
    text: `FLOOD EMERGENCY REQUEST — ${ref}

${d.name}
${d.phone}${d.email ? ` · ${d.email}` : ""}

WHERE
• ${d.address}${d.suburb ? `, ${d.suburb}` : ""}

WHAT
• Cause: ${d.cause}
• Rooms affected: ${d.rooms}
• Still leaking: ${d.activeLeak}
• Insurance claim: ${d.insurance}
${d.notes ? `• Notes: ${d.notes}\n` : ""}
Published inspection price they saw: $${inspectionPrice}.

CALL THEM BACK NOW: ${d.phone}

It's in the admin Jobs list — ${ref}.`,
  };
}

export function floodCustomerEmail(d: FloodRequest): { subject: string; text: string } {
  return {
    subject: `We've got your flood emergency — ${BUSINESS.name}`,
    text: `Hi ${d.name},

Your emergency request is in and has gone straight to us. Keep your phone on you — we're calling you back on ${d.phone}.

While you wait, if it's safe:
1. Stop the water at the source or the mains tap if you can.
2. Keep clear of wet power points and appliances — if water is near outlets, switch the power off at the meter box (only if it's dry and safe to reach).
3. Lift furniture and valuables off the wet floor — foil or containers under legs stops stains.
4. Don't walk on wet carpet more than you have to — it spreads the water and the damage.
5. Take photos of everything for your insurer before we arrive.

If anyone is in danger, call 000 first.

— ${BUSINESS.name}
${BUSINESS.phone} · ${BUSINESS.email}`,
  };
}

/** The quote-only email — sent when Ben prices a job in admin and ticks
 *  "email it to them". No date, no payment talk: here's your price, call us
 *  when you're ready to lock in a day. Formal layout: property address up
 *  top (agents file by address — added 9 Nov 2026 after the Town and Country
 *  quote went out without it), discounts shown so the maths adds up, and the
 *  HTML twin (quoteEmailHtmlForCustomer in emailTemplate.ts) boxes each part
 *  in blue with the recommended package + big total in a green box. */
export function quoteEmailForCustomer(d: QuoteEmailData): { subject: string; text: string } {
  const jobLines = d.lines
    .map((l) => `• ${l.label}${l.detail ? ` — ${l.detail}` : ""} — ${l.amount < 0 ? `−${money(-l.amount)}` : money(l.amount)}`)
    .join("\n\n");
  const issued = d.issuedAt ? new Date(d.issuedAt) : new Date();
  const fmt = (x: Date) =>
    x.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Sydney" });
  const validTo = new Date(issued.getTime() + 30 * 24 * 60 * 60 * 1000);
  const addr = d.address?.trim() || [d.suburb, d.town].filter(Boolean).join(", ");
  const discounts = (d.discounts ?? []).filter((x) => x.amount > 0);
  const discountLines = discounts.map((x) => `• ${x.label} — −${money(x.amount)}`).join("\n");
  const recommendation =
    d.recommendation?.trim() ||
    "The complete package above — each part priced separately, all done in the one visit.";
  const greeting = d.name.trim().split(/\s+/).length > 2 ? "Hello" : `Hi ${firstName(d.name)}`;
  return {
    subject: addr
      ? `Quote for ${shortAddress(addr)} — ${BUSINESS.name} (${d.reference})`
      : `Your quote — ${BUSINESS.name} (${d.reference})`,
    text: `${greeting},

Thanks for the opportunity to quote${addr ? " this property" : ""} — here it is in writing.

QUOTATION — ${d.reference}
Issued ${fmt(issued)} · valid to ${fmt(validTo)}
${addr ? `\nPROPERTY\n${addr}\n` : ""}
YOUR QUOTE
${jobLines}
${d.travelFee > 0 ? `\n• Travel${d.town ? ` — ${d.town}` : ""} — return trip, equipment and setup — ${money(d.travelFee)}\n` : ""}${discounts.length ? `\nSAVINGS APPLIED\n${discountLines}\n` : ""}
RECOMMENDED FOR THIS PROPERTY
${recommendation}

TOTAL: ${money(d.total)}

Every clean includes a commercial pre-vacuum and pre-spray, and the price above is the price on the day — no surprises.

No date is locked in yet. When you're ready, call or text ${BUSINESS.phone} (or just reply to this email) quoting ${d.reference} and we'll find a day that suits.

Kind regards,
The ${BUSINESS.name} team
${BUSINESS.phone} · ${BUSINESS.email}`,
  };
}

export async function notifyOwner(lead: LeadRow): Promise<void> {
  try {
    const smtp = await loadSmtpConfig();
    if (!isSmtpConfigured(smtp)) return;
    const n = ownerNotification(lead);
    await sendMail(smtp, BUSINESS.email, n.subject, n.text, undefined, brandedEmailHtml(n.text));
  } catch {
    // never let an owner alert break a customer's booking
  }
}

// ---------------------------------------------------------------------------
// Post-job thank-you + review ask
// ---------------------------------------------------------------------------

export function followUpEmail(
  lead: LeadRow,
  reviewUrl: string | null,
): { subject: string; text: string } {
  const input = parseQuote(lead);
  const b = parseBooking(lead);
  const carpet = (input?.carpetAreaM2 ?? 0) > 0;
  const reviewBlock = reviewUrl
    ? `\nIf you're happy with the result, a quick Google review honestly helps our little local business more than anything — it takes about a minute:\n${reviewUrl}\n`
    : "";
  return {
    subject: `All done — thanks for having us, ${firstName(lead.name)}`,
    text: `Hi ${firstName(lead.name)},

That's your ${serviceSummary(input, b?.rugPickup ?? false).toLowerCase()} all finished — thanks for choosing ${BUSINESS.name}.
${carpet ? `\nA couple of quick care notes:\n• Try to keep feet off the carpet for the first couple of hours — with the windows cracked or fans on it's usually dry within 2–6 hours.\n• Furniture can go back once the carpet's dry to the touch.\n` : ""}
${reviewBlock}
Thanks again,
The ${BUSINESS.name} team
${BUSINESS.phone} · ${BUSINESS.email}`,
  };
}

export function followUpSms(lead: LeadRow, reviewUrl: string | null): string {
  const review = reviewUrl ? ` Happy with the clean? A quick review helps us heaps: ${reviewUrl}` : "";
  return `${BUSINESS.name}: all done — thanks for having us!${review}`;
}

/** Rich HTML twin of the 5pm thank-you + review ask. Care notes box for
 *  carpet jobs, review CTA in the light-blue box. */
export function followUpEmailHtml(lead: LeadRow, reviewUrl: string | null): string {
  const input = parseQuote(lead);
  const b = parseBooking(lead);
  const carpet = (input?.carpetAreaM2 ?? 0) > 0;
  const what = serviceSummary(input, b?.rugPickup ?? false).toLowerCase();
  const care = carpet
    ? `<div style="font-size:13px;font-weight:bold;letter-spacing:1px;color:${BRAND.blue};margin:0 0 6px">A COUPLE OF QUICK CARE NOTES</div>
  ${bulletList([
    "Try to keep feet off the carpet for the first couple of hours — with the windows cracked or fans on it's usually dry within 2–6 hours.",
    "Furniture can go back once the carpet's dry to the touch.",
  ])}`
    : "";
  const review = reviewUrl
    ? ctaBox(`<strong>Happy with the result?</strong> A quick Google review honestly helps our little local business more than anything — it takes about a minute:<br>
    <a href="${esc(reviewUrl)}" style="display:inline-block;background:${BRAND.blue};color:#ffffff;padding:10px 18px;border-radius:8px;font-weight:bold;text-decoration:none;margin-top:10px">Leave a Google review</a>`)
    : "";
  return emailFrame(`
  ${mailHeading("✔ ALL DONE")}

  <p style="font-size:14px;line-height:1.6;margin:0 0 18px">Hi ${esc(firstName(lead.name))},<br><br>
  That's your ${esc(what)} all finished — thanks for choosing ${esc(BUSINESS.name)}.</p>

  ${care}
  ${promiseBox()}
  ${review}

  ${signOff("Thanks again")}`);
}

// ---------------------------------------------------------------------------
// Day-before reminder — automatic, the afternoon before every booking.
// ---------------------------------------------------------------------------

export function reminderEmail(lead: LeadRow): { subject: string; text: string } {
  const b = parseBooking(lead);
  const input = parseQuote(lead);
  const ref = bookingReference(lead);
  const where = [lead.address, lead.suburb].filter(Boolean).join(", ") || "your place";
  const pickup = b?.rugPickup ?? false;
  const prep = pickup
    ? `• Roll the rugs up near the door if you can — we'll be in and out in a couple of minutes.\n• They come back washed, dried and ready for the floor on Monday.`
    : `• A quick pick-up of small things off the floor (toys, shoes, lamps) helps us get straight into it — we shift lounges and light furniture ourselves.\n• Cracking a window or two on the day speeds up the drying.\n• Parking close to the door is a big help with the equipment.`;
  return {
    subject: `See you tomorrow — ${BUSINESS.name} (${ref})`,
    text: `Hi ${firstName(lead.name)},

Quick reminder — we're in tomorrow. ${b ? whenLine(b) : "We'll confirm the exact time by text."}

THE JOB
• ${serviceSummary(input, pickup)}
• Where: ${where}
• Total: ${money(lead.total)} — ${b ? paymentLine(b, lead) : "pay on the day"}
• Reference: ${ref}

A couple of things that help on the day:
${prep}

Anything changed? Call or text ${BUSINESS.phone} and we'll sort it.

See you tomorrow,
The ${BUSINESS.name} team
${BUSINESS.phone} · ${BUSINESS.email}`,
  };
}

/** Rich HTML twin of the day-before reminder (same formal standard as the
 *  confirmation — boxed details, big total, prep list). */
export function reminderEmailHtml(lead: LeadRow): string {
  const b = parseBooking(lead);
  const input = parseQuote(lead);
  const ref = bookingReference(lead);
  const where = [lead.address, lead.suburb].filter(Boolean).join(", ") || "your place";
  const pickup = b?.rugPickup ?? false;
  const prep = pickup
    ? [
        "Roll the rugs up near the door if you can — we'll be in and out in a couple of minutes.",
        "They come back washed, dried and ready for the floor on Monday.",
      ]
    : [
        "A quick pick-up of small things off the floor (toys, shoes, lamps) helps us get straight into it — we shift lounges and light furniture ourselves.",
        "Cracking a window or two on the day speeds up the drying.",
        "Parking close to the door is a big help with the equipment.",
      ];
  return emailFrame(`
  ${mailHeading("SEE YOU TOMORROW", `Reference <strong>${esc(ref)}</strong>`)}

  <p style="font-size:14px;line-height:1.6;margin:0 0 18px">Hi ${esc(firstName(lead.name))},<br><br>
  Quick reminder — we're in tomorrow. <strong>${esc(b ? whenLine(b) : "We'll confirm the exact time by text.")}</strong></p>

  ${detailsBox(
    detailRow("THE JOB", `<strong>${esc(serviceSummary(input, pickup))}</strong>`) +
      detailRow("WHEN", `<strong>${esc(b ? whenLine(b) : "To be confirmed")}</strong>`) +
      detailRow("WHERE", `<strong>${esc(where)}</strong>`),
  )}

  ${totalBox(lead.total, b ? paymentLine(b, lead) : "pay on the day")}

  <div style="font-size:13px;font-weight:bold;letter-spacing:1px;color:${BRAND.blue};margin:0 0 6px">A COUPLE OF THINGS THAT HELP ON THE DAY</div>
  ${bulletList(prep.map(esc))}

  ${ctaBox(`Anything changed? Call or text
    <a href="tel:+61423581223" style="color:${BRAND.blue};font-weight:bold">${esc(BUSINESS.phone)}</a>
    quoting <strong>${esc(ref)}</strong> and we'll sort it.`)}

  ${signOff("See you tomorrow")}`);
}

export function reminderSms(lead: LeadRow): string {
  const b = parseBooking(lead);
  const ref = bookingReference(lead);
  const when = b?.preferredDate
    ? b.rugPickup
      ? `${longDateLabel(b.preferredDate)} 3–5 PM (rug pickup)`
      : b.preferredSlot !== null && b.preferredSlot !== undefined
        ? `${longDateLabel(b.preferredDate)}, arrival ${TIME_SLOTS[b.preferredSlot]}`
        : longDateLabel(b.preferredDate)
    : "tomorrow";
  return `${BUSINESS.name}: reminder — we're in tomorrow (${when}). Total ${money(lead.total)}, ref ${ref}. Anything changed, call ${BUSINESS.phone}.`;
}

// ---------------------------------------------------------------------------
// Rug pickup tick — "we've got them, back Monday". Sent from the admin board
// when the owner marks the rugs collected (stage 1 of the rug tick-off).
// ---------------------------------------------------------------------------

export function rugPickedUpEmail(lead: LeadRow): { subject: string; text: string } {
  const b = parseBooking(lead);
  const input = parseQuote(lead);
  const ref = bookingReference(lead);
  const back = b?.preferredDate ? longDateLabel(rugReturnDay(b.preferredDate)) : "Monday";
  const what = serviceSummary(input, false).toLowerCase();
  const paid = lead.paidOnline || lead.paidOfflineAt;
  return {
    subject: `We've got your rugs — back ${back} (${ref})`,
    text: `Hi ${firstName(lead.name)},

Just a quick one — we've picked up your ${what} and they're in for their wash.

BACK TO YOU
• ${back}, in the afternoon — we'll let you know when we're on the way
• ${paid ? "All paid — nothing to do on the day" : `Total: ${money(lead.total)} — pay on return (cash, or instant bank transfer to our PayID: ${BUSINESS.payId} — put ${ref} in the description)`}
• Reference: ${ref}

Anything in the meantime, call or text ${BUSINESS.phone}.

Cheers,
The ${BUSINESS.name} team
${BUSINESS.phone} · ${BUSINESS.email}`,
  };
}

export function rugPickedUpSms(lead: LeadRow): string {
  const b = parseBooking(lead);
  const ref = bookingReference(lead);
  const back = b?.preferredDate ? longDateLabel(rugReturnDay(b.preferredDate)) : "Monday";
  return `${BUSINESS.name}: we've got your rugs — back to you ${back} arvo. Total ${money(lead.total)}, ref ${ref}. Anything, call ${BUSINESS.phone}.`;
}

/** Rich HTML twin of the "we've got your rugs" pickup tick. */
export function rugPickedUpEmailHtml(lead: LeadRow): string {
  const b = parseBooking(lead);
  const input = parseQuote(lead);
  const ref = bookingReference(lead);
  const back = b?.preferredDate ? longDateLabel(rugReturnDay(b.preferredDate)) : "Monday";
  const what = serviceSummary(input, false).toLowerCase();
  const paid = lead.paidOnline || lead.paidOfflineAt;
  return emailFrame(`
  ${mailHeading("WE'VE GOT YOUR RUGS", `Reference <strong>${esc(ref)}</strong>`)}

  <p style="font-size:14px;line-height:1.6;margin:0 0 18px">Hi ${esc(firstName(lead.name))},<br><br>
  Just a quick one — we've picked up your ${esc(what)} and they're in for their wash.</p>

  ${detailsBox(
    detailRow("BACK TO YOU", `<strong>${esc(back)}, in the afternoon</strong><br><span style="font-size:13px;color:${BRAND.grey}">We'll let you know when we're on the way.</span>`) +
      (paid
        ? detailRow("PAYMENT", `<strong>All paid</strong> — nothing to do on the day`)
        : detailRow("TOTAL", `<strong>${money(lead.total)}</strong> — pay on return (cash, or instant bank transfer to our PayID: ${esc(BUSINESS.payId)} — put ${esc(ref)} in the description)`)),
  )}

  ${ctaBox(`Anything in the meantime, call or text
    <a href="tel:+61423581223" style="color:${BRAND.blue};font-weight:bold">${esc(BUSINESS.phone)}</a>.`)}

  ${signOff("Cheers")}`);
}

// ---------------------------------------------------------------------------
// Six-month freshen-up nudge — ties into the 2-cleans-a-year maintenance plan
// (10% off every clean). Sent once per completed job, email-first.
// ---------------------------------------------------------------------------

export function nudgeEmail(lead: LeadRow): { subject: string; text: string } {
  const input = parseQuote(lead);
  const b = parseBooking(lead);
  const what = serviceSummary(input, b?.rugPickup ?? false).toLowerCase();
  const where = lead.suburb ? ` in ${lead.suburb}` : "";
  return {
    subject: `Time for a freshen-up, ${firstName(lead.name)}?`,
    text: `Hi ${firstName(lead.name)},

It's been about six months since we cleaned your ${what}${where} — that's about how long a clean stays at its best before everyday soil starts working back into the fibres.

If you're thinking about the next one, our maintenance plan is the cheap way to do it: book two cleans a year and every clean is 10% off — no codes, no fine print, just pick the "2 cleans a year" option on the quote and it comes straight off:

https://marshallscarpetcleaning.com.au/quote

Two minutes online and you'll have the exact price before we knock — the price you see is the price you pay.

Thanks again for having us last time,
The ${BUSINESS.name} team
${BUSINESS.phone} · ${BUSINESS.email}

P.S. Rather not get these reminders? Call or text ${BUSINESS.phone} and we'll take you off the list.`,
  };
}

export function nudgeSms(lead: LeadRow): string {
  return `${BUSINESS.name}: it's been about 6 months since your last clean — due a freshen-up? Book the 2-cleans-a-year plan and every clean is 10% off: https://marshallscarpetcleaning.com.au/quote — questions ${BUSINESS.phone}`;
}

/** Rich HTML twin of the six-month freshen-up nudge. */
export function nudgeEmailHtml(lead: LeadRow): string {
  const input = parseQuote(lead);
  const b = parseBooking(lead);
  const what = serviceSummary(input, b?.rugPickup ?? false).toLowerCase();
  const where = lead.suburb ? ` in ${lead.suburb}` : "";
  return emailFrame(`
  ${mailHeading("TIME FOR A FRESHEN-UP?")}

  <p style="font-size:14px;line-height:1.6;margin:0 0 18px">Hi ${esc(firstName(lead.name))},<br><br>
  It's been about six months since we cleaned your ${esc(what)}${esc(where)} — that's about how long a clean stays at its best before everyday soil starts working back into the fibres.</p>

  <div style="border:1.5px solid ${BRAND.blue};border-radius:8px;padding:14px 16px;margin:0 0 18px">
    <div style="font-size:13px;font-weight:bold;letter-spacing:1px;color:${BRAND.blue};margin-bottom:6px">THE CHEAP WAY TO DO IT</div>
    <div style="font-size:14px;line-height:1.6">Book <strong>two cleans a year</strong> and every clean is <strong>10% off</strong> — no codes, no fine print. Pick the "2 cleans a year" option on the quote and it comes straight off.<br>
    <a href="https://marshallscarpetcleaning.com.au/quote" style="display:inline-block;background:${BRAND.blue};color:#ffffff;padding:10px 18px;border-radius:8px;font-weight:bold;text-decoration:none;margin-top:10px">Get my 10%-off quote</a></div>
  </div>

  <p style="font-size:14px;line-height:1.6;margin:0 0 18px">Two minutes online and you'll have the exact price before we knock — the price you see is the price you pay.</p>

  ${signOff("Thanks again for having us last time")}

  <p style="font-size:12px;line-height:1.6;color:${BRAND.grey};margin:14px 0 0">P.S. Rather not get these reminders? Call or text ${esc(BUSINESS.phone)} and we'll take you off the list.</p>`);
}

// ---------------------------------------------------------------------------
// Manual freshen-up ("win-back") email — Ben sends it from the Clients tab
// when a past customer looks due. Season-aware: November to 18 December it
// becomes the pre-Christmas nudge, the rest of the year it's the timeless
// version. Stamps nudgeSentAt so the automatic 6-month sweep doesn't email
// them again straight after.
// ---------------------------------------------------------------------------

function winbackPreChristmas(): boolean {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());
  const month = Number(parts.find((p) => p.type === "month")?.value ?? 0);
  const day = Number(parts.find((p) => p.type === "day")?.value ?? 0);
  return month === 11 || (month === 12 && day <= 18);
}

export function winbackEmail(lead: LeadRow): { subject: string; text: string } {
  const input = parseQuote(lead);
  const b = parseBooking(lead);
  const what = serviceSummary(input, b?.rugPickup ?? false).toLowerCase();
  const optOut = `\n\nP.S. Rather not get these reminders? Call or text ${BUSINESS.phone} and we'll take you off the list.`;
  if (winbackPreChristmas()) {
    return {
      subject: `Getting the house Christmas-ready, ${firstName(lead.name)}?`,
      text: `Hi ${firstName(lead.name)},

Christmas is coming up fast — and if the family (or the in-laws) are descending this year, now's the time to get the ${what} freshened up before the December rush.

We finish up for the year on Friday 18 December and the December slots are already filling — if you'd like a clean before then, it takes about 60 seconds to get your exact price online:

https://marshallscarpetcleaning.com.au/quote

The price you see is the price you pay — no surprises on the day.

Thanks again for having us last time,
The ${BUSINESS.name} team
${BUSINESS.phone} · ${BUSINESS.email}${optOut}`,
    };
  }
  return {
    subject: `Time for a freshen-up, ${firstName(lead.name)}?`,
    text: `Hi ${firstName(lead.name)},

It's been a while since we cleaned your ${what} — carpets stay at their best with a clean every 6–12 months, before everyday soil works back into the fibres.

If you're due, our maintenance plan is the cheap way to do it: book two cleans a year and every clean is 10% off — no codes, no fine print, just pick the "2 cleans a year" option on the quote:

https://marshallscarpetcleaning.com.au/quote

Two minutes online and you'll have the exact price — the price you see is the price you pay.

Thanks again for having us last time,
The ${BUSINESS.name} team
${BUSINESS.phone} · ${BUSINESS.email}${optOut}`,
  };
}

export function winbackSms(lead: LeadRow): string {
  return winbackPreChristmas()
    ? `${BUSINESS.name}: Christmas is coming — book your freshen-up before we finish for the year on Fri 18 Dec: https://marshallscarpetcleaning.com.au/quote — questions ${BUSINESS.phone}`
    : `${BUSINESS.name}: due a freshen-up? Book the 2-cleans-a-year plan and every clean is 10% off: https://marshallscarpetcleaning.com.au/quote — questions ${BUSINESS.phone}`;
}

/** Rich HTML twin of the manual win-back email. */
export function winbackEmailHtml(lead: LeadRow): string {
  const input = parseQuote(lead);
  const b = parseBooking(lead);
  const what = serviceSummary(input, b?.rugPickup ?? false).toLowerCase();
  const christmas = winbackPreChristmas();
  const body = christmas
    ? `<p style="font-size:14px;line-height:1.6;margin:0 0 18px">Hi ${esc(firstName(lead.name))},<br><br>
  Christmas is coming up fast — and if the family (or the in-laws) are descending this year, now's the time to get the ${esc(what)} freshened up before the December rush.</p>

  ${ctaBox(`<strong>We finish up for the year on Friday 18 December</strong> and the December slots are already filling.<br>
    <a href="https://marshallscarpetcleaning.com.au/quote" style="display:inline-block;background:${BRAND.blue};color:#ffffff;padding:10px 18px;border-radius:8px;font-weight:bold;text-decoration:none;margin-top:10px">Get my price in 60 seconds</a>`)}

  <p style="font-size:14px;line-height:1.6;margin:0 0 18px">The price you see is the price you pay — no surprises on the day.</p>`
    : `<p style="font-size:14px;line-height:1.6;margin:0 0 18px">Hi ${esc(firstName(lead.name))},<br><br>
  It's been a while since we cleaned your ${esc(what)} — carpets stay at their best with a clean every 6–12 months, before everyday soil works back into the fibres.</p>

  <div style="border:1.5px solid ${BRAND.blue};border-radius:8px;padding:14px 16px;margin:0 0 18px">
    <div style="font-size:13px;font-weight:bold;letter-spacing:1px;color:${BRAND.blue};margin-bottom:6px">THE CHEAP WAY TO DO IT</div>
    <div style="font-size:14px;line-height:1.6">Book <strong>two cleans a year</strong> and every clean is <strong>10% off</strong> — no codes, no fine print. Pick the "2 cleans a year" option on the quote and it comes straight off.<br>
    <a href="https://marshallscarpetcleaning.com.au/quote" style="display:inline-block;background:${BRAND.blue};color:#ffffff;padding:10px 18px;border-radius:8px;font-weight:bold;text-decoration:none;margin-top:10px">Get my 10%-off quote</a></div>
  </div>

  <p style="font-size:14px;line-height:1.6;margin:0 0 18px">Two minutes online and you'll have the exact price — the price you see is the price you pay.</p>`;
  return emailFrame(`
  ${mailHeading(christmas ? "GETTING THE HOUSE CHRISTMAS-READY?" : "TIME FOR A FRESHEN-UP?")}

  ${body}

  ${signOff("Thanks again for having us last time")}

  <p style="font-size:12px;line-height:1.6;color:${BRAND.grey};margin:14px 0 0">P.S. Rather not get these reminders? Call or text ${esc(BUSINESS.phone)} and we'll take you off the list.</p>`);
}

// ---------------------------------------------------------------------------
// Payment receipt — goes out automatically when a job is marked done.
// ---------------------------------------------------------------------------

export function floodReportEmail(
  lead: LeadRow,
  total: number,
  attendedAt: string,
): { subject: string; text: string } {
  const ref = bookingReference(lead);
  const jobDate = new Date(`${attendedAt}T12:00:00`).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return {
    subject: `Your flood & water damage report — ${BUSINESS.name} (${ref})`,
    text: `Hi ${firstName(lead.name)},

Your flood & water damage report is attached as a PDF — it covers what we found, the work we did, the drying status and the itemised charges. It's written for your insurer: forward it straight to them with your claim.

REPORT ${ref}
• Date attended: ${jobDate}
• Total: ${money(total)}

No GST has been charged — not registered for GST.

If your assessor wants anything clarified, send them our way — ${BUSINESS.phone} or reply to this email.

— ${BUSINESS.name}
${BUSINESS.phone} · ${BUSINESS.email}`,
  };
}

export function receiptEmail(lead: LeadRow): { subject: string; text: string } {
  const ref = bookingReference(lead);
  const b = parseBooking(lead);
  const input = parseQuote(lead);
  const jobDate = b?.preferredDate
    ? longDateLabel(b.preferredDate)
    : new Date(lead.createdAt ?? Date.now()).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  const payment = lead.paidOnline
    ? "Paid in full online by card"
    : lead.paidOfflineAt
      ? "Paid in full — thank you"
      : b?.payment === "pay-now"
        ? "Paid in full online by card"
        : b?.payment === "invoice"
          ? "On invoice — 5-day terms"
          : "Paid on the day";
  return {
    subject: `Receipt — ${BUSINESS.legalName} (${ref})`,
    text: `Hi ${firstName(lead.name)},

Thanks again — your receipt is attached as a PDF. Keep it for your records (handy if a real estate or property manager needs proof of the clean).

RECEIPT ${ref}
• Job date: ${jobDate}
• What was done: ${serviceSummary(input, b?.rugPickup ?? false)}
• Total: ${money(lead.total)} — ${payment}

No GST has been charged — not registered for GST.

The ${BUSINESS.name} team
${BUSINESS.phone} · ${BUSINESS.email}`,
  };
}

/** Rich HTML twin of the receipt email (PDF rides as an attachment). */
export function receiptEmailHtml(lead: LeadRow): string {
  const ref = bookingReference(lead);
  const b = parseBooking(lead);
  const input = parseQuote(lead);
  const jobDate = b?.preferredDate
    ? longDateLabel(b.preferredDate)
    : new Date(lead.createdAt ?? Date.now()).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  const payment = lead.paidOnline
    ? "Paid in full online by card"
    : lead.paidOfflineAt
      ? "Paid in full — thank you"
      : b?.payment === "pay-now"
        ? "Paid in full online by card"
        : b?.payment === "invoice"
          ? "On invoice — 5-day terms"
          : "Paid — thank you";
  return emailFrame(`
  ${mailHeading("RECEIPT", `Reference <strong>${esc(ref)}</strong> &nbsp;·&nbsp; ${esc(jobDate)}`)}

  <p style="font-size:14px;line-height:1.6;margin:0 0 18px">Hi ${esc(firstName(lead.name))},<br><br>
  Thanks again — your receipt is attached as a PDF. Keep it for your records (handy if a real estate or property manager needs proof of the clean).</p>

  ${detailsBox(
    detailRow("WHAT WAS DONE", `<strong>${esc(serviceSummary(input, b?.rugPickup ?? false))}</strong>`) +
      detailRow("JOB DATE", esc(jobDate)),
  )}

  ${totalBox(lead.total, payment, "TOTAL PAID")}

  ${promiseBox()}

  <p style="font-size:12px;line-height:1.6;color:${BRAND.grey};margin:0 0 8px">No GST has been charged — not registered for GST.</p>

  ${signOff("Thanks again")}`);
}

// ---------------------------------------------------------------------------
// Invoice — completed job that hasn't been paid. Goes out in the 5pm batch
// (and from the board's "Send invoice" button). Card link rides in the text;
// the email template linkifies it into a clickable button-blue link.
// ---------------------------------------------------------------------------

export function invoiceEmail(
  lead: LeadRow,
  payUrl: string | null,
  reviewUrl: string | null,
): { subject: string; text: string } {
  const ref = bookingReference(lead);
  const b = parseBooking(lead);
  const input = parseQuote(lead);
  const jobIso = b?.preferredDate ?? null;
  const dueIso = b ? paymentDueDay(b) : null; // 5-day terms — rugs: 5 days from the Monday return
  const dueLabel = dueIso
    ? new Date(`${dueIso}T12:00:00`).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : null;
  // Agency jobs: the email goes to the real estate but the PDF is made out
  // to the tenant/owner — say so up front so accounts can see it at a glance.
  const addressee = invoiceAddressee(lead);
  const madeOutLine = addressee !== lead.name ? `• Made out to: ${addressee}\n` : "";
  const wo = workOrderNumberOf(lead);
  const woLine = wo ? `• Work order: ${wo}\n` : "";
  const cardBlock = payUrl ? `• Card: pay securely online — ${payUrl}\n` : "";
  const bankBlock = BUSINESS.bankBsb
    ? `• Bank transfer: BSB ${BUSINESS.bankBsb}, account ${BUSINESS.bankAccount} (${BUSINESS.bankName})\n`
    : `• Cash or bank transfer: call ${BUSINESS.phone} and we'll sort it\n`;
  const reviewBlock = reviewUrl
    ? `\nHappy with the result? A quick Google review honestly helps our little local business more than anything — it takes about a minute:\n${reviewUrl}\n`
    : "";
  return {
    subject: `Invoice — ${BUSINESS.legalName} (${ref})`,
    text: `Hi ${firstName(lead.name)},

Thanks for having us${jobIso ? ` on ${longDateLabel(jobIso)}` : ""} — your invoice is attached as a PDF.

INVOICE ${ref}
• What was done: ${serviceSummary(input, b?.rugPickup ?? false)}
${madeOutLine}${woLine}• Total due: ${money(lead.total)} — 5-day terms${dueLabel ? ` (due ${dueLabel})` : ""}

HOW TO PAY
${cardBlock}• PayID (instant bank transfer): ${BUSINESS.payId}
${bankBlock}Put ${ref} in the payment description so it lands straight against your job.

No GST has been charged — not registered for GST.
${reviewBlock}
Thanks again,
The ${BUSINESS.name} team
${BUSINESS.phone} · ${BUSINESS.email}`,
  };
}

export function invoiceSms(lead: LeadRow): string {
  const ref = bookingReference(lead);
  return `${BUSINESS.name}: thanks for having us — invoice ${ref} for ${money(lead.total)} is in your email (5-day terms). PayID ${BUSINESS.payId}, put ${ref} in the description. Questions? Call ${BUSINESS.phone}.`;
}

/** Rich HTML twin of the invoice email. The payment reference stays big, red
 *  and underlined (customers quote it in their transfer), and the card pay
 *  link becomes a proper button. */
export function invoiceEmailHtml(lead: LeadRow, payUrl: string | null, reviewUrl: string | null): string {
  const ref = bookingReference(lead);
  const b = parseBooking(lead);
  const input = parseQuote(lead);
  const jobIso = b?.preferredDate ?? null;
  const dueIso = b ? paymentDueDay(b) : null; // 5-day terms — rugs: 5 days from the Monday return
  const dueLabel = dueIso
    ? new Date(`${dueIso}T12:00:00`).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : null;
  // Agency jobs: email goes to the real estate, PDF is made out to the
  // tenant/owner — call it out so accounts can see it without opening the PDF.
  const addressee = invoiceAddressee(lead);
  const madeOutRow = addressee !== lead.name ? detailRow("MADE OUT TO", `<strong>${esc(addressee)}</strong>`) : "";
  const wo = workOrderNumberOf(lead);
  const woRow = wo ? detailRow("WORK ORDER", `<strong>${esc(wo)}</strong>`) : "";
  const refHtml = `<span style="font-size:1.2em;font-weight:800;color:#B91C1C;text-decoration:underline">${esc(ref)}</span>`;
  const cardButton = payUrl
    ? `<a href="${esc(payUrl)}" style="display:inline-block;background:${BRAND.blue};color:#ffffff;padding:12px 20px;border-radius:8px;font-weight:bold;text-decoration:none;margin:4px 0 10px">Pay ${money(lead.total)} by card now</a><br>`
    : "";
  const bankLine = BUSINESS.bankBsb
    ? `<li style="margin:6px 0;font-size:14px;line-height:1.5"><strong>Bank transfer:</strong> BSB ${esc(BUSINESS.bankBsb)} · account ${esc(BUSINESS.bankAccount)} (${esc(BUSINESS.bankName)})</li>`
    : `<li style="margin:6px 0;font-size:14px;line-height:1.5"><strong>Cash or bank transfer:</strong> call ${esc(BUSINESS.phone)} and we'll sort it</li>`;
  const review = reviewUrl
    ? ctaBox(`<strong>Happy with the result?</strong> A quick Google review honestly helps our little local business more than anything — it takes about a minute:<br>
    <a href="${esc(reviewUrl)}" style="display:inline-block;background:${BRAND.blue};color:#ffffff;padding:10px 18px;border-radius:8px;font-weight:bold;text-decoration:none;margin-top:10px">Leave a Google review</a>`)
    : "";
  return emailFrame(`
  ${mailHeading("INVOICE", `Reference ${refHtml} &nbsp;·&nbsp; 5-day terms${dueLabel ? ` — due <strong>${esc(dueLabel)}</strong>` : ""}`)}

  <p style="font-size:14px;line-height:1.6;margin:0 0 18px">Hi ${esc(firstName(lead.name))},<br><br>
  Thanks for having us${jobIso ? ` on ${esc(longDateLabel(jobIso))}` : ""} — your invoice is attached as a PDF.</p>

  ${detailsBox(
    detailRow("WHAT WAS DONE", `<strong>${esc(serviceSummary(input, b?.rugPickup ?? false))}</strong>`) +
      madeOutRow +
      woRow +
      (jobIso ? detailRow("JOB DATE", esc(longDateLabel(jobIso))) : ""),
  )}

  ${totalBox(lead.total, `5-day terms${dueLabel ? ` — due ${dueLabel}` : ""}`, "TOTAL DUE")}

  <div style="border:1.5px solid ${BRAND.blue};border-radius:8px;padding:14px 16px;margin:0 0 18px">
    <div style="font-size:13px;font-weight:bold;letter-spacing:1px;color:${BRAND.blue};margin-bottom:8px">HOW TO PAY</div>
    ${cardButton}
    <ul style="margin:0;padding-left:20px">
      <li style="margin:6px 0;font-size:14px;line-height:1.5"><strong>PayID (instant):</strong> ${esc(BUSINESS.payId)}</li>
      ${bankLine}
    </ul>
    <div style="font-size:13px;line-height:1.5;color:${BRAND.grey};margin-top:8px">Put ${refHtml} in the payment description so it lands straight against your job.</div>
  </div>

  ${promiseBox()}
  ${review}

  <p style="font-size:12px;line-height:1.6;color:${BRAND.grey};margin:0 0 8px">No GST has been charged — not registered for GST.</p>

  ${signOff("Thanks again")}`);
}

// ---------------------------------------------------------------------------
// Job-complete — ONE professional email when a job's finished (owner call
// 10 Nov 2026: invoice, receipt and review ask all ride in a single email).
// Paid jobs: job summary + receipt section (PDF attached if it hasn't already
// gone out) + review ask. Unpaid: job summary + invoice section (PDF + card
// pay link + PayID) + review ask.
// ---------------------------------------------------------------------------

export function jobCompleteEmail(
  lead: LeadRow,
  payUrl: string | null,
  reviewUrl: string | null,
  receiptAttached: boolean,
): { subject: string; text: string } {
  const ref = bookingReference(lead);
  const b = parseBooking(lead);
  const input = parseQuote(lead);
  const paid = !!(lead.paidOnline || lead.paidOfflineAt);
  const carpet = (input?.carpetAreaM2 ?? 0) > 0;
  const jobIso = b?.preferredDate ?? null;
  const jobDate = jobIso
    ? longDateLabel(jobIso)
    : new Date(lead.createdAt ?? Date.now()).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  const dueIso = b ? paymentDueDay(b) : null;
  const dueLabel = dueIso
    ? new Date(`${dueIso}T12:00:00`).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : null;
  const payment = lead.paidOnline ? "Paid in full online by card" : "Paid in full — thank you";

  const moneyBlock = paid
    ? `\nRECEIPT ${ref}\n• Total: ${money(lead.total)} — ${payment}\n• ${receiptAttached ? "Your receipt is attached as a PDF — keep it for your records (handy if a real estate or property manager needs proof of the clean)." : "Your receipt was emailed to you when you paid — sing out if you'd like another copy."}\n`
    : `\nINVOICE ${ref}\n• Total due: ${money(lead.total)} — 5-day terms${dueLabel ? ` (due ${dueLabel})` : ""}\n• Your invoice is attached as a PDF.\n\nHOW TO PAY\n${payUrl ? `• Card: pay securely online — ${payUrl}\n` : ""}• PayID (instant bank transfer): ${BUSINESS.payId}\n${BUSINESS.bankBsb ? `• Bank transfer: BSB ${BUSINESS.bankBsb}, account ${BUSINESS.bankAccount} (${BUSINESS.bankName})\n` : ""}Put ${ref} in the payment description so it lands straight against your job.\n`;
  const careBlock = carpet
    ? `\nA couple of quick care notes:\n• Try to keep feet off the carpet for the first couple of hours — with the windows cracked or fans on it's usually dry within 2–6 hours.\n• Furniture can go back once the carpet's dry to the touch.\n`
    : "";
  const reviewBlock = reviewUrl
    ? `\nIf you're happy with the result, a quick Google review honestly helps our little local business more than anything — it takes about a minute:\n${reviewUrl}\n`
    : "";
  return {
    subject: `All done — job complete ${paid ? "+ receipt" : "+ invoice"} (${ref})`,
    text: `Hi ${firstName(lead.name)},

That's your ${serviceSummary(input, b?.rugPickup ?? false).toLowerCase()} all finished — thanks for choosing ${BUSINESS.name}. Everything from the job is in this one email.

JOB SUMMARY
• What was done: ${serviceSummary(input, b?.rugPickup ?? false)}
• Job date: ${jobDate}
• Reference: ${ref}
${moneyBlock}
No GST has been charged — not registered for GST.
${careBlock}
${reviewBlock}
Thanks again,
The ${BUSINESS.name} team
${BUSINESS.phone} · ${BUSINESS.email}`,
  };
}

export function jobCompleteSms(lead: LeadRow, reviewUrl: string | null): string {
  const ref = bookingReference(lead);
  const paid = !!(lead.paidOnline || lead.paidOfflineAt);
  const moneyBit = paid
    ? `Receipt for ${money(lead.total)} is in your email.`
    : `Invoice ${ref} for ${money(lead.total)} is in your email (5-day terms) — PayID ${BUSINESS.payId}, put ${ref} in the description.`;
  const review = reviewUrl ? ` Happy with the clean? A quick review helps us heaps: ${reviewUrl}` : "";
  return `${BUSINESS.name}: all done — thanks for having us! ${moneyBit}${review}`;
}

/** Rich HTML twin of the job-complete email. One email carries everything:
 *  job summary, receipt (paid) or invoice with pay options (unpaid), care
 *  notes and the review ask. */
export function jobCompleteEmailHtml(
  lead: LeadRow,
  payUrl: string | null,
  reviewUrl: string | null,
  receiptAttached: boolean,
): string {
  const ref = bookingReference(lead);
  const b = parseBooking(lead);
  const input = parseQuote(lead);
  const paid = !!(lead.paidOnline || lead.paidOfflineAt);
  const carpet = (input?.carpetAreaM2 ?? 0) > 0;
  const jobIso = b?.preferredDate ?? null;
  const jobDate = jobIso
    ? longDateLabel(jobIso)
    : new Date(lead.createdAt ?? Date.now()).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  const dueIso = b ? paymentDueDay(b) : null;
  const dueLabel = dueIso
    ? new Date(`${dueIso}T12:00:00`).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : null;
  const refHtml = `<span style="font-size:1.2em;font-weight:800;color:#B91C1C;text-decoration:underline">${esc(ref)}</span>`;

  const moneySection = paid
    ? `${totalBox(lead.total, lead.paidOnline ? "Paid in full online by card" : "Paid in full — thank you", "TOTAL PAID")}
  <p style="font-size:13px;line-height:1.6;color:${BRAND.grey};margin:0 0 18px">${receiptAttached
      ? "Your receipt is attached as a PDF — keep it for your records (handy if a real estate or property manager needs proof of the clean)."
      : "Your receipt was emailed to you when you paid — sing out if you'd like another copy."}</p>`
    : `${totalBox(lead.total, `5-day terms${dueLabel ? ` — due ${dueLabel}` : ""}`, "TOTAL DUE")}
  <p style="font-size:13px;line-height:1.6;color:${BRAND.grey};margin:0 0 18px">Your invoice is attached as a PDF.</p>
  <div style="border:1.5px solid ${BRAND.blue};border-radius:8px;padding:14px 16px;margin:0 0 18px">
    <div style="font-size:13px;font-weight:bold;letter-spacing:1px;color:${BRAND.blue};margin-bottom:8px">HOW TO PAY</div>
    ${payUrl ? `<a href="${esc(payUrl)}" style="display:inline-block;background:${BRAND.blue};color:#ffffff;padding:12px 20px;border-radius:8px;font-weight:bold;text-decoration:none;margin:4px 0 10px">Pay ${money(lead.total)} by card now</a><br>` : ""}
    <ul style="margin:0;padding-left:20px">
      <li style="margin:6px 0;font-size:14px;line-height:1.5"><strong>PayID (instant):</strong> ${esc(BUSINESS.payId)}</li>
      ${BUSINESS.bankBsb ? `<li style="margin:6px 0;font-size:14px;line-height:1.5"><strong>Bank transfer:</strong> BSB ${esc(BUSINESS.bankBsb)} · account ${esc(BUSINESS.bankAccount)} (${esc(BUSINESS.bankName)})</li>` : ""}
    </ul>
    <div style="font-size:13px;line-height:1.5;color:${BRAND.grey};margin-top:8px">Put ${refHtml} in the payment description so it lands straight against your job.</div>
  </div>`;

  const care = carpet
    ? `<div style="font-size:13px;font-weight:bold;letter-spacing:1px;color:${BRAND.blue};margin:0 0 6px">A COUPLE OF QUICK CARE NOTES</div>
  ${bulletList([
    "Try to keep feet off the carpet for the first couple of hours — with the windows cracked or fans on it's usually dry within 2–6 hours.",
    "Furniture can go back once the carpet's dry to the touch.",
  ])}`
    : "";
  const review = reviewUrl
    ? ctaBox(`<strong>Happy with the result?</strong> A quick Google review honestly helps our little local business more than anything — it takes about a minute:<br>
    <a href="${esc(reviewUrl)}" style="display:inline-block;background:${BRAND.blue};color:#ffffff;padding:10px 18px;border-radius:8px;font-weight:bold;text-decoration:none;margin-top:10px">Leave a Google review</a>`)
    : "";
  return emailFrame(`
  ${mailHeading("✔ ALL DONE — JOB COMPLETE", `Reference ${paid ? esc(ref) : refHtml} &nbsp;·&nbsp; ${esc(jobDate)}`)}

  <p style="font-size:14px;line-height:1.6;margin:0 0 18px">Hi ${esc(firstName(lead.name))},<br><br>
  That's your ${esc(serviceSummary(input, b?.rugPickup ?? false).toLowerCase())} all finished — thanks for choosing ${esc(BUSINESS.name)}. Everything from the job is in this one email.</p>

  ${detailsBox(
    detailRow("WHAT WAS DONE", `<strong>${esc(serviceSummary(input, b?.rugPickup ?? false))}</strong>`) +
      detailRow("JOB DATE", esc(jobDate)),
  )}

  ${moneySection}
  ${care}
  ${promiseBox()}
  ${review}

  <p style="font-size:12px;line-height:1.6;color:${BRAND.grey};margin:0 0 8px">No GST has been charged — not registered for GST.</p>

  ${signOff("Thanks again")}`);
}

// ---------------------------------------------------------------------------
// Sending — email via Gmail SMTP settings, SMS via Twilio settings.
// ---------------------------------------------------------------------------

interface TwilioConfig {
  sid: string;
  token: string;
  from: string;
}

async function loadTwilio(): Promise<TwilioConfig | null> {
  const s = await getSettings(["twilio_sid", "twilio_token", "twilio_from"]);
  if (!s.twilio_sid || !s.twilio_token || !s.twilio_from) return null;
  return { sid: s.twilio_sid, token: s.twilio_token, from: s.twilio_from };
}

/** True once Twilio settings are saved — the booking form shows "text me" options only then. */
export async function isSmsConfigured(): Promise<boolean> {
  return (await loadTwilio()) !== null;
}

async function sendSms(config: TwilioConfig, to: string, body: string): Promise<void> {
  const resp = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${config.sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.sid}:${config.token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: config.from, Body: body }),
    },
  );
  if (!resp.ok) throw new Error(`Twilio ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
}

export interface SendResult {
  emailSent: boolean;
  smsSent: boolean;
  detail: string;
}

/**
 * Send a message the way the customer asked to be contacted: email → inbox,
 * phone → SMS (falling back to email if SMS isn't set up yet), either → both
 * when we can. Never throws — a message failure must never lose a booking.
 * `attachTerms` adds the Terms & Conditions PDF (booking confirmations);
 * `attachments` adds job PDFs (receipt/invoice on the job-complete email).
 */
export async function deliver(
  lead: LeadRow,
  email: { subject: string; text: string },
  sms: string,
  opts?: { attachTerms?: boolean; html?: string; attachments?: MailAttachment[] },
): Promise<SendResult> {
  const b = parseBooking(lead);
  const pref = b?.confirmBy ?? "either";
  const result: SendResult = { emailSent: false, smsSent: false, detail: "" };
  const notes: string[] = [];

  const wantEmail = pref !== "phone";
  const wantSms = pref !== "email";

  // Every customer email carries the logo inline, plus the Terms PDF on
  // booking confirmations. No van banner in the body — image-heavy email
  // is what content filters (Bigpond IB703) bounce.
  const attachments: MailAttachment[] = [
    { filename: "logo.png", content: brandLogo(), contentType: "image/png", cid: EMAIL_CID.logo },
  ];
  if (opts?.attachTerms) {
    attachments.push({ filename: "Marshalls-Carpet-Cleaning-Terms-and-Conditions.pdf", content: await termsPdfBuffer(), contentType: "application/pdf" });
  }
  if (opts?.attachments) attachments.push(...opts.attachments);
  const html = opts?.html ?? brandedEmailHtml(email.text);

  if (wantEmail && lead.email) {
    const smtp = await loadSmtpConfig();
    if (isSmtpConfigured(smtp)) {
      try {
        await sendMail(smtp, lead.email, email.subject, email.text, attachments, html);
        result.emailSent = true;
      } catch (err) {
        notes.push(`email failed (${String(err).slice(0, 120)})`);
      }
    } else {
      notes.push("email waiting — Gmail settings not saved yet");
    }
  }

  if (wantSms && lead.phone) {
    const twilio = await loadTwilio();
    if (twilio) {
      try {
        await sendSms(twilio, toAuMobile(lead.phone), sms);
        result.smsSent = true;
      } catch (err) {
        notes.push(`SMS failed (${String(err).slice(0, 120)})`);
      }
    } else {
      notes.push("SMS waiting — Twilio settings not saved yet");
      // Customer asked for a text but SMS isn't wired up — make sure they at
      // least get the email so nobody books into silence.
      if (!wantEmail && !result.emailSent && lead.email) {
        const smtp = await loadSmtpConfig();
        if (isSmtpConfigured(smtp)) {
          try {
            await sendMail(smtp, lead.email, email.subject, email.text, attachments, html);
            result.emailSent = true;
            notes.push("sent by email instead");
          } catch {
            /* already noted */
          }
        }
      }
    }
  }

  result.detail = notes.join("; ");
  return result;
}

/** 04xx xxx xxx → +614xxxxxxxx for Twilio. */
function toAuMobile(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0")) return `+61${digits.slice(1)}`;
  if (digits.startsWith("61")) return `+${digits}`;
  return digits;
}

/** Where the job sits in the day — used by the run sheet and follow-up timer. */
export function jobWindow(b: BookingDetails): { startMin: number; endMin: number } | null {
  if (b.preferredSlot === null || b.preferredSlot === undefined) return null;
  const startMin = SLOT_START_MINUTES[b.preferredSlot] ?? 480;
  return { startMin, endMin: startMin + (b.jobMinutes || 60) };
}

export { HOME_BASE, clockLabel, longDateLabel };
export { TIME_MODEL };
