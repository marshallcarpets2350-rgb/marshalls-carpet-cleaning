import { useEffect, useRef, useState } from "react";
import {
  BUSINESS,
  FALLBACK_TOWNS,
  money,
  travelFeeForTown,
} from "@contracts/rates";
import { useRates } from "@/lib/useRates";

export interface TravelResult {
  addressLabel: string;
  suburb: string;
  km: number | null;
  fee: number;
  outOfRange: boolean;
  source: "live" | "fallback";
  /** True when we matched the street but not the exact house number —
   *  the distance/fee is close but not guaranteed. */
  estimated?: boolean;
}

interface Props {
  value: TravelResult | null;
  onChange: (r: TravelResult | null) => void;
}

interface PhotonProperties {
  name?: string;
  housenumber?: string;
  street?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  state?: string;
  postcode?: string;
}

interface PhotonFeature {
  properties: PhotonProperties;
  geometry: { coordinates: [number, number] };
}

interface Suggestion {
  label: string;
  lat: number;
  lon: number;
  suburb: string;
  streetLevel: boolean;
}

/** Words that don't help identify WHICH street — road types and state filler. */
const STREET_TYPES = new Set([
  "road", "rd", "street", "st", "avenue", "ave", "av", "drive", "dr", "lane",
  "ln", "place", "pl", "close", "cl", "court", "ct", "crescent", "cres",
  "parade", "pde", "terrace", "tce", "way", "boulevard", "blvd", "circuit",
  "cct", "highway", "hwy", "nsw", "new", "south", "wales", "australia",
]);

const KNOWN_TOWNS =
  /\b(armidale|uralla|guyra|walcha|inverell|tamworth|glen innes|dorrigo|kellys plains|saumarez|benn lomond|ebnor|yarrowyck|hillgrove|wollomombi|tingha|bundarra|kingstown|bendemeer|kootingal|manilla|barraba|bingara|warialda|moree|narrabri|quirlindi|quirindi)\b/i;

interface ParsedQuery {
  number?: string;
  /** Distinctive street words, e.g. "52 Blanch Road" -> ["blanch"]. */
  streetWords: string[];
}

/** Strip the house number / unit prefix, leaving street + locality. */
function stripNumber(qRaw: string): string {
  let q = qRaw.replace(
    /^\s*(unit|flat|apartment|apt|suite|shop|lot)\s*\d+[a-z]?\s*[\/\-]\s*/i,
    "",
  );
  q = q.replace(/^\s*\d+[a-z]?\s*\/\s*(?=\d)/i, ""); // "3/52" -> "52"
  return q.replace(/^\s*\d+[a-z]?\s+/i, "");
}

/** Pull the house number and the meaningful street words out of what was typed. */
function parseQuery(qRaw: string): ParsedQuery {
  const m = qRaw
    .replace(/^\s*(unit|flat|apartment|apt|suite|shop|lot)\s*\d+[a-z]?\s*[\/\-]\s*/i, "")
    .replace(/^\s*\d+[a-z]?\s*\/\s*(?=\d)/i, "")
    .match(/^\s*(\d+[a-z]?)\s+(.+)$/i);
  const number = m?.[1]?.toLowerCase();
  const rest = (m ? m[2] : qRaw).toLowerCase().replace(/['']/g, "");
  const streetWords = rest
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !/^\d+$/.test(w) && !STREET_TYPES.has(w));
  return { number, streetWords };
}

