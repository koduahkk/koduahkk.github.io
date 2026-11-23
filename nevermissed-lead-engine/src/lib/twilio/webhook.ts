import { verify } from "@/lib/crypto";
import { verifyTwilioRequest } from "@/lib/twilio/client";
import { appUrl } from "@/lib/utils";

/** Parse + authenticate a Twilio form webhook (X-Twilio-Signature + our own call signature). */
export async function readTwilio(req: Request, opts: { requireCallSig?: boolean } = {}) {
  const url = new URL(req.url);
  let params: Record<string, string> = {};
  try {
    const form = await req.formData();
    params = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  } catch {
    return { ok: false, params, callId: null };
  }
  const publicUrl = appUrl(url.pathname + url.search);
  const ok = await verifyTwilioRequest(publicUrl, req.headers.get("x-twilio-signature"), params);
  const callId = url.searchParams.get("c");
  const sigOk = !opts.requireCallSig || (!!callId && verify("call:" + callId, url.searchParams.get("s") ?? ""));
  return { ok: ok && sigOk, params, callId };
}

export const twiml = (xml: string) => new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${xml}</Response>`, { headers: { "Content-Type": "text/xml" } });
