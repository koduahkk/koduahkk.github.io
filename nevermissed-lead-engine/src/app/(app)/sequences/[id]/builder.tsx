"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toastResult } from "@/components/app/action-button";
import { saveSequence, deleteSequence, type SequenceInput } from "@/app/actions/sequences";
import { MERGE_FIELDS, renderTemplate, missingFields, type MergeData } from "@/lib/email/merge";

type Step = SequenceInput["steps"][number];

export function SequenceBuilder({ id, initial, samples, canEdit, footer }: { id: string; initial: SequenceInput; samples: { id: string; name: string; data: MergeData }[]; canEdit: boolean; footer: string }) {
  const [v, setV] = useState(initial);
  const [sel, setSel] = useState(0);
  const [sample, setSample] = useState(samples[0]?.id ?? "");
  const [pending, start] = useTransition();
  const router = useRouter();
  const step = v.steps[sel];
  const data = samples.find((s) => s.id === sample)?.data ?? ({} as MergeData);
  const setStep = (patch: Partial<Step>) => setV({ ...v, steps: v.steps.map((s, i) => (i === sel ? { ...s, ...patch } : s)) });
  const preview = useMemo(() => step && { subject: renderTemplate(step.subject, data), body: renderTemplate(step.body, data), missing: missingFields(step.subject + step.body, data) }, [step, data]);
  const move = (dir: -1 | 1) => {
    const j = sel + dir;
    if (j < 0 || j >= v.steps.length) return;
    const steps = [...v.steps];
    [steps[sel], steps[j]] = [steps[j], steps[sel]];
    const days = steps.map((s) => s.dayOffset).sort((a, b) => Number(a) - Number(b));
    setV({ ...v, steps: steps.map((s, i) => ({ ...s, dayOffset: days[i] })) });
    setSel(j);
  };
  const insertField = (f: string) => setStep({ body: `${step.body}{{${f}}}` });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-4 pt-4 sm:grid-cols-2 sm:pt-5">
          <div className="space-y-1.5"><Label htmlFor="sn">Name</Label><Input id="sn" value={v.name} disabled={!canEdit} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="sd">Description</Label><Input id="sd" value={v.description ?? ""} disabled={!canEdit} onChange={(e) => setV({ ...v, description: e.target.value })} /></div>
          <div className="flex flex-wrap items-center gap-6 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm"><Switch checked={v.active} disabled={!canEdit} onCheckedChange={(x) => setV({ ...v, active: x })} /> Active</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={v.stopOnReply} disabled={!canEdit} onCheckedChange={(x) => setV({ ...v, stopOnReply: x })} /> Stop on reply</label>
            <span className="text-sm text-muted-foreground">Auto-enroll:</span>
            {(["HOT", "WARM", "COLD"] as const).map((t) => (
              <label key={t} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" className="h-4 w-4" disabled={!canEdit} checked={v.autoEnrollTiers.includes(t)} onChange={() => setV({ ...v, autoEnrollTiers: v.autoEnrollTiers.includes(t) ? v.autoEnrollTiers.filter((x) => x !== t) : [...v.autoEnrollTiers, t] })} />
                {t[0] + t.slice(1).toLowerCase()}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-2">
          {v.steps.map((s, i) => (
            <button key={s.id ?? i} onClick={() => setSel(i)} className={`w-full rounded-md border p-3 text-left text-sm ${i === sel ? "border-primary bg-primary/5" : "bg-card"}`}>
              <span className="block text-xs text-muted-foreground">Step {i + 1} · Day {s.dayOffset}</span>
              <span className="font-medium">{s.name}</span>
            </button>
          ))}
          {canEdit ? (
            <Button variant="outline" className="w-full" onClick={() => { const last = v.steps[v.steps.length - 1]; setV({ ...v, steps: [...v.steps, { name: "New step", dayOffset: Number(last?.dayOffset ?? 0) + 3, subject: "Re: {{salon_name}}", body: "Hi {{owner_first_name}},\n\n\n\n{{sender_name}}", templateKey: `step_${Date.now().toString(36)}` }] }); setSel(v.steps.length); }}>
              <Plus /> Add step
            </Button>
          ) : null}
        </div>

        {step ? (
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-2 sm:pb-2">
              <CardTitle className="text-base">Edit step {sel + 1}</CardTitle>
              {canEdit ? (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" aria-label="Move up" onClick={() => move(-1)}><ArrowUp /></Button>
                  <Button variant="ghost" size="icon" aria-label="Move down" onClick={() => move(1)}><ArrowDown /></Button>
                  <Button variant="ghost" size="icon" aria-label="Delete step" disabled={v.steps.length === 1} onClick={() => { setV({ ...v, steps: v.steps.filter((_, i) => i !== sel) }); setSel(Math.max(0, sel - 1)); }}><Trash2 /></Button>
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-[1fr_90px] gap-2">
                <div className="space-y-1.5"><Label>Step name</Label><Input value={step.name} disabled={!canEdit} onChange={(e) => setStep({ name: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Day</Label><Input type="number" min={0} value={step.dayOffset} disabled={!canEdit} onChange={(e) => setStep({ dayOffset: Number(e.target.value) })} /></div>
              </div>
              <div className="space-y-1.5"><Label>Subject</Label><Input value={step.subject} disabled={!canEdit} onChange={(e) => setStep({ subject: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Body (plain text)</Label><Textarea rows={16} className="font-mono text-xs" value={step.body} disabled={!canEdit} onChange={(e) => setStep({ body: e.target.value })} /></div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Insert a merge field. Use {"{{field|fallback}}"} for a fallback, or {"{{#field}}…{{/field}}"} to show text only when the field has a value.</p>
                <div className="flex flex-wrap gap-1">
                  {MERGE_FIELDS.map((f) => <button key={f} type="button" disabled={!canEdit} onClick={() => insertField(f)} className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px] hover:bg-accent">{f}</button>)}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {preview ? (
          <Card>
            <CardHeader className="pb-2 sm:pb-2">
              <CardTitle className="text-base">Preview</CardTitle>
              <Select value={sample} onChange={(e) => setSample(e.target.value)} aria-label="Preview with lead">
                {samples.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </CardHeader>
            <CardContent className="space-y-2">
              {preview.missing.length ? <p className="rounded bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Empty for this lead: {preview.missing.join(", ")}</p> : null}
              <p className="text-sm font-semibold">{preview.subject}</p>
              <pre className="whitespace-pre-wrap font-sans text-sm">{preview.body}</pre>
              <pre className="whitespace-pre-wrap border-t pt-2 font-sans text-xs text-muted-foreground">{footer}</pre>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {canEdit ? (
        <div className="flex justify-between border-t pt-4">
          <Button variant="ghost" className="text-destructive" disabled={pending} onClick={() => { if (confirm("Delete this sequence?")) start(async () => { const r = await deleteSequence(id); toastResult(r); if (r.ok) router.push("/sequences"); }); }}>Delete</Button>
          <Button disabled={pending} onClick={() => start(async () => { const r = await saveSequence(id, v); toastResult(r); if (r.ok) router.refresh(); })}>{pending ? "Saving…" : "Save sequence"}</Button>
        </div>
      ) : null}
    </div>
  );
}
