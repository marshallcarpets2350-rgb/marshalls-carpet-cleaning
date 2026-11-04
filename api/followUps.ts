// Post-job follow-up timer — thank-you + review messages go out in one batch
// at 5:00 PM on the job day (a job still running past 5 gets theirs at its own
// finish time), and the job flips to completed on the board. Rug pickups are
// skipped: their "done" moment is the return delivery days later, so those go
// from the admin button.
import { eq, isNotNull, isNull, ne, and } from "drizzle-orm";
import { getDb } from "./queries/connection";
import { leads } from "@db/schema";
import { getSetting } from "./queries/settings";
import { SLOT_START_MINUTES } from "@contracts/rates";
import {
  parseBooking,
  followUpEmail,
  followUpSms,
  deliver,
  type LeadRow,
} from "./messages";

const END_OF_DAY_MIN = 17 * 60; // 5:00 PM — thank-yous batch at close of day
const TICK_MS = 5 * 60 * 1000;

/** Current date (yyyy-mm-dd) and minutes-after-midnight in business time. */
function sydneyNow(): { iso: string; minutes: number } {
  const now = new Date();
  const iso = now.toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
  const hm = now.toLocaleTimeString("en-GB", {
    timeZone: "Australia/Sydney",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [h, m] = hm.split(":").map(Number);
  return { iso, minutes: h * 60 + m };
}

async function sendDueFollowUps(): Promise<void> {
  const db = getDb();
  const rows = await db
    .select()
    .from(leads)
    .where(
      and(
        isNotNull(leads.bookingJson),
        isNull(leads.followUpSentAt),
        ne(leads.status, "completed"),
      ),
    );
  if (rows.length === 0) return;

  const { iso, minutes } = sydneyNow();
  const reviewUrl = (await getSetting("google_review_url"))?.trim() || null;

  for (const row of rows) {
    const b = parseBooking(row as LeadRow);
    if (!b || !b.preferredDate || b.preferredSlot === null || b.preferredSlot === undefined)
      continue;
    if (b.rugPickup) continue; // pickups complete on return delivery — manual button
    const endMin = (SLOT_START_MINUTES[b.preferredSlot] ?? 480) + (b.jobMinutes || 60);
    const sendAt = Math.max(END_OF_DAY_MIN, endMin);
    const due =
      b.preferredDate < iso ||
      (b.preferredDate === iso && minutes >= sendAt);
    if (!due) continue;

    const lead = row as LeadRow;
    const sent = await deliver(lead, followUpEmail(lead, reviewUrl), followUpSms(lead, reviewUrl));
    await db
      .update(leads)
      .set({ followUpSentAt: new Date(), status: "completed" })
      .where(eq(leads.id, row.id));
    console.log(
      `Follow-up for MCC-${row.id}: ${sent.emailSent ? "email " : ""}${sent.smsSent ? "SMS " : ""}${sent.detail || "ok"}`,
    );
  }
}

export function scheduleFollowUps(): void {
  setTimeout(() => {
    sendDueFollowUps().catch((e) => console.error("follow-up tick failed:", e));
    setInterval(() => {
      sendDueFollowUps().catch((e) => console.error("follow-up tick failed:", e));
    }, TICK_MS);
  }, 20_000); // let the server settle before the first tick
}
