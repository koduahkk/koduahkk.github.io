"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertRole } from "@/lib/auth/session";
import { run } from "@/lib/action";
import { audit } from "@/lib/audit";
import { recordCallOutcome } from "@/lib/jobs/scoring";
import { runDailyPlanner } from "@/lib/jobs/planner";
import { isSuppressed } from "@/lib/suppression";
import { CALL_OUTCOMES } from "@/lib/domain";

const outcomeSchema = z.object({ callId: z.string(), outcome: z.enum(CALL_OUTCOMES), notes: z.string().max(5000).optional(), durationSec: z.number().int().min(0).max(36000).optional() });

export async function logOutcome(input: z.input<typeof outcomeSchema>) {
  return run(async () => {
    const u = await assertRole("CALLER");
    const d = outcomeSchema.parse(input);
    const call = await prisma.callAttempt.findUniqueOrThrow({ where: { id: d.callId }, include: { lead: true } });
    if (call.status === "CANCELLED") throw new Error("This call was cancelled (do-not-call or dead lead).");
    const r = await recordCallOutcome({ callId: d.callId, outcome: d.outcome, notes: d.notes || null, durationSec: d.durationSec, userId: u.id, mode: call.mode === "AUTOMATED" && call.status === "COMPLETED" ? "AUTOMATED" : "HUMAN" });
    revalidatePath("/queue");
    revalidatePath("/calls");
    const scored = r.tier ? ` · ${call.lead.name} scored ${r.tier}` : "";
    return { message: `Logged Call ${call.type}${scored}`, data: { tier: r.tier } };
  });
}

/** Before dialing: make sure the number isn't on the do-not-call list. */
export async function preflightCall(callId: string) {
  return run(async () => {
    await assertRole("CALLER");
    const call = await prisma.callAttempt.findUniqueOrThrow({ where: { id: callId }, include: { lead: true } });
    const check = await isSuppressed(prisma, "PHONE", call.lead.phoneE164 ?? call.lead.phone);
    if (!check.allowed) {
      await prisma.callAttempt.update({ where: { id: callId }, data: { status: "CANCELLED", routedReason: `Do-not-call: ${check.reason}` } });
      throw new Error("This number is on the do-not-call list. The call has been cancelled.");
    }
    await prisma.callAttempt.update({ where: { id: callId }, data: { status: "IN_PROGRESS" } });
    return { message: "Calling…" };
  });
}

export async function releaseCall(callId: string) {
  return run(async () => {
    await assertRole("CALLER");
    await prisma.callAttempt.updateMany({ where: { id: callId, status: "IN_PROGRESS", mode: "HUMAN" }, data: { status: "SCHEDULED" } });
    return {};
  });
}

export async function skipCall(callId: string, reason: string) {
  return run(async () => {
    const u = await assertRole("CALLER");
    // Push it back 1 hour rather than dropping it; outcome-less skips don't count.
    const c = await prisma.callAttempt.update({ where: { id: callId }, data: { status: "SCHEDULED", scheduledAt: new Date(Date.now() + 60 * 60_000), notes: reason || undefined } });
    await audit(u.id, "call.snooze", { type: "CallAttempt", id: c.id }, { reason });
    revalidatePath("/queue");
    return { message: "Snoozed 1 hour" };
  });
}

export async function runPlannerNow() {
  return run(async () => {
    const u = await assertRole("ADMIN");
    const r = await runDailyPlanner({ actorId: u.id });
    revalidatePath("/calls");
    revalidatePath("/dashboard");
    return { message: r.message + (r.unplannable.length ? ` ${r.unplannable.length} had no free slot.` : "") };
  });
}
