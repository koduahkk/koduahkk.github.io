import Link from "next/link";
import { PhoneCall, PartyPopper } from "lucide-react";
import { DateTime } from "luxon";
import { prisma } from "@/lib/db";
import { hasRole, requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { getSecret } from "@/lib/secrets";
import { PageHeader, EmptyState } from "@/components/app/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtIn, zoneAbbr } from "@/lib/format";
import { OUTCOME_META } from "@/lib/domain";
import { QueueCall, type QueueItem } from "./queue-call";

export const metadata = { title: "Call Queue" };

export default async function QueuePage({ searchParams }: { searchParams: Promise<{ call?: string }> }) {
  const { call: callId } = await searchParams;
  const user = await requireUser();
  const settings = await getSettings();
  const now = new Date();

  const include = { lead: true } as const;
  const [picked, upcoming, review] = await Promise.all([
    callId ? prisma.callAttempt.findUnique({ where: { id: callId }, include }) : null,
    prisma.callAttempt.findMany({
      where: { mode: "HUMAN", status: { in: ["SCHEDULED", "IN_PROGRESS"] }, scheduledAt: { lte: new Date(now.getTime() + 36 * 3600_000) } },
      include,
      orderBy: { scheduledAt: "asc" },
      take: 8,
    }),
    prisma.callAttempt.findMany({ where: { needsReview: true, status: "COMPLETED" }, include, orderBy: { executedAt: "desc" }, take: 10 }),
  ]);
  const current = picked ?? upcoming[0] ?? null;
  const browserCalling = settings.calling.browserCalling && !!(await getSecret("TWILIO_TWIML_APP_SID"));

  let item: QueueItem | null = null;
  if (current) {
    const other = await prisma.callAttempt.findFirst({ where: { leadId: current.leadId, id: { not: current.id } } });
    const mins = Math.round((current.scheduledAt.getTime() - now.getTime()) / 60000);
    item = {
      id: current.id,
      type: current.type,
      leadId: current.leadId,
      name: current.lead.name,
      phone: current.lead.phone ?? current.lead.phoneE164 ?? "",
      phoneE164: current.lead.phoneE164,
      city: current.lead.city,
      salonLocal: `${fmtIn(now, current.lead.timezone, "ccc h:mma")} ${zoneAbbr(now, current.lead.timezone)}`,
      yourLocal: fmtIn(now, user.timezone, "h:mma"),
      dueLabel: current.status === "COMPLETED" ? "Completed" : mins < -1 ? `Overdue ${DateTime.fromJSDate(current.scheduledAt).toRelative()?.replace(" ago", "")}` : mins <= 1 ? "Due now" : `Due ${fmtIn(current.scheduledAt, user.timezone, "ccc h:mma")} (salon ${fmtIn(current.scheduledAt, current.lead.timezone, "h:mma")})`,
      overdue: mins < -15 && current.status !== "COMPLETED",
      earlyMinutes: current.status === "COMPLETED" ? 0 : Math.max(0, mins),
      windowLabel: current.windowLabel,
      hoursAssumed: current.hoursAssumed,
      website: current.lead.website,
      bookingPlatform: current.lead.bookingPlatform,
      otherCall: other ? (other.outcome ? `${other.type}: ${OUTCOME_META[other.outcome].label}` : `${other.type} scheduled ${fmtIn(other.scheduledAt, current.lead.timezone, "ccc h:mma")} salon time`) : null,
      needsReview: current.needsReview,
      currentOutcome: current.outcome,
      autoNote: current.mode === "AUTOMATED" || current.needsReview ? current.notes : null,
    };
  }
  const rest = upcoming.filter((c) => c.id !== current?.id);

  return (
    <>
      <PageHeader title="Call Queue" description="One call at a time. Log what happened and the next salon loads." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          {item ? (
            <QueueCall item={item} script={settings.calling.callerScript} browserCalling={browserCalling} canLog={hasRole(user, "CALLER")} />
          ) : (
            <EmptyState icon={PartyPopper} title="Queue is clear">
              No human calls due in the next 36 hours. Check <Link className="text-primary underline" href="/calls">Today&apos;s Calls</Link> or run the planner.
            </EmptyState>
          )}
        </div>
        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Up next</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {rest.length === 0 ? <p className="text-sm text-muted-foreground">Nothing else queued.</p> : null}
              {rest.map((c) => (
                <Link key={c.id} href={`/queue?call=${c.id}`} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                  <span className="min-w-0 truncate">{c.lead.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{c.type} · {fmtIn(c.scheduledAt, user.timezone, "ccc h:mma")}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
          {review.length ? (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Automated calls to review</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {review.map((c) => (
                  <Link key={c.id} href={`/queue?call=${c.id}`} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                    <span className="min-w-0 truncate">{c.lead.name}</span>
                    <Badge variant="warning">{c.outcome ? OUTCOME_META[c.outcome].short : "?"}</Badge>
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardContent className="space-y-1 pt-4 text-xs text-muted-foreground sm:pt-5">
              <p className="flex items-center gap-1 font-medium text-foreground"><PhoneCall className="h-3.5 w-3.5" /> Shortcuts</p>
              <p>1–8 log an outcome · N focuses notes</p>
              <p>Numbers on the do-not-call list are blocked automatically.</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
