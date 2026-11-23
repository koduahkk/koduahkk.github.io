/**
 * Daily salon finding. Runs at 6:00 (before the 7:00 call planner) and adds
 * up to `dailyTarget` NEW salons from Google Places across the active
 * territories, in priority order.
 *
 * It does nothing until someone has chosen territories and categories in
 * Settings → Salon finding and switched it on. It stops when the target is
 * reached or the daily search budget is used up, whichever comes first.
 */
import { DateTime } from "luxon";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getSecret } from "@/lib/secrets";
import { audit } from "@/lib/audit";
import { ingestLead } from "@/lib/leads/ingest";
import { locate, searchTile, type NormalizedPlace } from "@/lib/places/google";
import { advanceTile, gridKey, isExhausted, loadCursor, passesFilters, setupGaps, tilesFor, type LatLng, type Tile } from "@/lib/sourcing/plan";

/** Google calls, injectable so the job can be tested without the network. */
export type PlacesApi = {
  geocode: (q: string) => Promise<LatLng>;
  search: (o: { tile: Tile; category: string; pageToken?: string | null }) => Promise<{ places: NormalizedPlace[]; nextPageToken: string | null }>;
};
const google: PlacesApi = { geocode: locate, search: searchTile };

export type SourcingResult = {
  ran: boolean;
  message: string;
  found: number;
  createdIds: string[];
  requests: number;
  skipped: Record<string, number>;
};

const SKIP_LABEL: Record<string, string> = {
  duplicate: "already in your leads",
  no_phone: "no phone number",
  closed: "permanently closed",
  rating: "below your minimum rating",
  reviews: "below your minimum reviews",
  chain: "chains",
  invalid: "invalid phone number",
};

