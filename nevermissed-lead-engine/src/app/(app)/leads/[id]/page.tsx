import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, ExternalLink, Globe, MapPin, Phone, RefreshCw, Star } from "lucide-react";
import { prisma } from "@/lib/db";
import { hasRole, requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { isSuppressed } from "@/lib/suppression";
import { formatHours } from "@/lib/places/hours";
import { PLACES_STALE_DAYS } from "@/lib/jobs/places";
import { buildMergeData } from "@/lib/email/merge";
import { instagramDraft, walkInScript } from "@/lib/email/manual";
import type { WeeklyHours } from "@/lib/domain";
import { fmtIn, relative, titleCase } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OutcomeBadge, StageBadge, TierBadge } from "@/components/app/badges";
import { ActionButton } from "@/components/app/action-button";
import { addToDoNotCall, clearStageOverride, createManualTasks, enrichNow, refreshFromGoogle, scheduleTestCalls, setTaskStatus, stopSequence } from "@/app/actions/leads";
import { CopyButton, EnrollForm, LeadEditForm, StageSelect, TaskForm } from "./client";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const lead = await prisma.lead.findUnique({ where: { id: (await params).id }, select: { name: true } });
  return { title: lead?.name ?? "Lead" };
}

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const caller = hasRole(user, "CALLER");
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      calls: { orderBy: { type: "asc" }, include: { caller: { select: { name: true } } } },
      scores: { orderBy: { computedAt: "desc" }, take: 5 },
      emails: { orderBy: { scheduledAt: "asc" }, include: { events: { orderBy: { occurredAt: "asc" } } } },
      enrollments: { include: { sequence: { select: { name: true } } } },
      tasks: { orderBy: [{ status: "asc" }, { dueAt: "asc" }] },
      contacts: true,
      territory: true,
    },
  });
  if (!lead) notFound();
  const [settings, sequences, audits, dnc, emailSup] = await Promise.all([
    getSettings(),
    prisma.sequence.findMany({ where: { active: true }, select: { id: true, name: true } }),
    prisma.auditLog.findMany({ where: { entityId: { in: [id, ...lead.calls.map((c) => c.id)] } }, orderBy: { createdAt: "desc" }, take: 15, include: { user: { select: { name: true } } } }),
    isSuppressed(prisma, "PHONE", lead.phoneE164 ?? lead.phone),
    lead.primaryEmail ? isSuppressed(prisma, "EMAIL", lead.primaryEmail) : null,
  ]);
  const zone = lead.timezone ?? "America/New_York";
  const stale = lead.placeId && (!lead.placesRefreshedAt || Date.now() - lead.placesRefreshedAt.getTime() > PLACES_STALE_DAYS * 86400_000);
  const merge = buildMergeData(lead, lead.calls, { senderName: settings.general.senderName, demoLink: settings.general.demoLink, demoPhone: settings.general.demoPhone, rules: settings.scoring });
  const hasMissed = !!merge.missed_call_1_day;
  const activeEnrollment = lead.enrollments.find((e) => e.status === "ACTIVE");

  return (
    <>
      <Link href="/leads" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Leads</Link>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{lead.name}</h1>
            <TierBadge tier={lead.currentTier} />
            <StageBadge stage={lead.stage} />
            {lead.stageOverridden ? <Badge variant="outline">Manual stage</Badge> : null}
            {!dnc.allowed && dnc.reason === "DO_NOT_CALL" ? <Badge variant="hot">Do not call</Badge> : null}
          </div>
          {lead.scoreReason ? <p className="mt-1 text-sm">{lead.scoreReason}</p> : null}
          {lead.lostReason && lead.stage === "LOST" ? <p className="mt-1 text-sm text-muted-foreground">Lost: {lead.lostReason}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StageSelect id={lead.id} stage={lead.stage} canEdit={caller} />
          {lead.stageOverridden && caller ? <ActionButton variant="ghost" size="sm" action={clearStageOverride.bind(null, lead.id)}>Use automatic stage</ActionButton> : null}
          {caller && lead.calls.length === 0 ? <ActionButton variant="outline" action={scheduleTestCalls.bind(null, lead.id)}>Schedule test calls</ActionButton> : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Test calls</CardTitle>
              <span className="text-xs text-muted-foreground">Salon time ({fmtIn(new Date(), zone, "ZZZZ")})</span>
            </CardHeader>
            <CardContent className="space-y-2">
              {lead.calls.length === 0 ? <p className="text-sm text-muted-foreground">Not tested yet. The daily planner will pick this salon up{lead.stage !== "NEW" ? " if it is moved back to New" : ""}.</p> : null}
              {lead.calls.map((c) => (
                <div key={c.id} className="flex flex-col gap-1 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">Call {c.type} · {c.type === "A" ? "in-hours" : "after-hours"} <span className="font-normal text-muted-foreground">({titleCase(c.mode)})</span></p>
                    <p className="text-xs text-muted-foreground">
                      {c.executedAt ? `Called ${fmtIn(c.executedAt, zone)}` : `Scheduled ${fmtIn(c.scheduledAt, zone)}`}
                      {c.durationSec ? ` · ${c.durationSec}s` : ""}{c.caller?.name ? ` · ${c.caller.name}` : ""}
                    </p>
                    {c.windowLabel ? <p className="text-xs text-muted-foreground">{c.windowLabel}{c.hoursAssumed ? " (hours assumed)" : ""}</p> : null}
                    {c.routedReason ? <p className="text-xs text-amber-700 dark:text-amber-300">{c.routedReason}</p> : null}
                    {c.notes ? <p className="mt-1 text-sm">{c.notes}</p> : null}
                    {c.recordingUrl ? <a className="text-xs text-primary underline" href={c.recordingUrl} target="_blank" rel="noreferrer">Greeting recording</a> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {c.needsReview ? <Badge variant="warning">Needs review</Badge> : null}
                    {c.status === "COMPLETED" ? <OutcomeBadge outcome={c.outcome} /> : <Badge variant="secondary">{titleCase(c.status)}</Badge>}
                    {caller && ((c.status === "SCHEDULED" && c.mode === "HUMAN") || c.needsReview) ? <Button asChild size="sm" variant="outline"><Link href={`/queue?call=${c.id}`}>{c.needsReview ? "Review" : "Call now"}</Link></Button> : null}
                  </div>
                </div>
              ))}
              {lead.scores.length > 1 ? (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Score history</summary>
                  <ul className="mt-1 space-y-0.5">{lead.scores.map((s) => <li key={s.id}>{fmtIn(s.computedAt, user.timezone, "LLL d h:mma")}: {s.tier} ({s.reason})</li>)}</ul>
                </details>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Email outreach</CardTitle>
                <CardDescription>
                  {lead.primaryEmail ? <>To {lead.primaryEmail}{emailSup && !emailSup.allowed ? <Badge variant="hot" className="ml-2">Suppressed: {emailSup.reason.toLowerCase()}</Badge> : null}</> : "No email on file. Use the manual channel below."}
                </CardDescription>
              </div>
              {activeEnrollment && caller ? <ActionButton variant="outline" size="sm" action={stopSequence.bind(null, lead.id)}>Stop sequence</ActionButton> : null}
            </CardHeader>
            <CardContent className="space-y-3">
              {lead.enrollments.map((e) => (
                <p key={e.id} className="text-sm">
                  <strong>{e.sequence.name}</strong> · {titleCase(e.status)}
                  {e.status === "ACTIVE" ? (e.nextSendAt ? ` · step ${e.nextStep} ${fmtIn(e.nextSendAt, user.timezone)}` : ` · step ${e.nextStep} queued`) : e.stopReason ? ` · ${e.stopReason}` : ""}
                </p>
              ))}
              {lead.enrollments.length === 0 && lead.primaryEmail && emailSup?.allowed && caller ? <EnrollForm id={lead.id} sequences={sequences} /> : null}
              {lead.emails.length === 0 ? <p className="text-sm text-muted-foreground">No emails yet.</p> : null}
              {lead.emails.map((m) => (
                <details key={m.id} className="rounded-md border p-3">
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{m.subject}</span>
                    <span className="flex flex-wrap gap-1">
                      <Badge variant={m.status === "SENT" ? "success" : m.status === "QUEUED" ? "secondary" : "hot"}>{titleCase(m.status)}</Badge>
                      {m.openedAt ? <Badge variant="outline">Opened</Badge> : null}
                      {m.clickedAt ? <Badge variant="outline">Clicked</Badge> : null}
                      {m.repliedAt ? <Badge>Replied</Badge> : null}
                    </span>
                  </summary>
                  <p className="mt-1 text-xs text-muted-foreground">{m.sentAt ? `Sent ${fmtIn(m.sentAt, user.timezone)}` : `Scheduled ${fmtIn(m.scheduledAt, user.timezone)}`}{m.error ? ` · ${m.error}` : ""}</p>
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-sm">{m.bodyText}</pre>
                  {m.events.filter((ev) => ev.type === "REPLIED").map((ev) => (
                    <div key={ev.id} className="mt-3 rounded-md bg-primary/5 p-3 text-sm">
                      <p className="text-xs font-medium">Reply · {fmtIn(ev.occurredAt, user.timezone)}</p>
                      <p className="whitespace-pre-wrap">{(ev.payload as { text?: string } | null)?.text}</p>
                    </div>
                  ))}
                </details>
              ))}
            </CardContent>
          </Card>

          {(!lead.primaryEmail || lead.tasks.some((t) => t.type === "INSTAGRAM_DM" || t.type === "WALK_IN")) && hasMissed ? (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <div><CardTitle>Manual channel</CardTitle><CardDescription>Same missed-call proof, for Instagram or a walk-in.</CardDescription></div>
                {caller && !lead.tasks.some((t) => t.status === "OPEN" && (t.type === "WALK_IN" || t.type === "INSTAGRAM_DM")) ? <ActionButton size="sm" variant="outline" action={createManualTasks.bind(null, lead.id)}>Create tasks</ActionButton> : null}
              </CardHeader>
              <CardContent className="space-y-3">
                {lead.instagram ? (
                  <div className="rounded-md border p-3">
                    <div className="mb-2 flex items-center justify-between"><p className="text-sm font-medium">Instagram DM to <a className="text-primary hover:underline" href={`https://instagram.com/${lead.instagram}`} target="_blank" rel="noreferrer">@{lead.instagram}</a></p><CopyButton text={instagramDraft(merge)} /></div>
                    <p className="whitespace-pre-wrap text-sm">{instagramDraft(merge)}</p>
                  </div>
                ) : null}
                <div className="rounded-md border p-3">
                  <div className="mb-2 flex items-center justify-between"><p className="text-sm font-medium">Walk-in script</p><CopyButton text={walkInScript(merge)} /></div>
                  <p className="whitespace-pre-wrap text-sm">{walkInScript(merge)}</p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader><CardTitle>Tasks</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {lead.tasks.length === 0 ? <p className="text-sm text-muted-foreground">No tasks.</p> : null}
              {lead.tasks.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm">
                  <div className="min-w-0">
                    <p className={t.status === "DONE" ? "text-muted-foreground line-through" : "font-medium"}>{t.title}</p>
                    <p className="text-xs text-muted-foreground">{titleCase(t.type)}{t.dueAt ? ` · due ${fmtIn(t.dueAt, user.timezone, "LLL d")}` : ""}</p>
                  </div>
                  {caller ? <ActionButton size="sm" variant="ghost" action={setTaskStatus.bind(null, t.id, t.status === "DONE" ? "OPEN" : "DONE")}>{t.status === "DONE" ? "Reopen" : "Done"}</ActionButton> : null}
                </div>
              ))}
              {caller ? <TaskForm leadId={lead.id} /> : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Salon</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {lead.phone ?? "-"} {lead.lineType ? <Badge variant="outline">{titleCase(lead.lineType)}</Badge> : null}</p>
              <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> {[lead.address, lead.city, lead.state, lead.zip].filter(Boolean).join(", ") || "-"}</p>
              {lead.website ? <p className="flex items-center gap-2"><Globe className="h-4 w-4 text-muted-foreground" /> <a href={lead.website} target="_blank" rel="noreferrer noopener" className="truncate text-primary hover:underline">{lead.website.replace(/^https?:\/\//, "")}</a></p> : null}
              <p className="flex items-center gap-2"><Star className="h-4 w-4 text-muted-foreground" /> {lead.googleRating?.toFixed(1) ?? "-"} ({lead.reviewCount ?? 0} reviews)</p>
              <p className="text-xs text-muted-foreground">{lead.category ? titleCase(lead.category) + " · " : ""}{zone}{lead.territory ? ` · ${lead.territory.name}` : ""} · source {titleCase(lead.source)}</p>
              <div className="border-t pt-2">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Hours {lead.hoursKnown ? "" : <span className="text-amber-700 dark:text-amber-300">(unknown, defaults used)</span>}</p>
                <dl className="grid grid-cols-[3rem_1fr] gap-x-2 text-xs">
                  {formatHours(lead.openingHours as WeeklyHours | null).map((h) => <Fragment key={h.day}><dt className="capitalize text-muted-foreground">{h.day}</dt><dd>{h.text}</dd></Fragment>)}
                </dl>
              </div>
              {lead.placeId ? (
                <div className="flex items-center justify-between gap-2 border-t pt-2 text-xs">
                  <span className={stale ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}>
                    {stale ? <AlertTriangle className="mr-1 inline h-3 w-3" /> : null}Google data refreshed {relative(lead.placesRefreshedAt)}
                  </span>
                  {caller ? <ActionButton size="sm" variant="ghost" action={refreshFromGoogle.bind(null, lead.id)}><RefreshCw /> Refresh</ActionButton> : null}
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-2 border-t pt-2 text-xs">
                <span className="text-muted-foreground">Website enrichment: {titleCase(lead.enrichmentStatus)}{lead.enrichedAt ? ` ${relative(lead.enrichedAt)}` : ""}</span>
                {caller && lead.website ? <ActionButton size="sm" variant="ghost" action={enrichNow.bind(null, lead.id)}>Re-scan</ActionButton> : null}
              </div>
              {lead.contacts.length ? (
                <div className="border-t pt-2 text-xs">
                  <p className="mb-1 font-medium text-muted-foreground">Contacts found</p>
                  {lead.contacts.map((c) => <p key={c.id} className="truncate">{titleCase(c.kind)}: {c.kind === "FACEBOOK" ? <a className="text-primary hover:underline" href={c.value} target="_blank" rel="noreferrer">{c.value.replace(/^https?:\/\/(www\.)?/, "")} <ExternalLink className="inline h-3 w-3" /></a> : c.value}{c.source ? <span className="text-muted-foreground"> ({c.source})</span> : null}</p>)}
                </div>
              ) : null}
              {caller && dnc.allowed ? <div className="border-t pt-2"><ActionButton size="sm" variant="ghost" className="text-destructive" confirm="Add this number to the do-not-call list? Scheduled calls will be cancelled." action={addToDoNotCall.bind(null, lead.id)}>Add to do-not-call</ActionButton></div> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent>
              <LeadEditForm id={lead.id} canEdit={caller} initial={{ ownerFirstName: lead.ownerFirstName ?? "", primaryEmail: lead.primaryEmail ?? "", instagram: lead.instagram ?? "", bookingPlatform: lead.bookingPlatform ?? "", website: lead.website ?? "", notes: lead.notes ?? "" }} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-xs">
              {audits.length === 0 ? <p className="text-muted-foreground">No activity yet.</p> : null}
              {audits.map((a) => <p key={a.id}><span className="text-muted-foreground">{fmtIn(a.createdAt, user.timezone, "LLL d h:mma")}</span> · {a.action.replace(/[._]/g, " ")}{a.user?.name ? ` by ${a.user.name}` : ""}</p>)}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
