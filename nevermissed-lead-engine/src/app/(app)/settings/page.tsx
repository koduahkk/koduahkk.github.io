import { AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/db";
import { hasRole, requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { secretStatus } from "@/lib/secrets";
import { appUrl } from "@/lib/utils";
import { imapConfigured } from "@/lib/jobs/imap";
import { PageHeader } from "@/components/app/page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/app/action-button";
import { toggleTerritory, deleteTerritory, updateMember, removeSuppression, updateSender, runSourcingNow, resetTerritoryProgress } from "@/app/actions/settings";
import { areasFor, citiesIn, STATES, STATE_NAMES, territoryLabel } from "@/lib/sourcing/cities";
import { DateTime } from "luxon";
import { coverage, isExhausted, loadAreaCursor, gridKey, setupGaps, tilesFor } from "@/lib/sourcing/plan";
import { Progress } from "@/components/ui/progress";
import { CallingForm, EmailForm, GeneralForm, InviteForm, ScoringForm, SecretForm, SenderForm, SourcingForm, SuppressionForm, TerritoryForm } from "./forms";
import { fmtIn } from "@/lib/format";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "general" } = await searchParams;
  const user = await requireUser();
  const admin = hasRole(user, "ADMIN");
  const [settings, territories, users, suppressions, senders, secrets, runs] = await Promise.all([
    getSettings(),
    prisma.territory.findMany({ orderBy: [{ priority: "desc" }, { name: "asc" }], include: { _count: { select: { leads: true } } } }),
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.suppression.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.senderIdentity.findMany({ orderBy: { createdAt: "asc" } }),
    secretStatus(),
    prisma.sourcingRun.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const sourcingGaps = setupGaps(settings.sourcing, territories.filter((t) => t.active).length);
  const has = (k: string) => !!secrets.find((s) => s.key === k)?.source;
  const twilioReady = has("TWILIO_ACCOUNT_SID") && has("TWILIO_AUTH_TOKEN") && has("TWILIO_CALLER_ID");

  return (
    <>
      <PageHeader title="Settings" description={admin ? "Changes apply to the whole team." : "Read-only. Ask an Admin to change settings."} />
      <div className="mb-4 flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100" role="note">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <strong>Automated calling rules (TCPA and state laws) vary. Confirm with a lawyer before enabling.</strong> Automated mode is currently{" "}
          <strong>{settings.calling.automatedEnabled ? "ON" : "OFF"}</strong>.
        </p>
      </div>
      <Tabs defaultValue={tab}>
        <TabsList>
          {[["general", "General"], ["sourcing", "Salon finding"], ["calling", "Calling"], ["scoring", "Scoring"], ["email", "Email"], ["integrations", "Integrations"], ["team", "Team"], ["compliance", "Compliance"]].map(([t, label]) => (
            <TabsTrigger key={t} value={t}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>General</CardTitle></CardHeader>
            <CardContent><GeneralForm value={settings.general} territories={territories} canEdit={admin} /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sourcing" className="space-y-4">
          <Card>
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Daily salon finding</CardTitle>
                <CardDescription>
                  {settings.sourcing.enabled
                    ? `On. Every day at 6:00 (${settings.general.plannerTimezone}) it adds up to ${settings.sourcing.dailyTarget} new salons from Google Places.`
                    : "Off. Choose your territories, categories and filters below, then switch it on."}
                </CardDescription>
              </div>
              {admin ? (
                <ActionButton variant="outline" disabled={sourcingGaps.length > 0} action={runSourcingNow}>
                  Find salons now
                </ActionButton>
              ) : null}
            </CardHeader>
            <CardContent>
              <SourcingForm value={settings.sourcing} canEdit={admin} gaps={sourcingGaps} placesReady={has("GOOGLE_PLACES_API_KEY")} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Territories</CardTitle>
              <CardDescription>Where to search: a state, with either any city (picked at random each day) or only the cities you choose. Coverage shows how much has been searched for your chosen categories.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {territories.length === 0 ? <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No territories yet. Add a state below.</p> : null}
              {territories.length ? (
                <Table>
                  <THead><TR><TH>Territory</TH><TH className="w-56">Coverage</TH><TH>Leads</TH><TH>Status</TH><TH /></TR></THead>
                  <TBody>
                    {territories.map((t) => {
                      const today = DateTime.now().setZone(settings.general.plannerTimezone).toISODate()!;
                      const areas = areasFor(t, today);
                      const cats = settings.sourcing.categories;
                      const per = areas.map((a) => {
                        const tiles = tilesFor(a.center, a.radiusKm, settings.sourcing.tileKm).length;
                        const cur = loadAreaCursor(t.sourcingCursor, a.key, gridKey(a.center, a.radiusKm, settings.sourcing.tileKm));
                        return { started: Object.keys(cur.cats).length > 0, done: isExhausted(cur, cats), cov: coverage(cur, cats, tiles), tiles };
                      });
                      const anyCity = !t.city;
                      const started = per.filter((x) => x.started).length;
                      const doneCount = per.filter((x) => x.done).length;
                      const cov = anyCity ? (per.length ? per.reduce((a, x) => a + x.cov, 0) / per.length : 0) : per[0]?.cov ?? 0;
                      const done = per.length > 0 && doneCount === per.length;
                      const unknown = !areas.length;
                      return (
                        <TR key={t.id}>
                          <TD>
                            <p className="font-medium">{territoryLabel(t)}</p>
                            <p className="text-xs text-muted-foreground">{unknown ? "City not in the list. Remove and add it again." : anyCity ? `${citiesIn(t.state ?? "").length} cities, picked at random each day` : `${per[0]?.tiles ?? 0} map tiles`}</p>
                          </TD>
                          <TD>
                            <Progress value={cov * 100} label={`${territoryLabel(t)} search coverage`} />
                            <p className="mt-1 text-xs text-muted-foreground">
                              {done ? "Fully searched" : anyCity ? (started ? `${started} cities started, ${doneCount} finished` : "Not searched yet") : per[0]?.started ? `${Math.round(cov * 100)}% searched` : "Not searched yet"}
                            </p>
                          </TD>
                          <TD>{t._count.leads}</TD>
                          <TD>{!t.active ? <Badge variant="secondary">Paused</Badge> : done ? <Badge variant="warning">Fully searched</Badge> : <Badge variant="success">Active</Badge>}</TD>
                          <TD className="space-x-1 whitespace-nowrap text-right">
                            {admin ? <ActionButton variant="ghost" size="sm" action={toggleTerritory.bind(null, t.id, !t.active)}>{t.active ? "Pause" : "Activate"}</ActionButton> : null}
                            {admin && started ? <ActionButton variant="ghost" size="sm" confirm="Start searching this territory from scratch? Salons you already have are skipped, but the searches still count toward your daily budget." action={resetTerritoryProgress.bind(null, t.id)}>Restart search</ActionButton> : null}
                            {admin ? <ActionButton variant="ghost" size="sm" className="text-destructive" confirm={`Remove ${territoryLabel(t)}? Its salons stay in your leads.`} action={deleteTerritory.bind(null, t.id)}>Remove</ActionButton> : null}
                          </TD>
                        </TR>
                      );
                    })}
                  </TBody>
                </Table>
              ) : null}
              {admin ? <TerritoryForm states={STATES.map((code) => ({ code, name: STATE_NAMES[code] }))} /> : null}
              <p className="text-xs text-muted-foreground">City list: <a className="underline" href="https://www.geonames.org" target="_blank" rel="noreferrer">GeoNames</a>, CC BY 4.0.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Recent runs</CardTitle></CardHeader>
            <CardContent>
              {runs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No runs yet.</p>
              ) : (
                <ul className="divide-y">
                  {runs.map((r) => (
                    <li key={r.id} className="py-2.5 text-sm">
                      <p><span className="font-medium">{fmtIn(r.createdAt, user.timezone, "ccc LLL d, h:mma")}</span> · {r.found} new salon{r.found === 1 ? "" : "s"} · {r.requests} search{r.requests === 1 ? "" : "es"} <span className="text-muted-foreground">({r.trigger === "manual" ? "run by hand" : "scheduled"})</span></p>
                      {r.notes.map((n, i) => <p key={i} className="text-xs text-muted-foreground">{n}</p>)}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calling">
          <Card>
            <CardHeader><CardTitle>Call windows &amp; modes</CardTitle></CardHeader>
            <CardContent><CallingForm value={settings.calling} canEdit={admin} twilioReady={twilioReady} /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scoring">
          <Card>
            <CardHeader>
              <CardTitle>Scoring rules</CardTitle>
              <CardDescription>Saving bumps the rules version. Existing scores update the next time a lead is re-evaluated.</CardDescription>
            </CardHeader>
            <CardContent><ScoringForm value={settings.scoring} canEdit={admin} /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Sending</CardTitle></CardHeader>
            <CardContent><EmailForm value={settings.email} canEdit={admin} providers={{ resend: has("RESEND_API_KEY"), sendgrid: has("SENDGRID_API_KEY") }} /></CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Sender identities</CardTitle>
              <CardDescription>Mailboxes on your custom domain. Sends rotate across active mailboxes, each with its own daily limit.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <THead><TR><TH>Name</TH><TH>Email</TH><TH>Daily limit</TH><TH>Status</TH><TH /></TR></THead>
                <TBody>
                  {senders.map((s) => (
                    <TR key={s.id}>
                      <TD className="font-medium">{s.name}</TD>
                      <TD>{s.email}</TD>
                      <TD>{s.dailyLimit}/day</TD>
                      <TD>{s.active ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Paused</Badge>}</TD>
                      <TD className="text-right">{admin ? <ActionButton variant="ghost" size="sm" action={updateSender.bind(null, s.id, { active: !s.active })}>{s.active ? "Pause" : "Activate"}</ActionButton> : null}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              {admin ? <SenderForm defaultLimit={settings.email.defaultDailyLimit} /> : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API keys</CardTitle>
              <CardDescription>Environment variables take precedence. Keys saved here are encrypted with APP_ENCRYPTION_KEY and never sent to the browser.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {secrets.map((s) => (
                <SecretForm key={s.key} k={s.key} label={s.label} source={s.source} canEdit={admin} />
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Webhook URLs</CardTitle><CardDescription>Point your providers at these endpoints.</CardDescription></CardHeader>
            <CardContent className="space-y-2 font-mono text-xs">
              <p>Resend events: {appUrl("/api/webhooks/email/resend")}</p>
              <p>SendGrid events: {appUrl("/api/webhooks/email/sendgrid")}</p>
              <p>Inbound replies: {appUrl("/api/webhooks/email/inbound?token=INBOUND_WEBHOOK_TOKEN")}</p>
              <p>Twilio TwiML App voice URL (browser calling): {appUrl("/api/webhooks/twilio/voice")}</p>
              <p>Inngest: {appUrl("/api/inngest")}</p>
              <p className="font-sans text-sm text-muted-foreground">IMAP reply polling: {imapConfigured() ? "configured" : "not configured (set IMAP_HOST / IMAP_USER / IMAP_PASSWORD)"}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team">
          <Card>
            <CardHeader><CardTitle>Team</CardTitle><CardDescription>Admin: everything. Caller: call queue, outcomes, notes, tasks. Viewer: read-only.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <THead><TR><TH>Name</TH><TH>Email</TH><TH>Role</TH><TH>Time zone</TH><TH>Status</TH><TH /></TR></THead>
                <TBody>
                  {users.map((u) => (
                    <TR key={u.id}>
                      <TD className="font-medium">{u.name ?? "-"}</TD>
                      <TD>{u.email}</TD>
                      <TD className="capitalize">{u.role.toLowerCase()}</TD>
                      <TD>{u.timezone}</TD>
                      <TD>{u.active ? (u.authId || u.email.endsWith(".example") ? <Badge variant="success">Active</Badge> : <Badge variant="warning">Invited</Badge>) : <Badge variant="secondary">Deactivated</Badge>}</TD>
                      <TD className="space-x-1 whitespace-nowrap text-right">
                        {admin && u.id !== user.id ? (
                          <>
                            {(["ADMIN", "CALLER", "VIEWER"] as const).filter((r) => r !== u.role).map((r) => (
                              <ActionButton key={r} variant="ghost" size="sm" action={updateMember.bind(null, u.id, { role: r })}>Make {r.toLowerCase()}</ActionButton>
                            ))}
                            <ActionButton variant="ghost" size="sm" action={updateMember.bind(null, u.id, { active: !u.active })}>{u.active ? "Deactivate" : "Reactivate"}</ActionButton>
                          </>
                        ) : null}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              {admin ? <InviteForm /> : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance">
          <Card>
            <CardHeader>
              <CardTitle>Do-not-call &amp; email suppression</CardTitle>
              <CardDescription>Checked before every call and every email. Unsubscribes, bounces and complaints are added automatically. Unsubscribes can never be removed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasRole(user, "CALLER") ? <SuppressionForm /> : null}
              <Table>
                <THead><TR><TH>Type</TH><TH>Value</TH><TH>Reason</TH><TH>Note</TH><TH>Added</TH><TH /></TR></THead>
                <TBody>
                  {suppressions.length === 0 ? (
                    <TR><TD colSpan={6} className="py-8 text-center text-muted-foreground">Nothing suppressed yet.</TD></TR>
                  ) : (
                    suppressions.map((s) => (
                      <TR key={s.id}>
                        <TD>{s.kind === "PHONE" ? "Phone" : "Email"}</TD>
                        <TD className="font-mono text-xs">{s.value}</TD>
                        <TD><Badge variant={s.reason === "UNSUBSCRIBE" || s.reason === "COMPLAINT" ? "hot" : "secondary"}>{s.reason.replace(/_/g, " ").toLowerCase()}</Badge></TD>
                        <TD className="text-muted-foreground">{s.note ?? ""}</TD>
                        <TD className="whitespace-nowrap">{fmtIn(s.createdAt, user.timezone, "LLL d, yyyy")}</TD>
                        <TD className="text-right">{admin && !["UNSUBSCRIBE", "COMPLAINT"].includes(s.reason) ? <ActionButton variant="ghost" size="sm" confirm="Remove this entry? They can be contacted again." action={removeSuppression.bind(null, s.id)}>Remove</ActionButton> : null}</TD>
                      </TR>
                    ))
                  )}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
