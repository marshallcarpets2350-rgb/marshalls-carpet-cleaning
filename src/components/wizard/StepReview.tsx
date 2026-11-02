// Final step — review & send: full recap, notes, discount code, submit.
// Shared by all three quote pages (/quote, /rugs, /lounge); `stepOf` tells
// the "Change" links where each section lives on the page.
import type { ConditionAnswers, Dirtiness, PaymentChoice, QuoteBreakdown, ConfirmBy } from "@contracts/rates";
import { CONFIRM_LABELS, PAYMENT_LABELS, PURPOSE_LABELS, RATES, TIME_SLOTS, SLOT_MINUTES, money, rugReturnDay } from "@contracts/rates";
import type { TravelResult } from "@/components/AddressField";
import type { Contact } from "./StepWhereWho";
import { StepHeading } from "./ui";

const DIRTINESS_LABELS: Record<Dirtiness, string> = {
  light: "Standard Clean",
  medium: "Deep Clean",
  heavy: "Restoration Clean",
};

export interface ReviewSteps {
  where: number;
  job: number;
  carpet: number;
  extras: number;
  when: number;
  payment: number;
}

function Row({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-charcoal/15 py-3 last:border-b-0">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-charcoal/50">{label}</p>
        <p className="mt-0.5 text-sm font-semibold text-charcoal">{value}</p>
      </div>
      <button type="button" onClick={onEdit} className="shrink-0 text-sm font-bold text-forest underline-offset-4 hover:underline">
        Change
      </button>
    </div>
  );
}

function conditionSummary(c: ConditionAnswers): string {
  const bits: string[] = [];
  if (c.pets === "inside") bits.push("indoor pets");
  if (c.pets === "outside") bits.push("outdoor pets only");
  if (c.smell === "up-close") bits.push("mild odour up close");
  if (c.smell === "noticeable") bits.push("noticeable odour");
  if (c.stains === "under-5") bits.push("less than 5 stains");
  if (c.stains === "over-5") bits.push("more than 5 stains");
  if (c.stains === "ten-plus") bits.push("10+ stains");
  if (c.stains === "none") bits.push("no stains");
  if (c.vacuumed === "week") bits.push("vacuumed within the week");
  if (c.vacuumed === "month") bits.push("vacuumed within the month");
  if (c.vacuumed === "longer") bits.push("a while since a thorough vacuum");
  return bits.length ? bits.join(", ") : "—";
}

