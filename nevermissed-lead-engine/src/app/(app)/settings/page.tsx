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
import { toggleTerritory, updateMember, removeSuppression, updateSender } from "@/app/actions/settings";
import { CallingForm, EmailForm, GeneralForm, InviteForm, ScoringForm, SecretForm, SenderForm, SuppressionForm, TerritoryForm } from "./forms";
import { fmtIn } from "@/lib/format";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "general" } = await searchParams;
  const user = await requireUser();
  const admin = hasRole(user, "ADMIN");
  const [settings, territories, users, suppressions, senders, secrets] = await Promise.all([
    getSettings(),
    prisma.territory.findMany({ orderBy: [{ priority: "desc" }, { name: "asc" }], include: { _count: { select: { leads: true } } } }),
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.suppression.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.senderIdentity.findMany({ orderBy: { createdAt: "asc" } }),
    secretStatus(),
  ]);
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
          {["general", "calling", "scoring", "email", "integrations", "team", "compliance"].map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">
              {t}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>General</CardTitle></CardHeader>
            <CardContent><GeneralForm value={settings.general} territories={territories} canEdit={admin} /></CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Territories</CardTitle>
              <CardDescription>Higher priority is planned first.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <THead><TR><TH>Name</TH><TH>Area</TH><TH>Priority</TH><TH>Leads</TH><TH>Status</TH><TH /></TR></THead>
                <TBody>
                  {territories.map((t) => (
                    <TR key={t.id}>
                      <TD className="font-medium">{t.name}</TD>
                      <TD>{[t.city, t.state, t.zip].filter(Boolean).join(", ")}{t.radiusMeters ? ` · ${t.radiusMeters / 1000} km` : ""}</TD>
                      <TD>{t.priority}</TD>
                      <TD>{t._count.leads}</TD>
                      <TD>{t.active ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Paused</Badge>}</TD>
                      <TD className="text-right">{admin ? <ActionButton variant="ghost" size="sm" action={toggleTerritory.bind(null, t.id, !t.active)}>{t.active ? "Pause" : "Activate"}</ActionButton> : null}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              {admin ? <TerritoryForm /> : null}
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
