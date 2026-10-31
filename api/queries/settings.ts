import { getDb } from "./connection";
import { settings } from "@db/schema";
import { eq } from "drizzle-orm";
import { resolveRates, type Rates } from "@contracts/rates";

export async function getSetting(key: string): Promise<string | null> {
  const rows = await getDb()
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await getDb()
    .insert(settings)
    .values({ key, value })
    .onDuplicateKeyUpdate({ set: { value } });
}

export async function deleteSetting(key: string): Promise<void> {
  await getDb().delete(settings).where(eq(settings.key, key));
}

export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const key of keys) {
    const v = await getSetting(key);
    if (v !== null) out[key] = v;
  }
  return out;
}

export const RATE_OVERRIDES_KEY = "rate_overrides";

/** The live rate card: owner's Admin → Settings overrides merged over the
 *  built-in figures. Used for every server-side quote computation. */
export async function loadRates(): Promise<Rates> {
  const raw = await getSetting(RATE_OVERRIDES_KEY);
  if (!raw) return resolveRates(null);
  try {
    return resolveRates(JSON.parse(raw));
  } catch {
    return resolveRates(null);
  }
}
