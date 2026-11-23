/**
 * Pluggable email providers. `console` is the default so the app works with
 * no keys: messages are logged and marked as sent.
 */
import "server-only";
import { getSecret } from "@/lib/secrets";

export type OutgoingEmail = {
  from: { name: string; email: string };
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
  headers: Record<string, string>;
  /** Our message token, echoed back by providers that support custom args. */
  token: string;
};

export interface EmailProvider {
  name: string;
  send(msg: OutgoingEmail): Promise<{ id: string }>;
}

const consoleProvider: EmailProvider = {
  name: "console",
  async send(msg) {
    console.info(`[email:console] to=${msg.to} subject="${msg.subject}"\n${msg.text}\n`);
    return { id: `console_${msg.token}` };
  },
};

const resendProvider = (key: string): EmailProvider => ({
  name: "resend",
  async send(msg) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${msg.from.name} <${msg.from.email}>`,
        to: [msg.to],
        reply_to: msg.replyTo,
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
        headers: msg.headers,
        tags: [{ name: "nm_token", value: msg.token.replace(/[^A-Za-z0-9_-]/g, "") }],
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok || !body.id) throw new Error(`Resend ${res.status}: ${body.message ?? "send failed"}`);
    return { id: body.id };
  },
});

const sendgridProvider = (key: string): EmailProvider => ({
  name: "sendgrid",
  async send(msg) {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: msg.to }] }],
        from: { email: msg.from.email, name: msg.from.name },
        reply_to: msg.replyTo ? { email: msg.replyTo } : undefined,
        subject: msg.subject,
        content: [
          { type: "text/plain", value: msg.text },
          { type: "text/html", value: msg.html },
        ],
        headers: msg.headers,
        custom_args: { nm_token: msg.token },
        tracking_settings: { click_tracking: { enable: false }, open_tracking: { enable: false } },
      }),
    });
    if (!res.ok) throw new Error(`SendGrid ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return { id: res.headers.get("x-message-id") ?? `sg_${msg.token}` };
  },
});

export async function getProvider(name: "console" | "resend" | "sendgrid"): Promise<EmailProvider> {
  if (name === "resend") {
    const k = await getSecret("RESEND_API_KEY");
    if (!k) throw new Error("Resend is selected but RESEND_API_KEY is not configured.");
    return resendProvider(k);
  }
  if (name === "sendgrid") {
    const k = await getSecret("SENDGRID_API_KEY");
    if (!k) throw new Error("SendGrid is selected but SENDGRID_API_KEY is not configured.");
    return sendgridProvider(k);
  }
  return consoleProvider;
}