// Apostrophes vanish without a space so "O'Dell" matches "Odell".
const norm = (s: string) =>
  s.toLowerCase().replace(/['']/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Score a Photon feature against what was typed.
 * Returns null for junk results (e.g. the right house number on the WRONG
 * street) so they never reach the list.
 */
function scoreFeature(
  f: PhotonFeature,
  parsed: ParsedQuery,
): { score: number; streetLevel: boolean } | null {
  const p = f.properties;
  // Match street words against the street field only — a business name like
  // "Armidale Electrical" must not count as matching the word "Armidale".
  const featStreet = norm(p.street ?? p.name ?? "");
  const featNum = (p.housenumber ?? "").toLowerCase().trim();
  let score = 0;
  let streetLevel = false;

  if (parsed.streetWords.length > 0) {
    const hits = parsed.streetWords.filter((w) =>
      featStreet.split(" ").includes(w) || featStreet.includes(w),
    ).length;
    if (hits === 0) {
      // Street name not in the result at all. If it only matched because the
      // house number coincided ("52 Crest Road" for "52 Blanch Road"), it's
      // junk — drop it. Otherwise keep weakly (town/locality-level results),
      // flagged as an estimate since nothing precise was matched.
      if (parsed.number && featNum === parsed.number) return null;
      score += 0.5;
      streetLevel = true;
    } else {
      score += 2 * hits + (hits === parsed.streetWords.length ? 2 : 0);
      if (parsed.number) {
        if (featNum === parsed.number) {
          score += 6; // exact house number + street — best possible
        } else if (featNum === "") {
          // Right street, no number in the data (common rural) — best estimate
          streetLevel = true;
          score += 2;
        } else {
          // Right street but a DIFFERENT number — useful coords, but showing
          // the wrong number is confusing, so rank it below the plain street
          streetLevel = true;
        }
      }
    }
  } else if (parsed.number && featNum === parsed.number) {
    score += 1; // bare number match, no street typed to check against
  }

  const locality = norm(p.suburb ?? p.city ?? p.town ?? p.village ?? "");
  if (KNOWN_TOWNS.test(locality)) score += 1;

  return { score, streetLevel };
}

function photonToSuggestion(
  f: PhotonFeature,
  streetLevel: boolean,
): Suggestion {
  const p = f.properties;
  const streetPart = [p.housenumber, p.street ?? p.name].filter(Boolean).join(" ");
  // Town/locality results carry the name only — no street — so the name IS
  // the town. Streets keep their real suburb, which stops a "Walcha Road"
  // address from being billed the Walcha flat rate.
  const locality =
    p.suburb ?? p.city ?? p.town ?? p.village ??
    (!p.street && !p.housenumber ? (p.name ?? "") : "");
  const label = [streetPart === locality ? "" : streetPart, locality, p.state, p.postcode]
    .filter(Boolean)
    .join(", ");
  return {
    label: label || p.name || "Unknown address",
    lon: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
    suburb: locality,
    streetLevel,
  };
}

async function fetchPhoton(q: string): Promise<PhotonFeature[]> {
  const url =
    "https://photon.komoot.io/api/?limit=8&lang=en" +
    "&lat=-30.51&lon=151.66" + // bias toward Armidale
    "&bbox=150.2,-31.6,153.0,-29.5&q=" +
    encodeURIComponent(q);
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.features ?? []).filter(
    (f: PhotonFeature) =>
      f.properties.state === "New South Wales" || f.properties.state === "NSW",
  );
}

