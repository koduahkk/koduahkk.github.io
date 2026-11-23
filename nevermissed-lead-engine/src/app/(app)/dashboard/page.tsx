import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { dashboardData, type Range } from "@/lib/dashboard";
import { PageHeader, Stat } from "@/components/app/page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { BarList } from "@/components/app/bar-list";
import { cn, pct } from "@/lib/utils";

export const metadata = { title: "Dashboard" };
const RANGES: { key: Range; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "all", label: "All time" },
];

function GroupTable({ rows, first }: { rows: Awaited<ReturnType<typeof dashboardData>>["byCity"]; first: string }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">No tested salons in this range.</p>;
  return (
    <Table>
      <THead><TR><TH>{first}</TH><TH className="text-right">Tested</TH><TH className="text-right">Hot</TH><TH className="text-right">Warm</TH><TH className="text-right">Replied <span className="normal-case">(of emailed)</span></TH><TH className="text-right">Customers</TH></TR></THead>
      <TBody>
        {rows.map((r) => (
          <TR key={r.name}>
            <TD className="font-medium">{r.name}</TD>
            <TD className="text-right tabular-nums">{r.tested}</TD>
            <TD className="whitespace-nowrap text-right tabular-nums">{r.hot} <span className="text-xs text-muted-foreground">({pct(r.hot, r.tested)}%)</span></TD>
            <TD className="text-right tabular-nums">{r.warm}</TD>
            <TD className="whitespace-nowrap text-right tabular-nums">{r.replied} <span className="text-xs text-muted-foreground">({pct(r.replied, r.emailed)}%)</span></TD>
            <TD className="text-right tabular-nums">{r.customers}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ range?: string; denied?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const range = (RANGES.find((r) => r.key === sp.range)?.key ?? "30d") as Range;
  const d = await dashboardData(range, user.timezone);
  const f = d.funnel;

  return (
    <>
      <PageHeader
        title={`Hi ${user.name?.split(" ")[0] ?? "there"}`}
        description="Funnel shows salons first tested in the selected range, followed through every stage."
        actions={
          <div className="flex rounded-md border bg-card p-0.5" role="group" aria-label="Date range">
            {RANGES.map((r) => (
              <Link key={r.key} href={`/dashboard?range=${r.key}`} className={cn("rounded px-3 py-1.5 text-sm", r.key === range ? "bg-muted font-medium" : "text-muted-foreground")}>{r.label}</Link>
            ))}
          </div>
        }
      />
      {sp.denied ? <p className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">You don&apos;t have access to that page.</p> : null}

      <Card className="mb-4">
        <CardContent className="grid gap-4 pt-4 sm:grid-cols-[1fr_auto] sm:items-center sm:pt-5">
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium">Today&apos;s progress</p>
              <p className="text-sm tabular-nums"><strong className="text-xl">{d.today.tested}</strong> of {d.today.quota} salons tested</p>
            </div>
            <Progress value={(d.today.tested / d.today.quota) * 100} label="Salons tested today" />
            <p className="mt-2 text-xs text-muted-foreground">{d.today.callsDone} of {d.today.callsTotal} calls scheduled today are done.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/queue" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Start calling</Link>
            <Link href="/inbox" className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent">{d.unreadReplies} new replies</Link>
          </div>
        </CardContent>
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Tested" value={f[1].value} hint={`${d.tiers.dead} dead numbers`} />
        <Stat label="Hot" value={d.tiers.hot} hint={`${pct(d.tiers.hot, d.tiers.scored)}% of scored`} />
        <Stat label="Warm" value={d.tiers.warm} hint={`${pct(d.tiers.warm, d.tiers.scored)}% of scored`} />
        <Stat label="Reply rate" value={`${pct(f[4].value, f[3].value)}%`} hint={`${f[4].value} of ${f[3].value} emailed`} />
        <Stat label="Open tasks" value={d.openTasks} hint="DMs, walk-ins, follow-ups" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Funnel</CardTitle><CardDescription>Conversion from the previous step in brackets.</CardDescription></CardHeader>
          <CardContent>
            <BarList
              ariaLabel="Sales funnel"
              rows={f.map((s, i) => ({
                label: s.label,
                value: s.value,
                display: i <= 1 ? String(s.value) : `${s.value} (${pct(s.value, f[i - 1].value)}%)`,
                detail: i === 0 ? `${s.value} new salons imported` : i === 1 ? `${s.value} salons with a first test call in range` : `${s.value} of ${f[i - 1].value} from "${f[i - 1].label}" (${pct(s.value, f[i - 1].value)}%)`,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Reply rate by template</CardTitle><CardDescription>Emails sent in range.</CardDescription></CardHeader>
          <CardContent>
            {d.templates.length ? (
              <BarList ariaLabel="Reply rate by template" max={1} rows={d.templates.map((t) => ({ label: t.label, value: t.rate, display: `${Math.round(t.rate * 100)}%`, detail: `${t.replied} replies / ${t.sent} sent · ${t.opened} opened · ${t.clicked} clicked` }))} />
            ) : <p className="py-6 text-center text-sm text-muted-foreground">No emails sent in this range.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Best call windows</CardTitle>
            <CardDescription>Share of in-hours calls (Call A) that went unanswered, by salon-local time. After-hours: {pct(d.afterHours.missed, d.afterHours.total)}% had no coverage ({d.afterHours.missed}/{d.afterHours.total}).</CardDescription>
          </CardHeader>
          <CardContent>
            {d.callWindows.length ? (
              <BarList ariaLabel="Miss rate by call window" max={1} rows={d.callWindows.slice(0, 10).map((w) => ({ label: w.label, value: w.rate, display: `${Math.round(w.rate * 100)}%`, detail: `${w.missed} missed of ${w.total} calls` }))} />
            ) : <p className="py-6 text-center text-sm text-muted-foreground">No completed calls yet.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Score mix</CardTitle><CardDescription>Tested salons in range by tier.</CardDescription></CardHeader>
          <CardContent>
            <BarList ariaLabel="Score mix" rows={[
              { label: "Hot", value: d.tiers.hot, detail: "Missed in-hours, no after-hours coverage" },
              { label: "Warm", value: d.tiers.warm, detail: "Missed one call, or both with a basic voicemail" },
              { label: "Cold", value: d.tiers.cold, detail: "Answered and covered after hours" },
              { label: "Dead", value: d.tiers.dead, detail: "Disconnected / wrong number" },
            ]} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Results by city</CardTitle></CardHeader>
          <CardContent><GroupTable rows={d.byCity} first="City" /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Results by booking platform</CardTitle></CardHeader>
          <CardContent><GroupTable rows={d.byPlatform} first="Platform" /></CardContent>
        </Card>
      </div>
    </>
  );
}
