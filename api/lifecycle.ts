// Booking lifecycle emails — two automatic sweeps, both idempotent:
//   1. Day-before reminder — "see you tomorrow" with the arrival window,
//      total and prep notes. Sent the afternoon before every booking.
//   2. Six-month nudge — "time for a freshen-up?" pointing at the
//      2-cleans-a-year maintenance plan (10% off every clean). Sent once per
//      completed job, roughly 182 days after the job date.
// Flags on the lead (reminder_sent_at / nudge_sent_at) make re-runs harmless,
// so the sweep also runs at boot to catch anything missed while redeploying.
import { and, eq, isNotNull, isNull, ne } from "drizzle-orm";
import { getDb } from "./queries/connection";
import { leads } from "@db/schema";
import {
  parseBooking,
  reminderEmail,
  reminderSms,
  nudgeEmail,
  nudgeSms,
  deliver,
  bookingReference,
  type LeadRow,
} from "./messages";

const NUDGE_AFTER_DAYS = 182; // ~6 months
const NUDGE_STALE_DAYS = 240; // older than this, don't surprise them out of the blue

/** yyyy-mm-dd in business time, offset by `plusDays`. */
function sydneyDate(plusDays = 0): string {
  const now = new Date(Date.now() + plusDays * 24 * 60 * 60 * 1000);
  return now.toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
}

function daysBetween(isoA: string, isoB: string): number {
  return Math.round((Date.parse(isoB) - Date.parse(isoA)) / (24 * 60 * 60 * 1000));
}

async function sendDayBeforeReminders(): Promise<number> {
  const db = getDb();
  const tomorrow = sydneyDate(1);
  const rows = await db
    .select()
    .from(leads)
    .where(and(isNotNull(leads.bookingJson), isNull(leads.reminderSentAt), ne(leads.status, "completed")));
  let sent = 0;
  for (const row of rows) {
    const b = parseBooking(row as LeadRow);
    if (!b || b.preferredDate !== tomorrow) continue;
    const lead = row as LeadRow;
    const r = await deliver(lead, reminderEmail(lead), reminderSms(lead));
    // Only flag when something actually went out — an SMTP hiccup retries at
    // the next sweep instead of silently dropping the reminder.
    if (r.emailSent || r.smsSent) {
      await db.update(leads).set({ reminderSentAt: new Date() }).where(eq(leads.id, row.id));
    }
    console.log(
      `Reminder for ${bookingReference(lead)}: ${r.emailSent ? "email " : ""}${r.smsSent ? "SMS " : ""}${r.detail || "ok"}`,
    );
    sent++;
  }
  return sent;
}

async function sendSixMonthNudges(): Promise<number> {
  const db = getDb();
  const today = sydneyDate();
  const rows = await db
    .select()
    .from(leads)
    .where(and(eq(leads.status, "completed"), isNull(leads.nudgeSentAt)));
  let sent = 0;
  for (const row of rows) {
    const b = parseBooking(row as LeadRow);
    const jobDate = b?.preferredDate ?? row.createdAt?.toISOString().slice(0, 10) ?? null;
    if (!jobDate) continue;
    const age = daysBetween(jobDate, today);
    if (age < NUDGE_AFTER_DAYS) continue;
    // Mark stale ones as done so we never surprise someone a year later.
    if (age > NUDGE_STALE_DAYS) {
      await db.update(leads).set({ nudgeSentAt: new Date() }).where(eq(leads.id, row.id));
      continue;
    }
    const lead = row as LeadRow;
    const r = await deliver(lead, nudgeEmail(lead), nudgeSms(lead));
    if (r.emailSent || r.smsSent) {
      await db.update(leads).set({ nudgeSentAt: new Date() }).where(eq(leads.id, row.id));
    }
    console.log(
      `6-month nudge for ${bookingReference(lead)}: ${r.emailSent ? "email " : ""}${r.smsSent ? "SMS " : ""}${r.detail || "ok"}`,
    );
    sent++;
  }
  return sent;
}

export async function runLifecycleSweep(): Promise<void> {
  const reminders = await sendDayBeforeReminders();
  const nudges = await sendSixMonthNudges();
  if (reminders + nudges > 0) console.log(`Lifecycle sweep: ${reminders} reminder(s), ${nudges} nudge(s)`);
}

/** Milliseconds until the next 4:30 PM on the Sydney wall clock. */
function msUntilNextSweep(): number {
  const now = Date.now();
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const sydneyWall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  let target = Date.UTC(get("year"), get("month") - 1, get("day"), 16, 30, 0);
  if (target <= sydneyWall) target += 24 * 60 * 60 * 1000;
  return target - sydneyWall;
}

/**
 * Daily at 4:30 PM Sydney — afternoon before the job, so the reminder lands
 * while they're thinking about tomorrow. Boot sweep catches missed windows
 * (flags keep it idempotent).
 */
export function scheduleLifecycle(): void {
  void runLifecycleSweep().catch((err) => console.error("Lifecycle sweep failed:", err));
  const firstIn = msUntilNextSweep();
  console.log(`Lifecycle emails: next sweep in ${Math.round(firstIn / 60000)} min (4:30 PM Sydney)`);
  setTimeout(() => {
    void runLifecycleSweep().catch((err) => console.error("Lifecycle sweep failed:", err));
    setInterval(() => {
      void runLifecycleSweep().catch((err) => console.error("Lifecycle sweep failed:", err));
    }, 24 * 60 * 60 * 1000).unref();
  }, firstIn).unref();
}
