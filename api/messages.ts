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
  longDateLabel,
  money,
  slotsNeededFor,
  serviceSummary,
  serviceKinds,
  rugReturnDay,
  paymentDueDay,
  type QuoteInput,
} from "@contracts/rates";
import { loadSmtpConfig, isSmtpConfigured, sendMail, type MailAttachment } from "./mailer";
import { termsPdfBuffer } from "./termsPdf";
import { brandedEmailHtml, EMAIL_CID } from "./emailTemplate";
import { brandLogo } from "./brand";
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
  payment: "pay-now" | "invoice" | "cash" | null;
  town: string;
  jobMinutes: number;
  rugPickup: boolean;
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
  return name.trim().split(/\s+/)[0] || name;
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
  if (b.payment === "invoice")
    return `Invoice after the job (5-day terms) — pay by PayID to ${BUSINESS.payId}, by bank transfer or by card. Put ${ref} in the payment description so it lands straight against your job`;
  return `Pay on the day — cash, or instant bank transfer to our PayID: ${BUSINESS.payId} (put ${ref} in the description)`;
}

export function bookingReference(lead: LeadRow): string {
  return `MCC-${String(lead.id).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Booking confirmation
// ---------------------------------------------------------------------------

export function confirmationEmail(lead: LeadRow): { subject: string; text: string } {
  const b = parseBooking(lead);
  const input = parseQuote(lead);
  const ref = bookingReference(lead);
  const where = [lead.address, lead.suburb].filter(Boolean).join(", ") || "your place";
  const big =
    b && slotsNeededFor(b.jobMinutes) >= TIME_SLOTS.length
      ? `\nThis is a big one — a full day on the tools, starting at 8:00 AM sharp. The whole day is yours.\n`
      : "";
  const collection = b?.rugPickup
    ? `\n• Collection: ${
        b.access?.method === "leave-out"
          ? `rugs left out — ${b.access.spot || "where we discussed"}. We'll grab them between 3:00 and 5:00 PM`
          : "someone will be home between 3:00 and 5:00 PM to hand them over"
      }`
    : "";
  return {
    subject: `Booking confirmed — ${BUSINESS.name} (${ref})`,
    text: `Hi ${firstName(lead.name)},

Beauty — you're booked in with ${BUSINESS.name}.

YOUR BOOKING
• ${serviceSummary(input, b?.rugPickup ?? false)}
• When: ${b ? whenLine(b) : "Time to be confirmed — we'll call you"}
• Where: ${where}${collection}
• Total: ${money(lead.total)} — ${b ? paymentLine(b, lead) : "pay on the day"}
• Reference: ${ref}
${big}
Every clean includes a commercial pre-vacuum and pre-spray. We'll call or text the day before to confirm the exact arrival time. Anything change? Call or text ${BUSINESS.phone} and we'll sort it.

A copy of our Terms & Conditions is attached as a PDF — plain-English, two pages, yours to keep. They're also on our website any time under "Terms & conditions" in the footer.

See you soon,
The ${BUSINESS.name} team
${BUSINESS.phone} · ${BUSINESS.email}`,
  };
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
    if (bd?.seasonalDiscount) lines.push({ label: `${bd.seasonalPromo?.label ?? "Seasonal deal"} — ${bd.seasonalPromo?.percent ?? ""}% off`.replace(" — %", ""), amount: -bd.seasonalDiscount });
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
• ${when}

WHERE
• ${where}

PRICE
${lines.map((l) => `• ${l.label} — ${money(l.amount)}`).join("\n")}${travel !== null ? `\n• Travel — ${money(travel)}` : ""}
• TOTAL: ${money(lead.total)}${lead.paidOnline ? " — PAID ONLINE ✓" : ""}

DETAILS
• Payment: ${b?.payment === "pay-now" ? "paying online" : b?.payment === "invoice" ? "invoice after the job" : "on the day"}${b?.access?.method ? `\n• Access: ${{ "be-there": "customer home", agent: "real-estate agent", lockbox: "lockbox", "someone-else": "someone else letting us in", "leave-out": "rugs left out" }[b.access.method]}${b.access.spot ? ` — ${b.access.spot}` : ""}` : ""}${b?.notes ? `\n• Notes: ${b.notes}` : ""}

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
 *  when you're ready to lock in a day. */
export function quoteEmailForCustomer(d: {
  name: string;
  reference: string;
  lines: { label: string; detail?: string; amount: number }[];
  total: number;
  travelFee: number;
  town?: string | null;
}): { subject: string; text: string } {
  const jobLines = d.lines
    .map((l) => `• ${l.label}${l.detail ? ` — ${l.detail}` : ""} — ${l.amount < 0 ? `−${money(-l.amount)}` : money(l.amount)}`)
    .join("\n");
  return {
    subject: `Your quote — ${BUSINESS.name} (${d.reference})`,
    text: `Hi ${firstName(d.name)},

Thanks for chatting with us — here's your price in writing.

YOUR QUOTE
${jobLines}
${d.travelFee > 0 ? `• Travel — ${money(d.travelFee)}\n` : ""}
Total: ${money(d.total)}
Reference: ${d.reference}

No date is locked in yet — this is just your price, held for 30 days. When you're ready, call or text ${BUSINESS.phone} (or just reply to this email) with your reference and we'll find a day that suits.

Every clean includes a commercial pre-vacuum and pre-spray, and the price above is the price on the day — no surprises.

Talk soon,
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
If anything at all doesn't look right, call ${BUSINESS.phone} within 7 days and we'll come back and put it right — free. That's the deal.
${reviewBlock}
Thanks again,
The ${BUSINESS.name} team
${BUSINESS.phone} · ${BUSINESS.email}`,
  };
}

export function followUpSms(lead: LeadRow, reviewUrl: string | null): string {
  const review = reviewUrl ? ` Happy with the clean? A quick review helps us heaps: ${reviewUrl}` : "";
  return `${BUSINESS.name}: all done — thanks for having us! Anything not right, call ${BUSINESS.phone} within 7 days and we'll fix it free.${review}`;
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

Anything not right with the clean? Call ${BUSINESS.phone} within 7 days and we'll come back and put it right — free.

The ${BUSINESS.name} team
${BUSINESS.phone} · ${BUSINESS.email}`,
  };
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
  const cardBlock = payUrl ? `• Card: pay securely online — ${payUrl}\n` : "";
  const reviewBlock = reviewUrl
    ? `\nHappy with the result? A quick Google review honestly helps our little local business more than anything — it takes about a minute:\n${reviewUrl}\n`
    : "";
  return {
    subject: `Invoice — ${BUSINESS.legalName} (${ref})`,
    text: `Hi ${firstName(lead.name)},

Thanks for having us${jobIso ? ` on ${longDateLabel(jobIso)}` : ""} — your invoice is attached as a PDF.

INVOICE ${ref}
• What was done: ${serviceSummary(input, b?.rugPickup ?? false)}
• Total due: ${money(lead.total)} — 5-day terms${dueLabel ? ` (due ${dueLabel})` : ""}

HOW TO PAY
${cardBlock}• PayID (instant bank transfer): ${BUSINESS.payId}
• Cash or bank transfer: call ${BUSINESS.phone} and we'll sort it
Put ${ref} in the payment description so it lands straight against your job.

No GST has been charged — not registered for GST.

Anything not right with the clean? Call ${BUSINESS.phone} within 7 days and we'll come back and put it right — free.
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
 * `attachTerms` adds the Terms & Conditions PDF (booking confirmations).
 */
export async function deliver(
  lead: LeadRow,
  email: { subject: string; text: string },
  sms: string,
  opts?: { attachTerms?: boolean },
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
  const html = brandedEmailHtml(email.text);

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
