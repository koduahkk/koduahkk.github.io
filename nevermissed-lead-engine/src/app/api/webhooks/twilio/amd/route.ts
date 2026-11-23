import { prisma } from "@/lib/db";
import { getTwilio } from "@/lib/twilio/client";
import { readTwilio } from "@/lib/twilio/webhook";

export const runtime = "nodejs";

/** Async AMD result. If a person picked up, end the call right away so we don't leave them on a silent line. */
export async function POST(req: Request) {
  const { ok, params, callId } = await readTwilio(req, { requireCallSig: true });
  if (!ok || !callId) return new Response("forbidden", { status: 403 });
  await prisma.callAttempt.update({ where: { id: callId }, data: { answeredBy: params.AnsweredBy ?? null } });
  if (params.AnsweredBy === "human" && params.CallSid) {
    const { client } = await getTwilio();
    await client.calls(params.CallSid).update({ status: "completed" }).catch(() => null);
  }
  return new Response(null, { status: 204 });
}
