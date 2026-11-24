/** Queue website enrichment for new leads: via Inngest when configured, else right after the response. */
import "server-only";
import { after } from "next/server";
import { trySend } from "@/inngest";
import { enrichLead } from "@/lib/jobs/enrich";

export async function queueEnrichment(ids: string[]) {
  if (!ids.length) return;
  const sent = await Promise.all(ids.map((id) => trySend("nm/lead.enrich", { leadId: id })));
  if (sent.every(Boolean)) return;
  // Scan every new salon's website after responding, 4 at a time. Anything left
  // over (e.g. a timeout) is picked up by the daily catch-up in the morning job.
  after(async () => {
    for (let i = 0; i < ids.length; i += 4) await Promise.all(ids.slice(i, i + 4).map((id) => enrichLead(id).catch(() => null)));
  });
}
