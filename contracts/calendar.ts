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

/** Dates offered in the picker: from BOOKING_NOTICE_DAYS out. Sundays are
 *  never offered, and Saturdays stopped being offered from 14 Nov 2026
 *  (owner call — weekends are for the rug run and rest). Saturday bookings
 *  made before then (e.g. 7 Nov) are honoured. */
export const LAST_BOOKABLE_SATURDAY = "2026-11-07";

export function bookableDates(): string[] {
  const out: string[] = [];
  const start = sydneyToday();
  for (let d = new Date(start); ; d.setDate(d.getDate() + 1)) {
    const diff = Math.round((d.getTime() - start.getTime()) / 86400000);
    if (diff > BOOKING_DAYS_AHEAD) break;
    if (diff < BOOKING_NOTICE_DAYS) continue;
    const day = d.getDay();
    const iso = isoDay(d);
    if (day === 0) continue; // Sundays never
    if (day === 6 && iso > LAST_BOOKABLE_SATURDAY) continue; // Saturdays: rug/rest days
    out.push(iso);
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
 * A booked job's footprint on a day. Every job is done in a single day —
 * nothing ever spills into the next — so the span is clamped to the day.
 */
export function spansForBooking(
  date: string,
  slot: number,
  span: number,
  town: string,
): BookedSpan[] {
  const daySlots = TIME_SLOTS.length;
  const take = Math.min(span, daySlots - slot);
  if (take <= 0) return [];
  return [{ date, slot, span: take, town }];
}

/**
 * Can a job of `span` slots in `town` start at `slot` on `date`?
 * The job has to fit inside the day (jobs never run into the next day),
 * clear manual blocks, and leave enough drive time around any other booking
 * that day — so a Walcha morning and an Armidale afternoon never collide,
 * and far towns start in the morning only.
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
  if (span > daySlots) return false; // too big for one day — phone job
  if (slot + span > daySlots) return false; // must finish by close of day
  if (isMorningOnlyTown(driveMinutesFor(town)) && !morningOnlySlotAllowed(slot))
    return false;
  for (let i = slot; i < slot + span; i++)
    if (blocked.has(`${date}:${i}`)) return false;
  for (const b of spans) {
    if (b.date !== date) continue;
    const buffer = Math.ceil(driveBetween(town, b.town) / SLOT_MINUTES);
    const bStart = b.slot - buffer;
    const bEnd = b.slot + b.span - 1 + buffer;
    if (slot <= bEnd && slot + span - 1 >= bStart) return false;
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
