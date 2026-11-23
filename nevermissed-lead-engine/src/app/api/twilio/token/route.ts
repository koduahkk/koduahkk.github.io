import { NextResponse } from "next/server";
import twilio from "twilio";
import { assertRole } from "@/lib/auth/session";
import { getSecret } from "@/lib/secrets";

export const runtime = "nodejs";

/** Short-lived Voice SDK token for signed-in callers. */
export async function POST() {
  let user;
  try {
    user = await assertRole("CALLER");
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 });
  }
  const [sid, key, secret, app] = await Promise.all([getSecret("TWILIO_ACCOUNT_SID"), getSecret("TWILIO_API_KEY"), getSecret("TWILIO_API_SECRET"), getSecret("TWILIO_TWIML_APP_SID")]);
  if (!sid || !key || !secret || !app) return NextResponse.json({ error: "Browser calling isn't fully configured (Settings → Integrations)." }, { status: 400 });
  const { AccessToken } = twilio.jwt;
  const token = new AccessToken(sid, key, secret, { identity: user.id, ttl: 3600 });
  token.addGrant(new AccessToken.VoiceGrant({ outgoingApplicationSid: app, incomingAllow: false }));
  return NextResponse.json({ token: token.toJwt() });
}
