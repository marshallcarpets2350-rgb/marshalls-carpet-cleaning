// Marshall's Carpet Cleaning — shared pricing engine.
// Used by the frontend (live quote total) and the backend (server-side
// re-computation when a lead is submitted). Change rates here only.

export type Dirtiness = "light" | "medium" | "heavy";
export type MattressSize = "single" | "double" | "queen" | "king";
export type MaintenancePlan = "none" | "two";

export const RATES = {
  carpet: {
    // Stepped standard rate — the bigger the house, the cheaper the metre:
    //   $4.00/m² for the first 40m², $3.80 to 60m², $3.60 to 80m²,
    //   $3.40 for every metre past 80. Each band prices only the metres in
    //   it (like tax brackets), so a quote never jumps backwards.
    // Deep and restoration stay multipliers on the stepped standard figure
    // (same structure as BFYB's ×1.30 / ×2.11, just gentler), and the
    // restoration rate undercuts them hardest on the expensive specialised
    // work (launch pricing, first 6 months).
    tiers: [
      { upTo: 40, perM2: 4.0 },
      { upTo: 60, perM2: 3.8 },
      { upTo: 80, perM2: 3.6 },
      { upTo: Infinity, perM2: 3.4 },
    ] as { upTo: number; perM2: number }[],
    perM2: { light: 4.0, medium: 4.4, heavy: 7.4 } as Record<Dirtiness, number>, // display only
    multiplier: { light: 1, medium: 1.1, heavy: 1.85 } as Record<Dirtiness, number>,
  },
  minimumCharge: 150, // BFYB's minimum callout is $289
  lounge: {
    perSeat: { light: 60, medium: 66, heavy: 75 } as Record<Dirtiness, number>, // BFYB: $97/seat flat
    reclinerPerSeat: 15,
  },
  mattress: {
    base: { single: 60, double: 80, queen: 90, king: 110 } as Record<
      MattressSize,
      number
    >,
    dirtinessMultiplier: { light: 1, medium: 1.2, heavy: 1.4 } as Record<
      Dirtiness,
      number
    >,
  },
  // Stain treatment, priced from the customer's own stain answers — a
  // structured scale: pet accidents cost the most (urine soaks to the
  // backing), food & drink sits in the middle, mud & heavy traffic the
  // least. Priced for the toughest stain ticked; each extra type half price.
  // On a Restoration Clean all of this is already included — no charge.
  stainCauseFee: {
    "pet-urine": 69,
    "food-drink": 45,
    "mud-traffic": 29,
    "not-sure": 45,
  } as Record<StainType, number>,
  extras: {
    // Kept for the BFYB comparison maths (their calculator still sells these
    // as add-ons; ours are either included free or priced into the quote).
    stainPackage: 30, // BFYB extra stain removal product $39/job
    enzymePreSpray: 37, // BFYB anti-microbial treatment $39/job
    preVacuumPerRoom: 10, // BFYB pre-vacuum $17/room — ours is FREE on every clean
  },
  rug: {
    // Rug pick-up & clean service — collected Thu/Fri 3–5pm, back Monday.
    bulkCount: 3, // this many rugs or more…
    bulkPercentOff: 10, // …gets this % off the rug subtotal
  },
  travel: {
    freeRadiusKm: 0, // no free radius — travel is charged from Armidale itself outward
    perKmEachWay: 1.0, // $ per km each way outside Armidale
    maxServiceKm: 120, // beyond this: call for a quote
    // Rug-only pickup runs: a straight $1/km from Armidale for the full
    // trip, rounded up to the nearest $5 (the town flats don't apply to it).
    rugPerKm: 1.0,
    // Flat travel for the towns priced by hand — all under BFYB's flat
    // surcharges (Uralla $57, Guyra $91, Walcha $143). Armidale itself is
    // free; everywhere else stays per-km.
    flatByTown: { armidale: 0, uralla: 30, guyra: 46, walcha: 120 } as Record<string, number>,
  },
  // $10 off every full $150 of the clean — stacks with other discounts.
  volumeDiscount: { every: 150, off: 10 },
  maintenance: {
    none: 0,
    two: 0.10, // 2 cleans a year — 10% off every clean
  } as Record<MaintenancePlan, number>,
} as const;

export const BUSINESS = {
  name: "Marshall's Carpet Cleaning",
  // Registered business name — used on formal documents (receipts, T&C,
  // anything showing the ABN). The friendly trading name above stays on the
  // website and in customer chat.
  legalName: "Marshall's Carpet Cleaning Co",
  abn: "ABN 92 101 709 902",
  owner: "The Marshall's team",
  phone: "0423 581 223",
  phoneHref: "tel:+61423581223",
  email: "Marshallcarpets2350@gmail.com",
  // Instant bank-transfer option (Hnry account) — shown wherever customers
  // can pay by transfer instead of card.
  payId: "bmarshall7@hnry.co",
  area: "Armidale & the New England",
  // Home base — 35 Campion Parade, Armidale (North Hill). Every day starts
  // and ends here; all travel is measured from this point.
  origin: { lat: -30.5010787, lon: 151.6669493 },
} as const;

// ---------------------------------------------------------------------------
// BFYB's live rate card — read off their booking page (booking-config.js,
// terms effective 11 Oct 2026). Powers the competitor comparison panel and
// the 17%-under backstop below; the daily price watch (api/priceWatch.ts)
// re-reads their config and flags any drift.

/** Every quote stays at least this far under BFYB's comparable total.
 *  Launch strategy (first 6 months): a full 17% under, so the specialised
 *  and expensive cleans undercut them hardest while we build the name. */
// Launch strategy (first 6 months): every quote stays at least this far
// under BFYB's live price for the same job. Re-checked daily by priceWatch.
export const BFYB_UNDERCUT_PERCENT = 17;
// ---------------------------------------------------------------------------

export interface BfybModel {
  base: number; // per-job service fee
  minimum: number; // minimum callout
  loungePerSeat: number;
  extras: { prevacPerRoom: number; antimicro: number; stain: number; fanPerDay: number; fleaEol: number };
  roomRates: Record<string, number>;
  soilingMultiplier: Record<Dirtiness, number>;
  // Blended $/m² across their room types — only used for raw-m² quotes.
  approxPerM2: number;
  // Flat per-town travel surcharge from their config (Armidale free).
  travelByTown: Record<string, number>;
  // Their published flood & water damage rates (from the same booking config).
  flood?: { inspection: number; extractionOne: number; extractionTwo: number };
}

// This is the FALLBACK model. The daily price watch (api/priceWatch.ts) keeps
// a live copy in the settings table (key "bfyb_model_live") that every quote
// and the comparison table actually price from — when BFYB move a number, our
// site follows automatically and the owner gets an email. These constants are
// what the site uses until the first successful daily check lands.
export const BFYB_MODEL: BfybModel = {
  base: 33, // per-job service fee
  minimum: 289, // minimum callout
  loungePerSeat: 97,
  extras: { prevacPerRoom: 17, antimicro: 39, stain: 39, fanPerDay: 41, fleaEol: 182 },
  roomRates: {
    bed: 54, // Bedroom — up to 4×4 m
    bedLarge: 78, // Large bedroom — up to 5×5 m
    wir: 20, // Walk-in robe — up to 2×2 m
    wirLarge: 39, // Large walk-in robe — up to 3×3 m
    living: 78, // Living room — up to 5×5 m
    livingLg: 104, // Large living room — up to 6×6 m
    dining: 54, // Dining room — up to 4×4 m
    hall: 33, // Hallway — up to 3×1 m
    hall2: 66, // Double hallway — up to 6×1 m
    hall3: 99, // Triple hallway — up to 9×1 m
    hall4: 132, // Long hallway — up to 12×1 m
    stairs: 78, // 16 steps or fewer
  } as Record<string, number>,
  soilingMultiplier: { light: 1.0, medium: 1.3, heavy: 2.11 } as Record<Dirtiness, number>,
  // Blended $/m² across their room types — only used for raw-m² quotes.
  approxPerM2: 3.6,
  // Flat per-town travel surcharge from their config (Armidale free).
  travelByTown: {
    armidale: 0,
    uralla: 57,
    "black mountain": 65,
    hillgrove: 78,
    guyra: 91,
    walcha: 143,
  },
  // Their published flood & water damage rates (same config, verified 3 Nov 2026).
  flood: { inspection: 182, extractionOne: 289, extractionTwo: 409 },
};

