"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toastResult } from "@/components/app/action-button";
import { createTask, enroll, setStage, updateLead } from "@/app/actions/leads";
import { BOOKING_PLATFORMS, LEAD_STAGES, STAGE_LABEL, type LeadStage } from "@/lib/domain";

function useAct() {
  const [pending, start] = useTransition();
  const router = useRouter();
  return { pending, act: (fn: () => Promise<Parameters<typeof toastResult>[0]>, after?: () => void) => start(async () => { const r = await fn(); toastResult(r); if (r.ok) { after?.(); router.refresh(); } }) };
}

export function LeadEditForm({ id, initial, canEdit }: { id: string; initial: { ownerFirstName: string; primaryEmail: string; instagram: string; bookingPlatform: string; website: string; notes: string }; canEdit: boolean }) {
  const [v, setV] = useState(initial);
  const { pending, act } = useAct();
  const f = (k: keyof typeof v) => ({ value: v[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value }), disabled: !canEdit });
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act(() => updateLead(id, v)); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="fn">Owner first name</Label><Input id="fn" {...f("ownerFirstName")} placeholder="Falls back to “there”" /></div>
        <div className="space-y-1.5"><Label htmlFor="em">Email</Label><Input id="em" type="email" {...f("primaryEmail")} /></div>
        <div className="space-y-1.5"><Label htmlFor="ig">Instagram</Label><Input id="ig" {...f("instagram")} placeholder="handle" /></div>
        <div className="space-y-1.5">
          <Label htmlFor="bp">Booking platform</Label>
          <Select id="bp" {...f("bookingPlatform")}>
            <option value="">None detected</option>
            {BOOKING_PLATFORMS.map((p) => <option key={p}>{p}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ws">Website</Label><Input id="ws" {...f("website")} /></div>
      </div>
      <div className="space-y-1.5"><Label htmlFor="nt">Notes</Label><Textarea id="nt" rows={4} {...f("notes")} /></div>
      {canEdit ? <div className="flex justify-end"><Button disabled={pending}>{pending ? "Saving…" : "Save"}</Button></div> : null}
    </form>
  );
}

export function StageSelect({ id, stage, canEdit }: { id: string; stage: LeadStage; canEdit: boolean }) {
  const { pending, act } = useAct();
  return (
    <Select
      aria-label="Pipeline stage"
      className="w-44"
      disabled={!canEdit || pending}
      value={stage}
      onChange={(e) => {
        const s = e.target.value;
        const reason = s === "LOST" ? window.prompt("Why was this lead lost?") ?? undefined : undefined;
        act(() => setStage(id, s, reason));
      }}
    >
      {LEAD_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
    </Select>
  );
}

export function EnrollForm({ id, sequences }: { id: string; sequences: { id: string; name: string }[] }) {
  const [seq, setSeq] = useState(sequences[0]?.id ?? "");
  const { pending, act } = useAct();
  if (!sequences.length) return <p className="text-sm text-muted-foreground">No active sequences.</p>;
  return (
    <div className="flex gap-2">
      <Select value={seq} onChange={(e) => setSeq(e.target.value)} aria-label="Sequence">
        {sequences.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </Select>
      <Button variant="outline" disabled={pending} onClick={() => act(() => enroll(id, seq))}>Enroll</Button>
    </div>
  );
}

export function TaskForm({ leadId }: { leadId: string }) {
  const [v, setV] = useState({ type: "FOLLOW_UP" as const, title: "", dueAt: "" });
  const { pending, act } = useAct();
  return (
    <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); act(() => createTask({ leadId, ...v, type: v.type }), () => setV({ ...v, title: "", dueAt: "" })); }}>
      <Input required placeholder="Add a task…" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
      <Input type="date" className="sm:w-40" value={v.dueAt} onChange={(e) => setV({ ...v, dueAt: e.target.value })} aria-label="Due date" />
      <Button variant="outline" disabled={pending}>Add</Button>
    </form>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setOk(true);
        toast.success("Copied");
        setTimeout(() => setOk(false), 1500);
      }}
    >
      {ok ? <Check /> : <Copy />} Copy
    </Button>
  );
}
