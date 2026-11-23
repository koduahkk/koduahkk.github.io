import { NextResponse } from "next/server";
import { getSecret } from "@/lib/secrets";
import { verifySvix } from "@/lib/webhooks";
import { handleBounce, handleComplaint, handleReply, recordEngagement } from "@/lib/jobs/email";

export const runtime = "nodejs";

type ResendEvent = { type: string; data: { email_id?: string; to?: string[]; from?: string; subject?: string; text?: string; bounce?: { type?: string }; click?: { link?: string } } };

export async function POST(req: Request) {
  const body = await req.text();
  const secret = await getSecret("RESEND_WEBHOOK_SECRET");
  if (!secret || !verifySvix(secret, req.headers, body)) return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  const ev = JSON.parse(body) as ResendEvent;
  const id = ev.data.email_id;
  switch (ev.type) {
    case "email.delivered":
      if (id) await recordEngagement("DELIVERED", { providerMessageId: id });
      break;
    case "email.opened":
      if (id) await recordEngagement("OPENED", { providerMessageId: id });
      break;
    case "email.clicked":
      if (id) await recordEngagement("CLICKED", { providerMessageId: id }, { url: ev.data.click?.link ?? null });
      break;
    case "email.bounced":
      // Treat everything except explicit transient bounces as hard.
      if (id) await handleBounce({ providerMessageId: id }, { type: ev.data.bounce?.type ?? null }, !/transient|soft/i.test(ev.data.bounce?.type ?? ""));
      break;
    case "email.complained":
      if (id) await handleComplaint({ providerMessageId: id });
      break;
    case "email.received":
      if (ev.data.from) await handleReply({ from: ev.data.from, to: ev.data.to, subject: ev.data.subject, text: ev.data.text });
      break;
  }
  return NextResponse.json({ ok: true });
}
