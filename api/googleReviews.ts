// Google reviews — pulled from the official Places API (New), cached in the
// DB and refreshed weekly. The homepage stars + review cards read the cache,
// so page loads never wait on Google and the API bill stays at cents a year.
//
// Owner setup: paste a Google Cloud API key (Places API New enabled) into
// Admin → Settings. The Place ID is found automatically by text search, and
// the "write a review" link is derived from it — which also feeds the
// follow-up email's review ask when no manual link is saved.

import { getSetting, getSettings, setSetting } from "./queries/settings";

const CACHE_KEY = "google_reviews_cache";
export const GOOGLE_KEYS = ["google_places_api_key", "google_place_id", CACHE_KEY] as const;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 12_000;

export interface GoogleReview {
  author: string;
  rating: number;
  text: string;
  relativeTime: string;
}

export interface GoogleReviewsData {
  rating: number;
  userRatingCount: number;
  reviews: GoogleReview[];
  mapsUrl: string;
  reviewUrl: string;
  fetchedAt: string;
}

// The business trades as "Marshall's" — the owner's personal name must never
// appear on the site, including inside a quoted Google review.
const OWNER_NAME = /\b(ben|benji|benjamin)\b/i;

async function loadCache(): Promise<GoogleReviewsData | null> {
  const raw = await getSetting(CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GoogleReviewsData;
  } catch {
    return null;
  }
}

/** Find our own Place ID by name — runs once, then it's stored. */
async function ensurePlaceId(apiKey: string, saved: string | null): Promise<string | null> {
  if (saved) return saved;
  // The Google listing uses a curly apostrophe and lowercase "cleaning", so
  // try a few spellings until one lands.
  const queries = [
    "Marshall\u2019s Carpet cleaning Armidale",
    "Marshall's Carpet Cleaning, Armidale NSW",
    "Marshalls Carpet Cleaning Armidale",
    "Marshall Carpet Cleaning Armidale NSW",
  ];
  for (const textQuery of queries) {
    const resp = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
      },
      body: JSON.stringify({ textQuery, languageCode: "en", regionCode: "AU" }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      const reason = body.match(/"message":\s*"([^"]{10,300})"/)?.[1];
      throw new Error(`Google place search failed (${resp.status})${reason ? ` — ${reason}` : body ? ` ${body.slice(0, 200)}` : ""}`);
    }
    const data = (await resp.json()) as {
      places?: { id: string; displayName?: { text?: string } }[];
    };
    const place = data.places?.[0];
    if (place?.id) {
      await setSetting("google_place_id", place.id);
      return place.id;
    }
  }

  // Final fallback: nearby search around the listing's map pin (Text Search
  // sometimes misses service-area businesses that hide their street address).
  const nearby = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName",
    },
    body: JSON.stringify({
      locationRestriction: {
        circle: { center: { latitude: -30.827906, longitude: 151.79948 }, radius: 5000 },
      },
      maxResultCount: 20,
      languageCode: "en",
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (nearby.ok) {
    const data = (await nearby.json()) as {
      places?: { id: string; displayName?: { text?: string } }[];
    };
    const hit = (data.places ?? []).find((p) => /marshall/i.test(p.displayName?.text ?? ""));
    if (hit?.id) {
      await setSetting("google_place_id", hit.id);
      return hit.id;
    }
    throw new Error(
      `Nearby search saw: [${(data.places ?? []).map((p) => p.displayName?.text).join(", ") || "nothing"}]`,
    );
  }
  throw new Error(`Nearby search failed (${nearby.status}) ${(await nearby.text().catch(() => "")).slice(0, 160)}`);
}

/** Temporary diagnostic: what does Google return for control queries? */
export async function debugGoogleSearch(apiKey: string): Promise<unknown> {
  const out: Record<string, unknown> = {};
  for (const q of ["Armidale", "carpet cleaning Armidale", "Marshall's Carpet cleaning Armidale", "Bunnings Armidale"]) {
    const resp = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName",
      },
      body: JSON.stringify({ textQuery: q, languageCode: "en", regionCode: "AU" }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!resp.ok) {
      out[q] = `HTTP ${resp.status}: ${(await resp.text().catch(() => "")).slice(0, 200)}`;
    } else {
      const data = (await resp.json()) as { places?: { displayName?: { text?: string } }[] };
      out[q] = (data.places ?? []).map((p) => p.displayName?.text);
    }
  }
  return out;
}

