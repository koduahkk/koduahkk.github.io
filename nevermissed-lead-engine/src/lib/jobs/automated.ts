/**
 * Automated test-call mode (OFF by default).
 *
 * Compliance gate, in order, before any automated dial:
 *   1. Automated mode must be enabled in Settings.
 *   2. Number must not be on the internal do-not-call / suppression list.
 *   3. Twilio Lookup line-type check: MOBILE (or unknown) → route to a human caller.
 * The call itself plays NO artificial or prerecorded voice: the TwiML is a
 * silent <Pause> then <Hangup>. If AMD detects a person we hang up immediately.
 */
import { prisma } from "@/lib/db";
import { getSettings, recordingPermitted } from "@/lib/settings";
import { isSuppressed } from "@/lib/suppression";
import { getTwilio } from "@/lib/twilio/client";
import { classifyAutomatedCall, mapLineType } from "@/lib/twilio/classify";
import { recordCallOutcome } from "@/lib/jobs/scoring";
import { audit } from "@/lib/audit";
import { sign } from "@/lib/crypto";
import { appUrl } from "@/lib/utils";

const LOOKUP_TTL_DAYS = 90;

async function routeToHuman(callId: string, reason: string) {
  await prisma.callAttempt.update({ where: { id: callId }, data: { mode: "HUMAN", routedReason: reason } });
  await audit(null, "call.routed_to_human", { type: "CallAttempt", id: callId }, { reason });
  return { placed: false, routed: true, reason };
}

export async function placeAutomatedCall(callId: string) {
  const settings = await getSettings();
  const call = await prisma.callAttempt.findUniqueOrThrow({ where: { id: callId }, include: { lead: true } });
  if (call.status !== "SCHEDULED" || call.mode !== "AUTOMATED") return { placed: false, reason: "Not a scheduled automated call" };
  if (!settings.calling.automatedEnabled) return routeToHuman(callId, "Automated mode is disabled");

  const lead = call.lead;
  const dnc = await isSuppressed(prisma, "PHONE", lead.phoneE164);
  if (!dnc.allowed) {
    await prisma.callAttempt.update({ where: { id: callId }, data: { status: "CANCELLED", routedReason: `Do-not-call: ${dnc.reason}` } });
    return { placed: false, reason: "On do-not-call list" };
  }

  const { client, callerId } = await getTwilio();
  if (!callerId) return routeToHuman(callId, "No Twilio caller ID configured");

  // Line-type check (cached).
  let lineType = lead.lineType;
  const fresh = lead.lineTypeCheckedAt && Date.now() - lead.lineTypeCheckedAt.getTime() < LOOKUP_TTL_DAYS * 86400_000;
  if (!lineType || !fresh) {
    try {
      const r = await client.lookups.v2.phoneNumbers(lead.phoneE164!).fetch({ fields: "line_type_intelligence" });
      lineType = mapLineType((r.lineTypeIntelligence as { type?: string } | null)?.type);
    } catch {
      lineType = "UNKNOWN";
    }
    await prisma.lead.update({ where: { id: lead.id }, data: { lineType, lineTypeCheckedAt: new Date() } });
  }
  if (lineType === "MOBILE") return routeToHuman(callId, "Mobile number: human caller required");
  if (lineType === "UNKNOWN") return routeToHuman(callId, "Line type unknown: human caller required");

  const record = recordingPermitted(settings.calling, lead.state);
  const sig = sign("call:" + callId);
  const tw = await client.calls.create({
    to: lead.phoneE164!,
    from: callerId,
    url: appUrl(`/api/webhooks/twilio/twiml`),
    method: "POST",
    timeout: settings.calling.maxRingSeconds,
    machineDetection: "DetectMessageEnd",
    asyncAmd: "true",
    asyncAmdStatusCallback: appUrl(`/api/webhooks/twilio/amd?c=${callId}&s=${sig}`),
    statusCallback: appUrl(`/api/webhooks/twilio/status?c=${callId}&s=${sig}`),
    statusCallbackEvent: ["completed"],
    record,
    ...(record ? { recordingStatusCallback: appUrl(`/api/webhooks/twilio/recording?c=${callId}&s=${sig}`) } : {}),
  });
  await prisma.callAttempt.update({ where: { id: callId }, data: { status: "IN_PROGRESS", twilioCallSid: tw.sid, executedAt: new Date() } });
  await audit(null, "call.automated.placed", { type: "CallAttempt", id: callId }, { sid: tw.sid, lineType, record });
  return { placed: true, sid: tw.sid };
}

/** Called every minute: place automated calls whose slot has arrived. */
export async function sweepAutomatedCalls(now = new Date()) {
  const settings = await getSettings();
  if (!settings.calling.automatedEnabled) return { placed: 0, routed: 0, skipped: "disabled" };
  const due = await prisma.callAttempt.findMany({
    where: { mode: "AUTOMATED", status: "SCHEDULED", scheduledAt: { lte: now, gte: new Date(now.getTime() - 30 * 60_000) } },
    take: settings.calling.maxCallsPer15Min,
    orderBy: { scheduledAt: "asc" },
  });
  let placed = 0, routed = 0;
  for (const c of due) {
    try {
      const r = await placeAutomatedCall(c.id);
      if (r.placed) placed++;
      if ("routed" in r && r.routed) routed++;
    } catch (e) {
      await routeToHuman(c.id, `Automated call failed: ${e instanceof Error ? e.message : e}`);
      routed++;
    }
  }
  return { placed, routed };
}

/** Twilio status callback → classify → log outcome (flagged for review where ambiguous). */
export async function completeAutomatedCall(callId: string, p: Record<string, string>) {
  const call = await prisma.callAttempt.findUnique({ where: { id: callId } });
  if (!call || call.status === "COMPLETED") return null;
  const c = classifyAutomatedCall({
    callStatus: p.CallStatus ?? "failed",
    answeredBy: p.AnsweredBy ?? call.answeredBy,
    durationSec: p.CallDuration ? Number(p.CallDuration) : null,
    sipResponseCode: p.SipResponseCode ? Number(p.SipResponseCode) : null,
  });
  await recordCallOutcome({
    callId,
    outcome: c.outcome,
    mode: "AUTOMATED",
    durationSec: p.CallDuration ? Number(p.CallDuration) : null,
    executedAt: call.executedAt ?? new Date(),
    notes: `[auto] ${c.note}`,
    needsReview: c.needsReview,
  });
  return c;
}
