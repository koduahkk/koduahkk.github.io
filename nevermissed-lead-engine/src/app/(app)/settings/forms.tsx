"use client";
/**
 * Settings forms (client). Each section saves independently through the
 * `saveSection` server action, which re-validates with zod.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toastResult } from "@/components/app/action-button";
import { saveSection, saveSecret, addTerritories, getCities, inviteMember, addSuppression, addSender } from "@/app/actions/settings";
import type { AppSettings } from "@/lib/settings";
import { CALL_OUTCOMES, DAYS, OUTCOME_META, SALON_CATEGORIES, type CallOutcome, type Day } from "@/lib/domain";
import { scoreLead } from "@/lib/scoring/engine";
import { cn } from "@/lib/utils";

function useSave() {
  const [pending, start] = useTransition();
  const router = useRouter();
  return {
    pending,
    save: (fn: () => Promise<Parameters<typeof toastResult>[0]>, after?: () => void) =>
      start(async () => {
        const r = await fn();
        toastResult(r);
        if (r.ok) {
          after?.();
          router.refresh();
        }
      }),
  };
}

const Field = ({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) => (
  <div className={cn("space-y-1.5", className)}>
    <Label>{label}</Label>
    {children}
    {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
  </div>
);

const Toggle = ({ label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
  <label className="flex items-start justify-between gap-4 rounded-md border p-3">
    <span>
      <span className="block text-sm font-medium">{label}</span>
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </span>
    <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
  </label>
);

const SaveBar = ({ pending, onClick, disabled }: { pending: boolean; onClick: () => void; disabled?: boolean }) => (
  <div className="flex justify-end border-t pt-4">
    <Button onClick={onClick} disabled={pending || disabled}>
      {pending ? "Saving…" : "Save changes"}
    </Button>
  </div>
);

const num = (v: string) => (v === "" ? 0 : Number(v));

// ─────────────────────────────── General ───────────────────────────────

export function GeneralForm({ value, territories, canEdit }: { value: AppSettings["general"]; territories: { id: string; name: string }[]; canEdit: boolean }) {
  const [v, setV] = useState(value);
  const { pending, save } = useSave();
  const set = <K extends keyof typeof v>(k: K, x: (typeof v)[K]) => setV({ ...v, [k]: x });
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Daily lead quota" hint="Salons the planner puts into testing each morning (2 calls each).">
          <Input type="number" min={1} max={500} value={v.dailyQuota} onChange={(e) => set("dailyQuota", num(e.target.value))} />
        </Field>
        <Field label="Priority territory" hint="Planned first; other territories fill the rest of the quota.">
          <Select value={v.priorityTerritoryId ?? ""} onChange={(e) => set("priorityTerritoryId", e.target.value || null)}>
            <option value="">None</option>
            {territories.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Planner time zone" hint="Defines 'today' for quotas and send limits.">
          <Input value={v.plannerTimezone} onChange={(e) => set("plannerTimezone", e.target.value)} placeholder="America/New_York" />
        </Field>
        <Field label="Business name">
          <Input value={v.businessName} onChange={(e) => set("businessName", e.target.value)} />
        </Field>
        <Field label="Physical business address" hint="Required by CAN-SPAM. Added to every email. Sending is blocked until set." className="sm:col-span-2">
          <Textarea rows={2} value={v.businessAddress} onChange={(e) => set("businessAddress", e.target.value)} placeholder="123 Main St, Suite 100, Atlanta, GA 30303" />
        </Field>
        <Field label="Sender name ({{sender_name}})">
          <Input value={v.senderName} onChange={(e) => set("senderName", e.target.value)} placeholder="Sam from NeverMissed" />
        </Field>
        <Field label="Demo booking link ({{demo_link}})">
          <Input value={v.demoLink} onChange={(e) => set("demoLink", e.target.value)} placeholder="https://cal.com/you/demo" />
        </Field>
        <Field label="Demo phone line ({{demo_phone}})">
          <Input value={v.demoPhone} onChange={(e) => set("demoPhone", e.target.value)} placeholder="(404) 555-0199" />
        </Field>
      </div>
      {canEdit ? <SaveBar pending={pending} onClick={() => save(() => saveSection("general", v))} /> : null}
    </div>
  );
}

// ─────────────────────────────── Calling ───────────────────────────────

function DayPicker({ value, onChange }: { value: Day[]; onChange: (d: Day[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {DAYS.map((d) => {
        const on = value.includes(d);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d])}
            className={cn("h-8 w-10 rounded-md border text-xs font-medium capitalize", on ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground")}
          >
            {d}
          </button>
        );
      })}
    </div>
  );
}

export function CallingForm({ value, canEdit, twilioReady }: { value: AppSettings["calling"]; canEdit: boolean; twilioReady: boolean }) {
  const [v, setV] = useState(value);
  const { pending, save } = useSave();
  const set = <K extends keyof typeof v>(k: K, x: (typeof v)[K]) => setV({ ...v, [k]: x });
  const defDays = DAYS.filter((d) => v.defaultHours[d]?.length);
  const defIv = Object.values(v.defaultHours).find((x) => x?.length)?.[0] ?? { open: "09:00", close: "19:00" };
  const setDefault = (days: Day[], open: string, close: string) => set("defaultHours", Object.fromEntries(days.map((d) => [d, [{ open, close }]])));

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="font-medium">Call A: in-hours peak windows</h3>
        <p className="text-sm text-muted-foreground">Call A lands inside the salon&apos;s open hours AND one of these windows, in the salon&apos;s local time.</p>
        {v.peakWindows.map((w, i) => (
          <div key={i} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-end">
            <Field label="Label">
              <Input value={w.label} onChange={(e) => set("peakWindows", v.peakWindows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            </Field>
            <Field label="Days">
              <DayPicker value={w.days} onChange={(d) => set("peakWindows", v.peakWindows.map((x, j) => (j === i ? { ...x, days: d } : x)))} />
            </Field>
            <Field label="From">
              <Input type="time" value={w.start} onChange={(e) => set("peakWindows", v.peakWindows.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />
            </Field>
            <Field label="To">
              <Input type="time" value={w.end} onChange={(e) => set("peakWindows", v.peakWindows.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} />
            </Field>
            <Button variant="ghost" size="icon" aria-label="Remove window" onClick={() => set("peakWindows", v.peakWindows.filter((_, j) => j !== i))}>
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => set("peakWindows", [...v.peakWindows, { label: "New window", days: ["sat"], start: "10:00", end: "12:00" }])}>
          <Plus /> Add window
        </Button>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Field label="Call B: minutes after close (min)">
          <Input type="number" value={v.afterHoursMinOffsetMin} onChange={(e) => set("afterHoursMinOffsetMin", num(e.target.value))} />
        </Field>
        <Field label="Call B: minutes after close (max)">
          <Input type="number" value={v.afterHoursMaxOffsetMin} onChange={(e) => set("afterHoursMaxOffsetMin", num(e.target.value))} />
        </Field>
        <Field label="Max calls per 15-minute window">
          <Input type="number" min={1} value={v.maxCallsPer15Min} onChange={(e) => set("maxCallsPer15Min", num(e.target.value))} />
        </Field>
        <Field label="Planning horizon (days)">
          <Input type="number" min={1} max={14} value={v.horizonDays} onChange={(e) => set("horizonDays", num(e.target.value))} />
        </Field>
        <Field label="Minimum lead time (minutes)">
          <Input type="number" min={0} value={v.minLeadTimeMin} onChange={(e) => set("minLeadTimeMin", num(e.target.value))} />
        </Field>
        <Field label="Max ring time (automated, seconds)">
          <Input type="number" min={10} max={60} value={v.maxRingSeconds} onChange={(e) => set("maxRingSeconds", num(e.target.value))} />
        </Field>
      </section>
      <Toggle label="Put Call B on a different day than Call A" hint="Two different days make stronger proof in the email." checked={v.separateDays} onChange={(x) => set("separateDays", x)} />

      <section className="space-y-2 rounded-md border p-3">
        <h3 className="text-sm font-medium">Default hours when a salon&apos;s hours are unknown (flagged on the call)</h3>
        <div className="flex flex-wrap items-end gap-3">
          <DayPicker value={defDays} onChange={(d) => setDefault(d, defIv.open, defIv.close)} />
          <Input type="time" className="w-32" value={defIv.open} onChange={(e) => setDefault(defDays, e.target.value, defIv.close)} aria-label="Default open" />
          <Input type="time" className="w-32" value={defIv.close} onChange={(e) => setDefault(defDays, defIv.open, e.target.value)} aria-label="Default close" />
        </div>
      </section>

      <Field label="Caller script reminder (shown in the Call Queue)">
        <Textarea rows={5} value={v.callerScript} onChange={(e) => set("callerScript", e.target.value)} />
      </Field>

      <Toggle label="Twilio browser calling" hint={twilioReady ? "Call from the browser instead of a tel: link." : "Needs Twilio Account SID, Auth Token, Caller ID, API key/secret and TwiML App SID."} checked={v.browserCalling} onChange={(x) => set("browserCalling", x)} disabled={!twilioReady} />

      <section className="space-y-3 rounded-lg border-2 border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
        <div className="flex gap-2 text-sm text-amber-900 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>Automated calling rules (TCPA and state laws) vary. Confirm with a lawyer before enabling.</strong> Automated mode never plays a voice. It checks the do-not-call list and the Twilio line type before every call, and sends mobile numbers to a human caller.
          </p>
        </div>
        <Toggle label="Automated test-call mode" hint={twilioReady ? "Off by default. New plans use automated mode while this is on." : "Configure Twilio first (Integrations)."} checked={v.automatedEnabled} onChange={(x) => set("automatedEnabled", x)} disabled={!twilioReady && !v.automatedEnabled} />
        <Toggle label="Record voicemail greetings for review" hint="Never in all-party-consent states (e.g. CA, FL, IL, PA, WA). Only in the states listed below." checked={v.recordGreetings} onChange={(x) => set("recordGreetings", x)} />
        <Field label="States where recording is allowed (2-letter codes, comma separated)">
          <Input value={v.recordingAllowedStates.join(", ")} onChange={(e) => set("recordingAllowedStates", e.target.value.split(/[,\s]+/).map((s) => s.trim().toUpperCase()).filter((s) => s.length === 2))} placeholder="GA, TX, CO" />
        </Field>
      </section>

      {canEdit ? <SaveBar pending={pending} onClick={() => save(() => saveSection("calling", v))} /> : null}
    </div>
  );
}

// ─────────────────────────────── Scoring ───────────────────────────────

export function ScoringForm({ value, canEdit }: { value: AppSettings["scoring"]; canEdit: boolean }) {
  const [v, setV] = useState(value);
  const { pending, save } = useSave();
  const cols = [
    { key: "inHoursAnswered", label: "Call A: answered (not missed)" },
    { key: "afterHoursCovered", label: "Call B: useful coverage" },
    { key: "basicVoicemail", label: "Counts as basic voicemail" },
    { key: "dead", label: "Makes lead DEAD" },
  ] as const;
  const toggle = (k: (typeof cols)[number]["key"], o: CallOutcome) => setV({ ...v, [k]: v[k].includes(o) ? v[k].filter((x) => x !== o) : [...v[k], o] });
  const at = new Date();
  const preview = (a: CallOutcome, b: CallOutcome) => scoreLead([{ type: "A", outcome: a, executedAt: at }, { type: "B", outcome: b, executedAt: at }], "UTC", v)?.tier ?? "-";
  const tone: Record<string, string> = { HOT: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200", WARM: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200", COLD: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200", DEAD: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" };

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 pr-2">Outcome</th>
              {cols.map((c) => (
                <th key={c.key} className="px-2 py-2 text-center font-medium">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CALL_OUTCOMES.map((o) => (
              <tr key={o} className="border-b">
                <td className="py-2 pr-2">{OUTCOME_META[o].label}</td>
                {cols.map((c) => (
                  <td key={c.key} className="px-2 py-2 text-center">
                    <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={v[c.key].includes(o)} onChange={() => toggle(c.key, o)} aria-label={`${c.label}: ${OUTCOME_META[o].label}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Toggle label="Basic voicemail downgrades HOT to WARM" hint="Spec default: missed both calls but has a basic voicemail → WARM." checked={v.basicVoicemailDowngradesHot} onChange={(x) => setV({ ...v, basicVoicemailDowngradesHot: x })} />

      <section>
        <h3 className="mb-2 text-sm font-medium">Live preview: tier for every Call A × Call B combination</h3>
        <div className="overflow-x-auto">
          <table className="min-w-[720px] text-xs">
            <thead>
              <tr>
                <th className="p-1 text-left text-muted-foreground">A ↓ / B →</th>
                {CALL_OUTCOMES.map((b) => (
                  <th key={b} className="p-1 font-medium text-muted-foreground">
                    {OUTCOME_META[b].short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CALL_OUTCOMES.map((a) => (
                <tr key={a}>
                  <th className="p-1 text-left font-medium text-muted-foreground">{OUTCOME_META[a].short}</th>
                  {CALL_OUTCOMES.map((b) => {
                    const t = preview(a, b);
                    return (
                      <td key={b} className="p-0.5">
                        <span className={cn("block rounded px-1 py-1 text-center font-semibold", tone[t])}>{t}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {canEdit ? <SaveBar pending={pending} onClick={() => save(() => saveSection("scoring", { ...v, version: v.version + 1 }))} /> : null}
    </div>
  );
}

// ─────────────────────────────── Email ───────────────────────────────

export function EmailForm({ value, canEdit, providers }: { value: AppSettings["email"]; canEdit: boolean; providers: Record<string, boolean> }) {
  const [v, setV] = useState(value);
  const { pending, save } = useSave();
  const set = <K extends keyof typeof v>(k: K, x: (typeof v)[K]) => setV({ ...v, [k]: x });
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email provider" hint={v.provider === "console" ? "Console logs emails to the server output. Good for demos." : providers[v.provider] ? "API key configured." : "API key missing (Integrations)."}>
          <Select value={v.provider} onChange={(e) => set("provider", e.target.value as typeof v.provider)}>
            <option value="console">Console (no sending)</option>
            <option value="resend">Resend</option>
            <option value="sendgrid">SendGrid</option>
          </Select>
        </Field>
        <Field label="Default daily limit per mailbox">
          <Input type="number" value={v.defaultDailyLimit} onChange={(e) => set("defaultDailyLimit", num(e.target.value))} />
        </Field>
        <Field label="Min seconds between sends (per mailbox)">
          <Input type="number" value={v.minSpacingSec} onChange={(e) => set("minSpacingSec", num(e.target.value))} />
        </Field>
        <Field label="Max seconds between sends (per mailbox)">
          <Input type="number" value={v.maxSpacingSec} onChange={(e) => set("maxSpacingSec", num(e.target.value))} />
        </Field>
        <Field label="Send window start (lead's local time)">
          <Input type="time" value={v.sendWindowStart} onChange={(e) => set("sendWindowStart", e.target.value)} />
        </Field>
        <Field label="Send window end">
          <Input type="time" value={v.sendWindowEnd} onChange={(e) => set("sendWindowEnd", e.target.value)} />
        </Field>
        <Field label="Send days">
          <DayPicker value={v.sendDays} onChange={(d) => set("sendDays", d)} />
        </Field>
        <Field label="Reply routing domain (optional)" hint="If set, Reply-To becomes reply+TOKEN@domain and the inbound webhook matches replies exactly.">
          <Input value={v.replyDomain} onChange={(e) => set("replyDomain", e.target.value)} placeholder="reply.yourdomain.com" />
        </Field>
      </div>
      <Toggle label="Track opens" hint="Adds a 1×1 pixel. Open data is unreliable (Apple Mail Privacy)." checked={v.trackOpens} onChange={(x) => set("trackOpens", x)} />
      <Toggle label="Track clicks" hint="Links go through a signed redirect." checked={v.trackClicks} onChange={(x) => set("trackClicks", x)} />
      {canEdit ? <SaveBar pending={pending} onClick={() => save(() => saveSection("email", v))} /> : null}
    </div>
  );
}

// ─────────────────────── Small inline forms ───────────────────────

export function SecretForm({ k, label, source, canEdit }: { k: string; label: string; source: "env" | "database" | null; canEdit: boolean }) {
  const [val, setVal] = useState("");
  const { pending, save } = useSave();
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="font-mono text-xs text-muted-foreground">
          {k} · {source === "env" ? "set via environment variable" : source === "database" ? "stored encrypted" : "not configured"}
        </p>
      </div>
      {canEdit && source !== "env" ? (
        <div className="flex gap-2">
          <Input type="password" autoComplete="off" value={val} onChange={(e) => setVal(e.target.value)} placeholder={source ? "••••••••" : "Paste key"} className="sm:w-56" />
          <Button variant="outline" disabled={pending || !val} onClick={() => save(() => saveSecret(k, val), () => setVal(""))}>
            Save
          </Button>
          {source === "database" ? (
            <Button variant="ghost" size="icon" aria-label="Remove key" disabled={pending} onClick={() => save(() => saveSecret(k, ""))}>
              <Trash2 />
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function TerritoryForm({ states }: { states: { code: string; name: string }[] }) {
  const [state, setState] = useState("");
  const [mode, setMode] = useState<"any" | "cities">("any");
  const [cities, setCities] = useState<{ name: string; population: number }[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const { pending, save } = useSave();

  async function chooseState(code: string) {
    setState(code);
    setPicked([]);
    setQ("");
    setCities([]);
    if (!code) return;
    setLoading(true);
    try {
      setCities(await getCities(code));
    } finally {
      setLoading(false);
    }
  }
  const shown = cities.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (n: string) => setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));
  const canAdd = !!state && (mode === "any" || picked.length > 0);

  return (
    <form
      className="space-y-3 rounded-md border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        save(() => addTerritories({ state, mode, cities: picked }), () => { setPicked([]); setQ(""); });
      }}
    >
      <p className="text-sm font-medium">Add a territory</p>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:items-start">
        <Field label="State">
          <Select value={state} onChange={(e) => chooseState(e.target.value)} aria-label="State">
            <option value="">Choose a state</option>
            {states.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </Select>
        </Field>
        <div className="space-y-2">
          <Label>Cities</Label>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="radio" name="tmode" checked={mode === "any"} onChange={() => setMode("any")} /> Any city (random each day)</label>
            <label className="flex items-center gap-2"><input type="radio" name="tmode" checked={mode === "cities"} onChange={() => setMode("cities")} /> Only these cities</label>
          </div>
          {mode === "any" ? (
            <p className="text-xs text-muted-foreground">{state ? `Each day it picks cities in ${states.find((s) => s.code === state)?.name} at random${cities.length ? ` from ${cities.length} cities` : ""}, and remembers how far it got in each.` : "Choose a state first."}</p>
          ) : !state ? (
            <p className="text-xs text-muted-foreground">Choose a state first.</p>
          ) : (
            <div className="space-y-2">
              <Input placeholder="Search cities" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search cities" />
              <div className="max-h-56 overflow-y-auto rounded-md border p-2">
                {loading ? <p className="p-2 text-sm text-muted-foreground">Loading cities…</p> : null}
                {!loading && !shown.length ? <p className="p-2 text-sm text-muted-foreground">No city matches “{q}”.</p> : null}
                <div className="grid gap-1 sm:grid-cols-2">
                  {shown.map((c) => (
                    <label key={c.name} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted">
                      <input type="checkbox" checked={picked.includes(c.name)} onChange={() => toggle(c.name)} />
                      <span className="flex-1">{c.name}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">{c.population.toLocaleString()}</span>
                    </label>
                  ))}
                </div>
              </div>
              {picked.length ? <p className="text-xs text-muted-foreground">{picked.length} selected: {picked.slice(0, 6).join(", ")}{picked.length > 6 ? "…" : ""}</p> : null}
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-end">
        <Button disabled={pending || !canAdd}><Plus /> {mode === "cities" && picked.length > 1 ? `Add ${picked.length} cities` : "Add territory"}</Button>
      </div>
    </form>
  );
}

export function InviteForm() {
  const [v, setV] = useState({ email: "", name: "", role: "CALLER" as "ADMIN" | "CALLER" | "VIEWER", timezone: "America/New_York" });
  const { pending, save } = useSave();
  return (
    <form className="grid gap-2 sm:grid-cols-[2fr_1.5fr_1fr_1.5fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); save(() => inviteMember(v), () => setV({ ...v, email: "", name: "" })); }}>
      <Field label="Email"><Input type="email" required value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
      <Field label="Name"><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
      <Field label="Role">
        <Select value={v.role} onChange={(e) => setV({ ...v, role: e.target.value as typeof v.role })}>
          <option value="ADMIN">Admin</option><option value="CALLER">Caller</option><option value="VIEWER">Viewer</option>
        </Select>
      </Field>
      <Field label="Time zone"><Input value={v.timezone} onChange={(e) => setV({ ...v, timezone: e.target.value })} /></Field>
      <Button disabled={pending}><Plus /> Invite</Button>
    </form>
  );
}

export function SuppressionForm() {
  const [v, setV] = useState({ kind: "PHONE" as "PHONE" | "EMAIL", value: "", note: "" });
  const { pending, save } = useSave();
  return (
    <form className="grid gap-2 sm:grid-cols-[1fr_2fr_2fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); save(() => addSuppression(v.kind, v.value, v.note), () => setV({ ...v, value: "", note: "" })); }}>
      <Field label="Type">
        <Select value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value as "PHONE" | "EMAIL" })}>
          <option value="PHONE">Phone (do not call)</option><option value="EMAIL">Email or @domain</option>
        </Select>
      </Field>
      <Field label="Value"><Input required value={v.value} onChange={(e) => setV({ ...v, value: e.target.value })} placeholder={v.kind === "PHONE" ? "(404) 555-0123" : "owner@salon.com or @salon.com"} /></Field>
      <Field label="Note"><Input value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} /></Field>
      <Button disabled={pending}><Plus /> Add</Button>
    </form>
  );
}

export function SenderForm({ defaultLimit }: { defaultLimit: number }) {
  const [v, setV] = useState({ name: "", email: "", replyTo: "", dailyLimit: defaultLimit });
  const { pending, save } = useSave();
  return (
    <form className="grid gap-2 sm:grid-cols-[1.5fr_2fr_2fr_1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); save(() => addSender(v), () => setV({ ...v, name: "", email: "", replyTo: "" })); }}>
      <Field label="From name"><Input required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
      <Field label="From email (custom domain)"><Input type="email" required value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
      <Field label="Reply-to (optional)"><Input type="email" value={v.replyTo} onChange={(e) => setV({ ...v, replyTo: e.target.value })} /></Field>
      <Field label="Daily limit"><Input type="number" value={v.dailyLimit} onChange={(e) => setV({ ...v, dailyLimit: num(e.target.value) })} /></Field>
      <Button disabled={pending}><Plus /> Add</Button>
    </form>
  );
}

// ─────────────────────────────── Salon finding ───────────────────────────────

export function SourcingForm({ value, canEdit, gaps, placesReady }: { value: AppSettings["sourcing"]; canEdit: boolean; gaps: string[]; placesReady: boolean }) {
  const [v, setV] = useState(value);
  const [chains, setChains] = useState(value.chainNames.join("\n"));
  const { pending, save } = useSave();
  const set = <K extends keyof typeof v>(k: K, x: (typeof v)[K]) => setV({ ...v, [k]: x });
  const catGaps = v.categories.length ? [] : ["Choose at least one salon category."];
  const blocking = [...gaps.filter((g) => !g.includes("category")), ...catGaps];
  const optNum = (s: string) => (s.trim() === "" ? null : Number(s));
  const payload = () => ({ ...v, chainNames: chains.split("\n").map((c) => c.trim()).filter((c) => c.length >= 2) });

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="font-medium">1. What to look for</h3>
        <p className="text-sm text-muted-foreground">Each category is searched separately across every territory.</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {SALON_CATEGORIES.map((c) => (
            <label key={c.value} className="flex items-center gap-2 rounded-md border p-3 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={v.categories.includes(c.value)}
                disabled={!canEdit}
                onChange={() => set("categories", v.categories.includes(c.value) ? v.categories.filter((x) => x !== c.value) : [...v.categories, c.value])}
              />
              {c.label}
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-medium">2. Filters</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Minimum Google rating" hint="Leave empty for no minimum.">
            <Input type="number" step="0.1" min={0} max={5} value={v.minRating ?? ""} disabled={!canEdit} onChange={(e) => set("minRating", optNum(e.target.value))} placeholder="e.g. 4.0" />
          </Field>
          <Field label="Minimum number of reviews" hint="Leave empty for no minimum.">
            <Input type="number" min={0} value={v.minReviews ?? ""} disabled={!canEdit} onChange={(e) => set("minReviews", optNum(e.target.value))} placeholder="e.g. 20" />
          </Field>
        </div>
        <Toggle label="Skip big chains" hint="Chains usually route calls to a corporate line, so the test proves nothing." checked={v.excludeChains} onChange={(x) => set("excludeChains", x)} disabled={!canEdit} />
        {v.excludeChains ? (
          <Field label="Chain names to skip (one per line)" hint="Matched as whole words in the salon's name, ignoring case.">
            <Textarea rows={6} value={chains} disabled={!canEdit} onChange={(e) => setChains(e.target.value)} />
          </Field>
        ) : null}
      </section>

      <section className="space-y-3">
        <h3 className="font-medium">3. How many</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="New salons per day">
            <Input type="number" min={1} max={500} value={v.dailyTarget} disabled={!canEdit} onChange={(e) => set("dailyTarget", num(e.target.value))} />
          </Field>
          <Field label="Max Google searches per day" hint="A hard cap on cost. One search returns up to 20 places.">
            <Input type="number" min={1} max={1000} value={v.maxRequestsPerDay} disabled={!canEdit} onChange={(e) => set("maxRequestsPerDay", num(e.target.value))} />
          </Field>
          <Field label="Search tile size (km)" hint="Smaller tiles find more salons in dense cities. Changing it restarts search progress.">
            <Input type="number" step="0.5" min={0.5} max={10} value={v.tileKm} disabled={!canEdit} onChange={(e) => set("tileKm", Number(e.target.value) || 3)} />
          </Field>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-medium">4. Switch it on</h3>
        {blocking.length ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="font-medium">Before it can run:</p>
            <ul className="ml-5 list-disc">{blocking.map((g) => <li key={g}>{g}</li>)}</ul>
          </div>
        ) : null}
        {!placesReady ? <p className="text-sm text-amber-700 dark:text-amber-300">Add a Google Places API key in Integrations, or the run will stop at its first search.</p> : null}
        <Toggle
          label="Find new salons every morning at 6:00"
          hint="Runs before the 7:00 call planner, so today's 50 are ready to plan."
          checked={v.enabled}
          disabled={!canEdit || (blocking.length > 0 && !v.enabled)}
          onChange={(x) => set("enabled", x)}
        />
      </section>

      {canEdit ? <SaveBar pending={pending} onClick={() => save(() => saveSection("sourcing", payload()))} /> : null}
    </div>
  );
}
