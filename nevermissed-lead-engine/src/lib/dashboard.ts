/**
 * Dashboard metrics. The funnel is a cohort: salons whose first test call
 * happened in the selected range, followed through every later stage, so
 * conversion rates between steps are meaningful.
 */
import { DateTime } from "luxon";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { isMissed } from "@/lib/scoring/engine";
import { setupGaps } from "@/lib/sourcing/plan";

export type Range = "today" | "7d" | "30d" | "all";
const LATER = ["DEMO_BOOKED", "TRIAL", "CUSTOMER"];

export function rangeStart(range: Range, zone: string): Date | null {
  const now = DateTime.now().setZone(zone);
  if (range === "today") return now.startOf("day").toJSDate();
  if (range === "7d") return now.minus({ days: 7 }).toJSDate();
  if (range === "30d") return now.minus({ days: 30 }).toJSDate();
  return null;
}

export async function dashboardData(range: Range, zone: string) {
  const settings = await getSettings();
  const since = rangeStart(range, zone);
  const inRange = since ? { gte: since } : undefined;

  const [sourced, calledLeads] = await Promise.all([
    prisma.lead.count({ where: inRange ? { createdAt: inRange } : {} }),
    prisma.lead.findMany({
      where: { calls: { some: { status: "COMPLETED", ...(inRange ? { executedAt: inRange } : {}) } } },
      select: {
        id: true, city: true, bookingPlatform: true, currentTier: true, stage: true,
        calls: { select: { type: true, outcome: true, executedAt: true, status: true } },
        emails: { select: { status: true, repliedAt: true, templateKey: true } },
        timezone: true,
      },
    }),
  ]);
  // Cohort = salons whose FIRST completed call is in range.
  const cohort = calledLeads.filter((l) => {
    const first = Math.min(...l.calls.filter((c) => c.executedAt).map((c) => c.executedAt!.getTime()));
    return !since || first >= since.getTime();
  });
  const n = (f: (l: (typeof cohort)[number]) => boolean) => cohort.filter(f).length;
  const scored = n((l) => !!l.currentTier);
  const hot = n((l) => l.currentTier === "HOT");
  const warm = n((l) => l.currentTier === "WARM");
  const cold = n((l) => l.currentTier === "COLD");
  const dead = n((l) => l.currentTier === "DEAD");
  const emailed = n((l) => l.emails.some((e) => e.status === "SENT" || e.status === "BOUNCED"));
  const replied = n((l) => l.emails.some((e) => e.repliedAt) || ["REPLIED", ...LATER].includes(l.stage));
  const demos = n((l) => LATER.includes(l.stage));
  const customers = n((l) => l.stage === "CUSTOMER");

  const funnel = [
    { key: "sourced", label: "Salons sourced", value: sourced },
    { key: "called", label: "Called (tested)", value: cohort.length },
    { key: "hotwarm", label: "Hot + Warm", value: hot + warm },
    { key: "emailed", label: "Emailed", value: emailed },
    { key: "replied", label: "Replied", value: replied },
    { key: "demos", label: "Demo booked", value: demos },
    { key: "customers", label: "Customers", value: customers },
  ];

  // Reply rate per template (messages sent in range).
  const msgs = await prisma.emailMessage.findMany({
    where: { status: { in: ["SENT", "BOUNCED"] }, ...(inRange ? { sentAt: inRange } : {}) },
    select: { templateKey: true, repliedAt: true, openedAt: true, clickedAt: true, step: { select: { name: true } } },
  });
  const byTpl = new Map<string, { label: string; sent: number; replied: number; opened: number; clicked: number }>();
  for (const m of msgs) {
    const k = m.templateKey ?? "manual";
    const row = byTpl.get(k) ?? { label: m.step?.name ?? k, sent: 0, replied: 0, opened: 0, clicked: 0 };
    row.sent++;
    if (m.repliedAt) row.replied++;
    if (m.openedAt) row.opened++;
    if (m.clickedAt) row.clicked++;
    byTpl.set(k, row);
  }
  const templates = [...byTpl.entries()].map(([key, r]) => ({ key, ...r, rate: r.sent ? r.replied / r.sent : 0 })).sort((a, b) => b.sent - a.sent);

  // Best call windows: Call A miss rate by salon-local day type + hour.
  const windows = new Map<string, { label: string; sort: number; total: number; missed: number }>();
  let bTotal = 0, bMissed = 0;
  for (const l of calledLeads) {
    for (const c of l.calls) {
      if (c.status !== "COMPLETED" || !c.outcome || !c.executedAt || c.outcome === "DISCONNECTED_OR_WRONG_NUMBER") continue;
      const missed = isMissed({ type: c.type, outcome: c.outcome }, settings.scoring);
      if (c.type === "B") {
        bTotal++;
        if (missed) bMissed++;
        continue;
      }
      const dt = DateTime.fromJSDate(c.executedAt, { zone: l.timezone ?? "America/New_York" });
      const dayType = dt.weekday === 6 ? "Sat" : dt.weekday === 7 ? "Sun" : "Weekday";
      const h = dt.hour;
      const hr = (x: number) => `${((x + 11) % 12) + 1}${x < 12 ? "am" : "pm"}`;
      const key = `${dayType}-${h}`;
      const row = windows.get(key) ?? { label: `${dayType} ${hr(h)}–${hr(h + 1)}`, sort: (dayType === "Weekday" ? 0 : dayType === "Sat" ? 100 : 200) + h, total: 0, missed: 0 };
      row.total++;
      if (missed) row.missed++;
      windows.set(key, row);
    }
  }
  const callWindows = [...windows.values()].map((w) => ({ ...w, rate: w.total ? w.missed / w.total : 0 })).sort((a, b) => b.rate - a.rate || b.total - a.total);

  // Results by city and booking platform.
  const group = (key: (l: (typeof cohort)[number]) => string) => {
    const m = new Map<string, { name: string; tested: number; hot: number; warm: number; emailed: number; replied: number; customers: number }>();
    for (const l of cohort) {
      const k = key(l);
      const r = m.get(k) ?? { name: k, tested: 0, hot: 0, warm: 0, emailed: 0, replied: 0, customers: 0 };
      r.tested++;
      if (l.currentTier === "HOT") r.hot++;
      if (l.currentTier === "WARM") r.warm++;
      if (l.emails.some((e) => e.status === "SENT")) r.emailed++;
      if (l.emails.some((e) => e.repliedAt) || ["REPLIED", ...LATER].includes(l.stage)) r.replied++;
      if (l.stage === "CUSTOMER") r.customers++;
      m.set(k, r);
    }
    return [...m.values()].sort((a, b) => b.tested - a.tested);
  };

  // Today's progress (planner zone).
  const dayStart = DateTime.now().setZone(settings.general.plannerTimezone).startOf("day").toJSDate();
  const testedToday = await prisma.callAttempt.findMany({ where: { status: "COMPLETED", executedAt: { gte: dayStart } }, distinct: ["leadId"], select: { leadId: true } });
  const callsToday = await prisma.callAttempt.groupBy({ by: ["status"], where: { scheduledAt: { gte: dayStart, lt: new Date(dayStart.getTime() + 86400_000) } }, _count: true });
  const runDate = DateTime.now().setZone(settings.general.plannerTimezone).toISODate()!;
  const [todayRuns, lastRun, activeTerritories, exhausted] = await Promise.all([
    prisma.sourcingRun.aggregate({ where: { runDate }, _sum: { found: true, requests: true } }),
    prisma.sourcingRun.findFirst({ orderBy: { createdAt: "desc" } }),
    prisma.territory.count({ where: { active: true } }),
    prisma.territory.findMany({ where: { active: true, exhaustedAt: { not: null } }, select: { name: true } }),
  ]);
  const sourcing = {
    enabled: settings.sourcing.enabled,
    target: settings.sourcing.dailyTarget,
    foundToday: todayRuns._sum.found ?? 0,
    searchesToday: todayRuns._sum.requests ?? 0,
    gaps: setupGaps(settings.sourcing, activeTerritories),
    lastRun,
    exhausted: exhausted.map((t) => t.name),
  };
  const [openTasks, unreadReplies] = await Promise.all([prisma.task.count({ where: { status: "OPEN" } }), prisma.emailEvent.count({ where: { type: "REPLIED", handled: false } })]);

  return {
    funnel,
    tiers: { scored, hot, warm, cold, dead },
    templates,
    callWindows,
    afterHours: { total: bTotal, missed: bMissed, rate: bTotal ? bMissed / bTotal : 0 },
    byCity: group((l) => l.city ?? "Unknown"),
    byPlatform: group((l) => l.bookingPlatform ?? "None detected"),
    today: {
      tested: testedToday.length,
      quota: settings.general.dailyQuota,
      callsDone: callsToday.find((c) => c.status === "COMPLETED")?._count ?? 0,
      callsTotal: callsToday.filter((c) => c.status !== "CANCELLED").reduce((s, c) => s + c._count, 0),
    },
    openTasks,
    unreadReplies,
    sourcing,
  };
}