/** Fresh copy from Google. Throws on failure — callers fall back to cache. */
export async function refreshGoogleReviews(): Promise<GoogleReviewsData | null> {
  const s = await getSettings(["google_places_api_key", "google_place_id", "google_review_url"]);
  const apiKey = s.google_places_api_key?.trim();
  if (!apiKey) return null;

  const placeId = await ensurePlaceId(apiKey, s.google_place_id?.trim() || null);
  if (!placeId) {
    throw new Error(
      "Google couldn't find the business — check the Google Business Profile is live and named \"Marshall's Carpet Cleaning\".",
    );
  }

  const resp = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=en`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "rating,userRatingCount,googleMapsUri,reviews.rating,reviews.text.text,reviews.originalText.text,reviews.relativePublishTimeDescription,reviews.authorAttribution.displayName",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    const hint = resp.status === 403 ? " — is the Places API (New) enabled on that key's project?" : "";
    throw new Error(`Google reviews fetch failed (${resp.status})${hint}${body ? ` ${body.slice(0, 160)}` : ""}`);
  }
  const data = (await resp.json()) as {
    rating?: number;
    userRatingCount?: number;
    googleMapsUri?: string;
    reviews?: {
      rating?: number;
      text?: { text?: string };
      originalText?: { text?: string };
      relativePublishTimeDescription?: string;
      authorAttribution?: { displayName?: string };
    }[];
  };

  const reviews: GoogleReview[] = (data.reviews ?? [])
    .map((r) => ({
      author: r.authorAttribution?.displayName?.trim() || "Google user",
      rating: r.rating ?? 5,
      text: (r.originalText?.text || r.text?.text || "").trim(),
      relativeTime: r.relativePublishTimeDescription || "",
    }))
    .filter((r) => r.text && !OWNER_NAME.test(r.text));

  const result: GoogleReviewsData = {
    rating: data.rating ?? 0,
    userRatingCount: data.userRatingCount ?? 0,
    reviews,
    mapsUrl: data.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Marshall's Carpet Cleaning Armidale")}`,
    reviewUrl: `https://search.google.com/local/writereview?placeid=${placeId}`,
    fetchedAt: new Date().toISOString(),
  };
  await setSetting(CACHE_KEY, JSON.stringify(result));

  // The derived review link feeds the thank-you email too — only auto-fill it
  // when the owner hasn't saved their own link.
  if (!s.google_review_url?.trim()) {
    await setSetting("google_review_url", result.reviewUrl);
  }
  return result;
}

/** What the homepage reads: fresh cache, or refresh if it's older than a
 *  week. On a Google hiccup the stale cache still shows — never nothing. */
export async function getGoogleReviews(): Promise<GoogleReviewsData | null> {
  const cached = await loadCache();
  const fresh = cached && Date.now() - new Date(cached.fetchedAt).getTime() < WEEK_MS;
  if (fresh) return cached;
  try {
    return (await refreshGoogleReviews()) ?? cached;
  } catch (err) {
    console.error("Google reviews refresh failed:", err);
    return cached;
  }
}

/** Status block for Admin → Settings. */
export async function googleReviewsStatus(): Promise<{
  configured: boolean;
  keyHint: string;
  placeId: string;
  cached: { rating: number; userRatingCount: number; reviewCount: number; fetchedAt: string } | null;
}> {
  const s = await getSettings(["google_places_api_key", "google_place_id"]);
  const cached = await loadCache();
  const key = s.google_places_api_key?.trim() ?? "";
  return {
    configured: Boolean(key),
    keyHint: key ? `…${key.slice(-4)}` : "",
    placeId: s.google_place_id?.trim() ?? "",
    cached: cached
      ? {
          rating: cached.rating,
          userRatingCount: cached.userRatingCount,
          reviewCount: cached.reviews.length,
          fetchedAt: cached.fetchedAt,
        }
      : null,
  };
}

/** Save (or replace) the API key, then prove it works with a live fetch. */
export async function saveGoogleApiKey(apiKey: string): Promise<GoogleReviewsData | null> {
  if (!/^[A-Za-z0-9_-]{20,}$/.test(apiKey)) {
    throw new Error("That doesn't look like a Google API key — copy the whole key from Google Cloud.");
  }
  await setSetting("google_places_api_key", apiKey);
  return refreshGoogleReviews();
}
