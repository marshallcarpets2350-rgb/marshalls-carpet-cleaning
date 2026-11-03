// Competitor comparison for the live quote summary.
// Every figure is taken from the competitor's own website or their own online
// quote calculator, and re-verified by the daily price watch (api/priceWatch.ts).
// BFYB's per-room rates come off their live booking config; Electrodry publish
// specials only (franchise pricing varies by area), so Electrodry appears ONLY
// when the daily check verified their numbers within the last 48 hours. If a
// competitor has no rate for a selected item, it lands in `missing` and is
// shown as not included in their price.

import {
  BFYB_MODEL,
  RATES,
  carpetStandardForArea,
  money,
  stainTreatmentFee,
  type BfybModel,
  type ElectroModel,
  type QuoteInput,
} from "@contracts/rates";

export interface CompetitorLine {
  label: string;
  amount: number;
}

export interface CompetitorEstimate {
  key: "bfyb" | "electrodry";
  name: string;
  lines: CompetitorLine[];
  /** Selected items the competitor publishes no rate for. */
  missing: string[];
  /** Sum of matched lines, or null if nothing matched. */
  total: number | null;
  /** True when some selected items couldn't be priced from published rates. */
  partial: boolean;
  /** Travel included in `total` (excluded again for the savings comparison). */
  travelAmount: number;
  /** Our price for exactly the items in `lines` — the like-for-like savings base. */
  oursComparable: number | null;
}

/** Our price for the carpet in this quote, at our own rates (no discounts). */
function ourCarpet(input: QuoteInput): number {
  if (input.carpetAreaM2 <= 0) return 0;
  return Math.round(
    carpetStandardForArea(input.carpetAreaM2) *
      RATES.carpet.multiplier[input.carpetDirtiness],
  );
}

/** Our price for the lounge seats in this quote, at our own rates. */
function ourSeats(input: QuoteInput): number {
  return input.lounges.reduce(
    (sum, l) =>
      sum +
      (l.seats > 0
        ? Math.round(l.seats * RATES.lounge.perSeat[l.dirtiness] + l.reclinerSeats * RATES.lounge.reclinerPerSeat)
        : 0),
    0,
  );
}

export interface CompareContext {
  /** Room-type counts from the quote builder's "Count my rooms" mode. */
  roomCounts?: Record<string, number>;
  /** Suburb/town from the address lookup — used for BFYB's per-town travel. */
  suburb?: string;
}

// --- Bang For Ya Buck (bangforyabuck.com.au) ---
// Their pricing model ships as BFYB_MODEL in contracts/rates.ts and is kept
// current by the daily price watch (api/priceWatch.ts), which writes their
// live numbers to the settings table; callers pass that live model in, so
// these estimates track their CURRENT prices. Their rule: carpet =
// max(minimum, base + flat per-room rates) × soiling multiplier; upholstery
// per seat; extras extra. Travel is a flat per-town surcharge.
function bfybView(model: BfybModel) {
  return {
    minimum: model.minimum,
    base: model.base,
    loungePerSeat: model.loungePerSeat,
    stainProduct: model.extras.stain,
    roomRates: model.roomRates,
    soilingMultiplier: model.soilingMultiplier,
    soilingLabel: {
      light: "Standard Clean",
      medium: "Deep Clean",
      heavy: "Restoration",
    } as Record<"light" | "medium" | "heavy", string>,
    // Blended $/m² across their room types — only used when the customer enters
    // an exact m² instead of counting rooms. Labelled as an approximation.
    approxPerM2: model.approxPerM2,
    travelByTown: model.travelByTown,
  };
}

function seatCount(input: QuoteInput): number {
  return input.lounges.reduce((s, l) => s + l.seats + l.reclinerSeats, 0);
}

function bfybTravel(suburb: string | undefined, BFYB: ReturnType<typeof bfybView>): { label: string; amount: number } | null {
  if (!suburb) return null;
  const key = suburb.trim().toLowerCase();
  for (const [town, fee] of Object.entries(BFYB.travelByTown)) {
    if (key.includes(town)) {
      return {
        label: fee === 0 ? `Travel — ${suburb} is in their free area` : `Travel to ${suburb}`,
        amount: fee,
      };
    }
  }
  return null;
}

