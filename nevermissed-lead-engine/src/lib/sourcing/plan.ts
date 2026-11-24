/**
 * Daily salon finding: pure helpers (no I/O, unit tested).
 *
 * Google Places Text Search returns at most 60 results per query, so one
 * search over a whole city only ever sees the same 60 salons. Instead each
 * territory is split into small square map tiles, searched one at a time,
 * starting at the center and spiralling outward. A cursor remembers where
 * the last run stopped, so every day continues into new ground.
 */
import { z } from "zod";
import { SALON_CATEGORIES } from "@/lib/domain";

/** Common US chains whose phones go to a call center or corporate line. Editable in Settings. */
export const DEFAULT_CHAINS = [
  "Great Clips", "Supercuts", "Sport Clips", "Fantastic Sams", "Cost Cutters", "SmartStyle", "Hair Cuttery", "Regis Salon",
  "Ulta Beauty", "JCPenney Salon", "Floyd's 99", "European Wax Center", "Drybar", "Massage Envy", "Hand & Stone",
  "The Lash Lounge", "Amazing Lash", "Hello Sugar", "Madison Reed", "Roosters Men's Grooming", "Toni&Guy", "Bishops",
];

export const sourcingSchema = z.object({
  /** Off until someone picks territories and categories and turns it on. */
  enabled: z.boolean().default(false),
  dailyTarget: z.number().int().min(1).max(500).default(50),
  categories: z.array(z.enum(SALON_CATEGORIES.map((c) => c.value) as [string, ...string[]])).default([]),
  /** Optional filters. null = no minimum. */
  minRating: z.number().min(0).max(5).nullable().default(null),
  minReviews: z.number().int().min(0).nullable().default(null),
  excludeChains: z.boolean().default(true),
  chainNames: z.array(z.string().min(2).max(60)).default(DEFAULT_CHAINS),
  /** Hard cap on Google searches per day, so the bill can't surprise you. */
  maxRequestsPerDay: z.number().int().min(1).max(1000).default(60),
  /** Side length of a search tile in km. Smaller tiles find more in dense areas. */
  tileKm: z.number().min(0.5).max(10).default(3),
});
export type SourcingSettings = z.infer<typeof sourcingSchema>;

export type LatLng = { lat: number; lng: number };
export type Tile = { low: LatLng; high: LatLng; center: LatLng };

const KM_PER_DEG_LAT = 110.574;
const kmPerDegLng = (lat: number) => 111.32 * Math.cos((lat * Math.PI) / 180);

/**
 * Square tiles (side `tileKm`) covering a circle of `radiusKm`, ordered by a
 * spiral from the center outward so the densest area is searched first.
 * Tiles whose center falls outside the circle (plus half a tile) are dropped.
 */
export function tilesFor(center: LatLng, radiusKm: number, tileKm: number): Tile[] {
  const dLat = tileKm / KM_PER_DEG_LAT;
  const dLng = tileKm / kmPerDegLng(center.lat);
  const n = Math.ceil(radiusKm / tileKm);
  const cells: { i: number; j: number; ring: number; angle: number }[] = [];
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      const distKm = Math.hypot(i * tileKm, j * tileKm);
      if (distKm > radiusKm + tileKm / 2) continue;
      cells.push({ i, j, ring: Math.max(Math.abs(i), Math.abs(j)), angle: Math.atan2(i, j) });
    }
  }
  cells.sort((a, b) => a.ring - b.ring || a.angle - b.angle);
  return cells.map(({ i, j }) => {
    const c = { lat: center.lat + i * dLat, lng: center.lng + j * dLng };
    return { center: c, low: { lat: c.lat - dLat / 2, lng: c.lng - dLng / 2 }, high: { lat: c.lat + dLat / 2, lng: c.lng + dLng / 2 } };
  });
}

/**
 * Where a territory's search stopped, kept per category so adding a category
 * later doesn't restart the others. `grid` identifies the tiling (center,
 * radius, tile size); if any of those change, progress starts over.
 */
