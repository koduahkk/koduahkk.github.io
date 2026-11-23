import { NextResponse } from "next/server";
import { getSecret } from "@/lib/secrets";
import { verifySendgrid } from "@/lib/webhooks";
import { handleBounce, handleComplaint, handleUnsubscribe, recordEngagement } from "@/lib/jobs/email";

export const runtime = "nodejs";

type SgEvent = { event: string; sg_message_id?: string; nm_token?: string; type?: string; url?: string };

export async function POST(req: Request) {
  const body = await req.text();
  const key = await getSecret("SENDGRID_WEBHOOK_PUBLIC_KEY");
  if (!key || !verifySendgrid(key, req.headers, body)) return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  const events = JSON.parse(body) as SgEvent[];
  for (const e of events) {
    // custom_args come back on the event; fall back to the message id prefix.
    const where = e.nm_token ? { token: e.nm_token } : { providerMessageId: e.sg_message_id?.split(".")[0] };
    switch (e.event) {
      case "delivered": await recordEngagement("DELIVERED", where); break;
      case "open": await recordEngagement("OPENED", where); break;
      case "click": await recordEngagement("CLICKED", where, { url: e.url ?? null }); break;
      case "bounce": await handleBounce(where, { type: e.type ?? null }, e.type !== "blocked"); break;
      case "dropped": await handleBounce(where, { type: "dropped" }, true); break;
      case "spamreport": await handleComplaint(where); break;
      case "unsubscribe":
      case "group_unsubscribe":
        if (e.nm_token) await handleUnsubscribe(e.nm_token);
        break;
    }
  }
  return NextResponse.json({ ok: true });
}
