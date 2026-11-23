/**
 * Run a background job once, without Inngest:
 *   npm run jobs:planner | jobs:emails | jobs:enrich | jobs:refresh-places | jobs:imap
 * (Uses the same code the Inngest functions call.)
 */
import { runDailyPlanner } from "@/lib/jobs/planner";
import { dispatchEmails } from "@/lib/jobs/email";
import { enrichPending } from "@/lib/jobs/enrich";
import { refreshStalePlaces } from "@/lib/jobs/places";
import { pollImap } from "@/lib/jobs/imap";
import { sweepAutomatedCalls } from "@/lib/jobs/automated";
import { prisma } from "@/lib/db";

const jobs: Record<string, () => Promise<unknown>> = {
  planner: () => runDailyPlanner(),
  emails: () => dispatchEmails(),
  enrich: () => enrichPending(25),
  "refresh-places": () => refreshStalePlaces(50),
  imap: () => pollImap(),
  "automated-calls": () => sweepAutomatedCalls(),
};

const name = process.argv[2];
if (!name || !jobs[name]) {
  console.error(`Usage: tsx scripts/run-job.ts <${Object.keys(jobs).join("|")}>`);
  process.exit(1);
}
jobs[name]()
  .then((r) => console.log(JSON.stringify(r, null, 2)))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
