import { prisma } from "@/lib/db";
import { isSuppressed, normalizePhone } from "@/lib/suppression";
import { twilioCreds } from "@/lib/twilio/client";
import { readTwilio, twiml } from "@/lib/twilio/webhook";

export const runtime = "nodejs";

/**
 * TwiML App voice URL for browser calling (a human caller talks live).
 * Only dials numbers that belong to a lead and are not on the do-not-call list,
 * so the token can't be used as a general-purpose phone.
 */
export async function POST(req: Request) {
  const { ok, params } = await readTwilio(req);
  if (!ok) return new Response("forbidden", { status: 403 });
  const to = normalizePhone(params.To);
  const lead = to ? await prisma.lead.findUnique({ where: { phoneE164: to } }) : null;
  if (!to || !lead) return twiml("<Reject/>");
  if (!(await isSuppressed(prisma, "PHONE", to)).allowed) return twiml("<Reject/>");
  const { callerId } = await twilioCreds();
  return twiml(`<Dial callerId="${callerId}" timeout="30"><Number>${to}</Number></Dial>`);
}