function estimateBFYB(input: QuoteInput, ctx?: CompareContext, model: BfybModel = BFYB_MODEL): CompetitorEstimate {
  const BFYB = bfybView(model);
  const lines: CompetitorLine[] = [];
  const missing: string[] = [];
  const mult = BFYB.soilingMultiplier[input.carpetDirtiness];
  const soiling = BFYB.soilingLabel[input.carpetDirtiness];

  // Carpet — exact when the customer counted rooms (our room keys map 1:1 to
  // their room types, so their price models exactly); an approximation only
  // when they typed a raw m² figure, which their calculator doesn't take.
  let carpet = 0;
  const roomCounts = ctx?.roomCounts ?? {};
  const roomTotal = Object.values(roomCounts).reduce((s, n) => s + n, 0);

  if (input.carpetAreaM2 > 0) {
    let roomsTotal = 0;
    if (roomTotal > 0) {
      roomsTotal = Object.entries(roomCounts).reduce(
        (s, [key, n]) => s + n * (BFYB.roomRates[key] ?? 0),
        0,
      );
      lines.push({
        label: `Carpet — ${roomTotal} room${roomTotal > 1 ? "s" : ""}/areas at their room rates`,
        amount: roomsTotal,
      });
    } else {
      roomsTotal = Math.round(input.carpetAreaM2 * BFYB.approxPerM2);
      lines.push({
        label: `Carpet ~${input.carpetAreaM2} m² at their room rates (approx)`,
        amount: roomsTotal,
      });
    }
    lines.push({ label: "Service fee", amount: BFYB.base });

    // Their rule (re-verified from their live booking.js on 19/10/2026): the
    // service fee joins the rooms and that sum is floored at $289; the
    // condition multiplier then scales the whole standard-priced job. Their
    // add-ons — pre-vacuum $17/room, stain product $39, anti-microbial $39 —
    // are NEVER in their displayed price: their own flow only recommends them
    // on a later screen and ticks nothing automatically, even for ten-plus
    // stains or pet urine. So we add zero extras here and explain the gap in
    // words under the panel instead of padding their number.
    const baseCleaning = roomsTotal + BFYB.base;
    let standardTotal = baseCleaning;
    if (baseCleaning < BFYB.minimum) {
      const topUp = BFYB.minimum - baseCleaning;
      lines.push({ label: "Their minimum callout applies", amount: topUp });
      standardTotal = BFYB.minimum;
    }
    carpet = Math.round(standardTotal * mult);
    if (mult !== 1) {
      lines.push({
        label: `Condition loading — ${soiling} ×${mult}`,
        amount: carpet - standardTotal,
      });
    }
  }

  const seats = seatCount(input);
  const seatsCost = seats * BFYB.loungePerSeat;
  if (seats > 0) {
    lines.push({
      label: `${seats} lounge seat${seats > 1 ? "s" : ""} × ${money(BFYB.loungePerSeat)}`,
      amount: seatsCost,
    });
  }

  if (input.carpetAreaM2 === 0 && (input.stainPackage || input.enzymePreSpray)) {
    missing.push("Fabric stain/enzyme treatments — not published for upholstery");
  }
  if (input.mattresses.length > 0) missing.push("Mattresses — not published");
  if (input.dirtGum) missing.push("Dirt & gum removal — not published");

  let subtotal = carpet + seatsCost;
  const travel = bfybTravel(ctx?.suburb, BFYB);
  const travelAmount = travel && subtotal > 0 ? travel.amount : 0;
  if (travel && subtotal > 0) {
    if (travel.amount > 0) lines.push({ label: travel.label, amount: travel.amount });
    subtotal += travel.amount;
  }
  if (!travel && subtotal > 0 && input.carpetAreaM2 + seats > 0) {
    missing.push(
      "Their travel surcharge (+$57–$143 by town, Armidale free) not added — no town matched",
    );
  }

  // Like-for-like: our price for the same carpet + seats + treatments.
  const oursComparable =
    subtotal > 0
      ? ourCarpet(input) +
        ourSeats(input) +
        stainTreatmentFee(input) +
        (input.stainPackage ? RATES.extras.stainPackage : 0) +
        (input.enzymePreSpray ? RATES.extras.enzymePreSpray : 0)
      : null;

  return {
    key: "bfyb",
    name: "Bang For Ya Buck",
    lines,
    missing,
    total: subtotal > 0 ? subtotal : null,
    partial: missing.length > 0,
    travelAmount,
    oursComparable,
  };
}

