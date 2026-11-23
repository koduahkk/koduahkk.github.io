/**
 * Background jobs (Inngest). Each function is a thin wrapper around a plain
 * async job in src/lib/jobs, so the same logic also runs from the UI
 * ("Run now" buttons) and from `npm run jobs:*` without Inngest.
 */
import { Inngest } from "inngest";
import { runDailyPlanner } from "@/lib/jobs/planner";
import { dispatchEmails } from "@/lib/jobs/email";
import { enrichLead, enrichPending } from "@/lib/jobs/enrich";
import { refreshStalePlaces } from "@/lib/jobs/places";
import { sweepAutomatedCalls } from "@/lib/jobs/automated";
import { pollImap } from "@/lib/jobs/imap";

export const inngest = new Inngest({ id: "nevermissed-lead-engine" });

const TZ = process.env.PLANNER_CRON_TZ || "America/New_York";

export const dailyPlanner = inngest.createFunction(
  { id: "daily-call-planner", triggers: [{ cron: `TZ=${TZ} 0 7 * * *` }] },
  async ({ step }) => step.run("plan", () => runDailyPlanner()),
);

export const automatedCallSweeper = inngest.createFunction(
  { id: "automated-call-sweeper", triggers: [{ cron: "* * * * *" }], concurrency: { limit: 1 } },
  async ({ step }) => step.run("sweep", () => sweepAutomatedCalls()),
);

export const emailDispatcher = inngest.createFunction(
  { id: "email-dispatcher", triggers: [{ cron: "*/5 * * * *" }], concurrency: { limit: 1 } },
  async ({ step }) => step.run("dispatch", () => dispatchEmails()),
);

export const enrichOne = inngest.createFunction(
  { id: "enrich-lead", triggers: [{ event: "nm/lead.enrich" }], concurrency: { limit: 5 }, retries: 2 },
  async ({ event, step }) => step.run("enrich", () => enrichLead((event.data as { leadId: string }).leadId)),
);

export const enrichBackfill = inngest.createFunction(
  { id: "enrich-pending", triggers: [{ cron: "15 * * * *" }], concurrency: { limit: 1 } },
  async ({ step }) => step.run("enrich-batch", () => enrichPending(25)),
);

export const placesRefresh = inngest.createFunction(
  { id: "places-refresh", triggers: [{ cron: `TZ=${TZ} 0 3 * * *` }], concurrency: { limit: 1 } },
  async ({ step }) => step.run("refresh", () => refreshStalePlaces(50)),
);

export const imapPoller = inngest.createFunction(
  { id: "imap-reply-poller", triggers: [{ cron: "*/5 * * * *" }], concurrency: { limit: 1 } },
  async ({ step }) => step.run("poll", () => pollImap()),
);

export const functions = [dailyPlanner, automatedCallSweeper, emailDispatcher, enrichOne, enrichBackfill, placesRefresh, imapPoller];

/** Fire-and-forget event; returns false when Inngest isn't reachable so callers can fall back. */
export async function trySend(name: string, data: Record<string, unknown>) {
  if (!process.env.INNGEST_EVENT_KEY && process.env.INNGEST_DEV !== "1") return false;
  try {
    await inngest.send({ name, data });
    return true;
  } catch {
    return false;
  }
}
