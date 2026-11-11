/** Everything the /thanks page needs to greet the customer properly. Stashed
 *  in sessionStorage the moment the booking is accepted, so it survives the
 *  round trip to Stripe checkout and back — and so /thanks never has to ask
 *  the server for booking details (no customer data in the URL, nothing to
 *  enumerate). If the stash is missing (hard refresh, different device) the
 *  page falls back to a generic thank-you. */
import { TIME_SLOTS, rugReturnDay } from "@contracts/rates";

export type ThanksBooking = {
  reference: string;
  total: number;
  firstName: string;
  date: string | null; // iso yyyy-mm-dd
  slot: number | null; // index into TIME_SLOTS; null for rug pickups
  flexible: boolean; // "call me to arrange"
  rugPickup: boolean;
  paid: boolean;
  /** 2-cleans-a-year plan — visit 2's booking, shown next to visit 1. */
  secondDate?: string | null;
  secondSlot?: number | null;
};

const KEY = "mcc-thanks";

export function stashThanks(b: ThanksBooking): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(b));
  } catch {
    // private mode etc — /thanks still renders, just generic
  }
}

export function readThanks(): ThanksBooking | null {
  try {
    const s = sessionStorage.getItem(KEY);
    return s ? (JSON.parse(s) as ThanksBooking) : null;
  } catch {
    return null;
  }
}

export function markThanksPaid(): void {
  const b = readThanks();
  if (b) stashThanks({ ...b, paid: true });
}

function fmtLong(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** The "we look forward to…" line — rug pickups get the Friday/Monday
 *  wording, cleans get their arrival window. */
export function whenLine(b: ThanksBooking): string {
  if (b.flexible || !b.date) {
    return "We'll give you a call to lock in a day that works.";
  }
  if (b.rugPickup) {
    return `We look forward to seeing you ${fmtLong(b.date)}, 3:00 – 5:00 PM, to collect your rugs — cleaned and dried, then back to you ${fmtLong(rugReturnDay(b.date))}.`;
  }
  if (b.slot !== null) {
    return `We look forward to seeing you ${fmtLong(b.date)}, arriving ${TIME_SLOTS[b.slot]} — it's in the schedule already, and we'll confirm the exact time with you.`;
  }
  return "We'll give you a call to lock in a day that works.";
}

/** The plan's second visit — already booked in, 10% off applied. */
export function secondVisitLine(b: ThanksBooking): string | null {
  if (!b.secondDate) return null;
  return `And visit 2 is in the schedule too — ${fmtLong(b.secondDate)}${b.secondSlot !== null && b.secondSlot !== undefined ? `, arriving ${TIME_SLOTS[b.secondSlot]}` : ""}, with your 10% plan discount on both cleans.`;
}
