import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getSecret } from "@/lib/secrets";
import { handleReply } from "@/lib/jobs/email";

export const runtime = "nodejs";

/**
 * Inbound replies. Accepts JSON `{ from, to, subject, text, inReplyTo }` or a
 * SendGrid Inbound Parse multipart form. Protected by ?token=INBOUND_WEBHOOK_TOKEN.
 */
export async function POST(req: NextRequest) {
  const expected = await getSecret("INBOUND_WEBHOOK_TOKEN");
  const got = req.nextUrl.searchParams.get("token") ?? "";
  if (!expected || got.length !== expected.length || !timingSafeEqual(Buffer.from(got), Buffer.from(expected))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let msg: { from: string; to: string[]; subject?: string; text?: string; inReplyTo?: string | null };
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const j = await req.json();
    msg = { from: j.from, to: [].concat(j.to ?? []), subject: j.subject, text: j.text ?? j.plain ?? "", inReplyTo: j.inReplyTo ?? j.in_reply_to ?? null };
  } else {
    const f = await req.formData();
    const headers = String(f.get("headers") ?? "");
    msg = { from: String(f.get("from") ?? ""), to: String(f.get("to") ?? "").split(","), subject: String(f.get("subject") ?? ""), text: String(f.get("text") ?? ""), inReplyTo: headers.match(/^In-Reply-To:\s*(.+)$/im)?.[1]?.trim() ?? null };
  }
  if (!msg.from) return NextResponse.json({ error: "missing from" }, { status: 400 });
  const m = await handleReply(msg);
  return NextResponse.json({ ok: true, matched: !!m });
}