export async function runSourcing(opts: { now?: Date; trigger?: "schedule" | "manual"; actorId?: string | null; api?: PlacesApi } = {}): Promise<SourcingResult> {
  const now = opts.now ?? new Date();
  const trigger = opts.trigger ?? "schedule";
  const api = opts.api ?? google;
  const settings = await getSettings();
  const s = settings.sourcing;
  const empty = (message: string): SourcingResult => ({ ran: false, message, found: 0, createdIds: [], requests: 0, skipped: {} });

  const territories = await prisma.territory.findMany({ where: { active: true }, orderBy: [{ priority: "desc" }, { createdAt: "asc" }] });
  const gaps = setupGaps(s, territories.length);
  if (gaps.length) return empty(`Salon finding isn't set up yet. ${gaps.join(" ")}`);
  // The schedule only runs once someone has switched it on; "Find salons now" works as soon as setup is complete.
  if (trigger === "schedule" && !s.enabled) return empty("Salon finding is switched off in Settings.");

  if (!opts.api && !(await getSecret("GOOGLE_PLACES_API_KEY"))) {
    return empty("Add a Google Places API key in Settings → Integrations so salons can be found.");
  }

  const runDate = DateTime.fromJSDate(now, { zone: settings.general.plannerTimezone }).toISODate()!;
  const sofar = await prisma.sourcingRun.aggregate({ where: { runDate }, _sum: { found: true, requests: true } });
  let need = s.dailyTarget - (sofar._sum.found ?? 0);
  let budget = s.maxRequestsPerDay - (sofar._sum.requests ?? 0);
  if (need <= 0) return empty(`Today's target of ${s.dailyTarget} salons is already reached.`);
  if (budget <= 0) return empty(`Today's search budget (${s.maxRequestsPerDay} searches) is used up. Raise it in Settings or try tomorrow.`);

  const notes: string[] = [];
  const skipped: Record<string, number> = {};
  const createdIds: string[] = [];
  let requests = 0;
  let halted = false;

  for (const t of territories) {
    if (need <= 0 || budget <= 0 || halted) break;

    // 1. Map center, looked up once and cached on the territory.
    let center: LatLng | null = t.centerLat != null && t.centerLng != null ? { lat: t.centerLat, lng: t.centerLng } : null;
    if (!center) {
      const q = t.zip || [t.city, t.state].filter(Boolean).join(", ") || t.name;
      try {
        center = await api.geocode(q);
        budget--;
        requests++;
        await prisma.territory.update({ where: { id: t.id }, data: { centerLat: center.lat, centerLng: center.lng } });
      } catch (e) {
        notes.push(`${t.name}: couldn't find "${q}" on the map (${e instanceof Error ? e.message : e}).`);
        continue;
      }
    }

    // 2. Tiles + where we stopped last time.
    const radiusKm = (t.radiusMeters ?? 15000) / 1000;
    const tiles = tilesFor(center, radiusKm, s.tileKm);
    const cursor = loadCursor(t.sourcingCursor, gridKey(center, radiusKm, s.tileKm));

    // 3. Walk categories → tiles → pages.
    for (const cat of s.categories) {
      let c = cursor.cats[cat] ?? { tile: 0, pageToken: null };
      while (!c.done && need > 0 && budget > 0) {
        let res: Awaited<ReturnType<PlacesApi["search"]>>;
        try {
          res = await api.search({ tile: tiles[c.tile], category: cat, pageToken: c.pageToken });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (c.pageToken && /400|INVALID_ARGUMENT|page_?token/i.test(msg)) {
            c = { tile: c.tile, pageToken: null }; // expired page token: redo the tile, duplicates are skipped
            continue;
          }
          notes.push(`Google Places stopped the run: ${msg}`);
          halted = true;
          break;
        }
        budget--;
        requests++;

        let stoppedMidPage = false;
        for (const p of res.places) {
          if (need <= 0) {
            stoppedMidPage = true; // keep the cursor here so tomorrow sees the rest of this page
            break;
          }
          const f = passesFilters(p, s);
          if (!f.ok) {
            skipped[f.reason] = (skipped[f.reason] ?? 0) + 1;
            continue;
          }
          const r = await ingestLead({ ...p, category: cat, territoryId: t.id }, "GOOGLE_PLACES");
          if (r.status === "created" && r.id) {
            createdIds.push(r.id);
            need--;
          } else {
            const k = r.status === "invalid" ? "invalid" : "duplicate";
            skipped[k] = (skipped[k] ?? 0) + 1;
          }
        }
        if (!stoppedMidPage) c = advanceTile(c, tiles.length, res.nextPageToken);
        cursor.cats[cat] = c;
        // Save progress after every page so a crash never repeats paid searches.
        await prisma.territory.update({ where: { id: t.id }, data: { sourcingCursor: cursor as unknown as Prisma.InputJsonValue } });
        if (stoppedMidPage) break;
      }
      cursor.cats[cat] = c;
      if (halted || need <= 0 || budget <= 0) break;
    }

    const done = isExhausted(cursor, s.categories);
    await prisma.territory.update({
      where: { id: t.id },
      data: { sourcingCursor: cursor as unknown as Prisma.InputJsonValue, exhaustedAt: done ? t.exhaustedAt ?? now : null },
    });
    if (done && !t.exhaustedAt) notes.push(`${t.name} is fully searched for the chosen categories. Add another territory or a wider radius to keep finding new salons.`);
  }

  const found = createdIds.length;
  const skipText = Object.entries(skipped).map(([k, v]) => `${v} ${SKIP_LABEL[k] ?? k}`).join(", ");
  if (skipText) notes.unshift(`Skipped: ${skipText}.`);
  if (need > 0 && budget <= 0) notes.push(`Stopped at the daily search budget (${s.maxRequestsPerDay}).`);
  if (need > 0 && !halted && budget > 0) notes.push("Every active territory is fully searched. Add a territory to find more salons.");

  await prisma.sourcingRun.create({ data: { runDate, found, skipped: Object.values(skipped).reduce((a, b) => a + b, 0), requests, notes, trigger } });
  await audit(opts.actorId, "sourcing.run", undefined, { runDate, found, requests, trigger });

  const total = (sofar._sum.found ?? 0) + found;
  const problem = notes.find((n) => /stopped the run|couldn't find/.test(n));
  return {
    ran: true,
    message: (problem && !found ? `${problem} ` : "") + `Found ${found} new salon${found === 1 ? "" : "s"} (${total} of ${s.dailyTarget} today) using ${requests} search${requests === 1 ? "" : "es"}.`,
    found,
    createdIds,
    requests,
    skipped,
  };
}
