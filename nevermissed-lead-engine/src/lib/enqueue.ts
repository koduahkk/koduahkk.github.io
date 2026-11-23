/** Queue website enrichment for new leads: via Inngest when configured, else right after the response. */
import "server-only";
import { after } from "next/server";
import { trySend } from "@/inngest";
import { enrichLead } from "@/lib/jobs/enrich";

export async function queueEnrichment(ids: string[]) {
  if (!ids.length) return;
  const sent = await Promise.all(ids.map((id) => trySend("nm/lead.enrich", { leadId: id })));
  if (sent.every(Boolean)) return;
  // Anything not picked up here is caught by the hourly enrichment backfill.
  after(async () => {
    for (const id of ids.slice(0, 25)) await enrichLead(id).catch(() => {});
  });
}
