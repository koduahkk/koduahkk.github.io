import { readTwilio, twiml } from "@/lib/twilio/webhook";

export const runtime = "nodejs";

/**
 * TwiML for automated test calls. Deliberately SILENT: no <Say>, no <Play>.
 * We never play an artificial or prerecorded voice. The pause gives answering-
 * machine detection (and, where legal, the recording) time to capture the
 * greeting; then we hang up.
 */
export async function POST(req: Request) {
  const { ok } = await readTwilio(req);
  if (!ok) return new Response("forbidden", { status: 403 });
  return twiml(`<Pause length="25"/><Hangup/>`);
}
