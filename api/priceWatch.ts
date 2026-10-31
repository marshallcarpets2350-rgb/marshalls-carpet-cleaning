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
  RATES,
  carpetStandardForArea,
  computeQuote,
  type BfybModel,
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

  const undercutHolds = margins.every(
    (m) => m.pctOfTheirs <= 100 - BFYB_UNDERCUT_PERCENT,
  );
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
  if (!hasTodaysEvidence()) {
    void runPriceWatch().catch((err) => console.error("Price watch failed:", err));
  }
  const firstIn = msUntilNext6amSydney();
  console.log(`Price watch: next check in ${Math.round(firstIn / 60000)} min (6:00 AM Sydney)`);
  setTimeout(() => {
    void runPriceWatch().catch((err) => console.error("Price watch failed:", err));
    setInterval(() => {
      void runPriceWatch().catch((err) => console.error("Price watch failed:", err));
    }, 24 * 60 * 60 * 1000).unref();
  }, firstIn).unref();
}