/** Electrodry's published specials, mapped onto this quote. Only called when
 *  the daily watch has freshly verified the model — franchise pricing varies
 *  by area, so stale numbers are never shown. */
function estimateElectrodry(input: QuoteInput, model: ElectroModel): CompetitorEstimate {
  const lines: CompetitorLine[] = [];
  const missing: string[] = [];

  if (input.carpetAreaM2 > 0) {
    const twoRoomCap = 2 * model.roomCapM2;
    const fourRoomCap = 4 * model.roomCapM2;
    if (input.carpetAreaM2 <= twoRoomCap) {
      lines.push({ label: "Carpet, 2-room special", amount: model.carpetTwoRoom });
    } else if (input.carpetAreaM2 <= fourRoomCap) {
      lines.push({ label: "Carpet, 3-room special (4th room free)", amount: model.carpetThreeRoom });
    } else {
      missing.push("Carpet over 4 rooms — beyond their published specials");
    }
  }

  const seats = seatCount(input);
  if (seats >= 3 && seats <= 4) {
    lines.push({ label: `${seats} lounge seats, special`, amount: model.loungeSpecial });
  } else if (seats > 0) {
    missing.push(`${seats} lounge seats — outside their published 3–4 seat special`);
  }

  const queens = input.mattresses
    .filter((m) => m.size === "queen")
    .reduce((s, m) => s + m.qty, 0);
  const otherSizes = input.mattresses
    .filter((m) => m.size !== "queen")
    .reduce((s, m) => s + m.qty, 0);
  if (queens > 0) {
    lines.push({
      label: `${queens} queen mattress${queens > 1 ? "es" : ""} × ${money(model.queenMattress)}`,
      amount: queens * model.queenMattress,
    });
  }
  if (otherSizes > 0) missing.push("Non-queen mattresses — not published");
  if (input.stainPackage || input.stainTypes.length > 0 || input.dirtGum)
    missing.push("Stain packages — quoted by them directly");
  if (input.rugs.some((r) => r.qty > 0)) missing.push("Rugs — not published");

  // Like-for-like: our price for exactly what their specials cover.
  let oursComparable: number | null = 0;
  if (input.carpetAreaM2 > 0) {
    const fourRoomCap = 4 * model.roomCapM2;
    oursComparable += input.carpetAreaM2 <= fourRoomCap ? ourCarpet(input) : 0;
  }
  if (seats >= 3 && seats <= 4) oursComparable += ourSeats(input);
  if (queens > 0) {
    oursComparable += Math.round(
      queens * RATES.mattress.base.queen *
        RATES.mattress.dirtinessMultiplier[
          input.mattresses.find((m) => m.size === "queen")?.dirtiness ?? "light"
        ],
    );
  }
  if (lines.length === 0) oursComparable = null;

  return {
    key: "electrodry",
    name: "Electrodry",
    lines,
    missing,
    total: lines.length > 0 ? lines.reduce((s, l) => s + l.amount, 0) : null,
    partial: missing.length > 0,
    travelAmount: 0,
    oursComparable,
  };
}

/**
 * Indicative "same job" estimates from each competitor's verified rates.
 * Electrodry is included only when `electroModel` is passed — i.e. the daily
 * watch verified their published specials within the freshness window.
 */
export function competitorEstimates(
  input: QuoteInput,
  ctx?: CompareContext,
  model: BfybModel = BFYB_MODEL,
  electroModel?: ElectroModel | null,
): CompetitorEstimate[] {
  const out: CompetitorEstimate[] = [estimateBFYB(input, ctx, model)];
  if (electroModel) out.push(estimateElectrodry(input, electroModel));
  return out;
}
