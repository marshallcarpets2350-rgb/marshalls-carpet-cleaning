// Calendar availability maths — pure functions shared by the server (live
// availability from the database) and the client (offline fallback in the
// downloadable demo file, computed from a snapshot of the real bookings).
import {
  BOOKING_DAYS_AHEAD,
  BOOKING_NOTICE_DAYS,
  SLOT_MINUTES,
  TIME_SLOTS,
  driveBetween,
  driveMinutesFor,
  isMorningOnlyTown,
  morningOnlySlotAllowed,
} from "./rates";

/** Today as yyyy-mm-dd in the business's timezone. */
export function sydneyToday(): Date {
  const s = new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
  return new Date(`${s}T00:00:00`);
}

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Dates offered in the picker: Mon–Sat, from BOOKING_NOTICE_DAYS out. */
export function bookableDates(): string[] {
  const out: string[] = [];
  const start = sydneyToday();
  for (let d = new Date(start); ; d.setDate(d.getDate() + 1)) {
    const diff = Math.round((d.getTime() - start.getTime()) / 86400000);
    if (diff > BOOKING_DAYS_AHEAD) break;
    if (diff >= BOOKING_NOTICE_DAYS && d.getDay() !== 0) out.push(isoDay(d));
  }
  return out;
}

/** A booked job's footprint on a day: start slot, length in slots, town. */
export interface BookedSpan {
  date: string;
  slot: number;
  span: number;
  town: string;
}

/** One day of availability, as the calendar renders it. */
export interface AvailabilityDay {
  date: string;
  /** true = a job of the requested size can START in this slot. */
  slots: boolean[];
  /** true = slot is inside a booking's span or manually blocked. */
  occupied: boolean[];
}

/** Workdays (Mon–Sat) following `fromIso`, yyyy-mm-dd, `count` of them. */
export function nextWorkdays(fromIso: string, count: number): string[] {
  const out: string[] = [];
  const d = new Date(`${fromIso}T00:00:00`);
  while (out.length < count) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) out.push(isoDay(d));
  }
  return out;
}

/**
 * Split a booking into day-sized spans. A job longer than one day continues
 * at 7:00 AM on the following workdays — each continuation day comes off the
 * board in full so nothing else can be booked into it.
 */
export function spansForBooking(
  date: string,
  slot: number,
  span: number,
  town: string,
): BookedSpan[] {
  const daySlots = TIME_SLOTS.length;
  const firstTake = Math.min(span, daySlots - slot);
  const out: BookedSpan[] = [{ date, slot, span: firstTake, town }];
  let remaining = span - firstTake;
  for (const d of nextWorkdays(date, 8)) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, daySlots);
    out.push({ date: d, slot: 0, span: take, town });
    remaining -= take;
  }
  return out;
}

/**
 * Can a job of `span` slots in `town` start at `slot` on `date`?
 * The job has to fit the day (or, for multi-day jobs, take the whole start
 * day from 7:00 AM with every continuation workday fully clear), clear manual
 * blocks, and leave enough drive time around any other booking that day — so
 * a Walcha morning and an Armidale afternoon never collide, and far towns
 * start in the morning only.
 */
export function canStart(
  date: string,
  slot: number,
  span: number,
  town: string,
  blocked: Set<string>,
  spans: BookedSpan[],
): boolean {
  const daySlots = TIME_SLOTS.length;
  const multiDay = span > daySlots;
  if (multiDay && slot !== 0) return false; // big jobs take the whole first day
  const daySpan = Math.min(span, daySlots - slot);
  if (daySpan <= 0) return false;
  if (isMorningOnlyTown(driveMinutesFor(town)) && !morningOnlySlotAllowed(slot))
    return false;
  for (let i = slot; i < slot + daySpan; i++)
    if (blocked.has(`${date}:${i}`)) return false;
  for (const b of spans) {
    if (b.date !== date) continue;
    const buffer = Math.ceil(driveBetween(town, b.town) / SLOT_MINUTES);
    const bStart = b.slot - buffer;
    const bEnd = b.slot + b.span - 1 + buffer;
    if (slot <= bEnd && slot + daySpan - 1 >= bStart) return false;
  }
  if (multiDay) {
    // Every continuation workday must be completely free — the crew is on
    // this job from 7:00 AM, so nothing else can share those days.
    let remaining = span - daySlots;
    for (const d of nextWorkdays(date, 8)) {
      if (remaining <= 0) break;
      for (let i = 0; i < daySlots; i++) if (blocked.has(`${d}:${i}`)) return false;
      if (spans.some((b) => b.date === d)) return false;
      remaining -= daySlots;
    }
    if (remaining > 0) return false; // beyond the lookahead — don't offer it
  }
  return true;
}

/** Build every bookable day's availability for a job of `span` slots. */
export function buildAvailability(
  span: number,
  town: string,
  blocked: Set<string>,
  spans: BookedSpan[],
): AvailabilityDay[] {
  return bookableDates().map((date) => ({
    date,
    slots: TIME_SLOTS.map((_, i) => canStart(date, i, span, town, blocked, spans)),
    occupied: TIME_SLOTS.map(
      (_, i) =>
        blocked.has(`${date}:${i}`) ||
        spans.some((b) => b.date === date && i >= b.slot && i < b.slot + b.span),
    ),
  }));
}
