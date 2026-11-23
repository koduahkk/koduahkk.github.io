import Link from "next/link";
import { ListChecks, AtSign, Footprints } from "lucide-react";
import { prisma } from "@/lib/db";
import { hasRole, requireUser } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/app/page";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/app/action-button";
import { setTaskStatus } from "@/app/actions/leads";
import { fmtIn, titleCase } from "@/lib/format";
import { CopyButton } from "../leads/[id]/client";
import { cn } from "@/lib/utils";

export const metadata = { title: "Tasks" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ status?: string; type?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const status = sp.status === "DONE" ? "DONE" : "OPEN";
  const tasks = await prisma.task.findMany({
    where: { status, ...(sp.type ? { type: sp.type as never } : {}) },
    include: { lead: { select: { id: true, name: true, city: true, instagram: true } }, assignee: { select: { name: true } } },
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    take: 200,
  });
  const filters = [
    { label: "All open", href: "/tasks", on: status === "OPEN" && !sp.type },
    { label: "Instagram DMs", href: "/tasks?type=INSTAGRAM_DM", on: sp.type === "INSTAGRAM_DM" },
    { label: "Walk-ins", href: "/tasks?type=WALK_IN", on: sp.type === "WALK_IN" },
    { label: "Follow-ups", href: "/tasks?type=FOLLOW_UP", on: sp.type === "FOLLOW_UP" },
    { label: "Done", href: "/tasks?status=DONE", on: status === "DONE" },
  ];
  const now = Date.now();

  return (
    <>
      <PageHeader title="Tasks" description="Manual-channel outreach for leads without an email, plus follow-ups." />
      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((f) => <Link key={f.label} href={f.href} className={cn("rounded-md px-3 py-1.5 text-sm", f.on ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted")}>{f.label}</Link>)}
      </div>
      {tasks.length === 0 ? <EmptyState icon={ListChecks} title="No tasks here">HOT and WARM leads without an email get an Instagram DM and walk-in task automatically.</EmptyState> : null}
      <div className="space-y-3">
        {tasks.map((t) => (
          <Card key={t.id}>
            <CardContent className="pt-4 sm:pt-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    {t.type === "INSTAGRAM_DM" ? <AtSign className="h-4 w-4 text-muted-foreground" /> : t.type === "WALK_IN" ? <Footprints className="h-4 w-4 text-muted-foreground" /> : null}
                    {t.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.lead ? <Link href={`/leads/${t.lead.id}`} className="hover:underline">{t.lead.name}{t.lead.city ? `, ${t.lead.city}` : ""}</Link> : null}
                    {t.dueAt ? <> · due {fmtIn(t.dueAt, user.timezone, "ccc LLL d")}</> : null}
                    {t.assignee?.name ? ` · ${t.assignee.name}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{titleCase(t.type)}</Badge>
                  {t.status === "OPEN" && t.dueAt && t.dueAt.getTime() < now ? <Badge variant="hot">Overdue</Badge> : null}
                  {t.body ? <CopyButton text={t.body} /> : null}
                  {hasRole(user, "CALLER") ? <ActionButton size="sm" variant={t.status === "OPEN" ? "default" : "outline"} action={setTaskStatus.bind(null, t.id, t.status === "OPEN" ? "DONE" : "OPEN")}>{t.status === "OPEN" ? "Done" : "Reopen"}</ActionButton> : null}
                </div>
              </div>
              {t.body ? <details className="mt-2"><summary className="cursor-pointer text-xs text-primary">Show draft</summary><p className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{t.body}</p></details> : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
