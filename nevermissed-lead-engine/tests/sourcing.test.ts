import { describe, expect, it } from "vitest";
import { advanceTile, coverage, DEFAULT_CHAINS, gridKey, isExhausted, loadCursor, passesFilters, setupGaps, sourcingSchema, tilesFor } from "@/lib/sourcing/plan";

const ATL = { lat: 33.749, lng: -84.388 };
const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371, r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

describe("tilesFor", () => {
  it("covers the circle with tiles of the requested size, center first", () => {
    const tiles = tilesFor(ATL, 10, 3);
    expect(tiles[0].center.lat).toBeCloseTo(ATL.lat, 6);
    expect(tiles[0].center.lng).toBeCloseTo(ATL.lng, 6);
    // Tile side ≈ 3 km in both directions.
    const t = tiles[0];
    expect(km(t.low, { lat: t.high.lat, lng: t.low.lng })).toBeCloseTo(3, 1);
    expect(km(t.low, { lat: t.low.lat, lng: t.high.lng })).toBeCloseTo(3, 1);
    // No tile center beyond radius + half a tile.
    for (const x of tiles) expect(km(ATL, x.center)).toBeLessThanOrEqual(10 + 1.5 + 0.05);
    // Roughly the circle's area in tiles.
    expect(tiles.length).toBeGreaterThan((Math.PI * 100) / 9 * 0.8);
  });
  it("orders tiles in rings moving outward", () => {
    const d = tilesFor(ATL, 15, 3).map((t) => km(ATL, t.center));
    expect(Math.max(...d.slice(0, 9))).toBeLessThan(Math.min(...d.slice(-8)));
  });
  it("gives a single tile for a tiny radius", () => {
    expect(tilesFor(ATL, 1, 3)).toHaveLength(1);
  });
});

describe("cursor", () => {
  it("follows pages, then tiles, then marks the category done", () => {
    expect(advanceTile({ tile: 0 }, 3, "tok")).toEqual({ tile: 0, pageToken: "tok" });
    expect(advanceTile({ tile: 0, pageToken: "tok" }, 3, null)).toEqual({ tile: 1, pageToken: null });
    expect(advanceTile({ tile: 2 }, 3)).toEqual({ tile: 3, pageToken: null, done: true });
  });
  it("keeps progress per category and starts over when the tiling changes", () => {
    const grid = gridKey(ATL, 10, 3);
    const stored = { grid, cats: { hair_salon: { tile: 5 } } };
    expect(loadCursor(stored, grid).cats.hair_salon.tile).toBe(5);
    expect(loadCursor(stored, gridKey(ATL, 15, 3)).cats).toEqual({});
    expect(loadCursor(null, grid)).toEqual({ grid, cats: {} });
  });
  it("reports coverage and exhaustion across the enabled categories", () => {
    const c = { grid: "g", cats: { hair_salon: { tile: 10, done: true }, nail_salon: { tile: 5 } } };
    expect(coverage(c, ["hair_salon", "nail_salon"], 10)).toBe(0.75);
    expect(isExhausted(c, ["hair_salon"])).toBe(true);
    expect(isExhausted(c, ["hair_salon", "nail_salon"])).toBe(false);
    expect(coverage(null, ["hair_salon"], 10)).toBe(0);
  });
});

describe("filters", () => {
  const f = sourcingSchema.parse({ minRating: 4, minReviews: 20 });
  const base = { name: "Glow Studio", phone: "+14045550101", googleRating: 4.6, reviewCount: 120 };
  it("keeps a salon that passes every filter", () => expect(passesFilters(base, f)).toEqual({ ok: true }));
  it("drops closed salons, salons with no phone, and low ratings or reviews", () => {
    expect(passesFilters({ ...base, closedPermanently: true }, f)).toMatchObject({ reason: "closed" });
    expect(passesFilters({ ...base, phone: null }, f)).toMatchObject({ reason: "no_phone" });
    expect(passesFilters({ ...base, googleRating: 3.9 }, f)).toMatchObject({ reason: "rating" });
    expect(passesFilters({ ...base, reviewCount: null }, f)).toMatchObject({ reason: "reviews" });
  });
  it("drops chains by whole-word name match, case and punctuation insensitive", () => {
    expect(passesFilters({ ...base, name: "Great Clips at Midtown Place" }, f)).toMatchObject({ reason: "chain" });
    expect(passesFilters({ ...base, name: "FLOYD'S 99 Barbershop" }, f)).toMatchObject({ reason: "chain" });
    expect(passesFilters({ ...base, name: "Supercutsies Hair" }, f)).toEqual({ ok: true });
    expect(passesFilters({ ...base, name: "Great Clips" }, { ...f, excludeChains: false })).toEqual({ ok: true });
  });
  it("has no minimums by default", () => {
    const d = sourcingSchema.parse({});
    expect(passesFilters({ ...base, googleRating: null, reviewCount: 0 }, d)).toEqual({ ok: true });
    expect(d.enabled).toBe(false);
    expect(d.chainNames).toEqual(DEFAULT_CHAINS);
  });
});

describe("setupGaps", () => {
  it("blocks the job until territories and categories are chosen", () => {
    expect(setupGaps(sourcingSchema.parse({}), 0)).toHaveLength(2);
    expect(setupGaps(sourcingSchema.parse({ categories: ["hair_salon"] }), 1)).toEqual([]);
  });
});