export type CategoryCursor = { tile: number; pageToken?: string | null; done?: boolean };
export type TerritoryCursor = { grid: string; cats: Record<string, CategoryCursor> };

export const gridKey = (center: LatLng, radiusKm: number, tileKm: number) =>
  `${center.lat.toFixed(4)},${center.lng.toFixed(4)}:${radiusKm}:${tileKm}`;

/** Read a stored cursor, starting over if the tiling changed. */
export function loadCursor(stored: unknown, grid: string): TerritoryCursor {
  const c = stored as TerritoryCursor | null;
  return c && c.grid === grid && c.cats && typeof c.cats === "object" ? { grid, cats: { ...c.cats } } : { grid, cats: {} };
}

/** Next page of the same tile, else the next tile, else done. */
export function advanceTile(cur: CategoryCursor, tileCount: number, nextPageToken?: string | null): CategoryCursor {
  if (nextPageToken) return { tile: cur.tile, pageToken: nextPageToken };
  if (cur.tile + 1 < tileCount) return { tile: cur.tile + 1, pageToken: null };
  return { tile: tileCount, pageToken: null, done: true };
}

/** Share of the territory searched across the enabled categories, 0–1. */
export function coverage(cursor: TerritoryCursor | null, categories: string[], tileCount: number): number {
  if (!categories.length || !tileCount) return 0;
  const per = categories.map((c) => {
    const k = cursor?.cats[c];
    return k?.done ? 1 : Math.min(1, (k?.tile ?? 0) / tileCount);
  });
  return per.reduce((a, b) => a + b, 0) / categories.length;
}

export const isExhausted = (cursor: TerritoryCursor | null, categories: string[]) =>
  categories.length > 0 && categories.every((c) => cursor?.cats[c]?.done);

export type Candidate = { name: string; phone: string | null; googleRating: number | null; reviewCount: number | null; closedPermanently?: boolean };
export type FilterResult = { ok: true } | { ok: false; reason: "closed" | "no_phone" | "rating" | "reviews" | "chain" };

const normName = (s: string) => s.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9&]+/g, " ").trim();

/** Apply the user's filters to one Google result. */
export function passesFilters(p: Candidate, f: Pick<SourcingSettings, "minRating" | "minReviews" | "excludeChains" | "chainNames">): FilterResult {
  if (p.closedPermanently) return { ok: false, reason: "closed" };
  if (!p.phone) return { ok: false, reason: "no_phone" };
  if (f.minRating != null && (p.googleRating ?? 0) < f.minRating) return { ok: false, reason: "rating" };
  if (f.minReviews != null && (p.reviewCount ?? 0) < f.minReviews) return { ok: false, reason: "reviews" };
  if (f.excludeChains) {
    const n = ` ${normName(p.name)} `;
    if (f.chainNames.some((c) => n.includes(` ${normName(c)} `))) return { ok: false, reason: "chain" };
  }
  return { ok: true };
}

/** What still has to be set before the daily job is allowed to run. Empty = ready. */
export function setupGaps(s: SourcingSettings, activeTerritories: number): string[] {
  const gaps: string[] = [];
  if (!activeTerritories) gaps.push("Add at least one territory (a state, with any city or specific cities).");
  if (!s.categories.length) gaps.push("Choose at least one salon category.");
  return gaps;
}

/** Stored progress for a territory: one cursor per city ("area"). */
export type TerritoryProgress = { areas: Record<string, TerritoryCursor> };

/** The cursor for one city, accepting the older single-area format. */
export function loadAreaCursor(stored: unknown, areaKey: string, grid: string): TerritoryCursor {
  const s = stored as { areas?: Record<string, unknown>; grid?: string } | null;
  const raw = s?.areas?.[areaKey] ?? (s?.grid ? s : null);
  return loadCursor(raw, grid);
}

export function loadProgress(stored: unknown): TerritoryProgress {
  const s = stored as { areas?: Record<string, TerritoryCursor> } | null;
  return { areas: s?.areas && typeof s.areas === "object" ? { ...s.areas } : {} };
}
