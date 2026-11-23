import { handleUnsubscribe } from "@/lib/jobs/email";

export const runtime = "nodejs";

const page = (title: string, body: string) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;color:#111;line-height:1.5"><h1 style="font-size:1.4rem">${title}</h1><p>${body}</p></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );

/** One-click unsubscribe link in the email footer: honored immediately. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const m = await handleUnsubscribe((await params).token);
  if (!m) return page("Link not recognized", "This unsubscribe link is invalid or expired. Reply to the email with “unsubscribe” and we'll remove you.");
  return page("You're unsubscribed", `${m.toEmail.replace(/[<>&"]/g, "")} won't receive any more emails from us.`);
}

/** RFC 8058 List-Unsubscribe-Post one-click (mail clients POST here). */
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  await handleUnsubscribe((await params).token);
  return new Response(null, { status: 200 });
}
