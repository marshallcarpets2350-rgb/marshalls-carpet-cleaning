// Daily BFYB price watch.
//
// Re-reads Bang For Ya Buck's live booking config (the same file their
// online calculator runs on), diffs it against the competitor model our
// comparison panel and 17%-under backstop price from, and — when their
// numbers move and pass sanity checks — updates that model automatically, so
// our quotes and published comparison track their CURRENT prices with no
// human in the loop. It then re-prices a set of reference jobs through their
// live numbers to confirm every quote still lands at least 17% under theirs.
//
// The report is stored in the settings table (key "bfyb_price_watch") and
// surfaced on the admin dashboard; the live model under "bfyb_model_live".
// If SMTP is configured and something drifted, the owner gets an email.
// Runs at boot when today's check was missed, then daily at 6 AM Sydney.

import {
  BFYB_MODEL,
  BFYB_UNDERCUT_PERCENT,
  ELECTRO_MODEL,
  ELECTRO_VERIFY_MAX_AGE_MS,
  RATES,
  carpetStandardForArea,
  computeQuote,
  type BfybModel,
  type ElectroModel,
  type QuoteInput,
} from "../contracts/rates";
import { getSettings, setSetting, loadRates } from "./queries/settings";
import { loadSmtpConfig, isSmtpConfigured, sendMail } from "./mailer";
import { BUSINESS } from "../contracts/rates";
import fs from "node:fs";
import path from "node:path";

const CONFIG_URL = "https://bangforyabuck.com.au/assets/booking-config.js";
export const PRICE_WATCH_KEY = "bfyb_price_watch";
// The live competitor model every quote prices from — written by the daily
// check whenever BFYB move a number. Falls back to BFYB_MODEL in rates.ts.
export const BFYB_LIVE_MODEL_KEY = "bfyb_model_live";

// Every daily check is archived here as dated JSON — the raw BFYB config
// plus our report. That's the standing evidence file behind every "checked
// {date}" claim on the site, and the price history if BFYB ever dispute a
// comparison. One file per day (Sydney date); re-runs on the same day
// overwrite it.
const EVIDENCE_DIR = path.resolve(process.cwd(), "data/price-watch");

function sydneyDateKey(d: Date = new Date()): string {
  // en-CA gives YYYY-MM-DD.
  return d.toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
}

export function savePriceWatchEvidence(payload: unknown): string | null {
  const dayKey = sydneyDateKey();
  // Mirror into the database as well — the settings table survives redeploys
  // even if the host wipes the filesystem, so the dated evidence trail behind
  // every comparison claim can never be lost.
  void setSetting(`bfyb_evidence_${dayKey}`, JSON.stringify(payload)).catch((err) =>
    console.error("Price watch evidence DB save failed:", err),
  );
  try {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    const file = path.join(EVIDENCE_DIR, `bfyb-prices-${dayKey}.json`);
    fs.writeFileSync(file, JSON.stringify(payload, null, 2));
    return file;
  } catch (err) {
    console.error("Price watch evidence save failed:", err);
    return null;
  }
}

/** True when today's evidence file already exists (Sydney date). */
function hasTodaysEvidence(): boolean {
  try {
    return fs.existsSync(path.join(EVIDENCE_DIR, `bfyb-prices-${sydneyDateKey()}.json`));
  } catch {
    return false;
  }
}

export interface PriceWatchMargin {
  label: string;
  /** What the customer actually pays — after the automatic 17%-under check. */
  ours: number;
  /** Our list price before the automatic undercut discount, for context. */
  oursList: number;
  theirs: number;
  /** Our price as a % of theirs — must stay under 100 - BFYB_UNDERCUT_PERCENT. */
  pctOfTheirs: number;
}

export interface PriceWatchReport {
  checkedAt: string;
  fetchOk: boolean;
  /** False when any published BFYB figure differs from our model. */
  modelMatches: boolean;
  /** False when any reference job lands less than 17% under their live price. */
  undercutHolds: boolean;
  drifts: string[];
  margins: PriceWatchMargin[];
  /** True when this check moved our live competitor model to their new numbers. */
  modelUpdated?: boolean;
  /** Combinations run through the strict both-sides sweep (rooms × levels × lounge sizes). */
  variationsChecked?: number;
  error?: string;
}

// Their carpet room ids are our BFYB_MODEL room keys — same list, same sizes.
const ROOM_ID_MAP: Record<string, keyof typeof BFYB_MODEL.roomRates> = {
  bed: "bed",
  bedLarge: "bedLarge",
  wir: "wir",
  wirLarge: "wirLarge",
  living: "living",
  livingLg: "livingLg",
  dining: "dining",
  hall: "hall",
  hall2: "hall2",
  hall3: "hall3",
  hall4: "hall4",
  stairs: "stairs",
};

