/**
 * Morning routine for Vercel Cron (see vercel.json): find new salons, then
 * plan today's test calls, in that order. Vercel calls this once a day with
 * `Authorization: Bearer $CRON_SECRET`. Both steps are safe to run twice
 * (they only top up to today's targets), so Inngest can run them as well.
 */
import { NextResponse } from "next/server";
import { after } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runSourcing } from "@/lib/jobs/sourcing";
import { runDailyPlanner } from "@/lib/jobs/planner";
import { enrichLead, enrichPending } from "@/lib/jobs/enrich";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  return !!secret && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sourcing = await runSourcing({ trigger: "schedule" }).catch((e) => ({ ran: false, message: String(e?.message ?? e), createdIds: [] as string[], found: 0 }));
  const planner = await runDailyPlanner().catch((e) => ({ message: String(e?.message ?? e) }));

  // Scan the new salons' websites after responding (4 at a time).
  const ids = sourcing.createdIds;
  if (ids.length) {
    after(async () => {
      for (let i = 0; i < ids.length; i += 4) await Promise.all(ids.slice(i, i + 4).map((id) => enrichLead(id).catch(() => null)));
      // Catch up on any salon whose website hasn't been scanned yet (e.g. from yesterday).
      await enrichPending(60).catch(() => null);
    });
  } else {
    after(async () => {
      await enrichPending(60).catch(() => null);
    });
  }
  return NextResponse.json({ sourcing: { ran: sourcing.ran, found: sourcing.found, message: sourcing.message }, planner: { message: planner.message } });
}
