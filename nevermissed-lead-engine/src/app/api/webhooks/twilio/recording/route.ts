import { prisma } from "@/lib/db";
import { readTwilio } from "@/lib/twilio/webhook";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { ok, params, callId } = await readTwilio(req, { requireCallSig: true });
  if (!ok || !callId) return new Response("forbidden", { status: 403 });
  if (params.RecordingUrl) await prisma.callAttempt.update({ where: { id: callId }, data: { recordingUrl: `${params.RecordingUrl}.mp3` } });
  return new Response(null, { status: 204 });
}
