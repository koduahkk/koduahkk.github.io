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
import { searchTile, type NormalizedPlace } from "@/lib/places/google";
import { areasFor, territoryLabel } from "@/lib/sourcing/cities";
import { advanceTile, gridKey, isExhausted, loadAreaCursor, loadProgress, passesFilters, setupGaps, tilesFor, type Tile } from "@/lib/sourcing/plan";

/** Google calls, injectable so the job can be tested without the network. */
export type PlacesApi = {
  search: (o: { tile: Tile; category: string; pageToken?: string | null }) => Promise<{ places: NormalizedPlace[]; nextPageToken: string | null }>;
};
const google: PlacesApi = { search: searchTile };

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
    const areas = areasFor(t, runDate);
    if (!areas.length) {
      notes.push(`${territoryLabel(t)}: no matching city found. Edit or remove this territory.`);
      continue;
    }
    const progress = loadProgress(t.sourcingCursor);
    let allDone = true;

    for (const area of areas) {
      const tiles = tilesFor(area.center, area.radiusKm, s.tileKm);
      const cursor = loadAreaCursor(t.sourcingCursor, area.key, gridKey(area.center, area.radiusKm, s.tileKm));
      if (isExhausted(cursor, s.categories)) continue;
      if (need <= 0 || budget <= 0 || halted) {
        allDone = false;
        break;
      }

      // Walk categories → tiles → pages inside this city.
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
              stoppedMidPage = true; // keep the cursor here so the rest of this page is seen next time
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
          progress.areas[area.key] = cursor;
          // Save after every page so a crash never repeats paid searches.
          await prisma.territory.update({ where: { id: t.id }, data: { sourcingCursor: progress as unknown as Prisma.InputJsonValue } });
          if (stoppedMidPage) break;
        }
        cursor.cats[cat] = c;
        if (halted || need <= 0 || budget <= 0) break;
      }
      progress.areas[area.key] = cursor;
      if (!isExhausted(cursor, s.categories)) allDone = false;
      else notes.push(`${area.city}, ${t.state}: fully searched.`);
    }

    await prisma.territory.update({
      where: { id: t.id },
      data: { sourcingCursor: progress as unknown as Prisma.InputJsonValue, exhaustedAt: allDone ? t.exhaustedAt ?? now : null },
    });
    if (allDone && !t.exhaustedAt) notes.push(`${territoryLabel(t)} is fully searched for the chosen categories. Add another city or state to keep finding new salons.`);
  }

  const found = createdIds.length;
  const skipText = Object.entries(skipped).map(([k, v]) => `${v} ${SKIP_LABEL[k] ?? k}`).join(", ");
  if (skipText) notes.unshift(`Skipped: ${skipText}.`);
  if (need > 0 && budget <= 0) notes.push(`Stopped at the daily search budget (${s.maxRequestsPerDay}).`);
  if (need > 0 && !halted && budget > 0) notes.push("Every active territory is fully searched. Add a territory to find more salons.");

  await prisma.sourcingRun.create({ data: { runDate, found, skipped: Object.values(skipped).reduce((a, b) => a + b, 0), requests, notes, trigger } });
  await audit(opts.actorId, "sourcing.run", undefined, { runDate, found, requests, trigger });

  const total = (sofar._sum.found ?? 0) + found;
  const problem = notes.find((n) => /stopped the run|no matching city/.test(n));
  return {
    ran: true,
    message: (problem && !found ? `${problem} ` : "") + `Found ${found} new salon${found === 1 ? "" : "s"} (${total} of ${s.dailyTarget} today) using ${requests} search${requests === 1 ? "" : "es"}.`,
    found,
    createdIds,
    requests,
    skipped,
  };
}
