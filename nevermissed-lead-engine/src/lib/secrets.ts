/**
 * API keys. Environment variables always win; otherwise an admin can store an
 * encrypted override from Settings → Integrations. Values are never sent to
 * the browser — the UI only sees `configured: true/false` and a masked hint.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";

export const SECRET_KEYS = [
  { key: "GOOGLE_PLACES_API_KEY", label: "Google Places API key", group: "Google" },
  { key: "TWILIO_ACCOUNT_SID", label: "Twilio Account SID", group: "Twilio" },
  { key: "TWILIO_AUTH_TOKEN", label: "Twilio Auth Token", group: "Twilio" },
  { key: "TWILIO_CALLER_ID", label: "Twilio caller ID (E.164 number you own)", group: "Twilio" },
  { key: "TWILIO_API_KEY", label: "Twilio API key SID (browser calling)", group: "Twilio" },
  { key: "TWILIO_API_SECRET", label: "Twilio API key secret (browser calling)", group: "Twilio" },
  { key: "TWILIO_TWIML_APP_SID", label: "Twilio TwiML App SID (browser calling)", group: "Twilio" },
  { key: "RESEND_API_KEY", label: "Resend API key", group: "Email" },
  { key: "RESEND_WEBHOOK_SECRET", label: "Resend webhook signing secret (whsec_…)", group: "Email" },
  { key: "SENDGRID_API_KEY", label: "SendGrid API key", group: "Email" },
  { key: "SENDGRID_WEBHOOK_PUBLIC_KEY", label: "SendGrid event webhook public key", group: "Email" },
  { key: "INBOUND_WEBHOOK_TOKEN", label: "Inbound reply webhook token", group: "Email" },
] as const;
export type SecretKey = (typeof SECRET_KEYS)[number]["key"];

const cache = new Map<string, { v: string | null; at: number }>();

export async function getSecret(k: SecretKey): Promise<string | null> {
  const env = process.env[k];
  if (env) return env;
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < 30_000) return hit.v;
  const row = await prisma.integrationSecret.findUnique({ where: { key: k } });
  let v: string | null = null;
  if (row) {
    try {
      v = decrypt(row.cipher);
    } catch {
      v = null; // key rotated — treat as unset
    }
  }
  cache.set(k, { v, at: Date.now() });
  return v;
}

export async function setSecret(k: SecretKey, value: string | null) {
  cache.delete(k);
  if (!value) {
    await prisma.integrationSecret.deleteMany({ where: { key: k } });
    return;
  }
  await prisma.integrationSecret.upsert({
    where: { key: k },
    create: { key: k, cipher: encrypt(value) },
    update: { cipher: encrypt(value) },
  });
}

export async function secretStatus() {
  const rows = await prisma.integrationSecret.findMany();
  return SECRET_KEYS.map((s) => {
    const fromEnv = !!process.env[s.key];
    const stored = rows.some((r) => r.key === s.key);
    return { ...s, source: fromEnv ? "env" : stored ? "database" : null } as const;
  });
}
