/**
 * Daily call planner: picks the next N un-tested salons (priority territory
 * first) and books Call A + Call B for each, respecting the per-15-minute cap.
 * Safe to run more than once a day — it only tops up to the quota.
 */
import { DateTime } from "luxon";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { planBatch } from "@/lib/scheduler/slots";
import { audit } from "@/lib/audit";
import type { WeeklyHours } from "@/lib/domain";

export async function runDailyPlanner(opts: { now?: Date; quota?: number; territoryId?: string | null; actorId?: string | null } = {}) {
  const settings = await getSettings();
  const now = opts.now ?? new Date();
  const planDate = DateTime.fromJSDate(now, { zone: settings.general.plannerTimezone }).toISODate()!;
  const quota = opts.quota ?? settings.general.dailyQuota;
  const territoryId = opts.territoryId === undefined ? settings.general.priorityTerritoryId : opts.territoryId;

  const already = await prisma.lead.count({ where: { plannedFor: planDate } });
  const need = Math.max(0, quota - already);
  if (!need) return { planDate, planned: 0, alreadyPlanned: already, unplannable: [] as string[], message: "Today's quota is already planned." };

  const dnc = await prisma.suppression.findMany({ where: { kind: "PHONE" }, select: { value: true } });
  const base = {
    stage: "NEW" as const,
    phoneE164: { not: null, notIn: dnc.map((d) => d.value) },
    calls: { none: {} },
  };
  const order = [{ reviewCount: { sort: "desc" as const, nulls: "last" as const } }, { createdAt: "asc" as const }];
  const first = territoryId ? await prisma.lead.findMany({ where: { ...base, territoryId }, orderBy: order, take: need }) : [];
  const rest =
    first.length < need
      ? await prisma.lead.findMany({
          where: { ...base, id: { notIn: first.map((l) => l.id) } },
          orderBy: [{ territory: { priority: "desc" } }, ...order],
          take: need - first.length,
        })
      : [];
  const leads = [...first, ...rest];
  if (!leads.length) return { planDate, planned: 0, alreadyPlanned: already, unplannable: [], message: "No un-tested salons left. Import more leads." };

  const existing = await prisma.callAttempt.findMany({
    where: { status: "SCHEDULED", scheduledAt: { gte: now, lte: new Date(now.getTime() + (settings.calling.horizonDays + 2) * 86400_000) } },
    select: { scheduledAt: true },
  });

  const { planned, unplannable } = planBatch(
    leads.map((l) => ({ id: l.id, hours: (l.hoursKnown ? (l.openingHours as WeeklyHours) : null) ?? null, zone: l.timezone ?? settings.general.plannerTimezone })),
    { now, config: settings.calling, existing: existing.map((e) => e.scheduledAt) },
  );

  const mode = settings.calling.automatedEnabled ? "AUTOMATED" : "HUMAN";
  for (const p of planned) {
    await prisma.$transaction([
      prisma.callAttempt.create({ data: { leadId: p.id, type: "A", scheduledAt: p.a.at, windowLabel: p.a.windowLabel, hoursAssumed: p.hoursAssumed, mode } }),
      prisma.callAttempt.create({ data: { leadId: p.id, type: "B", scheduledAt: p.b.at, windowLabel: p.b.windowLabel, hoursAssumed: p.hoursAssumed, mode } }),
      prisma.lead.update({ where: { id: p.id }, data: { stage: "TESTING", plannedFor: planDate } }),
    ]);
  }
  await audit(opts.actorId, "planner.run", undefined, { planDate, planned: planned.length, unplannable: unplannable.length });
  return { planDate, planned: planned.length, alreadyPlanned: already, unplannable, message: `Planned ${planned.length} salons (${planned.length * 2} calls).` };
}