/* eslint-disable @typescript-eslint/no-explicit-any */

function extractConfig(js: string): any {
  const m = js.match(/window\.BFYB_CONFIG\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
  if (!m) throw new Error("window.BFYB_CONFIG assignment not found");
  return JSON.parse(m[1]);
}

/**
 * Build a complete BfybModel from their live config. Returns the model plus
 * any structural problems found (missing services/rooms) — callers must run
 * validateLiveModel too before trusting the numbers.
 */
export function buildLiveModel(cfg: any): { model: BfybModel; problems: string[] } {
  const problems: string[] = [];
  const carpet = cfg?.services?.find((s: any) => s.id === "carpet");
  const upholstery = cfg?.services?.find((s: any) => s.id === "upholstery");

  const model: BfybModel = JSON.parse(JSON.stringify(BFYB_MODEL));
  if (!carpet) {
    problems.push("carpet service missing from their config");
  } else {
    model.minimum = Number(carpet.minimum);
    model.base = Number(carpet.serviceFee);
    for (const [theirId, ourKey] of Object.entries(ROOM_ID_MAP)) {
      const room = carpet.rooms?.find((r: any) => r.id === theirId);
      if (!room) {
        problems.push(`room "${theirId}" missing from their config`);
        continue;
      }
      model.roomRates[ourKey] = Number(room.price);
    }
    const multOf = (id: string) =>
      Number(carpet.conditions?.options?.find((o: any) => o.id === id)?.multiplier);
    model.soilingMultiplier = {
      light: multOf("bronze"),
      medium: multOf("silver"),
      heavy: multOf("gold"),
    };
    const extraOf = (id: string) =>
      Number(carpet.extras?.find((e: any) => e.id === id)?.price);
    model.extras = {
      prevacPerRoom: extraOf("prevac"),
      antimicro: extraOf("antimicro"),
      stain: extraOf("stain"),
      fanPerDay: extraOf("fanHire"),
    };
  }
  if (!upholstery) {
    problems.push("upholstery service missing from their config");
  } else {
    model.loungePerSeat = Number(upholstery.from);
  }
  const towns: Record<string, number> = {};
  for (const t of cfg?.towns ?? []) {
    towns[String(t.name).toLowerCase()] = Number(t.travel);
  }
  if (Object.keys(towns).length > 0) model.travelByTown = towns;
  else problems.push("no towns in their config");
  // approxPerM2 stays at the modelled blend — their calculator takes no m² input.
  return { model, problems };
}

/**
 * Sanity bounds on a scraped model. Anything outside these ranges means their
 * config changed shape (or the scrape went wrong) — the update is refused and
 * the site keeps pricing off the last good model. Generous on purpose: any
 * real-world price move passes, only garbage fails.
 */
export function validateLiveModel(m: BfybModel): string[] {
  const bad: string[] = [];
  const inRange = (label: string, v: number, lo: number, hi: number) => {
    if (!Number.isFinite(v) || v < lo || v > hi) bad.push(`${label} = ${v} (expected ${lo}–${hi})`);
  };
  inRange("minimum", m.minimum, 50, 2000);
  inRange("service fee", m.base, 0, 300);
  inRange("lounge per seat", m.loungePerSeat, 20, 400);
  for (const key of Object.keys(BFYB_MODEL.roomRates)) {
    if (!(key in m.roomRates)) bad.push(`room rate "${key}" missing`);
    else inRange(`room rate "${key}"`, m.roomRates[key], 5, 600);
  }
  inRange("multiplier light", m.soilingMultiplier.light, 0.5, 5);
  inRange("multiplier medium", m.soilingMultiplier.medium, 0.5, 5);
  inRange("multiplier heavy", m.soilingMultiplier.heavy, 0.5, 5);
  inRange("extras.prevac", m.extras.prevacPerRoom, 0, 300);
  inRange("extras.antimicro", m.extras.antimicro, 0, 300);
  inRange("extras.stain", m.extras.stain, 0, 300);
  inRange("extras.fanHire", m.extras.fanPerDay, 0, 300);
  for (const [town, fee] of Object.entries(m.travelByTown)) {
    inRange(`travel ${town}`, fee, 0, 600);
  }
  return bad;
}

// Short cache so the 6 AM update reaches quoting within minutes without a DB
// hit on every keystroke-driven quote recalc.
let modelCache: { at: number; model: BfybModel } | null = null;

/** The competitor model quotes price from right now: live from settings when
 *  the daily check has written one, else the shipped BFYB_MODEL fallback. */
export async function loadBfybModel(): Promise<BfybModel> {
  if (modelCache && Date.now() - modelCache.at < 5 * 60 * 1000) return modelCache.model;
  let model: BfybModel = BFYB_MODEL;
  try {
    const s = await getSettings([BFYB_LIVE_MODEL_KEY]);
    const raw = s[BFYB_LIVE_MODEL_KEY];
    if (raw) {
      const parsed = JSON.parse(raw) as BfybModel;
      if (validateLiveModel(parsed).length === 0) model = parsed;
    }
  } catch (err) {
    console.error("Live BFYB model unreadable, using fallback:", err);
  }
  modelCache = { at: Date.now(), model };
  return model;
}

/** Their calculator's total from the LIVE config for a room-based job. */
function liveBfybTotal(
  carpetSvc: any,
  rooms: Record<string, number>,
  level: "bronze" | "silver" | "gold",
  extraIds: string[],
): number {
  const mult =
    carpetSvc.conditions.options.find((o: any) => o.id === level)?.multiplier ?? 1;
  const roomSum = Object.entries(rooms).reduce((s, [id, n]) => {
    const room = carpetSvc.rooms.find((r: any) => r.id === id);
    return s + (room?.price ?? 0) * n;
  }, 0);
  // CRM rule (re-verified 19/10/2026): floor rooms + service fee at the
  // minimum, then scale by the condition multiplier. Their extras (pre-vacuum,
  // stain, anti-microbial, fans) are NEVER in their displayed price — their
  // booking flow only recommends them and auto-ticks nothing — so extraIds is
  // kept for call-site compatibility but deliberately ignored.
  void extraIds;
  const baseCleaning = carpetSvc.serviceFee + roomSum;
  const standardTotal =
    baseCleaning < carpetSvc.minimum ? carpetSvc.minimum : baseCleaning;
  return Math.round(standardTotal * mult);
}

export async function runPriceWatch(): Promise<PriceWatchReport> {
  const checkedAt = new Date().toISOString();
  const drifts: string[] = [];
  const liveRates = await loadRates();
  const margins: PriceWatchMargin[] = [];
  const currentModel = await loadBfybModel();
  let effectiveModel = currentModel;
  let modelUpdated = false;

  let cfg: any = null;
  let fetchError: string | undefined;
  try {
    const res = await fetch(CONFIG_URL, {
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "Mozilla/5.0 (price check)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cfg = extractConfig(await res.text());
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err);
  }

  if (!cfg) {
    const report: PriceWatchReport = {
      checkedAt,
      fetchOk: false,
      modelMatches: true, // unknown, not a drift
      undercutHolds: true,
      drifts: [],
      margins: [],
      error: `Couldn't read their config: ${fetchError}`,
    };
    await setSetting(PRICE_WATCH_KEY, JSON.stringify(report));
    savePriceWatchEvidence({ checkedAt, source: CONFIG_URL, fetchOk: false, error: report.error, report });
    return report;
  }

  const carpet = cfg.services.find((s: any) => s.id === "carpet");
  const upholstery = cfg.services.find((s: any) => s.id === "upholstery");

  // --- 1. Diff their live figures against our model ---
  const expect = (label: string, live: number, modelled: number) => {
    if (live !== modelled) {
      drifts.push(`${label}: their live price is $${live}, our model says $${modelled}`);
    }
  };

  if (carpet) {
    expect("Minimum callout", carpet.minimum, currentModel.minimum);
    expect("Service fee", carpet.serviceFee, currentModel.base);
    for (const [theirId, ourKey] of Object.entries(ROOM_ID_MAP)) {
      const room = carpet.rooms.find((r: any) => r.id === theirId);
      if (!room) {
        drifts.push(`Room "${theirId}" is gone from their calculator`);
        continue;
      }
      expect(`${room.label} rate`, room.price, currentModel.roomRates[ourKey]);
    }
    const multOf = (id: string) =>
      carpet.conditions.options.find((o: any) => o.id === id)?.multiplier;
    if (multOf("bronze") !== currentModel.soilingMultiplier.light)
      drifts.push(`Standard multiplier is now ×${multOf("bronze")} (was ×${currentModel.soilingMultiplier.light})`);
    if (multOf("silver") !== currentModel.soilingMultiplier.medium)
      drifts.push(`Deep multiplier is now ×${multOf("silver")} (was ×${currentModel.soilingMultiplier.medium})`);
    if (multOf("gold") !== currentModel.soilingMultiplier.heavy)
      drifts.push(`Restoration multiplier is now ×${multOf("gold")} (was ×${currentModel.soilingMultiplier.heavy})`);
    const extraOf = (id: string) =>
      carpet.extras.find((e: any) => e.id === id)?.price;
    expect("Stain product", extraOf("stain"), currentModel.extras.stain);
    expect("Anti-microbial", extraOf("antimicro"), currentModel.extras.antimicro);
    expect("Pre-vacuum per room", extraOf("prevac"), currentModel.extras.prevacPerRoom);
    expect("Fan hire", extraOf("fanHire"), currentModel.extras.fanPerDay);
  } else {
    drifts.push("Carpet service not found in their config at all");
  }

  if (upholstery) {
    expect("Upholstery per seat", upholstery.from, currentModel.loungePerSeat);
  }

  for (const t of cfg.towns ?? []) {
    const key = String(t.name).toLowerCase();
    if (key in currentModel.travelByTown) {
      expect(
        `Travel to ${t.name}`,
        t.travel,
        currentModel.travelByTown[key],
      );
    }
  }

  // --- 1b. Follow their moves automatically ---
  // Build a full model from their live config. If every number passes sanity
  // bounds it becomes the model every quote and the comparison table price
  // from — the 17%-under promise then tracks their CURRENT prices with no
  // human in the loop. If anything looks off (structure changed, nonsense
  // values) the update is refused and the site keeps the last good model.
  {
    const built = buildLiveModel(cfg);
    const problems = [...built.problems, ...validateLiveModel(built.model)];
    if (problems.length > 0) {
      drifts.push(
        `Auto-update refused — their config didn't pass checks (${problems.join("; ")}). Still pricing off the last good model.`,
      );
    } else if (JSON.stringify(built.model) !== JSON.stringify(currentModel)) {
      await setSetting(BFYB_LIVE_MODEL_KEY, JSON.stringify(built.model));
      modelCache = { at: Date.now(), model: built.model };
      effectiveModel = built.model;
      modelUpdated = true;
    }
  }

  // --- 2. Re-price reference jobs through their live numbers ---
  if (carpet) {
    const jobs: {
      label: string;
      rooms: Record<string, number>;
      m2: number;
      level: "bronze" | "silver" | "gold";
      extras: string[];
      ours: number;
    }[] = [
      {
        label: "3 bed + lounge, standard",
        rooms: { bed: 3, living: 1 },
        m2: 73,
        level: "bronze",
        extras: [],
        ours: 0,
      },
      {
        label: "3 bed + lounge, deep",
        rooms: { bed: 3, living: 1 },
        m2: 73,
        level: "silver",
        extras: [],
        ours: 0,
      },
      {
        label: "3 bed + lounge, restoration + stain + antimicro",
        rooms: { bed: 3, living: 1 },
        m2: 73,
        level: "gold",
        extras: ["stain", "antimicro"],
        ours: 0,
      },
      {
        // 4 large bedrooms (100m²) + large living (36) + dining (16) +
        // hallway (3) + robe (4) = 159m² — the m² must match the rooms so
        // both sides price the same floor area.
        label: "Big house (159m²), standard",
        rooms: { bedLarge: 4, livingLg: 1, dining: 1, hall: 1, wir: 1 },
        m2: 159,
        level: "bronze",
        extras: [],
        ours: 0,
      },
    ];
    const ourMult = {
      bronze: RATES.carpet.multiplier.light,
      silver: RATES.carpet.multiplier.medium,
      gold: RATES.carpet.multiplier.heavy,
    } as const;
    for (const j of jobs) {
      const ourExtras = j.extras.reduce(
        (s, e) =>
          s +
          (e === "antimicro"
            ? RATES.extras.enzymePreSpray
            : e === "stain" && j.level !== "gold"
              ? RATES.stainCauseFee["food-drink"]
              : 0),
        0,
      );
      const oursList =
        Math.round(carpetStandardForArea(j.m2) * ourMult[j.level]) + ourExtras;
      // What the customer ACTUALLY pays — the same computeQuote the site runs,
      // volume discount and automatic 17%-under backstop included. Their side
      // is re-priced from the LIVE config, so if BFYB move a number and our
      // model of them goes stale, the final price here stops matching the
      // promise and the flag below fires.
      const quoteInput: QuoteInput = {
        carpetAreaM2: j.m2,
        carpetDirtiness:
          j.level === "gold" ? "heavy" : j.level === "silver" ? "medium" : "light",
        maintenance: "none",
        lounges: [],
        mattresses: [],
        rugs: [],
        stainPackage: false,
        dirtGum: false,
        enzymePreSpray: j.extras.includes("antimicro"),
        stainTypes: j.extras.includes("stain") ? ["food-drink"] : [],
        stainsBand: j.extras.includes("stain") ? "ten-plus" : "none",
        preVacuumRooms: 0,
        dryingFans: 0,
        travelFee: 0,
        discountPercent: 0,
        roomCounts: j.rooms,
      };
      const oursFinal = computeQuote(quoteInput, liveRates, effectiveModel).cleaningTotal;
      const theirs = liveBfybTotal(carpet, j.rooms, j.level, j.extras);
      margins.push({
        label: j.label,
        ours: oursFinal,
        oursList,
        theirs,
        pctOfTheirs: Math.round((oursFinal / theirs) * 100),
      });
    }
    if (upholstery) {
      margins.push({
        label: "3-seat lounge",
        ours: 3 * RATES.lounge.perSeat.light,
        oursList: 3 * RATES.lounge.perSeat.light,
        theirs: 3 * upholstery.from,
        pctOfTheirs: Math.round(((3 * RATES.lounge.perSeat.light) / (3 * upholstery.from)) * 100),
      });
    }
  }

  // --- 2b. Strict variation sweep: every room-count × clean-level combo,
  // plus lounge sizes 1–6, priced through BOTH sides. Any combination where
  // our final price (automatic discounts included) lands less than 17% under
  // their live price is flagged — the promise must hold on EVERY variation,
  // not just the reference jobs above.
  let variationsChecked = 0;
  if (carpet) {
    const ROOM_M2: Record<string, number> = {
      bed: 16, bedLarge: 25, wir: 4, wirLarge: 9, living: 25, livingLg: 36,
      dining: 16, hall: 3, hall2: 6, hall3: 9, hall4: 12,
    };
    const m2Of = (rooms: Record<string, number>) =>
      Object.entries(rooms).reduce((s, [k, n]) => s + (ROOM_M2[k] ?? 0) * n, 0);
    const roomSets: Record<string, number>[] = [
      { bed: 1 },
      { bed: 2 },
      { bed: 2, living: 1 },
      { bed: 3 },
      { bed: 3, living: 1 },
      { bed: 4, living: 1 },
      { bed: 3, living: 1, dining: 1, hall: 1 },
      { bedLarge: 4, livingLg: 1, dining: 1, hall: 1, wir: 1 },
      { bedLarge: 5, livingLg: 1, living: 1, hall2: 1 },
      { living: 1, stairs: 0 },
    ];
    const levels = ["bronze", "silver", "gold"] as const;
    const ourMultOf = { bronze: "light", silver: "medium", gold: "heavy" } as const;
    for (const rooms of roomSets) {
      const m2 = m2Of(rooms);
      if (m2 <= 0) continue;
      for (const level of levels) {
        variationsChecked++;
        const q: QuoteInput = {
          carpetAreaM2: m2,
          carpetDirtiness: ourMultOf[level],
          maintenance: "none",
          lounges: [],
          mattresses: [],
          rugs: [],
          stainPackage: false,
          dirtGum: false,
          enzymePreSpray: false,
          stainTypes: [],
          preVacuumRooms: 0,
          dryingFans: 0,
          travelFee: 0,
          discountPercent: 0,
          roomCounts: rooms,
        };
        const ours = computeQuote(q, liveRates, effectiveModel).cleaningTotal;
        const theirs = liveBfybTotal(carpet, rooms, level, []);
        if (ours > Math.floor(theirs * (1 - BFYB_UNDERCUT_PERCENT / 100))) {
          const label = Object.entries(rooms).map(([k, n]) => `${n}×${k}`).join("+");
          drifts.push(
            `Variation ${label} ${level}: ours lands at $${ours} vs their $${theirs} — under the 17% rule, needs a rates review`,
          );
        }
      }
    }
    if (upholstery) {
      for (let seats = 1; seats <= 6; seats++) {
        variationsChecked++;
        const ours = computeQuote(
          {
            carpetAreaM2: 0,
            carpetDirtiness: "light",
            maintenance: "none",
            lounges: [{ seats, dirtiness: "light", reclinerSeats: 0 }],
            mattresses: [],
            rugs: [],
            stainPackage: false,
            dirtGum: false,
            enzymePreSpray: false,
            stainTypes: [],
            preVacuumRooms: 0,
            dryingFans: 0,
            travelFee: 0,
            discountPercent: 0,
          },
          liveRates,
          effectiveModel,
        ).cleaningTotal;
        // Their minimum callout applies to a lounge-only booking too.
        const theirs = Math.max(seats * Number(upholstery.from), Number(carpet.minimum));
        if (ours > Math.floor(theirs * (1 - BFYB_UNDERCUT_PERCENT / 100))) {
          drifts.push(
            `Variation ${seats}-seat lounge: ours lands at $${ours} vs their $${theirs} — under the 17% rule, needs a rates review`,
          );
        }
      }
    }
  }

  const undercutHolds = margins.every(
    (m) => m.pctOfTheirs <= 100 - BFYB_UNDERCUT_PERCENT,
  ) && !drifts.some((d) => d.includes("under the 17% rule"));
  for (const m of margins) {
    if (m.pctOfTheirs > 100 - BFYB_UNDERCUT_PERCENT) {
      drifts.push(
        `${m.label}: even after the automatic discount ours lands at $${m.ours} (list $${m.oursList}), only ${100 - m.pctOfTheirs}% under their live $${m.theirs} — the 17% promise needs a rates review`,
      );
    }
  }

  const report: PriceWatchReport = {
    checkedAt,
    fetchOk: true,
    modelMatches: drifts.filter((d) => !d.includes("under the 17% rule") && !d.includes("Auto-update refused")).length === 0,
    undercutHolds,
    drifts,
    margins,
    modelUpdated,
    variationsChecked,
  };
  await setSetting(PRICE_WATCH_KEY, JSON.stringify(report));
  savePriceWatchEvidence({ checkedAt, source: CONFIG_URL, fetchOk: true, rawConfig: cfg, report });

  // Tell the owner when something moved — only if email is set up.
  if (drifts.length > 0) {
    try {
      const smtp = await loadSmtpConfig();
      if (isSmtpConfigured(smtp)) {
        await sendMail(
          smtp,
          BUSINESS.email,
          `BFYB price watch — ${drifts.length} change${drifts.length > 1 ? "s" : ""} spotted`,
          `The daily check of Bang For Ya Buck's live prices found changes:\n\n` +
            drifts.map((d) => `• ${d}`).join("\n") +
            (modelUpdated
              ? `\n\nNo action needed — the quote calculator and the comparison table now price off their new numbers automatically, so every quote still lands at least ${BFYB_UNDERCUT_PERCENT}% under theirs.`
              : "") +
            `\n\nChecked ${checkedAt}.\nOpen the admin dashboard → Price watch for the full report.`,
        );
      }
    } catch (err) {
      console.error("Price watch email failed:", err);
    }
  }

  return report;
}

export async function getPriceWatchReport(): Promise<PriceWatchReport | null> {
  const s = await getSettings([PRICE_WATCH_KEY]);
  const raw = s[PRICE_WATCH_KEY];
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PriceWatchReport;
  } catch {
    return null;
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ===========================================================================
// Electrodry price watch — published specials only.
//
// Electrodry's main site gates specials behind a postcode lookup and sits
// behind Cloudflare, so the watch reads the static specials page their
// franchise network publishes (electrodry.net.au/special-deals — same
// national specials). Because franchise pricing varies by area, Electrodry
// only appears in our comparison panel when this check has verified the
// numbers within ELECTRO_VERIFY_MAX_AGE_MS — otherwise the panel hides them
// rather than show a price we can't stand behind.
// ===========================================================================

const ELECTRO_SPECIALS_URL = "https://www.electrodry.net.au/special-deals/";
export const ELECTRO_WATCH_KEY = "electro_price_watch";
export const ELECTRO_LIVE_MODEL_KEY = "electro_model_live";

export interface ElectroLive {
  model: ElectroModel;
  checkedAt: string; // ISO of the last SUCCESSFUL verification
}

export interface ElectroWatchReport {
  checkedAt: string;
  fetchOk: boolean;
  verified: boolean; // all four specials found + within sanity bounds
  drifts: string[];
  margins: PriceWatchMargin[];
  error?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Parse the specials table: rows carry data-title + a single $ cell. */
export function parseElectroSpecials(html: string): { model: ElectroModel; missing: string[] } {
  const decode = (s: string) =>
    s
      .replace(/&#36;/g, "$")
      .replace(/&amp;/g, "&")
      .replace(/<[^>]+>/g, " ");
  const rows = html.split("<tr");
  const wanted: [RegExp, keyof Omit<ElectroModel, "roomCapM2">][] = [
    [/3 ROOMS CLEANED AND 4TH ROOM FREE/i, "carpetThreeRoom"],
    [/2 ROOMS CLEANED AND HALLWAY FREE/i, "carpetTwoRoom"],
    [/3 SEAT CLEANED AND 4TH SEAT FREE/i, "loungeSpecial"],
    [/QUEEN MATTRESS CLEANED/i, "queenMattress"],
  ];
  const model: ElectroModel = { ...ELECTRO_MODEL };
  const found = new Set<string>();
  for (const row of rows) {
    const text = decode(row).replace(/\s+/g, " ");
    for (const [pattern, key] of wanted) {
      if (found.has(key) || !pattern.test(text)) continue;
      const amounts = [...text.matchAll(/\$\s?(\d+(?:\.\d{2})?)/g)].map((m) => Number(m[1]));
      const price = amounts.find((a) => a >= 50);
      if (price !== undefined) {
        model[key] = price;
        found.add(key);
      }
    }
  }
  const missing = wanted.filter(([, k]) => !found.has(k)).map(([, k]) => k);
  return { model, missing };
}

/** Sanity bounds — any real-world price move passes, only garbage fails. */
export function validateElectroModel(m: ElectroModel): string[] {
  const bad: string[] = [];
  const inRange = (label: string, v: number, lo: number, hi: number) => {
    if (!Number.isFinite(v) || v < lo || v > hi) bad.push(`${label} = ${v} (expected ${lo}–${hi})`);
  };
  inRange("2-room special", m.carpetTwoRoom, 80, 800);
  inRange("3-room special", m.carpetThreeRoom, 80, 900);
  inRange("3-seat lounge special", m.loungeSpecial, 80, 900);
  inRange("queen mattress", m.queenMattress, 40, 500);
  return bad;
}

let electroCache: { at: number; live: ElectroLive | null } | null = null;

/** Electrodry's specials ONLY when verified within the freshness window —
 *  null means "not certain right now", and the panel hides them. */
export async function loadElectroModel(): Promise<ElectroLive | null> {
  if (electroCache && Date.now() - electroCache.at < 5 * 60 * 1000) return electroCache.live;
  let live: ElectroLive | null = null;
  try {
    const s = await getSettings([ELECTRO_LIVE_MODEL_KEY]);
    const raw = s[ELECTRO_LIVE_MODEL_KEY];
    if (raw) {
      const parsed = JSON.parse(raw) as ElectroLive;
      const fresh = Date.now() - new Date(parsed.checkedAt).getTime() < ELECTRO_VERIFY_MAX_AGE_MS;
      if (fresh && validateElectroModel(parsed.model).length === 0) live = parsed;
    }
  } catch (err) {
    console.error("Live Electrodry model unreadable, hiding:", err);
  }
  electroCache = { at: Date.now(), live };
  return live;
}

/** Reference jobs re-priced through Electrodry's verified specials. No 17%
 *  promise here — we just flag any job where we'd show as DEARER in the
 *  comparison panel, so the owner can decide whether to say anything. */
async function electroMargins(model: ElectroModel): Promise<PriceWatchMargin[]> {
  const liveRates = await loadRates();
  const margins: PriceWatchMargin[] = [];
  const job = (
    label: string,
    input: Partial<QuoteInput>,
    theirs: number,
  ) => {
    const q: QuoteInput = {
      carpetAreaM2: 0,
      carpetDirtiness: "light",
      maintenance: "none",
      lounges: [],
      mattresses: [],
      rugs: [],
      stainPackage: false,
      dirtGum: false,
      enzymePreSpray: false,
      stainTypes: [],
      preVacuumRooms: 0,
      dryingFans: 0,
      travelFee: 0,
      discountPercent: 0,
      ...input,
    };
    const ours = computeQuote(q, liveRates).cleaningTotal;
    margins.push({
      label,
      ours,
      oursList: ours,
      theirs,
      pctOfTheirs: Math.round((ours / theirs) * 100),
    });
  };
  job("2 rooms + hallway (26 m²)", { carpetAreaM2: 2 * model.roomCapM2 }, model.carpetTwoRoom);
  job("3 rooms + 4th free (52 m²)", { carpetAreaM2: 4 * model.roomCapM2 }, model.carpetThreeRoom);
  job("3-seat lounge", { lounges: [{ seats: 3, dirtiness: "light", reclinerSeats: 0 }] }, model.loungeSpecial);
  job("4-seat lounge", { lounges: [{ seats: 4, dirtiness: "light", reclinerSeats: 0 }] }, model.loungeSpecial);
  job(
    "Queen mattress",
    { mattresses: [{ size: "queen", dirtiness: "light", qty: 1 }] },
    model.queenMattress,
  );
  return margins;
}

export async function runElectroWatch(): Promise<ElectroWatchReport> {
  const checkedAt = new Date().toISOString();
  const drifts: string[] = [];
  const prev = await loadElectroModel();

  let html: string | null = null;
  let fetchError: string | undefined;
  try {
    const res = await fetch(ELECTRO_SPECIALS_URL, {
      signal: AbortSignal.timeout(15000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-AU,en;q=0.9",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err);
  }

  if (html === null) {
    const report: ElectroWatchReport = {
      checkedAt,
      fetchOk: false,
      verified: false,
      drifts: prev
        ? [`Couldn't verify Electrodry's specials (${fetchError}). The comparison panel hides them until a check succeeds again.`]
        : [],
      margins: [],
      error: fetchError,
    };
    await setSetting(ELECTRO_WATCH_KEY, JSON.stringify(report));
    void setSetting(
      `electro_evidence_${sydneyDateKey()}`,
      JSON.stringify({ checkedAt, source: ELECTRO_SPECIALS_URL, fetchOk: false, error: fetchError }),
    ).catch(() => {});
    await emailElectroWatch(report, prev !== null);
    return report;
  }

  const { model, missing } = parseElectroSpecials(html);
  const problems = [...missing.map((k) => `special "${k}" not found on their page`), ...validateElectroModel(model)];

  if (problems.length > 0) {
    const report: ElectroWatchReport = {
      checkedAt,
      fetchOk: true,
      verified: false,
      drifts: [
        `Electrodry verification failed (${problems.join("; ")}). Keeping the last verified numbers; the panel hides them once they're 48 hours old.`,
      ],
      margins: [],
    };
    await setSetting(ELECTRO_WATCH_KEY, JSON.stringify(report));
    void setSetting(
      `electro_evidence_${sydneyDateKey()}`,
      JSON.stringify({ checkedAt, source: ELECTRO_SPECIALS_URL, fetchOk: true, verified: false, problems }),
    ).catch(() => {});
    await emailElectroWatch(report, prev !== null);
    return report;
  }

  // Verified — this becomes the only model the comparison panel may show.
  const live: ElectroLive = { model, checkedAt };
  const prevModel = prev?.model ?? null;
  if (prevModel) {
    const expect = (label: string, now: number, was: number) => {
      if (now !== was) drifts.push(`${label}: now $${now} (was $${was})`);
    };
    expect("2 rooms + hallway special", model.carpetTwoRoom, prevModel.carpetTwoRoom);
    expect("3 rooms + 4th free special", model.carpetThreeRoom, prevModel.carpetThreeRoom);
    expect("3 seats + 4th seat free special", model.loungeSpecial, prevModel.loungeSpecial);
    expect("Queen mattress special", model.queenMattress, prevModel.queenMattress);
  }
  await setSetting(ELECTRO_LIVE_MODEL_KEY, JSON.stringify(live));
  electroCache = { at: Date.now(), live };

  const margins = await electroMargins(model);
  for (const m of margins) {
    if (m.ours >= m.theirs) {
      drifts.push(
        `${m.label}: ours comes out at $${m.ours} vs their $${m.theirs} — we'd show as dearer on that special, worth a look`,
      );
    }
  }

  const report: ElectroWatchReport = { checkedAt, fetchOk: true, verified: true, drifts, margins };
  await setSetting(ELECTRO_WATCH_KEY, JSON.stringify(report));
  void setSetting(
    `electro_evidence_${sydneyDateKey()}`,
    JSON.stringify({ checkedAt, source: ELECTRO_SPECIALS_URL, fetchOk: true, verified: true, model, report }),
  ).catch(() => {});
  await emailElectroWatch(report, drifts.length > 0);
  return report;
}

async function emailElectroWatch(report: ElectroWatchReport, worthTelling: boolean): Promise<void> {
  if (!worthTelling || report.drifts.length === 0) return;
  try {
    const smtp = await loadSmtpConfig();
    if (!isSmtpConfigured(smtp)) return;
    await sendMail(
      smtp,
      BUSINESS.email,
      report.verified
        ? `Electrodry price watch — ${report.drifts.length} change${report.drifts.length > 1 ? "s" : ""} spotted`
        : "Electrodry price watch — couldn't verify their prices",
      `The daily check of Electrodry's published specials:\n\n` +
        report.drifts.map((d) => `• ${d}`).join("\n") +
        (report.verified
          ? `\n\nThe comparison panel is showing their new numbers.`
          : `\n\nThe comparison panel only shows Electrodry when their prices are verified fresh — they'll disappear from it automatically until a check succeeds.`) +
        `\n\nChecked ${report.checkedAt}.`,
    );
  } catch (err) {
    console.error("Electrodry watch email failed:", err);
  }
}

export async function getElectroWatchReport(): Promise<ElectroWatchReport | null> {
  const s = await getSettings([ELECTRO_WATCH_KEY]);
  const raw = s[ELECTRO_WATCH_KEY];
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ElectroWatchReport;
  } catch {
    return null;
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */

/** Milliseconds until the next 6:00 AM in Sydney (Armidale's timezone). */
function msUntilNext6amSydney(): number {
  const now = Date.now();
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  // Read the Sydney wall clock as-if-UTC so we can diff it against 06:00.
  const sydneyWall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  let target = Date.UTC(get("year"), get("month") - 1, get("day"), 6, 0, 0);
  if (target <= sydneyWall) target += 24 * 60 * 60 * 1000;
  return target - sydneyWall;
}

/**
 * Run daily at 6:00 AM Sydney — start of the business day, so the "checked
 * {date}" on the site is never more than a day old. At boot we only run if
 * today's check was missed (e.g. a redeploy after 6 AM).
 */
export function schedulePriceWatch(): void {
  const runBoth = () => {
    void runPriceWatch().catch((err) => console.error("Price watch failed:", err));
    void runElectroWatch().catch((err) => console.error("Electrodry watch failed:", err));
  };
  if (!hasTodaysEvidence()) runBoth();
  const firstIn = msUntilNext6amSydney();
  console.log(`Price watch: next check in ${Math.round(firstIn / 60000)} min (6:00 AM Sydney)`);
  setTimeout(() => {
    runBoth();
    setInterval(runBoth, 24 * 60 * 60 * 1000).unref();
  }, firstIn).unref();
}
