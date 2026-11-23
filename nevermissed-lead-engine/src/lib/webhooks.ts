/** Webhook signature verification for email providers. */
import { createHmac, createPublicKey, createVerify, timingSafeEqual } from "node:crypto";

/** Resend uses Svix: HMAC-SHA256 over `${id}.${timestamp}.${body}` with the base64 secret after "whsec_". */
export function verifySvix(secret: string, headers: Headers, body: string, toleranceSec = 300): boolean {
  const id = headers.get("svix-id");
  const ts = headers.get("svix-timestamp");
  const sigs = headers.get("svix-signature");
  if (!id || !ts || !sigs) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > toleranceSec) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest();
  return sigs.split(" ").some((part) => {
    const [, sig] = part.split(",");
    if (!sig) return false;
    const got = Buffer.from(sig, "base64");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

/** SendGrid Signed Event Webhook: ECDSA P-256 over `${timestamp}${body}`. */
export function verifySendgrid(publicKeyB64: string, headers: Headers, body: string): boolean {
  const sig = headers.get("x-twilio-email-event-webhook-signature");
  const ts = headers.get("x-twilio-email-event-webhook-timestamp");
  if (!sig || !ts) return false;
  try {
    const key = createPublicKey({ key: Buffer.from(publicKeyB64, "base64"), format: "der", type: "spki" });
    const v = createVerify("sha256");
    v.update(ts + body);
    return v.verify(key, Buffer.from(sig, "base64"));
  } catch {
    return false;
  }
}
