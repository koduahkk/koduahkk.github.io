import "server-only";
import twilio from "twilio";
import { getSecret } from "@/lib/secrets";

export async function twilioCreds() {
  const [sid, token, callerId] = await Promise.all([
    getSecret("TWILIO_ACCOUNT_SID"),
    getSecret("TWILIO_AUTH_TOKEN"),
    getSecret("TWILIO_CALLER_ID"),
  ]);
  return { sid, token, callerId, configured: !!(sid && token && callerId) };
}

export async function getTwilio() {
  const c = await twilioCreds();
  if (!c.sid || !c.token) throw new Error("Twilio is not configured (Settings → Integrations).");
  return { client: twilio(c.sid, c.token), ...c };
}

/** Verify X-Twilio-Signature on a form-encoded webhook. */
export async function verifyTwilioRequest(url: string, signature: string | null, params: Record<string, string>) {
  const token = await getSecret("TWILIO_AUTH_TOKEN");
  if (!token || !signature) return false;
  return twilio.validateRequest(token, signature, url, params);
}
