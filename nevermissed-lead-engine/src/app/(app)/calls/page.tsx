import Link from "next/link";
import { DateTime } from "luxon";
import { CalendarClock, AlertTriangle, Bot } from "lucide-react";
import { prisma } from "@/lib/db";
import { hasRole, requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { PageHeader, EmptyState, Stat } from "@/components/app/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OutcomeBadge } from "@/components/app/badges";
import { ActionButton } from "@/components/app/action-button";
import { runPlannerNow } from "@/app/actions/calls";
import { fmtIn, zoneAbbr } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Today's Calls" };

export default async function TodaysCalls({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { day } = await searchParams;
  const user = await requireUser();
  const settings = await getSettings();
  const zone = user.timezone;
  const base = DateTime.now().setZone(zone).startOf("day").plus({ days: day === "tomorrow" ? 1 : 0 });
  const start = base.toJSDate();
  const end = base.plus({ days: 1 }).toJSDate();

  const calls = await prisma.callAttempt.findMany({
    where: { scheduledAt: { gte: start, lt: end }, status: { not: "CANCELLED" } },
    include: { lead: { select: { id: true, name: true, city: true, timezone: true, phone: true } } },
    orderBy: { scheduledAt: "asc" },
  });
  const done = calls.filter((c) => c.status === "COMPLETED").length;
  const testedToday = new Set(calls.filter((c) => c.status === "COMPLETED").map((c) => c.leadId)).size;
  const quota = settings.general.dailyQuota;

  // Group into 15-minute slots in absolute time (rendered in the user's zone).
  const groups = new Map<number, typeof calls>();
  for (const c of calls) {
    const k = Math.floor(c.scheduledAt.getTime() / 900_000) * 900_000;
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  const now = Date.now();
  const label = day === "tomorrow" ? "tomorrow" : "today";

  return (
    <>
      <PageHeader
        title={day === "tomorrow" ? "Tomorrow's Calls" : "Today's Calls"}
        description={`${base.toFormat("cccc, LLL d")}. Times in your zone (${zoneAbbr(new Date(), zone)}), with the salon's local time next to each.`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={day === "tomorrow" ? "/calls" : "/calls?day=tomorrow"}>{day === "tomorrow" ? "Today" : "Tomorrow"}</Link>
            </Button>
            {hasRole(user, "ADMIN") ? (
              <ActionButton variant="outline" action={runPlannerNow}>
                Run planner now
              </ActionButton>
            ) : null}
            <Button asChild>
              <Link href="/queue">Open call queue</Link>
            </Button>
          </>
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Card className="sm:col-span-2">
          <CardContent className="pt-4 sm:pt-5">
            <div className="mb-2 flex items-baseline justify-between">
              <p className="text-sm font-medium">Salons tested {label}</p>
              <p className="text-sm tabular-nums">
                <strong className="text-lg">{testedToday}</strong> of {quota}
              </p>
            </div>
            <Progress value={(testedToday / quota) * 100} label={`Salons tested ${label}`} />
            <p className="mt-2 text-xs text-muted-foreground">
              {done} of {calls.length} calls on this day completed.
            </p>
          </CardContent>
        </Card>
        <Stat label="Calls left" value={calls.length - done} hint={`Max ${settings.calling.maxCallsPer15Min} per 15 minutes`} />
      </div>

      {calls.length === 0 ? (
        <EmptyState icon={CalendarClock} title="No calls scheduled for this day">
          The planner runs every morning at 7:00 ({settings.general.plannerTimezone}).{hasRole(user, "ADMIN") ? " You can also run it now." : ""}
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {[...groups.entries()].map(([k, list]) => (
            <Card key={k} className={cn(k + 900_000 < now && list.every((c) => c.status === "COMPLETED") && "opacity-70")}>
              <CardHeader className="flex-row items-center justify-between pb-2 sm:pb-2">
                <CardTitle className="text-base">
                  {fmtIn(new Date(k), zone, "h:mma")} – {fmtIn(new Date(k + 900_000), zone, "h:mma")}
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {list.length} call{list.length > 1 ? "s" : ""}
                </span>
              </CardHeader>
              <CardContent className="divide-y">
                {list.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                    <Badge variant={c.type === "A" ? "default" : "secondary"} className="w-28 justify-center">
                      {c.type === "A" ? "A · in-hours" : "B · after-hours"}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <Link href={`/leads/${c.lead.id}`} className="font-medium hover:underline">
                        {c.lead.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {fmtIn(c.scheduledAt, zone, "h:mma")} you · <strong className="text-foreground">{fmtIn(c.scheduledAt, c.lead.timezone, "h:mma")} {zoneAbbr(c.scheduledAt, c.lead.timezone)}</strong> salon · {c.lead.city}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {c.hoursAssumed ? (
                        <Badge variant="warning" title="Salon hours unknown. Default hours were used.">
                          <AlertTriangle className="h-3 w-3" /> Hours assumed
                        </Badge>
                      ) : null}
                      {c.mode === "AUTOMATED" ? (
                        <Badge variant="outline">
                          <Bot className="h-3 w-3" /> Auto
                        </Badge>
                      ) : null}
                      {c.status === "COMPLETED" ? (
                        <OutcomeBadge outcome={c.outcome} />
                      ) : c.status === "IN_PROGRESS" ? (
                        <Badge>In progress</Badge>
                      ) : c.scheduledAt.getTime() < now ? (
                        <Badge variant="hot">Overdue</Badge>
                      ) : (
                        <Badge variant="secondary">Scheduled</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
