/** CSV import helpers (pure; safe to use in client components). */
import { parseHoursText } from "@/lib/places/hours";
import type { LeadInput } from "@/lib/leads/ingest";

/** CSV column mapping: app field → CSV header. */
export const CSV_FIELDS = [
  { key: "name", label: "Salon name", required: true },
  { key: "phone", label: "Phone", required: true },
  { key: "email", label: "Email" },
  { key: "ownerFirstName", label: "Owner first name" },
  { key: "address", label: "Street address" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "zip", label: "ZIP" },
  { key: "website", label: "Website" },
  { key: "googleRating", label: "Google rating" },
  { key: "reviewCount", label: "Review count" },
  { key: "category", label: "Category" },
  { key: "hours", label: "Opening hours (text)" },
  { key: "instagram", label: "Instagram" },
  { key: "placeId", label: "Google place_id" },
  { key: "lat", label: "Latitude" },
  { key: "lng", label: "Longitude" },
] as const;
export type CsvFieldKey = (typeof CSV_FIELDS)[number]["key"];
export type CsvMapping = Partial<Record<CsvFieldKey, string>>;

/** Guess a mapping from CSV headers (case/spacing-insensitive). */
export function guessMapping(headers: string[]): CsvMapping {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const synonyms: Record<CsvFieldKey, string[]> = {
    name: ["name", "salonname", "business", "businessname", "company"],
    phone: ["phone", "phonenumber", "telephone", "tel", "mobile"],
    email: ["email", "emailaddress", "contactemail"],
    ownerFirstName: ["ownerfirstname", "firstname", "owner", "contactname"],
    address: ["address", "street", "streetaddress", "address1"],
    city: ["city", "town"],
    state: ["state", "region", "province"],
    zip: ["zip", "zipcode", "postalcode", "postcode"],
    website: ["website", "url", "site", "web"],
    googleRating: ["rating", "googlerating", "stars"],
    reviewCount: ["reviews", "reviewcount", "numreviews", "userratingcount"],
    category: ["category", "type"],
    hours: ["hours", "openinghours", "businesshours"],
    instagram: ["instagram", "ig", "insta"],
    placeId: ["placeid", "googleplaceid"],
    lat: ["lat", "latitude"],
    lng: ["lng", "lon", "long", "longitude"],
  };
  const out: CsvMapping = {};
  for (const [key, syns] of Object.entries(synonyms) as [CsvFieldKey, string[]][]) {
    const h = headers.find((x) => syns.includes(norm(x)));
    if (h) out[key] = h;
  }
  return out;
}

const num = (v: string | undefined) => {
  if (v == null || v.trim() === "") return null;
  const n = Number(v.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

export function rowToLeadInput(row: Record<string, string>, mapping: CsvMapping): LeadInput | null {
  const get = (k: CsvFieldKey) => (mapping[k] ? row[mapping[k]!]?.trim() || null : null);
  const name = get("name");
  if (!name) return null;
  return {
    name,
    phone: get("phone"),
    email: get("email"),
    ownerFirstName: get("ownerFirstName"),
    address: get("address"),
    city: get("city"),
    state: get("state")?.toUpperCase() ?? null,
    zip: get("zip"),
    website: get("website"),
    googleRating: num(get("googleRating") ?? undefined),
    reviewCount: num(get("reviewCount") ?? undefined),
    category: get("category"),
    openingHours: parseHoursText(get("hours")),
    instagram: get("instagram")?.replace(/^@/, "") ?? null,
    placeId: get("placeId"),
    lat: num(get("lat") ?? undefined),
    lng: num(get("lng") ?? undefined),
  };
}

