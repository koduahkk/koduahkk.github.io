/**
 * Integration test for the daily salon finder: real Postgres, fake Google.
 * Runs only when TEST_DATABASE_URL points at a disposable database:
 *   TEST_DATABASE_URL=postgresql://... npm test
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { NormalizedPlace } from "@/lib/places/google";
import type { PlacesApi } from "@/lib/jobs/sourcing";

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

// Fake Google: every tile has 2 pages (12 + 5 salons), unique per tile/category/page.
let calls = 0;
function fakeApi(): PlacesApi {
  return {
    search: async ({ tile, category, pageToken }) => {
      calls++;
      const page = pageToken ? 2 : 1;
      const key = `${tile.center.lat.toFixed(4)}|${tile.center.lng.toFixed(4)}|${category}|${page}`;
      const seed = [...key].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
      const places: NormalizedPlace[] = Array.from({ length: page === 1 ? 12 : 5 }, (_, i) => {
        const n = (seed + i * 7919) % 9_000_000;
        const kind = i % 6; // 0 chain, 1 no phone, 2 closed, others fine
        return {
          placeId: `fake_${key}_${i}`,
          name: kind === 0 ? `Great Clips #${n}` : `Salon ${n}`,
          phone: kind === 1 ? null : `+1404${String(2_000_000 + n).padStart(7, "0")}`,
          address: null, city: "Atlanta", state: "GA", zip: null, country: "US", lat: tile.center.lat, lng: tile.center.lng,
          website: null, googleRating: 4.5, reviewCount: 40, openingHours: null, closedPermanently: kind === 2,
        };
      });
      return { places, nextPageToken: page === 1 ? `tok_${key}` : null };
    },
  };
}

describe.skipIf(!url)("daily salon finding (integration)", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let runSourcing: typeof import("@/lib/jobs/sourcing").runSourcing;
  let saveSettingsSection: typeof import("@/lib/settings").saveSettingsSection;
  const day1 = new Date("2026-11-24T11:00:00Z"); // 6am New York
  const day2 = new Date("2026-11-25T11:00:00Z");

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/db"));
    ({ runSourcing } = await import("@/lib/jobs/sourcing"));
    ({ saveSettingsSection } = await import("@/lib/settings"));
  });
  beforeEach(async () => {
    calls = 0;
    await prisma.leadContact.deleteMany();
    await prisma.lead.deleteMany();
    await prisma.sourcingRun.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.territory.deleteMany();
    await prisma.settings.deleteMany();
  });

  it("does nothing until territories and categories are chosen and it's switched on", async () => {
    let r = await runSourcing({ now: day1, api: fakeApi() });
    expect(r.ran).toBe(false);
    expect(r.message).toMatch(/territory/);
    await prisma.territory.create({ data: { name: "Atlanta, GA", city: "Atlanta", state: "GA" } });
    await saveSettingsSection("sourcing", { categories: ["hair_salon"] });
    r = await runSourcing({ now: day1, api: fakeApi() });
    expect(r).toMatchObject({ ran: false, message: expect.stringMatching(/switched off/) });
    expect(calls).toBe(0);
    // A manual run works once setup is complete, even before switching it on.
    r = await runSourcing({ now: day1, api: fakeApi(), trigger: "manual" });
    expect(r.ran).toBe(true);
  });

  it("finds exactly the daily target, applies filters, and continues where it stopped the next day", async () => {
    await prisma.territory.create({ data: { name: "Atlanta, GA", city: "Atlanta", state: "GA" } });
    await saveSettingsSection("sourcing", { enabled: true, dailyTarget: 50, categories: ["hair_salon", "nail_salon"], maxRequestsPerDay: 60 });

    const r1 = await runSourcing({ now: day1, api: fakeApi() });
    expect(r1.found).toBe(50);
    expect(r1.skipped.chain).toBeGreaterThan(0);
    expect(r1.skipped.no_phone).toBeGreaterThan(0);
    expect(r1.skipped.closed).toBeGreaterThan(0);
    const leads = await prisma.lead.findMany();
    expect(leads).toHaveLength(50);
    expect(leads.every((l) => l.source === "GOOGLE_PLACES" && l.territoryId && l.stage === "NEW" && !/Great Clips/.test(l.name))).toBe(true);
    expect(leads.every((l) => l.timezone === "America/New_York")).toBe(true);

    // Same day again: target reached, no searches.
    const again = await runSourcing({ now: day1, api: fakeApi() });
    expect(again.ran).toBe(false);
    expect(again.message).toMatch(/already reached/);

    // Next day: 50 more, no duplicates, cursor moved on.
    const before = calls;
    const r2 = await runSourcing({ now: day2, api: fakeApi() });
    expect(r2.found).toBe(50);
    expect(await prisma.lead.count()).toBe(100);
    expect(r2.skipped.duplicate ?? 0).toBeLessThanOrEqual(5); // at most the rest of a page left mid-way
    expect(calls - before).toBe(r2.requests);
    expect(await prisma.sourcingRun.count()).toBe(2);
  });

  it("stops at the daily search budget", async () => {
    await prisma.territory.create({ data: { name: "Atlanta, GA", city: "Atlanta", state: "GA" } });
    await saveSettingsSection("sourcing", { enabled: true, dailyTarget: 50, categories: ["hair_salon"], maxRequestsPerDay: 2 });
    const r = await runSourcing({ now: day1, api: fakeApi() });
    expect(r.requests).toBe(2);
    expect(r.found).toBeLessThan(50);
    const run = await prisma.sourcingRun.findFirstOrThrow();
    expect(run.notes.join(" ")).toMatch(/search budget/);
    expect((await runSourcing({ now: day1, api: fakeApi() })).message).toMatch(/budget .* used up/);
  });

  it("marks a territory fully searched and says so", async () => {
    // A 1 km radius gives a single 3 km tile.
    await prisma.territory.create({ data: { name: "Dalton, GA", city: "Dalton", state: "GA", radiusMeters: 1000 } });
    await saveSettingsSection("sourcing", { enabled: true, dailyTarget: 50, categories: ["hair_salon"], maxRequestsPerDay: 60 });
    const r = await runSourcing({ now: day1, api: fakeApi() });
    expect(r.requests).toBe(2); // one tile, two pages
    const t = await prisma.territory.findFirstOrThrow();
    expect(t.exhaustedAt).not.toBeNull();
    const run = await prisma.sourcingRun.findFirstOrThrow();
    expect(run.notes.join(" ")).toMatch(/fully searched/);
  });

  it("with 'any city', works through the state's cities in a random daily order and keeps each city's progress", async () => {
    const t = await prisma.territory.create({ data: { name: "Georgia: any city", state: "GA" } });
    await saveSettingsSection("sourcing", { enabled: true, dailyTarget: 30, categories: ["hair_salon"], maxRequestsPerDay: 60, tileKm: 10 });
    const r1 = await runSourcing({ now: day1, api: fakeApi() });
    expect(r1.found).toBe(30);
    const p1 = (await prisma.territory.findUniqueOrThrow({ where: { id: t.id } })).sourcingCursor as { areas: Record<string, unknown> };
    const cities1 = Object.keys(p1.areas);
    expect(cities1.length).toBeGreaterThanOrEqual(1);
    const r2 = await runSourcing({ now: day2, api: fakeApi() });
    expect(r2.found).toBe(30);
    const p2 = (await prisma.territory.findUniqueOrThrow({ where: { id: t.id } })).sourcingCursor as { areas: Record<string, unknown> };
    // Day 1's cities are still remembered, and day 2 started somewhere else.
    for (const c of cities1) expect(p2.areas[c]).toBeTruthy();
    expect(Object.keys(p2.areas).length).toBeGreaterThan(cities1.length);
    expect(await prisma.lead.count({ where: { territoryId: t.id } })).toBe(60);
  });

  it("reports a territory whose city isn't in the list", async () => {
    await prisma.territory.create({ data: { name: "Nowhere, GA", city: "Nowhereville", state: "GA" } });
    await saveSettingsSection("sourcing", { enabled: true, categories: ["hair_salon"] });
    const r = await runSourcing({ now: day1, api: fakeApi() });
    expect(r.found).toBe(0);
    expect(r.message).toMatch(/no matching city/);
  });
});
