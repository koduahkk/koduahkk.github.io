/**
 * Google Places API (New) client.
 *
 * Terms of service: only `place_id` is stored permanently. Every other field
 * we keep is treated as cache — stamped with `placesRefreshedAt` and
 * refreshable from the lead page or the background refresh job.
 */
import "server-only";
import { getSecret } from "@/lib/secrets";
import { fromGooglePeriods, type GooglePeriod } from "@/lib/places/hours";
import { SALON_CATEGORIES } from "@/lib/domain";
import type { WeeklyHours } from "@/lib/domain";

const BASE = "https://places.googleapis.com/v1";
const FIELDS = [
  "id", "displayName", "nationalPhoneNumber", "internationalPhoneNumber", "formattedAddress", "addressComponents",
  "websiteUri", "rating", "userRatingCount", "regularOpeningHours", "location", "businessStatus",
];

type GPlace = {
  id: string;
  displayName?: { text: string };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  formattedAddress?: string;
  addressComponents?: { longText: string; shortText: string; types: string[] }[];
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: { periods?: GooglePeriod[] };
  location?: { latitude: number; longitude: number };
  businessStatus?: string;
};

export type NormalizedPlace = {
  placeId: string;
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  website: string | null;
  googleRating: number | null;
  reviewCount: number | null;
  openingHours: WeeklyHours | null;
  closedPermanently: boolean;
};

async function apiKey() {
  const k = await getSecret("GOOGLE_PLACES_API_KEY");
  if (!k) throw new Error("Google Places API key is not configured (Settings → Integrations).");
  return k;
}

async function call<T>(path: string, init: RequestInit & { fieldMask: string }): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": await apiKey(), "X-Goog-FieldMask": init.fieldMask },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Places ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

function normalize(p: GPlace): NormalizedPlace {
  const comp = (t: string, short = false) => {
    const c = p.addressComponents?.find((x) => x.types.includes(t));
    return c ? (short ? c.shortText : c.longText) : null;
  };
  return {
    placeId: p.id,
    name: p.displayName?.text ?? "Unnamed",
    phone: p.internationalPhoneNumber ?? p.nationalPhoneNumber ?? null,
    address: p.formattedAddress ?? null,
    city: comp("locality") ?? comp("sublocality") ?? comp("postal_town"),
    state: comp("administrative_area_level_1", true),
    zip: comp("postal_code"),
    country: comp("country", true),
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    website: p.websiteUri ?? null,
    googleRating: p.rating ?? null,
    reviewCount: p.userRatingCount ?? null,
    openingHours: fromGooglePeriods(p.regularOpeningHours?.periods),
    closedPermanently: p.businessStatus === "CLOSED_PERMANENTLY",
  };
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Resolve a city or ZIP to a center point using Places Text Search itself (no Geocoding API needed). */
async function locate(location: string) {
  const r = await call<{ places?: GPlace[] }>("/places:searchText", {
    method: "POST",
    fieldMask: "places.location,places.formattedAddress",
    body: JSON.stringify({ textQuery: location, pageSize: 1 }),
  });
  const loc = r.places?.[0]?.location;
  if (!loc) throw new Error(`Couldn't find "${location}" on Google Maps.`);
  return { lat: loc.latitude, lng: loc.longitude };
}

/**
 * Text Search biased to a circle around the city/ZIP; results outside the
 * radius are dropped. Pages through up to `maxResults` (Google caps at 60).
 */
export async function searchSalons(opts: { location: string; radiusMeters: number; category: string; maxResults?: number }) {
  const cat = SALON_CATEGORIES.find((c) => c.value === opts.category) ?? SALON_CATEGORIES[0];
  const center = await locate(opts.location);
  const radius = Math.min(Math.max(opts.radiusMeters, 500), 50000);
  const out: NormalizedPlace[] = [];
  let pageToken: string | undefined;
  const max = Math.min(opts.maxResults ?? 60, 60);
  do {
    const body: Record<string, unknown> = {
      textQuery: `${cat.query} near ${opts.location}`,
      pageSize: 20,
      locationBias: { circle: { center: { latitude: center.lat, longitude: center.lng }, radius } },
    };
    if (cat.placesType) body.includedType = cat.placesType;
    if (pageToken) body.pageToken = pageToken;
    const r = await call<{ places?: GPlace[]; nextPageToken?: string }>("/places:searchText", {
      method: "POST",
      fieldMask: FIELDS.map((f) => "places." + f).join(",") + ",nextPageToken",
      body: JSON.stringify(body),
    });
    for (const p of r.places ?? []) {
      const n = normalize(p);
      if (n.closedPermanently) continue;
      if (n.lat != null && n.lng != null && haversineMeters(center, { lat: n.lat, lng: n.lng }) > radius) continue;
      out.push(n);
    }
    pageToken = r.nextPageToken;
  } while (pageToken && out.length < max);
  return { center, places: out.slice(0, max), category: cat };
}

/** Place Details — used by the "refresh" action to re-pull cached fields. */
export async function getPlace(placeId: string): Promise<NormalizedPlace> {
  const p = await call<GPlace>(`/places/${encodeURIComponent(placeId)}`, { method: "GET", fieldMask: FIELDS.join(",") });
  return normalize(p);
}
