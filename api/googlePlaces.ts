// Google address lookup — Places API (New), server-side so the key never
// reaches the browser. Used by the quote pages' address field: autocomplete
// as they type, details when they pick one. The free Photon/OSM path stays
// as the automatic fallback whenever the key is missing or Google errors.

import { getSetting } from "./queries/settings";

const FETCH_TIMEOUT_MS = 10_000;

// Bias everything at our service area: 50km circle on Armidale (Google's max
// radius), plus Australia-only region filtering.
const SERVICE_BIAS = {
  circle: { center: { latitude: -30.51, longitude: 151.66 }, radius: 50000 },
};

async function apiKey(): Promise<string | null> {
  const key = (await getSetting("google_places_api_key"))?.trim();
  return key || null;
}

export interface AddressSuggestion {
  placeId: string;
  label: string;
  /** True when Google only knows the street, not the house number. */
  streetLevel: boolean;
}

export interface AddressSearchResult {
  /** False = Google unavailable (no key / error) — client uses the fallback. */
  google: boolean;
  suggestions: AddressSuggestion[];
}

interface AutocompleteResponse {
  suggestions?: {
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      types?: string[];
    };
  }[];
}

export async function autocompleteAddress(input: string): Promise<AddressSearchResult> {
  const key = await apiKey();
  if (!key) return { google: false, suggestions: [] };
  try {
    const resp = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.types",
      },
      body: JSON.stringify({
        input,
        includedRegionCodes: ["au"],
        languageCode: "en",
        regionCode: "AU",
        locationBias: SERVICE_BIAS,
        includeQueryPredictions: false,
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!resp.ok) {
      console.error("Google autocomplete failed:", resp.status, await resp.text().catch(() => ""));
      return { google: false, suggestions: [] };
    }
    const data = (await resp.json()) as AutocompleteResponse;
    const seen = new Set<string>();
    const suggestions: AddressSuggestion[] = [];
    for (const s of data.suggestions ?? []) {
      const p = s.placePrediction;
      if (!p?.placeId || !p.text?.text) continue;
      // Australia-wide region filter still lets interstate noise through —
      // keep NSW only.
      if (!/\bNSW\b|New South Wales/i.test(p.text.text)) continue;
      const label = p.text.text;
      if (seen.has(label)) continue;
      seen.add(label);
      const types = p.types ?? [];
      const streetLevel =
        !types.includes("street_address") &&
        !types.includes("premise") &&
        !types.includes("subpremise");
      suggestions.push({ placeId: p.placeId, label, streetLevel });
      if (suggestions.length >= 5) break;
    }
    return { google: true, suggestions };
  } catch (err) {
    console.error("Google autocomplete error:", err);
    return { google: false, suggestions: [] };
  }
}

export interface ResolvedAddress {
  lat: number;
  lon: number;
  label: string;
  suburb: string;
  streetLevel: boolean;
}

interface DetailsResponse {
  location?: { latitude?: number; longitude?: number };
  formattedAddress?: string;
  addressComponents?: { longText?: string; types?: string[] }[];
  types?: string[];
}

export async function resolveAddress(placeId: string): Promise<ResolvedAddress | null> {
  const key = await apiKey();
  if (!key) return null;
  try {
    const resp = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=en`,
      {
        headers: {
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "location,formattedAddress,addressComponents,types",
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      },
    );
    if (!resp.ok) {
      console.error("Google place details failed:", resp.status);
      return null;
    }
    const data = (await resp.json()) as DetailsResponse;
    const lat = data.location?.latitude;
    const lon = data.location?.longitude;
    if (typeof lat !== "number" || typeof lon !== "number") return null;
    // The suburb for fee purposes is the postal locality, never the street.
    const comp = (t: string) =>
      data.addressComponents?.find((c) => c.types?.includes(t))?.longText?.trim();
    const suburb =
      comp("locality") ?? comp("postal_town") ?? comp("sublocality_level_1") ?? "";
    const types = data.types ?? [];
    const streetLevel =
      !types.includes("street_address") &&
      !types.includes("premise") &&
      !types.includes("subpremise");
    return {
      lat,
      lon,
      label: data.formattedAddress?.trim() || "",
      suburb,
      streetLevel,
    };
  } catch (err) {
    console.error("Google place details error:", err);
    return null;
  }
}
