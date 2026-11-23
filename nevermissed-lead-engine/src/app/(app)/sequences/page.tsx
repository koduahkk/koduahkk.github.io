import Link from "next/link";
import { Plus, Workflow } from "lucide-react";
import { prisma } from "@/lib/db";
import { hasRole, requireUser } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/app/page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TierBadge } from "@/components/app/badges";
import { ActionButton } from "@/components/app/action-button";
import { createSequence, runEmailDispatcher } from "@/app/actions/sequences";
import { pct } from "@/lib/utils";

export const metadata = { title: "Sequences" };

export default async function SequencesPage() {
  const user = await requireUser();
  const admin = hasRole(user, "ADMIN");
  const seqs = await prisma.sequence.findMany({
    orderBy: { createdAt: "asc" },
    include: { steps: { orderBy: { order: "asc" } }, _count: { select: { enrollments: true } }, enrollments: { select: { status: true } } },
  });
  const stats = await prisma.emailMessage.groupBy({ by: ["stepId"], where: { status: { in: ["SENT", "BOUNCED"] } }, _count: { _all: true, repliedAt: true, openedAt: true } });
  const queued = await prisma.emailMessage.count({ where: { status: "QUEUED" } });

  return (
    <>
      <PageHeader
        title="Sequences"
        description={`Multi-step emails that stop on reply, bounce or unsubscribe. ${queued} email(s) queued.`}
        actions={admin ? (
          <>
            <ActionButton variant="outline" action={runEmailDispatcher}>Send due emails now</ActionButton>
            <form action={createSequence}><Button><Plus /> New sequence</Button></form>
          </>
        ) : null}
      />
      {seqs.length === 0 ? <EmptyState icon={Workflow} title="No sequences yet">Create one to start emailing HOT and WARM leads automatically.</EmptyState> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {seqs.map((s) => {
          const active = s.enrollments.filter((e) => e.status === "ACTIVE").length;
          return (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle><Link href={`/sequences/${s.id}`} className="hover:underline">{s.name}</Link></CardTitle>
                  {s.active ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Paused</Badge>}
                </div>
                <CardDescription>{s.description}</CardDescription>
                <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                  Auto-enrolls: {s.autoEnrollTiers.length ? s.autoEnrollTiers.map((t) => <TierBadge key={t} tier={t} />) : "manual only"} · {active} active · {s._count.enrollments} total{s.stopOnReply ? " · stops on reply" : ""}
                </div>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2">
                  {s.steps.map((st) => {
                    const m = stats.find((x) => x.stepId === st.id);
                    const sent = m?._count._all ?? 0;
                    return (
                      <li key={st.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                        <span className="min-w-0"><span className="mr-2 inline-block w-14 text-xs text-muted-foreground">Day {st.dayOffset}</span><span className="font-medium">{st.name}</span></span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{sent} sent · {pct(m?._count.repliedAt ?? 0, sent)}% replied</span>
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
