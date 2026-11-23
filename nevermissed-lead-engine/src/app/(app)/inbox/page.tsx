import Link from "next/link";
import type { EmailEventType } from "@prisma/client";
import { Inbox as InboxIcon } from "lucide-react";
import { prisma } from "@/lib/db";
import { hasRole, requireUser } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/app/page";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StageBadge, TierBadge } from "@/components/app/badges";
import { ActionButton } from "@/components/app/action-button";
import { markHandled } from "@/app/actions/inbox";
import { setStage } from "@/app/actions/leads";
import { fmtIn } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Inbox" };

const TABS: { key: string; label: string; types: EmailEventType[] }[] = [
  { key: "replies", label: "Replies", types: ["REPLIED"] },
  { key: "bounces", label: "Bounces & unsubscribes", types: ["BOUNCED", "UNSUBSCRIBED", "COMPLAINED"] },
  { key: "engagement", label: "Opens & clicks", types: ["OPENED", "CLICKED"] },
];

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ tab?: string; all?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const tab = TABS.find((t) => t.key === sp.tab) ?? TABS[0];
  const showAll = sp.all === "1" || tab.key !== "replies";
  const events = await prisma.emailEvent.findMany({
    where: { type: { in: tab.types }, ...(showAll ? {} : { handled: false }) },
    include: { lead: true, message: { select: { subject: true, templateKey: true } } },
    orderBy: { occurredAt: "desc" },
    take: 100,
  });
  const caller = hasRole(user, "CALLER");

  return (
    <>
      <PageHeader title="Inbox" description="Replies stop the sequence automatically. Reply from your own mailbox, then move the lead along." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <Link key={t.key} href={`/inbox?tab=${t.key}`} className={cn("rounded-md px-3 py-1.5 text-sm", t.key === tab.key ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted")}>{t.label}</Link>
        ))}
        {tab.key === "replies" ? <Link href={showAll ? "/inbox" : "/inbox?all=1"} className="ml-auto text-sm text-primary hover:underline">{showAll ? "Show unhandled only" : "Show handled too"}</Link> : null}
      </div>
      {events.length === 0 ? (
        <EmptyState icon={InboxIcon} title={tab.key === "replies" ? "No replies waiting" : "Nothing here yet"}>Replies arrive through the inbound webhook or IMAP polling.</EmptyState>
      ) : (
        <div className="space-y-3">
          {events.map((e) => {
            const p = (e.payload ?? {}) as { from?: string; subject?: string; text?: string };
            return (
              <Card key={e.id} className={cn(e.type === "REPLIED" && !e.handled && "border-primary/50")}>
                <CardContent className="space-y-2 pt-4 sm:pt-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {e.lead ? <Link href={`/leads/${e.lead.id}`} className="font-medium hover:underline">{e.lead.name}</Link> : null}
                      {e.lead ? <TierBadge tier={e.lead.currentTier} /> : null}
                      {e.lead ? <StageBadge stage={e.lead.stage} /> : null}
                      {e.type !== "REPLIED" ? <Badge variant={e.type === "OPENED" || e.type === "CLICKED" ? "secondary" : "hot"}>{e.type.toLowerCase()}</Badge> : null}
                    </div>
                    <span className="text-xs text-muted-foreground">{fmtIn(e.occurredAt, user.timezone)}</span>
                  </div>
                  {e.type === "REPLIED" ? (
                    <>
                      <p className="text-xs text-muted-foreground">{p.from} · {p.subject ?? e.message?.subject}</p>
                      <p className="whitespace-pre-wrap text-sm">{p.text}</p>
                      {caller ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {e.lead && !["DEMO_BOOKED", "TRIAL", "CUSTOMER"].includes(e.lead.stage) ? <ActionButton size="sm" action={setStage.bind(null, e.lead.id, "DEMO_BOOKED", undefined)}>Demo booked</ActionButton> : null}
                          {e.lead && e.lead.stage !== "LOST" ? <ActionButton size="sm" variant="outline" action={setStage.bind(null, e.lead.id, "LOST", "Not interested (reply)")}>Not interested</ActionButton> : null}
                          <ActionButton size="sm" variant="ghost" action={markHandled.bind(null, e.id, !e.handled)}>{e.handled ? "Mark unread" : "Mark handled"}</ActionButton>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">{e.message?.subject ?? ""}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
