/**
 * US states and their cities, for picking salon-finding territories.
 *
 * City names, coordinates and populations come from GeoNames
 * (https://www.geonames.org, CC BY 4.0), extracted from the `all-the-cities`
 * package: every city of 15,000+ people, topped up to at least 15 cities per
 * state. Coordinates are bundled so choosing a city costs no Google searches.
 */
import data from "./us-cities.json";

export const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware",
  DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon",
  PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};
export const STATES = Object.keys(STATE_NAMES).sort((a, b) => STATE_NAMES[a].localeCompare(STATE_NAMES[b]));

export type City = { name: string; state: string; lat: number; lng: number; population: number };

const DATA = data as unknown as Record<string, [string, number, number, number][]>;

/** Cities in a state, largest first. */
export function citiesIn(state: string): City[] {
  return (DATA[state?.toUpperCase()] ?? []).map(([name, lat, lng, population]) => ({ name, state: state.toUpperCase(), lat, lng, population }));
}

export function findCity(state: string | null | undefined, name: string | null | undefined): City | null {
  if (!state || !name) return null;
  const n = name.trim().toLowerCase();
  return citiesIn(state).find((c) => c.name.toLowerCase() === n) ?? null;
}

/** Search radius sized to the city: ~5 km for a small town up to 25 km for a big metro. */
export function radiusKmFor(population: number): number {
  return Math.min(25, Math.max(5, Math.round(Math.sqrt(Math.max(population, 0)) / 45)));
}

/** Deterministic shuffle (mulberry32 seeded from a string). */
export function shuffled<T>(items: T[], seedText: string): T[] {
  let s = [...seedText].reduce((h, ch) => (Math.imul(h ^ ch.charCodeAt(0), 2654435761) >>> 0), 2166136261);
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** One place to search: a city's center and radius. */
export type SearchArea = { key: string; city: string; center: { lat: number; lng: number }; radiusKm: number };

/**
 * The areas a territory covers. A specific city is one area. "Any city" is
 * every city in the state in a random order that changes each day (seeded by
 * the date, so repeated runs on the same day continue the same order).
 */
export function areasFor(t: { id: string; state: string | null; city: string | null; radiusMeters?: number | null }, runDate: string): SearchArea[] {
  if (!t.state) return [];
  if (t.city) {
    const c = findCity(t.state, t.city);
    if (!c) return [];
    return [{ key: c.name, city: c.name, center: { lat: c.lat, lng: c.lng }, radiusKm: t.radiusMeters ? t.radiusMeters / 1000 : radiusKmFor(c.population) }];
  }
  return shuffled(citiesIn(t.state), `${t.id}:${runDate}`).map((c) => ({ key: c.name, city: c.name, center: { lat: c.lat, lng: c.lng }, radiusKm: radiusKmFor(c.population) }));
}

export function territoryLabel(t: { state: string | null; city: string | null; name?: string }) {
  if (!t.state) return t.name ?? "Territory";
  return t.city ? `${t.city}, ${t.state}` : `${STATE_NAMES[t.state] ?? t.state}: any city`;
}