/** Their calculator's total for the carpet + lounges + matched extras in a
 *  quote (cleaning only, their minimum included). Null when nothing on the
 *  job maps to their rate card. Used by the comparison panel. */
export function bfybComparableTotal(q: QuoteInput, model: BfybModel = BFYB_MODEL): number | null {
  let carpet = 0;
  if (q.carpetAreaM2 > 0) {
    const roomSum = q.roomCounts
      ? Object.entries(q.roomCounts).reduce(
          (s, [k, n]) => s + n * (model.roomRates[k] ?? 0),
          0,
        )
      : 0;
    // Exact from their room list when rooms were counted; a blended $/m² only
    // when the customer typed a raw area (their calculator has no m² mode).
    const roomsTotal = roomSum > 0 ? roomSum : q.carpetAreaM2 * model.approxPerM2;

    // Their CRM rule (read from booking-config/carpet-calc/booking.js on
    // 19/10/2026): service fee joins the rooms and the SUM is floored at the
    // minimum; the condition multiplier scales the whole standard-priced job;
    // travel stays out. Their add-ons — pre-vacuum $17/room, stain product
    // $39, anti-microbial $39, fans $41 — are NEVER in their displayed price:
    // booking.js syncRecommended() deliberately ticks nothing, so even "ten or
    // more stains" or pet urine only RECOMMENDS a product on a later screen.
    // We therefore add zero extras to their number; the difference is
    // explained in words next to the comparison instead.
    const tickedTotal = roomsTotal + model.base;
    const standardTotal =
      tickedTotal < model.minimum ? model.minimum : tickedTotal;
    carpet = Math.round(standardTotal * model.soilingMultiplier[q.carpetDirtiness]);
  }
  const seats = q.lounges.reduce((s, l) => s + l.seats + l.reclinerSeats, 0);
  const total = carpet + seats * model.loungePerSeat;
  if (total <= 0) return null;
  return total;
}

/** Our side of the same comparable scope (used by the comparison panel). */
export function comparableSubtotal(
  q: QuoteInput,
  carpetSubtotal: number,
  rates: Rates = DEFAULT_RATES,
): number {
  let ours = carpetSubtotal;
  for (const l of q.lounges) {
    if (l.seats <= 0) continue;
    ours += Math.round(
      l.seats * rates.lounge.perSeat[l.dirtiness] +
        l.reclinerSeats * rates.lounge.reclinerPerSeat,
    );
  }
  ours += stainTreatmentFee(q, rates);
  if (q.stainPackage) ours += rates.extras.stainPackage; // legacy fabric add-on
  if (q.enzymePreSpray) ours += rates.extras.enzymePreSpray;
  // Pre-vacuum is FREE with every clean — nothing to add on our side.
  return ours;
}

