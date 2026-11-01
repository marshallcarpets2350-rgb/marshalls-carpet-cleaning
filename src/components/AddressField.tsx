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

interface Suggestion {
  label: string;
  lat: number;
  lon: number;
  suburb: string;
}

function photonToSuggestion(f: {
  properties: PhotonProperties;
  geometry: { coordinates: [number, number] };
}): Suggestion {
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
  };
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

  // Debounced Nominatim autocomplete
  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }
    if (query.trim().length < 4) {
      setSuggestions([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        // Photon (OSM) geocoder, biased to the New England bbox
        const url =
          "https://photon.komoot.io/api/?limit=6&lang=en" +
          "&bbox=150.2,-31.6,153.0,-29.5&q=" +
          encodeURIComponent(query);
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        const data = await res.json();
        const seen = new Set<string>();
        const list: Suggestion[] = (data.features ?? [])
          .filter(
            (f: { properties: PhotonProperties }) =>
              f.properties.state === "New South Wales" || f.properties.state === "NSW",
          )
          .map(photonToSuggestion)
          .filter((s: Suggestion) => {
            if (seen.has(s.label)) return false;
            seen.add(s.label);
            return true;
          })
          .slice(0, 5);
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
          {value.source === "fallback" && (
            <p className="mt-1 text-sm text-charcoal/70">
              Estimated from your nearest town — we confirm the exact fee when we book you in.
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
