import { describe, expect, it } from "vitest";
import { areasFor, citiesIn, findCity, radiusKmFor, shuffled, STATES, territoryLabel } from "@/lib/sourcing/cities";
import { loadAreaCursor, gridKey } from "@/lib/sourcing/plan";

describe("US city list", () => {
  it("has every state and DC, each with cities, largest first", () => {
    expect(STATES).toHaveLength(51);
    for (const s of STATES) {
      const c = citiesIn(s);
      expect(c.length, s).toBeGreaterThanOrEqual(5);
      expect(c[0].population).toBeGreaterThanOrEqual(c[c.length - 1].population);
    }
    expect(citiesIn("AZ")[0].name).toBe("Phoenix");
  });
  it("finds cities case-insensitively and only in the right state", () => {
    expect(findCity("ga", "atlanta")).toMatchObject({ name: "Atlanta", state: "GA" });
    expect(findCity("TX", "Atlanta")).toBeNull();
    expect(findCity("GA", null)).toBeNull();
  });
  it("sizes the search area to the city", () => {
    expect(radiusKmFor(20_000)).toBe(5);
    expect(radiusKmFor(460_000)).toBe(15);
    expect(radiusKmFor(1_600_000)).toBe(25);
  });
});

describe("areasFor", () => {
  it("is one area for a specific city, with an optional radius override", () => {
    expect(areasFor({ id: "t1", state: "GA", city: "Atlanta" }, "2026-11-24")).toEqual([expect.objectContaining({ city: "Atlanta", radiusKm: 15 })]);
    expect(areasFor({ id: "t1", state: "GA", city: "Atlanta", radiusMeters: 3000 }, "2026-11-24")[0].radiusKm).toBe(3);
  });
  it("is every city in the state for 'any city', in a random order that changes daily but not within a day", () => {
    const a = areasFor({ id: "t1", state: "GA", city: null }, "2026-11-24").map((x) => x.city);
    const b = areasFor({ id: "t1", state: "GA", city: null }, "2026-11-24").map((x) => x.city);
    const c = areasFor({ id: "t1", state: "GA", city: null }, "2026-11-25").map((x) => x.city);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect([...a].sort()).toEqual(citiesIn("GA").map((x) => x.name).sort());
  });
  it("labels territories", () => {
    expect(territoryLabel({ state: "GA", city: "Atlanta" })).toBe("Atlanta, GA");
    expect(territoryLabel({ state: "GA", city: null })).toBe("Georgia: any city");
  });
  it("shuffles without losing items", () => {
    expect(shuffled([1, 2, 3, 4, 5], "x").sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("loadAreaCursor", () => {
  it("reads per-city progress and accepts the older single-area format", () => {
    const grid = gridKey({ lat: 33.749, lng: -84.388 }, 15, 3);
    expect(loadAreaCursor({ areas: { Atlanta: { grid, cats: { hair_salon: { tile: 4 } } } } }, "Atlanta", grid).cats.hair_salon.tile).toBe(4);
    expect(loadAreaCursor({ grid, cats: { hair_salon: { tile: 2 } } }, "Atlanta", grid).cats.hair_salon.tile).toBe(2);
    expect(loadAreaCursor(null, "Atlanta", grid).cats).toEqual({});
  });
});