/** Their flat travel surcharge for a town, matched loosely. */
export function bfybTravelForTown(town: string | null | undefined, model: BfybModel = BFYB_MODEL): number | null {
  if (!town) return null;
  const key = town.trim().toLowerCase();
  for (const [name, fee] of Object.entries(model.travelByTown)) {
    if (key.includes(name)) return fee;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Electrodry — published specials only. Franchise pricing varies by area, so
// the comparison panel shows Electrodry ONLY when the daily watch verified
// these numbers within the last 48 hours (api/priceWatch.ts). Fallback below
// is the last verified read (specials page, 3 Nov 2026).
export interface ElectroModel {
  carpetThreeRoom: number; // "3 rooms cleaned + 4th room free"
  carpetTwoRoom: number; // "2 rooms cleaned + hallway free"
  loungeSpecial: number; // "3 seats cleaned + 4th seat free"
  queenMattress: number;
  roomCapM2: number; // max room size on the specials
}

export const ELECTRO_MODEL: ElectroModel = {
  carpetThreeRoom: 289,
  carpetTwoRoom: 259,
  loungeSpecial: 289,
  queenMattress: 159,
  roomCapM2: 13,
};

/** How fresh the daily Electrodry verification must be before we quote their
 *  numbers to customers — older than this and the panel hides them. */
export const ELECTRO_VERIFY_MAX_AGE_MS = 48 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Flood & water damage — published prices, 20% under BFYB's published flood
// rates ($182 inspection, extraction from $289/$409 — read off their booking
// config). The daily price watch re-reads theirs; floodPrices() follows their
// moves automatically. These constants are the fallbacks (verified 3 Nov 2026).
export const FLOOD_UNDERCUT_PERCENT = 20;

export const FLOOD_RATES = {
  inspection: 145, // floor(182 × 0.8) — thermal imaging, moisture readings, insurer-ready scope
  labourPerHour: 80, // standard hours, per technician — 2 techs × 2h = $320 vs their $409 (78%)
  labourAfterHours: 120, // 7 PM – 7 AM, per technician (1.5× standard loading)
  fanPerDay: 32, // floor(41 × 0.8) — drying fans, per fan per day
};

/** Our flood prices: inspection and fan hire always 20% under BFYB's CURRENT
 *  published rates when the daily watch has a live model (they publish no
 *  hourly labour rate, so ours are set flat); else the verified fallbacks. */
export function floodPrices(model?: Pick<BfybModel, "flood" | "extras"> | null) {
  const under = (n: number) => Math.floor(n * (1 - FLOOD_UNDERCUT_PERCENT / 100));
  return {
    inspection: model?.flood ? under(model.flood.inspection) : FLOOD_RATES.inspection,
    labourPerHour: FLOOD_RATES.labourPerHour,
    labourAfterHours: FLOOD_RATES.labourAfterHours,
    fanPerDay: model?.extras?.fanPerDay ? under(model.extras.fanPerDay) : FLOOD_RATES.fanPerDay,
  };
}

// ---------------------------------------------------------------------------
// Flood job report — what Ben logs after attending, and the priced lines it
// produces. The SAME function backs the admin preview, the stored quote and
// the insurer PDF, so every surface always agrees.
export interface FloodReportInput {
  technicians: number; // 1–4
  standardHours: number; // hours on site, 7 AM – 7 PM
  afterHoursHours: number; // hours on site, 7 PM – 7 AM
  fans: number; // drying fans left on site
  fanDays: number; // days the fans stayed
  inspectionCharged: boolean; // the flat emergency inspection & assessment
}

export type FloodPrices = ReturnType<typeof floodPrices>;

export function floodReportCharges(
  input: FloodReportInput,
  prices: FloodPrices,
): { lines: { label: string; amount: number }[]; total: number } {
  const lines: { label: string; amount: number }[] = [];
  const techs = Math.max(1, Math.round(input.technicians));
  const round = (n: number) => Math.round(n * 100) / 100;
  if (input.inspectionCharged) {
    lines.push({
      label: "Emergency inspection & assessment — thermal imaging, moisture readings, insurer-ready scope",
      amount: prices.inspection,
    });
  }
  if (input.standardHours > 0) {
    lines.push({
      label: `Extraction & drying labour — ${techs} technician${techs > 1 ? "s" : ""} × ${input.standardHours}h (standard hours)`,
      amount: round(techs * input.standardHours * prices.labourPerHour),
    });
  }
  if (input.afterHoursHours > 0) {
    lines.push({
      label: `After-hours labour — ${techs} technician${techs > 1 ? "s" : ""} × ${input.afterHoursHours}h (7 PM – 7 AM)`,
      amount: round(techs * input.afterHoursHours * prices.labourAfterHours),
    });
  }
  if (input.fans > 0 && input.fanDays > 0) {
    lines.push({
      label: `Drying fans — ${input.fans} fan${input.fans > 1 ? "s" : ""} × ${input.fanDays} day${input.fanDays > 1 ? "s" : ""}`,
      amount: round(input.fans * input.fanDays * prices.fanPerDay),
    });
  }
  return { lines, total: round(lines.reduce((s, l) => s + l.amount, 0)) };
}

export interface LoungeItem {
  seats: number; // 1–10
  dirtiness: Dirtiness;
  reclinerSeats: number;
  added?: boolean; // tacked on via the cross-sell card — this item gets the 10%
}

export interface MattressItem {
  size: MattressSize;
  dirtiness: Dirtiness;
  qty: number;
  added?: boolean;
}

// ---------------------------------------------------------------------------
// Rugs — pick-up & clean service. Prices from the printed flyer.
// ---------------------------------------------------------------------------

export type RugSize = "xs" | "s" | "m" | "l" | "xl";

export interface RugItem {
  size: RugSize;
  qty: number;
  added?: boolean;
}

export const RUG_SIZES: {
  id: RugSize;
  label: string;
  area: string;
  price: number;
}[] = [
  { id: "xs", label: "Extra Small", area: "up to 1.5 m²", price: 35 },
  { id: "s", label: "Small", area: "up to 2.5 m²", price: 45 },
  { id: "m", label: "Medium", area: "up to 4 m²", price: 65 },
  { id: "l", label: "Large", area: "up to 6 m²", price: 85 },
  { id: "xl", label: "Extra Large", area: "over 6 m²", price: 100 },
];

// ---------------------------------------------------------------------------
// Adjustable rates — every customer-facing figure can be overridden from
// Admin → Settings (saved in the database, applied to new quotes only).
// Anything not overridden falls back to the built-in figures above.
// ---------------------------------------------------------------------------

/** The full, ready-to-use rate card: RATES plus per-size rug prices. */
export interface Rates {
  carpet: {
    tiers: { upTo: number; perM2: number }[];
    perM2: Record<Dirtiness, number>;
    multiplier: Record<Dirtiness, number>;
  };
  minimumCharge: number;
  lounge: { perSeat: Record<Dirtiness, number>; reclinerPerSeat: number };
  mattress: {
    base: Record<MattressSize, number>;
    dirtinessMultiplier: Record<Dirtiness, number>;
  };
  stainCauseFee: Record<StainType, number>;
  extras: { stainPackage: number; enzymePreSpray: number; preVacuumPerRoom: number };
  rug: { bulkCount: number; bulkPercentOff: number };
  rugPrices: Record<RugSize, number>;
  travel: {
    freeRadiusKm: number;
    perKmEachWay: number;
    maxServiceKm: number;
    rugPerKm: number;
    flatByTown: Record<string, number>;
  };
  volumeDiscount: { every: number; off: number };
  maintenance: Record<MaintenancePlan, number>;
}

/** Numbers the owner has changed in Admin → Settings. Everything optional —
 *  anything missing keeps the built-in figure. Stored as plain JSON, so the
 *  last carpet tier's upTo is null (meaning "no ceiling"), never Infinity. */
export interface RateOverrides {
  minimumCharge?: number;
  carpetTiers?: { upTo: number | null; perM2: number }[];
  carpetMultiplier?: Partial<Record<Dirtiness, number>>;
  loungePerSeat?: Partial<Record<Dirtiness, number>>;
  reclinerPerSeat?: number;
  mattressBase?: Partial<Record<MattressSize, number>>;
  stainCauseFee?: Partial<Record<StainType, number>>;
  rugPrices?: Partial<Record<RugSize, number>>;
  rugBulkPercentOff?: number;
  travelFreeRadiusKm?: number;
  travelPerKmEachWay?: number;
  travelFlatByTown?: Record<string, number>;
  rugPerKm?: number;
  volumeEvery?: number;
  volumeOff?: number;
  maintenanceTwoOff?: number;
}

export const DEFAULT_RATES: Rates = {
  carpet: {
    tiers: RATES.carpet.tiers.map((t) => ({ upTo: t.upTo, perM2: t.perM2 })),
    perM2: { ...RATES.carpet.perM2 },
    multiplier: { ...RATES.carpet.multiplier },
  },
  minimumCharge: RATES.minimumCharge,
  lounge: {
    perSeat: { ...RATES.lounge.perSeat },
    reclinerPerSeat: RATES.lounge.reclinerPerSeat,
  },
  mattress: {
    base: { ...RATES.mattress.base },
    dirtinessMultiplier: { ...RATES.mattress.dirtinessMultiplier },
  },
  stainCauseFee: { ...RATES.stainCauseFee },
  extras: { ...RATES.extras },
  rug: { ...RATES.rug },
  rugPrices: Object.fromEntries(RUG_SIZES.map((x) => [x.id, x.price])) as Record<RugSize, number>,
  travel: { ...RATES.travel, flatByTown: { ...RATES.travel.flatByTown } },
  volumeDiscount: { ...RATES.volumeDiscount },
  maintenance: { ...RATES.maintenance },
};

/** Merge the owner's saved overrides over the built-in rate card. */
export function resolveRates(o?: RateOverrides | null): Rates {
  if (!o) return DEFAULT_RATES;
  const d = DEFAULT_RATES;
  return {
    carpet: {
      tiers: o.carpetTiers?.length
        ? o.carpetTiers.map((t, i, arr) => ({
            upTo: t.upTo ?? (i === arr.length - 1 ? Infinity : (d.carpet.tiers[i]?.upTo ?? Infinity)),
            perM2: t.perM2,
          }))
        : d.carpet.tiers,
      perM2: d.carpet.perM2,
      multiplier: { ...d.carpet.multiplier, ...o.carpetMultiplier },
    },
    minimumCharge: o.minimumCharge ?? d.minimumCharge,
    lounge: {
      perSeat: { ...d.lounge.perSeat, ...o.loungePerSeat },
      reclinerPerSeat: o.reclinerPerSeat ?? d.lounge.reclinerPerSeat,
    },
    mattress: {
      base: { ...d.mattress.base, ...o.mattressBase },
      dirtinessMultiplier: d.mattress.dirtinessMultiplier,
    },
    stainCauseFee: { ...d.stainCauseFee, ...o.stainCauseFee },
    extras: d.extras,
    rug: { ...d.rug, bulkPercentOff: o.rugBulkPercentOff ?? d.rug.bulkPercentOff },
    rugPrices: { ...d.rugPrices, ...o.rugPrices },
    travel: {
      freeRadiusKm: o.travelFreeRadiusKm ?? d.travel.freeRadiusKm,
      perKmEachWay: o.travelPerKmEachWay ?? d.travel.perKmEachWay,
      maxServiceKm: d.travel.maxServiceKm,
      rugPerKm: o.rugPerKm ?? d.travel.rugPerKm,
      flatByTown: { ...d.travel.flatByTown, ...o.travelFlatByTown },
    },
    volumeDiscount: {
      every: o.volumeEvery ?? d.volumeDiscount.every,
      off: o.volumeOff ?? d.volumeDiscount.off,
    },
    maintenance: { ...d.maintenance, two: o.maintenanceTwoOff ?? d.maintenance.two },
  };
}

export function rugCount(rugs: RugItem[]): number {
  return rugs.reduce((s, r) => s + r.qty, 0);
}

/** Pickup days for rug-only bookings: Friday afternoons only (owner call
 *  5 Nov 2026 — Thursdays dropped). Existing Thursday pickups already on the
 *  board are honoured. */
export const RUG_PICKUP_DAYS = [5]; // getDay(): 5=Fri
export const RUG_PICKUP_LABEL = "3:00 – 5:00 PM";

/** All Thu/Fri dates in the booking window that can take a rug pickup. */
export function rugPickupDays(): string[] {
  const out: string[] = [];
  const start = sydneyToday();
  for (
    let d = new Date(start);
    ;
    d.setDate(d.getDate() + 1)
  ) {
    const diff = Math.round((d.getTime() - start.getTime()) / 86400000);
    if (diff > BOOKING_DAYS_AHEAD) break;
    if (diff >= BOOKING_NOTICE_DAYS && RUG_PICKUP_DAYS.includes(d.getDay())) {
      out.push(isoDay(d));
    }
  }
  return out;
}

export function isRugPickupDay(iso: string): boolean {
  return rugPickupDays().includes(iso);
}

/** The Monday after a Thu/Fri pickup — when the rugs come back. */
export function rugReturnDay(pickupIso: string): string {
  const d = new Date(pickupIso + "T12:00:00");
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return isoDay(d);
}

/** Invoice terms: payment is due 5 days after the job's done — for rug
 *  runs, 5 days after the Monday return (owner call 6 Nov 2026, was 7). */
export function paymentDueDay(b: { preferredDate: string | null; rugPickup?: boolean }): string | null {
  if (!b.preferredDate) return null;
  const base = b.rugPickup ? rugReturnDay(b.preferredDate) : b.preferredDate;
  const d = new Date(base + "T12:00:00");
  d.setDate(d.getDate() + 5);
  return isoDay(d);
}

// Sydney-local date helpers (shared by client + server so pickup days and
// booking windows line up exactly).
function sydneyToday(): Date {
  const s = new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
  return new Date(s + "T12:00:00");
}
function isoDay(d: Date): string {
  return d.toLocaleDateString("en-CA");
}

export interface QuoteInput {
  carpetAreaM2: number;
  carpetDirtiness: Dirtiness;
  maintenance: MaintenancePlan;
  lounges: LoungeItem[];
  mattresses: MattressItem[];
  rugs: RugItem[];
  stainPackage: boolean;
  dirtGum: boolean;
  enzymePreSpray: boolean;
  stainTypes: StainType[]; // causes ticked in the condition questions — prices stain treatment
  stainsBand?: StainsAnswer; // how many stains — gates our own stain fee; BFYB never auto-adds theirs
  preVacuumRooms: number; // rooms pre-vacuumed FREE with every clean (feeds the time estimate)
  dryingFans: number; // 0–4 fans, left for the day
  travelFee: number; // computed from the address module
  discountPercent: number; // from a validated discount code (0–100)
  roomCounts?: Record<string, number>; // rooms mode — feeds the BFYB comparison
  crossSellApplied?: boolean; // customer tacked extra services on at checkout — 10% off those services
}

export interface QuoteLine {
  label: string;
  detail?: string;
  amount: number;
}

export interface QuoteBreakdown {
  lines: QuoteLine[];
  carpetSubtotal: number;
  cleaningSubtotal: number;
  rugCount: number;
  rugDiscount: number;
  maintenanceDiscount: number;
  codeDiscount: number;
  crossSellDiscount: number; // 10% off services added at checkout
  volumeDiscount: number; // $10 off every full $150
  undercutDiscount: number; // the 17%-under-BFYB backstop, when it fires
  bfybTotal: number | null; // their comparable total, for the check + panel
  minimumApplied: boolean;
  onsiteWork: boolean; // false = rug-only pickup (no minimum charge)
  cleaningTotal: number;
  travelFee: number;
  total: number;
  isEmpty: boolean;
}

const round = (n: number) => Math.round(n);

/** Travel fee: $1/km each way, charged from the first kilometre outside
 *  Armidale (no free allowance). */
export function travelFeeForKm(oneWayKm: number, rates: Rates = DEFAULT_RATES): number {
  const chargeable = Math.max(0, oneWayKm - rates.travel.freeRadiusKm);
  return round(chargeable * 2 * rates.travel.perKmEachWay);
}

/**
 * Travel fee for a known destination: the flat town rate when we've set
 * one, otherwise per-km.
 */
export function travelFeeForTown(
  town: string | undefined | null,
  oneWayKm: number,
  rates: Rates = DEFAULT_RATES,
): number {
  if (town) {
    const flat = rates.travel.flatByTown[town.trim().toLowerCase()];
    if (flat !== undefined) return flat;
  }
  return travelFeeForKm(oneWayKm, rates);
}

/** Rug-only pickup travel: $1/km from Armidale for the full trip, rounded
 *  up to the nearest $5 (Uralla ≈ $25, Guyra ≈ $40, Walcha ≈ $100). Free
 *  in Armidale itself; the town flats and each-way rate are for on-site
 *  jobs. */
export function rugPickupTravelFee(
  oneWayKm: number,
  rates: Rates = DEFAULT_RATES,
  town?: string | null,
): number {
  if (town && town.trim().toLowerCase() === "armidale") return 0;
  if (oneWayKm <= rates.travel.freeRadiusKm) return 0;
  return Math.ceil((oneWayKm * rates.travel.rugPerKm) / 5) * 5;
}

/**
 * Standard-clean carpet figure for an area, before the clean-level
 * multiplier. Walks the stepped rate ladder: $4.00/m² to 40m², $3.80 to
 * 60m², $3.60 to 80m², $3.40 beyond — each band prices only its own metres.
 */
export function carpetStandardForArea(areaM2: number, rates: Rates = DEFAULT_RATES): number {
  let remaining = areaM2;
  let lower = 0;
  let total = 0;
  for (const tier of rates.carpet.tiers) {
    const inBand = Math.min(remaining, tier.upTo - lower);
    if (inBand <= 0) break;
    total += inBand * tier.perM2;
    remaining -= inBand;
    lower = tier.upTo;
    if (remaining <= 0) break;
  }
  return total;
}

/** Our stain-treatment charge from the customer's stain answers: toughest
 *  type full price, each extra type half. Restoration Clean includes it. */
export function stainTreatmentFee(
  q: Pick<QuoteInput, "carpetAreaM2" | "carpetDirtiness" | "stainTypes">,
  rates: Rates = DEFAULT_RATES,
): number {
  if (q.carpetAreaM2 <= 0 || q.carpetDirtiness === "heavy" || q.stainTypes.length === 0) {
    return 0;
  }
  const fees = q.stainTypes.map((t) => rates.stainCauseFee[t]).sort((a, b) => b - a);
  return fees[0] + Math.round(fees.slice(1).reduce((sum, f) => sum + f, 0) / 2);
}

export function computeQuote(input: QuoteInput, rates: Rates = DEFAULT_RATES, bfybModel: BfybModel = BFYB_MODEL): QuoteBreakdown {
  const lines: QuoteLine[] = [];

  // Carpet — tiered standard figure × the clean-level multiplier.
  const mult = rates.carpet.multiplier[input.carpetDirtiness];
  const carpetSubtotal = round(carpetStandardForArea(input.carpetAreaM2, rates) * mult);
  if (input.carpetAreaM2 > 0) {
    const levelWord = (
      { light: "standard", medium: "deep", heavy: "restoration" } as const
    )[input.carpetDirtiness];
    const detail =
      input.carpetAreaM2 <= rates.carpet.tiers[0].upTo
        ? `${input.carpetAreaM2} m² @ $${(rates.carpet.tiers[0].perM2 * mult).toFixed(2)}/m² (${levelWord} clean)`
        : `${input.carpetAreaM2} m² on stepped rates ($${rates.carpet.tiers[0].perM2.toFixed(2)} down to $${rates.carpet.tiers[rates.carpet.tiers.length - 1].perM2.toFixed(2)}/m²)` +
          (mult !== 1 ? `, ×${mult} ${levelWord}` : ` (${levelWord} clean)`);
    lines.push({
      label: "Carpet cleaning",
      detail,
      amount: carpetSubtotal,
    });
  }

  // Lounges
  let loungeSubtotal = 0;
  let crossSellBase = 0; // only items explicitly tacked on via the cross-sell card
  input.lounges.forEach((l, i) => {
    if (l.seats <= 0) return;
    const seatRate = rates.lounge.perSeat[l.dirtiness];
    const amount = round(
      l.seats * seatRate + l.reclinerSeats * rates.lounge.reclinerPerSeat,
    );
    loungeSubtotal += amount;
    if (l.added) crossSellBase += amount;
    lines.push({
      label: `Lounge ${input.lounges.length > 1 ? `#${i + 1}` : ""}`.trim(),
      detail: `${l.seats} seat${l.seats > 1 ? "s" : ""} × $${seatRate}/seat (${l.dirtiness})${l.reclinerSeats > 0 ? ` + ${l.reclinerSeats} recliner${l.reclinerSeats > 1 ? "s" : ""} × $${rates.lounge.reclinerPerSeat}` : ""}`,
      amount,
    });
  });

  // Mattresses
  let mattressSubtotal = 0;
  input.mattresses.forEach((m) => {
    if (m.qty <= 0) return;
    const each = round(
      rates.mattress.base[m.size] * rates.mattress.dirtinessMultiplier[m.dirtiness],
    );
    mattressSubtotal += each * m.qty;
    if (m.added) crossSellBase += each * m.qty;
    lines.push({
      label: `${m.size[0].toUpperCase()}${m.size.slice(1)} mattress`,
      detail: `${m.qty} × $${each} (${m.dirtiness})`,
      amount: each * m.qty,
    });
  });

  // Rugs — pick-up & clean, priced from the flyer
  let rugSubtotal = 0;
  input.rugs.forEach((r) => {
    if (r.qty <= 0) return;
    const size = RUG_SIZES.find((x) => x.id === r.size);
    const price = rates.rugPrices[r.size];
    if (!size || price === undefined) return;
    rugSubtotal += price * r.qty;
    if (r.added) crossSellBase += price * r.qty;
    lines.push({
      label: `${size.label} rug${r.qty > 1 ? "s" : ""}`,
      detail: `${r.qty} × $${price} · pick-up, clean & dry, back Monday`,
      amount: price * r.qty,
    });
  });
  const rugs = rugCount(input.rugs);
  const rugDiscount =
    rugs >= rates.rug.bulkCount
      ? round(rugSubtotal * (rates.rug.bulkPercentOff / 100))
      : 0;

  // Stain treatment — priced straight from the stain answers, on a
  // structured scale (pet accidents dearest, then food & drink, then mud &
  // traffic). Toughest ticked type at full price, each extra type at half.
  // Restoration Clean already includes stain treatment — no extra charge.
  if (
    input.carpetAreaM2 > 0 &&
    input.carpetDirtiness !== "heavy" &&
    input.stainTypes.length > 0
  ) {
    const amount = stainTreatmentFee(input, rates);
    const toughest = input.stainTypes
      .slice()
      .sort((a, b) => rates.stainCauseFee[b] - rates.stainCauseFee[a])[0];
    lines.push({
      label: `Stain treatment — ${STAIN_TYPE_LABELS[toughest]}`,
      detail:
        input.stainTypes.length > 1
          ? "Priced for the toughest stain, each extra type at half — spot-treated before the main clean"
          : "Spot-treated with dedicated stain product before the main clean",
      amount,
    });
  }
  if (input.enzymePreSpray) {
    lines.push({
      label: "Enzyme pre-spray",
      detail: "Treats pet odour & urine in the backing, not just the fibre",
      amount: rates.extras.enzymePreSpray,
    });
  }
  // Pre-vacuum is FREE with every clean — preVacuumRooms now only feeds the
  // on-site time estimate. No charge line.

  // Checkout cross-sell: when the customer tacked extra services onto this
  // booking, the ADDED items (flagged `added` — never the service they came
  // for) get 10% off. On the carpet quote every soft-furnishing item arrives
  // via the cross-sell card unflagged in older bookings, so with no flags at
  // all we fall back to the whole lounge+mattress+rug subtotal. A negative
  // line keeps it visible on the quote, the receipt and the admin record.
  const addOnSubtotal = loungeSubtotal + mattressSubtotal + rugSubtotal;
  const discountableBase = crossSellBase > 0 ? crossSellBase : addOnSubtotal;
  const crossSellDiscount =
    input.crossSellApplied && discountableBase > 0 ? round(discountableBase * 0.1) : 0;
  if (crossSellDiscount > 0) {
    lines.push({
      label: "10% off your added service",
      detail: "For booking the extra service together with this clean",
      amount: -crossSellDiscount,
    });
  }

  // The $150 minimum covers the truck and the trip — it exists for on-site
  // work. A rug-only pickup runs with the Friday pickup run, so it
  // doesn't carry the minimum.
  const onsiteWork =
    input.carpetAreaM2 > 0 ||
    input.lounges.some((l) => l.seats > 0) ||
    input.mattresses.some((m) => m.qty > 0);

  const cleaningSubtotal =
    lines.reduce((s, l) => s + l.amount, 0) - rugDiscount;
  const isEmpty = cleaningSubtotal === 0;

  // 2-cleans-a-year plan: 10% off the whole clean, every clean
  const maintenanceDiscount = round(
    cleaningSubtotal * rates.maintenance[input.maintenance],
  );

  // Discount code applies to the cleaning subtotal after the plan discount
  const afterMaintenance = cleaningSubtotal - maintenanceDiscount;
  const codeDiscount = round(afterMaintenance * (input.discountPercent / 100));

  // $10 off every full $150 — stacks with any discount code.
  // Rugs are EXCLUDED: they're set prices, and the only rug discount is
  // 10% off for 3+ rugs (owner call 5 Nov 2026).
  const afterCode = afterMaintenance - codeDiscount;
  const volumeBase = Math.max(0, afterCode - (rugSubtotal - rugDiscount));
  const volumeDiscount =
    Math.floor(volumeBase / rates.volumeDiscount.every) * rates.volumeDiscount.off;

  let cleaningTotal = afterCode - volumeDiscount;
  let minimumApplied = false;
  if (!isEmpty && onsiteWork && cleaningTotal < rates.minimumCharge) {
    cleaningTotal = rates.minimumCharge;
    minimumApplied = true;
  }

  // The 17%-under-BFYB check, run live on every quote: if their comparable
  // total exists and ours isn't at least 17% under it after our own
  // discounts, the difference comes off automatically.
  const bfybTotal = isEmpty ? null : bfybComparableTotal(input, bfybModel);
  let undercutDiscount = 0;
  if (bfybTotal !== null && cleaningSubtotal > 0) {
    const discountRatio = cleaningTotal / cleaningSubtotal;
    const oursComparable = round(
      comparableSubtotal(input, carpetSubtotal, rates) * discountRatio,
    );
    const target = Math.floor(bfybTotal * (1 - BFYB_UNDERCUT_PERCENT / 100));
    if (oursComparable > target) {
      undercutDiscount = Math.min(oursComparable - target, cleaningTotal);
      cleaningTotal -= undercutDiscount;
    }
  }

  const travelFee = isEmpty ? 0 : round(input.travelFee);
  const total = cleaningTotal + travelFee;

  return {
    lines,
    carpetSubtotal,
    cleaningSubtotal,
    rugCount: rugs,
    rugDiscount,
    maintenanceDiscount,
    codeDiscount,
    crossSellDiscount,
    volumeDiscount,
    undercutDiscount,
    bfybTotal,
    minimumApplied,
    onsiteWork,
    cleaningTotal,
    travelFee,
    total,
    isEmpty,
  };
}

export const money = (n: number) =>
  `$${n.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;

// ---------------------------------------------------------------------------
// Booking wizard — everything below describes the job beyond the price.
// ---------------------------------------------------------------------------

export type CleanPurpose = "moving-out" | "living" | "selling";
export type PropertyType = "single" | "double";
export type PetsAnswer = "none" | "outside" | "inside";
export type SmellAnswer = "no" | "up-close" | "noticeable";
export type StainsAnswer = "none" | "under-5" | "over-5" | "ten-plus";
export type StainType = "pet-urine" | "food-drink" | "mud-traffic" | "not-sure";
export type VacuumAnswer = "week" | "month" | "longer";
export type AccessMethod = "be-there" | "agent" | "lockbox" | "someone-else" | "leave-out";
export type ParkingAccess = "close" | "stairs-or-far";
export type PaymentChoice = "pay-now" | "invoice" | "cash";
export type ConfirmBy = "either" | "phone" | "email";

export const PURPOSE_LABELS: Record<CleanPurpose, string> = {
  "moving-out": "End of lease",
  living: "Freshening up",
  selling: "Selling or re-letting",
};

export const ACCESS_LABELS: Record<AccessMethod, string> = {
  "be-there": "I'll be there to let you in",
  agent: "The agent has the key",
  lockbox: "Key in a lockbox or a safe spot",
  "someone-else": "Someone else will be there",
  "leave-out": "Left out for collection",
};

/** Rug-pickup wording — "be there" reads differently when there's no house to enter. */
export const RUG_PICKUP_LABELS: Record<string, string> = {
  "be-there": "Someone will be home, 3–5 PM",
  "leave-out": "Rugs left out for collection",
};

export const PAYMENT_LABELS: Record<PaymentChoice, string> = {
  "pay-now": "Pay now — card, online",
  invoice: "Invoice me after the job",
  cash: "Cash or PayID on the day",
};

export const STAIN_TYPE_LABELS: Record<StainType, string> = {
  "pet-urine": "pet accidents",
  "food-drink": "food & drink spills",
  "mud-traffic": "mud & heavy traffic",
  "not-sure": "stains — cause confirmed on arrival",
};

// ---------------------------------------------------------------------------
// "What's being done" — one human sentence shared by the run sheet, the jobs
// list, confirmation emails and receipts, plus the colour-dot kinds.
// ---------------------------------------------------------------------------
const ROOM_LABELS: Record<string, [string, string]> = {
  bed: ["bedroom", "bedrooms"],
  bedLarge: ["large bedroom", "large bedrooms"],
  wir: ["walk-in robe", "walk-in robes"],
  wirLarge: ["large walk-in robe", "large walk-in robes"],
  living: ["living room", "living rooms"],
  livingLg: ["large living room", "large living rooms"],
  dining: ["dining room", "dining rooms"],
  hall: ["hallway", "hallways"],
  hall2: ["double hallway", "double hallways"],
  hall3: ["triple hallway", "triple hallways"],
  hall4: ["long hallway", "long hallways"],
  stairs: ["set of stairs", "sets of stairs"],
};

const CLEAN_LABEL: Record<string, string> = {
  light: "Standard Clean",
  medium: "Deep Clean",
  heavy: "Restoration Clean",
};

/** The job broken into readable lines — main work items separate from extras. */
export interface ServiceParts {
  main: string[];
  extras: string[];
}

export function serviceParts(input: QuoteInput | null, rugPickup = false): ServiceParts {
  if (!input) return { main: ["Cleaning"], extras: [] };
  const main: string[] = [];
  const counts = input.roomCounts ?? {};
  const rooms = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([key, n]) => {
      const [one, many] = ROOM_LABELS[key] ?? ["room", "rooms"];
      return n === 1 ? `1 ${one}` : `${n} ${many}`;
    });
  if (input.carpetAreaM2 > 0 || rooms.length > 0) {
    const what =
      rooms.length > 0
        ? rooms.join(", ").replace(/, ([^,]*)$/, " and $1")
        : `carpet (~${input.carpetAreaM2} m²)`;
    main.push(`Carpet — ${what} (${CLEAN_LABEL[input.carpetDirtiness]})`);
  }
  for (const l of input.lounges) {
    if (l.seats > 0)
      main.push(
        `Lounge — ${l.seats}-seat${l.reclinerSeats > 0 ? ` incl. ${l.reclinerSeats} recliner${l.reclinerSeats > 1 ? "s" : ""}` : ""} (${CLEAN_LABEL[l.dirtiness]})`,
      );
  }
  for (const m of input.mattresses) {
    if (m.qty > 0)
      main.push(`${m.qty}× ${m.size} mattress${m.qty > 1 ? "es" : ""} (${CLEAN_LABEL[m.dirtiness]})`);
  }
  const rugs = input.rugs.reduce((s, r) => s + r.qty, 0);
  if (rugs > 0) {
    const bySize = input.rugs
      .filter((r) => r.qty > 0)
      .map((r) => `${r.qty}× ${r.size}`)
      .join(", ");
    main.push(`${rugs} rug${rugs > 1 ? "s" : ""} (${bySize})${rugPickup ? " — pick-up & return" : ""}`);
  }
  const extras: string[] = [];
  if (input.stainTypes.length)
    extras.push(input.stainTypes.map((t) => STAIN_TYPE_LABELS[t]).join(", "));
  if (input.stainPackage) extras.push("stain package");
  if (input.enzymePreSpray) extras.push("enzyme pre-spray");
  if (input.dirtGum) extras.push("dirt & gum treatment");
  if (input.preVacuumRooms > 0)
    extras.push(`pre-vacuum ${input.preVacuumRooms} room${input.preVacuumRooms > 1 ? "s" : ""}`);
  if (input.dryingFans > 0)
    extras.push(`${input.dryingFans} drying fan${input.dryingFans > 1 ? "s" : ""}`);
  return { main, extras };
}

/** Human list of what's being done — "2 bedrooms (Restoration Clean); 5-seat lounge; Extras — pet accidents, enzyme pre-spray". */
export function serviceSummary(input: QuoteInput | null, rugPickup: boolean): string {
  if (!input) return "Cleaning";
  const { main, extras } = serviceParts(input, rugPickup);
  const parts = [...main];
  if (extras.length) parts.push(`Extras — ${extras.join(", ")}`);
  return parts.length ? parts.join("; ") : "Cleaning";
}

/** Colour-dot categories for the admin job list / run sheet. */
export type ServiceKind = "rug" | "carpet" | "lounge";

export function serviceKinds(input: QuoteInput | null): ServiceKind[] {
  if (!input) return [];
  const kinds: ServiceKind[] = [];
  const counts = input.roomCounts ?? {};
  if (input.rugs.reduce((s, r) => s + r.qty, 0) > 0) kinds.push("rug");
  if (input.carpetAreaM2 > 0 || Object.values(counts).some((n) => n > 0)) kinds.push("carpet");
  if (input.lounges.some((l) => l.seats > 0)) kinds.push("lounge");
  return kinds;
}

export const CONFIRM_LABELS: Record<ConfirmBy, string> = {
  either: "Either",
  phone: "Phone",
  email: "Email",
};

/** Answers to the four carpet-condition questions. */
export interface ConditionAnswers {
  pets: PetsAnswer | null;
  smell: SmellAnswer | null;
  stains: StainsAnswer | null;
  stainTypes: StainType[];
  vacuumed: VacuumAnswer | null;
}

export const emptyCondition: ConditionAnswers = {
  pets: null,
  smell: null,
  stains: null,
  stainTypes: [],
  vacuumed: null,
};

export function conditionComplete(c: ConditionAnswers): boolean {
  return Boolean(
    c.pets &&
      c.smell &&
      c.stains &&
      c.vacuumed &&
      (c.stains === "none" || c.stainTypes.length > 0),
  );
}

/**
 * Scores the condition answers into a recommended soiling level.
 * Individually small things (a slight whiff, a handful of stains) nudge to
 * medium; pets inside, noticeable odour, pet urine or ten-plus stains stack
 * up quickly to heavy.
 */
export function recommendDirtiness(c: ConditionAnswers): Dirtiness | null {
  if (!conditionComplete(c)) return null;
  let score = 0;
  if (c.pets === "inside") score += 2;
  if (c.smell === "up-close") score += 1;
  if (c.smell === "noticeable") score += 2;
  if (c.stains === "under-5") score += 1;
  if (c.stains === "over-5") score += 2;
  if (c.stains === "ten-plus") score += 3;
  if (c.stainTypes.includes("pet-urine")) score += 2;
  if (c.vacuumed === "longer") score += 1;
  if (score <= 1) return "light";
  if (score <= 4) return "medium";
  return "heavy";
}

/** Why we recommended that level — short, human, shown under the cards. */
export function recommendationReasons(c: ConditionAnswers): string[] {
  const r: string[] = [];
  if (c.pets === "inside") r.push("an indoor pet");
  if (c.smell === "up-close") r.push("a slight odour up close");
  if (c.smell === "noticeable") r.push("an odour you notice walking in");
  if (c.stains === "under-5") r.push("a few stains to treat");
  if (c.stains === "over-5") r.push("more than five stains");
  if (c.stains === "ten-plus") r.push("ten or more stains");
  if (c.stainTypes.includes("pet-urine")) r.push("pet urine in the carpet");
  if (c.vacuumed === "longer") r.push("a while since the last proper vacuum");
  return r;
}

/**
 * Extras recommendations, mirroring the competitor's logic:
 * pre-vacuum for pet hair and dry grit, enzyme pre-spray for odour and urine.
 * Returns a short "why" for the badge, or null when not recommended.
 */
export function recommendPreVacuum(c: ConditionAnswers): string | null {
  if (c.pets === "inside")
    return "pet hair works down into the pile where a household vacuum can't reach";
  if (c.vacuumed === "longer")
    return "dry grit has to come out before any water goes down";
  if (c.stainTypes.includes("mud-traffic"))
    return "traffic marks are mostly dry grit — vacuuming first stops it turning to mud";
  if (c.vacuumed === "month") return "a month of traffic puts real grit down in the pile";
  if (c.pets === "outside")
    return "outdoor pets still carry hair and dander inside on the way through";
  return null;
}

export function recommendEnzyme(c: ConditionAnswers): string | null {
  if (c.stainTypes.includes("pet-urine"))
    return "urine soaks through to the backing — this treats what's underneath";
  if (c.smell === "noticeable")
    return "a smell you notice from the door is bacteria in the backing, not the fibre";
  if (c.smell === "up-close")
    return "an early smell is far cheaper to treat now than once it sets in";
  if (c.pets === "inside")
    return "pet odour lives in what hair and skin leave behind — steam alone shifts it for a week";
  return null;
}

export interface AccessDetails {
  method: AccessMethod | null;
  agency: string;
  spot: string;
  code: string;
  name: string;
  mobile: string;
  parking: ParkingAccess | null;
}

export const emptyAccess: AccessDetails = {
  method: null,
  agency: "",
  spot: "",
  code: "",
  name: "",
  mobile: "",
  parking: null,
};

/** Everything the wizard collects beyond the priced quote. */
export interface BookingDetails {
  purpose: CleanPurpose | null;
  propertyType: PropertyType | null;
  condition: ConditionAnswers;
  recommended: Dirtiness | null;
  access: AccessDetails;
  payment: PaymentChoice | null;
  preferredDate: string | null; // yyyy-mm-dd, null = "call me to arrange"
  preferredSlot: number | null; // index into TIME_SLOTS; null for rug pickups
  confirmBy: ConfirmBy;
  notes: string;
  town: string; // suburb/town from the address — drives travel-time spacing
  jobMinutes: number; // estimated minutes on site (server recomputes)
  rugPickup: boolean; // rug-only booking: Thu/Fri 3–5pm pickup, back Monday
  /** 2-cleans-a-year plan — the second visit, picked on the calendar and
   *  booked into the schedule at the same time as the first. */
  secondVisit: { date: string; slot: number } | null;
}

// Day/time picker — hourly windows 8:00 AM–5:00 PM, Monday to Friday, from
// two days out. Owner call 4 Nov 2026: weekdays start at 8 (no more 7am
// starts), and Saturdays stopped being offered from 14 Nov 2026 — weekends
// are for the rug run and rest (see bookableDates in contracts/calendar.ts).
export const TIME_SLOTS = [
  "8:00 – 9:00 AM",
  "9:00 – 10:00 AM",
  "10:00 – 11:00 AM",
  "11:00 AM – 12:00 PM",
  "12:00 – 1:00 PM",
  "1:00 – 2:00 PM",
  "2:00 – 3:00 PM",
  "3:00 – 4:00 PM",
  "4:00 – 5:00 PM",
] as const;

export const SLOT_MINUTES = 60;
export const BOOKING_DAYS_AHEAD = 365; // a full year forward in the calendar
export const BOOKING_NOTICE_DAYS = 2; // tomorrow is never offered (rugs use this too)
/** Same-day bookings: today IS offered, but a slot must start at least this
 *  far in the future — owner call 5 Nov 2026 ("should still say available
 *  times until the day is fully finished"). The day drops out when the last
 *  slot that could still finish by 5pm falls inside this window. */
export const SAME_DAY_LEAD_MINUTES = 120;

/** Minutes after midnight each slot starts at (8:00 AM through 4:00 PM). */
export const SLOT_START_MINUTES = [480, 540, 600, 660, 720, 780, 840, 900, 960] as const;

/** "7:00 AM" style label for a minutes-after-midnight time. */
export function clockLabel(mins: number): string {
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const h12 = ((h24 + 11) % 12) + 1;
  const ampm = h24 < 12 ? "AM" : "PM";
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** "Wednesday 21 October 2026" from a yyyy-mm-dd day. */
export function longDateLabel(iso: string): string {
  const [y, mo, d] = iso.split("-").map(Number);
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const wd = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  return `${weekdays[wd]} ${d} ${months[mo - 1]} ${y}`;
}

// ---------------------------------------------------------------------------
// Job duration + travel — how long a job ties up the day, and how far it is.
// Used to space bookings so there's always enough time before the next one.
//
// Times anchored on the operator's rule (4 Nov 2026): an average house takes
// 2 hours on site. The reference house is a standard-clean 3-bed + living +
// hall — the raw per-room model puts it at ~93 minutes, so every estimate is
// scaled to land that reference at exactly 120, and bigger or dirtier jobs
// stretch proportionally beyond it (a deep-clean 3-bed comes out ~2½ hours).
// Generous times = the day never over-books. Still consistent with published
// production rates: portable/box-unit hot water extraction runs 600–1,200
// sq ft/hour (CMM/ISSA), and heavy soil slowing production ~2× matches ISSA's
// 400 sq ft/hr heavy-soil floor.
// ---------------------------------------------------------------------------

export const TIME_MODEL = {
  averageHouseMinutes: 120, // operator anchor: a typical house, start to packed up
  arriveSetupMinutes: 20, // machine out, hoses run, pre-spray bottles filled
  packUpMinutes: 15, // pack down and load up
  // Per-room minutes for a Standard clean, split into pre-spray + clean pass.
  // Deep/Restoration multiply the clean pass only (pre-spray time is constant).
  roomMinutes: {
    bed: { pre: 4, clean: 8 }, // up to 4×4 m
    bedLarge: { pre: 6, clean: 11 }, // up to 5×5 m
    wir: { pre: 2, clean: 4 },
    wirLarge: { pre: 3, clean: 6 },
    living: { pre: 6, clean: 11 },
    livingLg: { pre: 6, clean: 16 }, // up to 6×6 m
    dining: { pre: 4, clean: 8 },
    hall: { pre: 2, clean: 3 },
    hall2: { pre: 2, clean: 5 },
    hall3: { pre: 3, clean: 6 },
    hall4: { pre: 3, clean: 6 },
    stairs: { pre: 3, clean: 6 }, // fiddly per step
  } as Record<string, { pre: number; clean: number }>,
  conditionCleanFactor: { light: 1, medium: 1.4, heavy: 1.9 } as Record<Dirtiness, number>,
  // Stain work per stained room: counter-rotating brush then steam treat.
  stainRoomMinutes: 10,
  // How many rooms we assume need stain work from the customer's answer.
  stainedRoomsByBand: { "under-5": 2, "over-5": 4, "ten-plus": 6 } as Record<string, number>,
  // Fallback when the customer types an exact m² instead of counting rooms —
  // bundles pre-spray + clean into one rate per m².
  perM2: { light: 0.65, medium: 0.95, heavy: 1.3 } as Record<Dirtiness, number>,
  loungePerSeat: { light: 12, medium: 15, heavy: 19 } as Record<Dirtiness, number>,
  reclinerSeatExtra: 6, // mechanisms + extra panels per recliner seat
  mattressEach: 15,
  preVacuumPerRoom: 4, // commercial pre-vacuum pass (free with every clean)
  perSpecialExtra: 12, // stain pack / enzyme / dirt-gum setup each
  dryingFanSetup: 10, // place fans, quick walkthrough
  rugLoad: 10, // rugs coming along with an on-site job
  rugPickupStop: 30, // rug-only pickup stop
} as const;

/** Estimated minutes on site for a quote (rounded up to 15, capped at one
 *  full working day — every job is done in a single day, never split). */
export function estimateJobMinutes(q: QuoteInput): number {
  let m = 0;
  const roomCounts = q.roomCounts ?? {};
  const totalRooms = Object.values(roomCounts).reduce((s, n) => s + n, 0);
  // Counted rooms mean carpet work even if the area wasn't sent through.
  const hasCarpet = q.carpetAreaM2 > 0 || totalRooms > 0;
  const onsite =
    hasCarpet ||
    q.lounges.some((l) => l.seats > 0) ||
    q.mattresses.some((x) => x.qty > 0);
  if (onsite) {
    m += TIME_MODEL.arriveSetupMinutes + TIME_MODEL.packUpMinutes;
    const factor = TIME_MODEL.conditionCleanFactor[q.carpetDirtiness];
    if (hasCarpet) {
      if (totalRooms > 0) {
        // Counted rooms — the operator's per-room times, clean pass scaled
        // by condition.
        for (const [key, n] of Object.entries(roomCounts)) {
          const t = TIME_MODEL.roomMinutes[key] ?? TIME_MODEL.roomMinutes.bed;
          m += n * (t.pre + t.clean * factor);
        }
      } else {
        m += q.carpetAreaM2 * TIME_MODEL.perM2[q.carpetDirtiness];
      }
      // Stain rooms take brush + steam time on top, whatever the clean level.
      const stained = TIME_MODEL.stainedRoomsByBand[q.stainsBand ?? "none"] ?? 0;
      if (stained > 0) {
        const rooms = totalRooms > 0 ? totalRooms : Math.max(1, Math.round(q.carpetAreaM2 / 16));
        m += Math.min(stained, rooms) * TIME_MODEL.stainRoomMinutes;
      }
    }
    m += q.lounges.reduce(
      (s, l) =>
        s +
        l.seats * TIME_MODEL.loungePerSeat[l.dirtiness] +
        l.reclinerSeats * (TIME_MODEL.loungePerSeat[l.dirtiness] + TIME_MODEL.reclinerSeatExtra),
      0,
    );
    m += q.mattresses.reduce((s, x) => s + x.qty * TIME_MODEL.mattressEach, 0);
    m += q.preVacuumRooms * TIME_MODEL.preVacuumPerRoom;
    if (q.stainPackage) m += TIME_MODEL.perSpecialExtra;
    if (q.enzymePreSpray) m += TIME_MODEL.perSpecialExtra;
    if (q.dirtGum) m += TIME_MODEL.perSpecialExtra;
    if (q.dryingFans > 0) m += TIME_MODEL.dryingFanSetup;
  }
  const rugs = rugCount(q.rugs);
  if (rugs > 0) m += onsite ? TIME_MODEL.rugLoad : TIME_MODEL.rugPickupStop;
  // Owner calibration 4 Nov 2026: anchor the day on a 2-hour average house.
  // The reference house (3 bed + living + hall, standard clean) is derived
  // from the room times above, then every estimate scales so that reference
  // lands exactly on the anchor (minimum 30 min stays).
  const t = TIME_MODEL;
  const referenceHouseRaw =
    t.arriveSetupMinutes +
    t.packUpMinutes +
    3 * (t.roomMinutes.bed.pre + t.roomMinutes.bed.clean) +
    (t.roomMinutes.living.pre + t.roomMinutes.living.clean) +
    (t.roomMinutes.hall.pre + t.roomMinutes.hall.clean);
  const scaled = m * (t.averageHouseMinutes / referenceHouseRaw);
  const rounded = Math.max(30, Math.ceil(scaled / 15) * 15);
  // Never longer than one working day — jobs are done in a single day, so a
  // monster quote simply takes the whole day instead of spilling into the next.
  return Math.min(rounded, SLOT_MINUTES * TIME_SLOTS.length);
}

/** How many consecutive hourly slots a job of this length occupies. */
export function slotsNeededFor(jobMinutes: number): number {
  return Math.max(1, Math.ceil(jobMinutes / SLOT_MINUTES));
}

// Base of operations — every day starts and ends here. Drive times below are
// from Armidale; the base sits inside town so town figures apply as-is.
export const HOME_BASE = {
  address: "35 Campion Parade, Armidale NSW 2350",
  town: "Armidale",
} as const;

// One-way drive minutes from Armidale (home base) by town — road time, not
// straight-line.
const TOWN_DRIVE_MINUTES: Record<string, number> = {
  armidale: 0,
  uralla: 25,
  "black mountain": 25,
  hillgrove: 30,
  guyra: 35,
  walcha: 75,
};

/** One-way drive minutes to a town; falls back to road km when unknown. */
export function driveMinutesFor(
  town: string | null | undefined,
  km?: number | null,
): number {
  const key = (town ?? "")
    .toLowerCase()
    .replace(/\b(nsw|2350|2354|2358|2359|2365)\b/g, "")
    .replace(/[^a-z ]/g, "")
    .trim()
    .replace(/\s+/g, " ");
  if (key in TOWN_DRIVE_MINUTES) return TOWN_DRIVE_MINUTES[key];
  for (const [name, mins] of Object.entries(TOWN_DRIVE_MINUTES)) {
    if (key.includes(name)) return mins;
  }
  if (km && km > 0) return Math.round(km * 0.8); // rural roads ~75 km/h
  return 0;
}

/** Drive minutes between two towns — routed via Armidale, the realistic run. */
export function driveBetween(
  townA: string,
  townB: string,
  kmA?: number | null,
  kmB?: number | null,
): number {
  const norm = (t: string) =>
    t.toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
  if (norm(townA) === norm(townB)) return 0;
  return driveMinutesFor(townA, kmA) + driveMinutesFor(townB, kmB);
}

/** Towns this far out are morning-only — the afternoon stays free for the
 *  drive back and any second job in town. (Walcha, and anything further.) */
export const FAR_DRIVE_MINUTES = 60;
export function isMorningOnlyTown(driveMinutes: number): boolean {
  return driveMinutes >= FAR_DRIVE_MINUTES;
}

/** Slots a far-town job may start in — the morning windows only. */
export function morningOnlySlotAllowed(slotIndex: number): boolean {
  return slotIndex <= 3; // 8:00, 9:00, 10:00, 11:00 starts
}

// ---------------------------------------------------------------------------
// The 2-cleans-a-year plan — both visits are picked on the calendar up front
// and booked straight into the schedule.
// ---------------------------------------------------------------------------

export const PLAN_LABELS: Record<MaintenancePlan, string> = {
  none: "Just this clean",
  two: "2 cleans a year — 10% off",
};

// Fallback road distances (km, one way from Armidale) when the live
// geocoding/routing services can't be reached.
export const FALLBACK_TOWNS: { name: string; km: number }[] = [
  { name: "Armidale", km: 0 },
  { name: "Uralla", km: 23 },
  { name: "Guyra", km: 38 },
  { name: "Walcha", km: 96 },
  { name: "Glen Innes", km: 100 },
  { name: "Dorrigo", km: 128 },
  { name: "Inverell", km: 140 },
  { name: "Tamworth", km: 110 },
];