async function roadDistanceKm(lat: number, lon: number): Promise<number | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${BUSINESS.origin.lon},${BUSINESS.origin.lat};${lon},${lat}?overview=false`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const metres = data?.routes?.[0]?.distance;
  return typeof metres === "number" ? metres / 1000 : null;
}

export default function AddressField({ value, onChange }: Props) {
  const rates = useRates();
  const [query, setQuery] = useState(value?.addressLabel ?? "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [routing, setRouting] = useState(false);
  const [failed, setFailed] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const skipNextSearch = useRef(false);

  // Debounced Photon (OSM) autocomplete, biased to the New England
  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }
    const trimmed = query.trim();
    if (trimmed.length < 4) {
      setSuggestions([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        // Try the query as typed. Extra variants catch common failure modes:
        // no town typed -> add "Armidale"; a house number present -> also try
        // without it, because number-matching can bury the actual street.
        const variants = [trimmed];
        if (!KNOWN_TOWNS.test(trimmed)) variants.push(`${trimmed} Armidale`);
        const numberless = stripNumber(trimmed);
        if (numberless !== trimmed && numberless.trim().length >= 4) {
          variants.push(numberless);
        }
        const batches = await Promise.all(variants.map(fetchPhoton));

        const parsed = parseQuery(trimmed);
        const seen = new Set<string>();
        const scored: { s: Suggestion; score: number }[] = [];
        for (const features of batches) {
          for (const f of features) {
            const sc = scoreFeature(f, parsed);
            if (!sc) continue;
            const s = photonToSuggestion(f, sc.streetLevel);
            const key = s.label.toLowerCase();
            const existing = scored.findIndex(
              (x) => x.s.label.toLowerCase() === key,
            );
            if (existing >= 0) {
              // Keep the better-scoring copy of a duplicate label
              if (sc.score > scored[existing].score) {
                scored[existing] = { s, score: sc.score };
              }
              continue;
            }
            if (seen.has(key)) continue;
            seen.add(key);
            scored.push({ s, score: sc.score });
          }
        }
        scored.sort((a, b) => b.score - a.score);
        const list = scored.slice(0, 5).map((x) => x.s);
        setSuggestions(list);
        setOpen(list.length > 0);
        setFailed(false);
      } catch {
        setFailed(true);
      } finally {
        setSearching(false);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const resolve = async (s: Suggestion) => {
    setOpen(false);
    setRouting(true);
    skipNextSearch.current = true;
    setQuery(s.label);
    const km = await roadDistanceKm(s.lat, s.lon);
    setRouting(false);

    if (km === null) {
      setFailed(true);
      return;
    }
    const outOfRange = km > rates.travel.maxServiceKm;
    onChange({
      addressLabel: s.label,
      suburb: s.suburb,
      km: Math.round(km * 10) / 10,
      fee: outOfRange ? 0 : travelFeeForTown(s.suburb, km, rates),
      outOfRange,
      source: "live",
      estimated: s.streetLevel,
    });
  };

  const pickTown = (name: string) => {
    const town = FALLBACK_TOWNS.find((t) => t.name === name);
    if (!town) return;
    skipNextSearch.current = true;
    setQuery(`${town.name} NSW`);
    onChange({
      addressLabel: `${town.name} NSW`,
      suburb: town.name,
      km: town.km,
      fee: town.km > rates.travel.maxServiceKm ? 0 : travelFeeForTown(town.name, town.km, rates),
      outOfRange: town.km > rates.travel.maxServiceKm,
      source: "fallback",
    });
  };

  return (
    <div ref={boxRef} className="relative">
      <label htmlFor="address" className="mb-2 block font-bold text-charcoal">
        Your address
      </label>
      <input
        id="address"
        className="input-sharp"
        placeholder="Start typing your street address…"
        value={query}
        autoComplete="street-address"
        onChange={(e) => {
          setQuery(e.target.value);
          if (value) onChange(null);
        }}
        onFocus={() => suggestions.length && setOpen(true)}
      />

      {(searching || routing) && (
        <p className="mt-2 text-sm font-semibold text-forest" role="status">
          {searching ? "Finding addresses…" : "Measuring the drive from Armidale…"}
        </p>
      )}

      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto border-[1.5px] border-charcoal bg-background shadow-lg">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                className="block w-full px-4 py-3 text-left text-sm leading-snug hover:bg-mintlight focus:bg-mintlight"
                onClick={() => resolve(s)}
              >
                {s.label}
                {s.streetLevel && (
                  <span className="block text-xs text-charcoal/60">
                    Street match — exact house number estimated
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {value && !value.outOfRange && (
        <div className="mt-3 border-[1.5px] border-forest bg-mintlight p-4" role="status">
          <p className="font-semibold text-charcoal">
            {value.km !== null && value.km > 0.5 ? (
              <>
                About <strong>{Math.round(value.km)}km</strong> by road from Armidale →{" "}
                travel fee{" "}
                <strong className="font-display text-lg text-forest">
                  {value.fee === 0 ? "Free" : money(value.fee)}
                </strong>
                {value.fee === 0 && (
                  <span className="text-charcoal/70"> (free in Armidale)</span>
                )}
              </>
            ) : (
              <>
                You're in Armidale → travel fee{" "}
                <strong className="font-display text-lg text-forest">Free</strong>
              </>
            )}
          </p>
          {(value.source === "fallback" || value.estimated) && (
            <p className="mt-1 text-sm text-charcoal/70">
              {value.source === "fallback"
                ? "Estimated from your nearest town — we confirm the exact fee when we book you in."
                : "Estimated to your street — we confirm the exact fee when we book you in."}
            </p>
          )}
        </div>
      )}

      {value?.outOfRange && (
        <div className="mt-3 border-[1.5px] border-charcoal bg-cream p-4" role="status">
          <p className="font-semibold text-charcoal">
            That's about {Math.round(value.km ?? 0)}km away — outside our regular{" "}
            {rates.travel.maxServiceKm}km run. We may still be able to do it: call us on{" "}
            <a href={BUSINESS.phoneHref} className="font-bold text-forest">
              {BUSINESS.phone}
            </a>{" "}
            and he'll quote the travel by hand.
          </p>
        </div>
      )}

      {(failed || (!value && query.length >= 4 && !searching && suggestions.length === 0)) && (
        <div className="mt-3">
          <p className="text-sm font-semibold text-charcoal/80">
            Can't find it? Pick your nearest town instead:
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {FALLBACK_TOWNS.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => pickTown(t.name)}
                className="border-[1.5px] border-charcoal bg-background px-3 py-1.5 text-sm font-semibold hover:bg-cream"
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