export function StepReview({
  contact, confirmBy, travel, purpose, condition, dirtiness, breakdown,
  stainPackage, enzymePreSpray, preVacuum, roomCount, jobSummary,
  payment, date, slot, rugsOnly, hasCarpet, jobMinutes, pickupNote,
  kicker, stepOf,
  notes, setNotes,
  codeInput, setCodeInput, appliedCode, codeError, applyCode,
  submitting, submitError, slotConflict, canSubmit, onSubmit, onGoToStep,
}: {
  contact: Contact;
  confirmBy: ConfirmBy;
  travel: TravelResult | null;
  purpose: keyof typeof PURPOSE_LABELS | null;
  condition: ConditionAnswers;
  dirtiness: Dirtiness;
  breakdown: QuoteBreakdown;
  stainPackage: boolean;
  enzymePreSpray: boolean;
  preVacuum: boolean;
  roomCount: number;
  payment: PaymentChoice | null;
  date: string | null;
  slot: number | null;
  rugsOnly: boolean;
  hasCarpet: boolean;
  jobMinutes: number;
  /** Rug pickups only — where the rugs are collected from. */
  pickupNote?: string;
  kicker: string;
  stepOf: ReviewSteps;
  notes: string;
  setNotes: (s: string) => void;
  codeInput: string;
  setCodeInput: (s: string) => void;
  appliedCode: { code: string; percentOff: number } | null;
  codeError: string;
  applyCode: () => void;
  submitting: boolean;
  submitError: string | null;
  slotConflict: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  onGoToStep: (n: number) => void;
}) {
  const fmtDay = (iso: string) =>
    new Date(iso + "T12:00:00").toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
  const whenLabel = date && rugsOnly
    ? `Rug pickup ${fmtDay(date)}, 3:00 – 5:00 PM${pickupNote ? ` — ${pickupNote}` : ""} — returned Monday ${new Date(rugReturnDay(date) + "T12:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "long" })}`
    : date && slot !== null
      ? `${fmtDay(date)}, ${TIME_SLOTS[slot]}${jobMinutes > SLOT_MINUTES ? ` — about ${(Math.round((jobMinutes / 60) * 2) / 2).toString().replace(/\.5$/, "½")} hours on site` : ""}`
      : `Call me to arrange${rugsOnly && pickupNote ? ` — ${pickupNote}` : ""}`;

  const extras: string[] = [];
  if (enzymePreSpray) extras.push(`enzyme pre-spray (${money(RATES.extras.enzymePreSpray)})`);
  if (preVacuum) extras.push(`pre-vacuum ${roomCount} room${roomCount === 1 ? "" : "s"} (${money(roomCount * RATES.extras.preVacuumPerRoom)})`);
  if (stainPackage) extras.push(`stain treatment (${money(RATES.extras.stainPackage)})`);

  const jobBits: string[] = [];
  if (purpose) jobBits.push(PURPOSE_LABELS[purpose]);
  jobBits.push(jobSummary || breakdown.lines.map((l) => l.label.toLowerCase()).join(", ") || "nothing priced yet");

  return (
    <div className="space-y-8">
      <StepHeading kicker={kicker} title="Check it, then send." sub="This goes straight to our phone. We confirm the time and the price before anything is locked in." />

      <div className="border-[1.5px] border-charcoal bg-background px-5 py-2">
        <Row label="Your details" value={`${contact.name} · ${contact.phone} · ${contact.email}${travel?.addressLabel ? ` — ${travel.addressLabel}` : ""} · confirm by ${CONFIRM_LABELS[confirmBy]}`} onEdit={() => onGoToStep(stepOf.where)} />
        <Row label={hasCarpet ? "Your home" : "The items"} value={jobBits.join(" · ")} onEdit={() => onGoToStep(stepOf.job)} />
        {hasCarpet && (
          <Row label="Carpet condition" value={`${DIRTINESS_LABELS[dirtiness]} — ${conditionSummary(condition)}`} onEdit={() => onGoToStep(stepOf.carpet)} />
        )}
        {(extras.length > 0 || hasCarpet) && (
          <Row label="Add-ons" value={extras.length ? extras.join(" · ") : "None"} onEdit={() => onGoToStep(stepOf.extras)} />
        )}
        <Row label="Date & time" value={whenLabel} onEdit={() => onGoToStep(stepOf.when)} />
        <Row label="Payment" value={payment ? PAYMENT_LABELS[payment] : "—"} onEdit={() => onGoToStep(stepOf.payment)} />
      </div>

      <div>
        <label htmlFor="notes" className="mb-2 block font-bold text-charcoal">Anything we should know? (optional)</label>
        <textarea
          id="notes"
          className="input-sharp min-h-24"
          placeholder="e.g. where we'll find the key, gate access, parking close by, dog in the yard, red wine stain in the lounge room…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
        />
      </div>

      <div>
        <label htmlFor="code" className="mb-2 block font-bold text-charcoal">Discount code</label>
        <div className="flex max-w-md gap-2">
          <input
            id="code"
            className="input-sharp uppercase"
            placeholder="e.g. WELCOME10"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
          />
          <button type="button" onClick={applyCode} className="btn-pill-dark whitespace-nowrap !px-5">
            Apply
          </button>
        </div>
        {appliedCode && (
          <p className="mt-2 font-semibold text-forest" role="status">
            {appliedCode.code} applied — {appliedCode.percentOff}% off the cleaning.
          </p>
        )}
        {codeError && <p className="mt-2 font-semibold text-destructive" role="alert">{codeError}</p>}
      </div>

      <div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || !canSubmit}
          className="btn-pill w-full text-lg disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          {submitting ? "Sending…" : `Send my booking — ${money(breakdown.total)}`}
        </button>
        {slotConflict && (
          <p className="mt-3 border-[1.5px] border-destructive bg-background px-4 py-3 font-semibold text-destructive" role="alert">
            That time was just taken.{" "}
            <button type="button" className="underline" onClick={() => onGoToStep(stepOf.when)}>Pick another time</button>{" "}
            and send again.
          </p>
        )}
        {submitError && !slotConflict && (
          <p className="mt-3 font-semibold text-destructive" role="alert">{submitError}</p>
        )}
        <p className="mt-3 text-sm text-charcoal/60">
          Sending doesn't charge anything — we confirm the day, the price and the payment with you
          first. By booking you agree to our{" "}
          <a href="/terms" target="_blank" rel="noreferrer" className="font-semibold text-forest underline underline-offset-2">
            terms &amp; conditions
          </a>{" "}
          — a copy comes attached to your confirmation email, too.
        </p>
      </div>
    </div>
  );
}
