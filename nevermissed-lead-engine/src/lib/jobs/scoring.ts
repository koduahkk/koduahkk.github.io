/**
 * Logging call outcomes → scoring → pipeline moves → auto-enrollment / manual tasks.
 */
import type { CallMode, CallOutcome, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { scoreLead, stageForTier } from "@/lib/scoring/engine";
import { audit } from "@/lib/audit";
import { isSuppressed } from "@/lib/suppression";
import { buildMergeData } from "@/lib/email/merge";
import { instagramDraft, walkInScript } from "@/lib/email/manual";
import { enrollLead } from "@/lib/jobs/email";

/** Stages the scorer may move a lead out of. Later stages are human-owned. */
const AUTO_STAGES = new Set(["NEW", "TESTING", "HOT", "WARM", "COLD"]);

export async function recordCallOutcome(input: {
  callId: string;
  outcome: CallOutcome;
  notes?: string | null;
  userId?: string | null;
  mode?: CallMode;
  durationSec?: number | null;
  executedAt?: Date;
  needsReview?: boolean;
}) {
  const call = await prisma.callAttempt.update({
    where: { id: input.callId },
    data: {
      outcome: input.outcome,
      status: "COMPLETED",
      executedAt: input.executedAt ?? new Date(),
      notes: input.notes ?? undefined,
      callerId: input.userId ?? undefined,
      durationSec: input.durationSec ?? undefined,
      mode: input.mode ?? undefined,
      needsReview: input.needsReview ?? false,
    },
  });
  await audit(input.userId, "call.outcome", { type: "CallAttempt", id: call.id }, { outcome: input.outcome, type: call.type });
  return evaluateLead(call.leadId, input.userId);
}

/** Re-score a lead from its completed calls and apply the consequences. Idempotent. */
export async function evaluateLead(leadId: string, actorId?: string | null) {
  const settings = await getSettings();
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId }, include: { calls: true } });
  const done = lead.calls.filter((c) => c.status === "COMPLETED" && c.outcome && c.executedAt);
  const result = scoreLead(
    done.map((c) => ({ type: c.type, outcome: c.outcome!, executedAt: c.executedAt! })),
    lead.timezone ?? "America/New_York",
    settings.scoring,
  );

  if (!result) {
    if (lead.stage === "NEW") await prisma.lead.update({ where: { id: leadId }, data: { stage: "TESTING" } });
    return { tier: null as null, reason: null as null };
  }

  const data: Prisma.LeadUpdateInput = { currentTier: result.tier, scoreReason: result.reason };
  if (!lead.stageOverridden && AUTO_STAGES.has(lead.stage)) {
    data.stage = stageForTier(result.tier);
    if (result.tier === "DEAD") data.lostReason = "Disconnected / wrong number";
  }
  const changed = lead.currentTier !== result.tier || lead.scoreReason !== result.reason;
  await prisma.$transaction([
    prisma.lead.update({ where: { id: leadId }, data }),
    ...(changed
      ? [prisma.leadScore.create({ data: { leadId, tier: result.tier, reason: result.reason, evidence: result.evidence, rulesVersion: settings.scoring.version } })]
      : []),
  ]);

  if (result.tier === "DEAD") {
    // Don't waste a call on a dead number.
    await prisma.callAttempt.updateMany({ where: { leadId, status: "SCHEDULED" }, data: { status: "CANCELLED", routedReason: "Lead is DEAD" } });
  }
  if (changed) await audit(actorId, "lead.scored", { type: "Lead", id: leadId }, { tier: result.tier });

  if (result.tier === "HOT" || result.tier === "WARM") await startOutreach(leadId, result.tier, actorId);
  return result;
}

/** Enroll in the matching sequence if we have a mailable email; otherwise create manual-channel tasks. */
export async function startOutreach(leadId: string, tier: "HOT" | "WARM", actorId?: string | null) {
  const settings = await getSettings();
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId }, include: { calls: true, enrollments: true, tasks: true } });

  const emailOk = lead.primaryEmail ? (await isSuppressed(prisma, "EMAIL", lead.primaryEmail)).allowed : false;
  if (emailOk) {
    if (lead.enrollments.length) return { enrolled: false, reason: "already enrolled" };
    const seq = await prisma.sequence.findFirst({ where: { active: true, autoEnrollTiers: { has: tier } }, orderBy: { createdAt: "asc" } });
    if (seq) {
      await enrollLead(leadId, seq.id, actorId);
      return { enrolled: true, sequenceId: seq.id };
    }
  }

  // Manual channel: Instagram DM (if we know the handle) + walk-in script.
  const merge = buildMergeData(lead, lead.calls, {
    senderName: settings.general.senderName,
    demoLink: settings.general.demoLink,
    demoPhone: settings.general.demoPhone,
    rules: settings.scoring,
  });
  const open = (t: string) => lead.tasks.some((x) => x.type === t && x.status === "OPEN");
  const tasks: Prisma.TaskCreateManyInput[] = [];
  if (lead.instagram && !open("INSTAGRAM_DM")) {
    tasks.push({ leadId, type: "INSTAGRAM_DM", title: `DM @${lead.instagram} on Instagram`, body: instagramDraft(merge), dueAt: new Date() });
  }
  if (!open("WALK_IN")) {
    tasks.push({ leadId, type: "WALK_IN", title: `Walk-in visit: ${lead.name}`, body: walkInScript(merge), dueAt: new Date(Date.now() + 2 * 86400_000) });
  }
  if (tasks.length) await prisma.task.createMany({ data: tasks });
  return { enrolled: false, reason: emailOk ? "no matching sequence" : "no usable email", tasks: tasks.length };
}
