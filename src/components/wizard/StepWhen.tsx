// Step 5 — your schedule: a professional sliding calendar, a full year out.
// Availability is live: booked jobs and blocked times come off the board in
// real time, the calendar works out how many hours your job needs and only
// offers start times that genuinely fit — including drive time around other
// bookings, and morning-only starts for far towns (Walcha way). Rug-only
// bookings use the same calendar but only the Friday pickup days
// light up. Everything is sized large so it's easy to read and easy to tap.
import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import { buildAvailability, type BookedSpan } from "@contracts/calendar";
import snapshotJson from "@/assets/availability-snapshot.json";
import {
  TIME_SLOTS,
  driveMinutesFor,
  isMorningOnlyTown,
  rugPickupDays,
  rugReturnDay,
  slotsNeededFor,
  RUG_PICKUP_LABEL,
} from "@contracts/rates";
import { StepHeading } from "./ui";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function fullDay(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function hoursLabel(minutes: number): string {
  const h = minutes / 60;
  return `${Math.round(h * 2) / 2}`.replace(/\.5$/, "½") + (h >= 1.5 ? " hours" : " hour");
}

/** First of the month, monthKey "yyyy-mm", and grid facts for a month. */
function monthFacts(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const leadBlanks = (first.getDay() + 6) % 7; // Monday-first offset
  const label = first.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
  return { daysInMonth, leadBlanks, label };
}

function monthKeyOf(iso: string): string {
  return iso.slice(0, 7);
}

/**
 * One sliding month of the booking calendar. `enabled` maps a bookable date
 * to a small badge (free-slot count, or the pickup window for rugs).
 */
function SlidingCalendar({
  enabled,
  monthKeys,
  selected,
  onSelect,
  initialIdx = 0,
}: {
  enabled: Map<string, string>; // iso → badge text
  monthKeys: string[]; // ordered "yyyy-mm" list spanning the year
  selected: string | null;
  onSelect: (iso: string) => void;
  initialIdx?: number; // open this many months in (plan visit 2 ≈ 6 months out)
}) {
  const [idx, setIdx] = useState(initialIdx);
  const [slide, setSlide] = useState<"left" | "right" | null>(null);

  if (monthKeys.length === 0) {
    return (
      <div className="flex min-h-64 items-center justify-center border-[1.5px] border-charcoal bg-creamlight/60 text-sm text-charcoal/50">
        Loading the year…
      </div>
    );
  }

  const go = (next: number) => {
    if (next < 0 || next >= monthKeys.length) return;
    setSlide(next > idx ? "right" : "left");
    setIdx(next);
  };

  const key = monthKeys[Math.min(idx, monthKeys.length - 1)];
  const { daysInMonth, leadBlanks, label } = monthFacts(key);
  const cells: (string | null)[] = [
    ...Array.from({ length: leadBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${key}-${String(i + 1).padStart(2, "0")}`),
  ];

  return (
    <div className="border-[1.5px] border-charcoal bg-background">
      {/* Month header with slide arrows */}
      <div className="flex items-center justify-between border-b-[1.5px] border-charcoal bg-creamlight px-4 py-3">
        <button
          type="button"
          aria-label="Previous month"
          disabled={idx === 0}
          onClick={() => go(idx - 1)}
          className="flex h-11 w-11 items-center justify-center border-[1.5px] border-charcoal bg-background text-xl font-black text-charcoal transition-colors hover:bg-mintlight disabled:opacity-25"
        >
          ‹
        </button>
        <p className="font-display text-xl font-black text-charcoal md:text-2xl">{label}</p>
        <button
          type="button"
          aria-label="Next month"
          disabled={idx >= monthKeys.length - 1}
          onClick={() => go(idx + 1)}
          className="flex h-11 w-11 items-center justify-center border-[1.5px] border-charcoal bg-background text-xl font-black text-charcoal transition-colors hover:bg-mintlight disabled:opacity-25"
        >
          ›
        </button>
      </div>

      {/* Sliding month grid */}
      <div className="overflow-hidden">
        <div
          key={key}
          className={slide === "right" ? "cal-slide-right" : slide === "left" ? "cal-slide-left" : ""}
        >
          <div className="grid grid-cols-7 gap-px border-b-[1.5px] border-charcoal/20 bg-charcoal/10">
            {WEEKDAYS.map((d) => (
              <p key={d} className="bg-creamlight py-2 text-center text-xs font-bold uppercase tracking-widest text-charcoal/60">
                {d}
              </p>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-charcoal/10">
            {cells.map((iso, i) => {
              if (!iso) return <div key={`x${i}`} className="bg-creamlight/60" />;
              const badge = enabled.get(iso);
              const open = badge !== undefined;
              const isSel = selected === iso;
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={!open}
                  onClick={() => onSelect(iso)}
                  className={`flex min-h-[64px] flex-col items-center justify-center gap-1 py-2 transition-colors md:min-h-[72px] ${
                    isSel
                      ? "bg-forest text-background"
                      : open
                        ? "bg-background hover:bg-mintlight"
                        : "bg-creamlight/60"
                  }`}
                >
                  <span
                    className={`font-display text-lg font-black leading-none md:text-xl ${
                      isSel ? "text-background" : open ? "text-charcoal" : "text-charcoal/25"
                    }`}
                  >
                    {Number(iso.slice(8))}
                  </span>
                  {open && !isSel && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-forest">
                      {badge}
                    </span>
                  )}
                  {isSel && <span className="text-[10px] font-bold uppercase tracking-wide">Selected</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The arrival windows under a picked day — big, easy-to-tap buttons. */
function SlotPicker({
  day,
  freeSlots,
  slot,
  onPick,
}: {
  day: string;
  freeSlots: boolean[];
  slot: number | null;
  onPick: (slot: number) => void;
}) {
  return (
    <div>
      <p className="mb-3 font-bold text-charcoal">Arrival time — {fullDay(day)}</p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {TIME_SLOTS.map((label, i) => {
          const free = freeSlots[i];
          const active = slot === i;
          return (
            <button
              key={i}
              type="button"
              disabled={!free}
              onClick={() => onPick(i)}
              className={`relative border-[1.5px] px-2 py-3.5 text-base font-bold transition-colors ${
                active
                  ? "border-forest bg-mintlight text-charcoal"
                  : free
                    ? "border-charcoal/30 bg-background text-charcoal hover:border-charcoal"
                    : "border-charcoal/20 bg-creamlight text-charcoal/40 line-through"
              }`}
            >
              {label}
              {free && !active && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-forest/70" />
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-sm text-charcoal/60">
        Crossed-out times are already booked — everything you can tap is genuinely free.
      </p>
    </div>
  );
}

export function StepWhen({
  date,
  slot,
  flexible,
  onPick,
  town,
  jobMinutes,
  rugsOnly,
  kicker = "Step 5 · Your schedule",
  title,
  sub,
  hideFlexible = false,
  startMonthOffset = 0,
  minDate,
  compact = false,
}: {
  date: string | null;
  slot: number | null;
  flexible: boolean; // "call me to arrange" selected
  onPick: (date: string | null, slot: number | null) => void; // (null, null) = call me
  town: string;
  jobMinutes: number;
  rugsOnly: boolean;
  kicker?: string;
  /** Heading overrides — the plan's visit-2 calendar reuses this component. */
  title?: string;
  sub?: string;
  /** Plan visit 2 must be a real booked date — no "call me" escape hatch. */
  hideFlexible?: boolean;
  /** Open the calendar this many months ahead (visit 2 ≈ 6 months out). */
  startMonthOffset?: number;
  /** Never offer dates on or before this one (visit 2 must follow visit 1). */
  minDate?: string;
  /** Skip the info notes — the first calendar on the page already said it. */
  compact?: boolean;
}) {
  const avail = trpc.public.listAvailability.useQuery(
    { town, jobMinutes },
    { staleTime: 30_000, retry: 1, enabled: !rugsOnly },
  );

  const span = slotsNeededFor(jobMinutes);
  const fullDayJob = span >= TIME_SLOTS.length; // takes the whole day — 8:00 AM start
  const driveMin = driveMinutesFor(town);
  const morningOnly = isMorningOnlyTown(driveMin);

  const fallbackDays = useMemo(() => {
    if (!avail.isError) return null;
    const snap = snapshotJson as { blocked: string[]; spans: BookedSpan[] };
    return buildAvailability(span, town, new Set(snap.blocked), snap.spans);
  }, [avail.isError, span, town]);

  const days = useMemo(
    () => avail.data ?? fallbackDays ?? [],
    [avail.data, fallbackDays],
  );

  // Visit 2 on the plan: only days AFTER the first clean are offered.
  const offeredDays = useMemo(
    () => (minDate ? days.filter((d) => d.date > minDate) : days),
    [days, minDate],
  );

  // Enabled dates + badges for the on-site calendar.
  const { enabled, monthKeys } = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of offeredDays) {
      const free = d.slots.filter(Boolean).length;
      if (free > 0) map.set(d.date, `${free} free`);
    }
    const keys = [...new Set(offeredDays.map((d) => monthKeyOf(d.date)))];
    return { enabled: map, monthKeys: keys };
  }, [offeredDays]);

  // Rug pickups — same calendar, but only Thu/Fri afternoons light up.
  const rug = useMemo(() => {
    if (!rugsOnly) return { enabled: new Map<string, string>(), monthKeys: [] as string[] };
    const pickup = rugPickupDays();
    const map = new Map<string, string>(pickup.map((iso) => [iso, "3–5pm"]));
    const keys = [...new Set(pickup.map(monthKeyOf))];
    return { enabled: map, monthKeys: keys };
  }, [rugsOnly]);

  const cal = rugsOnly ? rug : { enabled, monthKeys };
  const dayRow = offeredDays.find((d) => d.date === date);

  return (
    <div className="space-y-8">
      <style>{`
        @keyframes calSlideRight { from { transform: translateX(60px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
        @keyframes calSlideLeft { from { transform: translateX(-60px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
        .cal-slide-right { animation: calSlideRight .22s ease-out }
        .cal-slide-left { animation: calSlideLeft .22s ease-out }
      `}</style>

      <StepHeading
        kicker={kicker}
        title={title ?? (rugsOnly ? "Choose your pickup day" : "Choose your date & arrival window")}
        sub={
          sub ??
          (rugsOnly
            ? "Rugs are collected Friday between 3 and 5pm, and returned the Monday after — cleaned and dry. The calendar runs a full year ahead."
            : "This is our live booking calendar — every booked job comes off the board in real time, so any day and time you can select is genuinely available. It runs a full year ahead, and we confirm the exact time with you before the job.")
        }
      />

      {!rugsOnly && avail.isLoading && (
        <p className="text-sm text-charcoal/60">Checking the live calendar…</p>
      )}
      {!rugsOnly && avail.isError && (
        <p className="border-[1.5px] border-charcoal bg-creamlight px-4 py-3 text-sm text-charcoal/80">
          Showing a saved copy of the calendar — we'll confirm your exact time when we call.
        </p>
      )}

      {!compact && !rugsOnly && jobMinutes >= 60 && (
        <p className="border-[1.5px] border-charcoal/30 bg-creamlight px-4 py-3 text-sm text-charcoal/80">
          Your job needs about <strong>{hoursLabel(jobMinutes)}</strong> on site
          {span > 1 && (
            <>
              , so a start time reserves {span === 2 ? "that window and the one after" : `${span} windows from the start`}
            </>
          )}
          {" "}— the calendar only offers starts where the whole job fits.
        </p>
      )}
      {!compact && !rugsOnly && fullDayJob && (
        <p className="border-[1.5px] border-charcoal/30 bg-creamlight px-4 py-3 text-sm text-charcoal/80">
          That's a full-day job — it starts at 8:00 AM and the whole day is
          yours. Every job is finished in one day, so nothing carries over to
          the next.
        </p>
      )}
      {!compact && !rugsOnly && morningOnly && (
        <p className="border-[1.5px] border-charcoal/30 bg-creamlight px-4 py-3 text-sm text-charcoal/80">
          {town || "Your town"} is a fair drive out, so jobs there start in the
          morning — the afternoon stays free for the run back and anything in town.
        </p>
      )}

      {/* Christmas closure notice — shows through the lead-up and the break,
          then quietly disappears once we're back (11 Jan 2027). */}
      {!compact && new Date() < new Date(2027, 0, 11) && (
        <p className="border-[1.5px] border-charcoal bg-creamlight px-4 py-3 text-sm text-charcoal/80">
          {rugsOnly ? (
            <>
              🎄 <strong>Booked out over Christmas</strong> — the last rug pickup is
              Friday 11 December (back to you Monday 14th), and pickups start again
              Friday 15 January.
            </>
          ) : (
            <>
              🎄 <strong>Booked out over Christmas</strong> — we're cleaning right up
              to Friday 18 December, then we're back Monday 11 January. Any day you
              can still pick below is genuinely free, but December fills fast.
            </>
          )}
        </p>
      )}

      <div className="space-y-4">
        <SlidingCalendar
          enabled={cal.enabled}
          monthKeys={cal.monthKeys}
          selected={date}
          initialIdx={startMonthOffset}
          onSelect={(iso) => onPick(iso, fullDayJob ? 0 : null)}
        />

        {rugsOnly && date && (
          <div className="border-[1.5px] border-forest bg-mintlight px-4 py-3 text-sm">
            <p className="font-bold text-charcoal">{fullDay(date)}</p>
            <p className="mt-0.5 text-charcoal/70">
              Pickup {RUG_PICKUP_LABEL} → returned Monday{" "}
              {new Date(rugReturnDay(date) + "T12:00:00").toLocaleDateString("en-AU", {
                day: "numeric",
                month: "long",
              })}
              , cleaned and dry.
            </p>
          </div>
        )}

        {!rugsOnly && dayRow && (
          <SlotPicker
            day={dayRow.date}
            freeSlots={dayRow.slots}
            slot={slot}
            onPick={(s) => onPick(dayRow.date, s)}
          />
        )}
      </div>

      {!hideFlexible && (
        <button
          type="button"
          onClick={() => onPick(null, null)}
          className={`w-full border-[1.5px] p-4 text-left transition-colors ${flexible ? "border-forest bg-mintlight" : "border-charcoal/30 bg-background hover:border-charcoal"}`}
        >
          <p className="font-bold text-charcoal">Not sure yet — call me to arrange</p>
          <p className="mt-0.5 text-sm text-charcoal/60">
            We'll phone you and find a day that works.
          </p>
        </button>
      )}
    </div>
  );
}
