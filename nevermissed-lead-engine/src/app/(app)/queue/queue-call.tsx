"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Clock, ExternalLink, Phone, PhoneOff, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CALL_OUTCOMES, OUTCOME_META, type CallOutcome } from "@/lib/domain";
import { logOutcome, preflightCall, releaseCall, skipCall } from "@/app/actions/calls";
import { cn } from "@/lib/utils";
import { BrowserDialer } from "./browser-dialer";

export type QueueItem = {
  id: string;
  type: "A" | "B";
  leadId: string;
  name: string;
  phone: string;
  phoneE164: string | null;
  city: string | null;
  salonLocal: string;
  yourLocal: string;
  dueLabel: string;
  overdue: boolean;
  /** Minutes until the scheduled slot (0 if due). Calling early changes what the test measures. */
  earlyMinutes: number;
  windowLabel: string | null;
  hoursAssumed: boolean;
  website: string | null;
  bookingPlatform: string | null;
  otherCall: string | null;
  needsReview: boolean;
  currentOutcome: CallOutcome | null;
  autoNote: string | null;
};

const toneClass: Record<string, string> = {
  good: "border-emerald-300 hover:bg-emerald-50 dark:border-emerald-900 dark:hover:bg-emerald-950/50",
  meh: "border-amber-300 hover:bg-amber-50 dark:border-amber-900 dark:hover:bg-amber-950/50",
  bad: "border-red-300 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/50",
  dead: "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800",
};

export function QueueCall({ item, script, browserCalling, canLog }: { item: QueueItem; script: string; browserCalling: boolean; canLog: boolean }) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [notes, setNotes] = useState("");
  const [showScript, setShowScript] = useState(true);
  const [pending, start] = useTransition();
  const router = useRouter();
  const notesRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 500);
    return () => clearInterval(t);
  }, [startedAt]);

  // Reset when the queue advances to the next call.
  useEffect(() => {
    setStartedAt(null);
    setElapsed(0);
    setNotes("");
  }, [item.id]);

  const begin = useCallback(async () => {
    const r = await preflightCall(item.id);
    if (!r.ok) {
      toast.error(r.error);
      router.refresh();
      return false;
    }
    setStartedAt(Date.now());
    return true;
  }, [item.id, router]);

  const submit = useCallback(
    (outcome: CallOutcome) => {
      if (!canLog || pending) return;
      start(async () => {
        const r = await logOutcome({ callId: item.id, outcome, notes: notes || undefined, durationSec: startedAt ? Math.floor((Date.now() - startedAt) / 1000) : undefined });
        if (r.ok) {
          toast.success(r.message);
          router.refresh();
        } else toast.error(r.error);
      });
    },
    [canLog, pending, item.id, notes, startedAt, router],
  );

  // Keyboard shortcuts: 1–8 log an outcome, C starts the call, N focuses notes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.tagName === "SELECT" || e.metaKey || e.ctrlKey || e.altKey) return;
      const o = CALL_OUTCOMES.find((x) => OUTCOME_META[x].key === e.key);
      if (o) {
        e.preventDefault();
        submit(o);
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        notesRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit]);

  const mm = String(Math.floor(elapsed / 60)).padStart(1, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={item.type === "A" ? "default" : "secondary"}>{item.type === "A" ? "Call A · in-hours" : "Call B · after-hours"}</Badge>
          <Badge variant={item.overdue ? "hot" : "outline"}>
            <Clock className="h-3 w-3" /> {item.dueLabel}
          </Badge>
          {item.hoursAssumed ? <Badge variant="warning">Hours unknown, defaults used</Badge> : null}
          {item.needsReview ? <Badge variant="warning">Review automated result</Badge> : null}
        </div>
        <h2 className="mt-3 text-2xl font-semibold leading-tight">{item.name}</h2>
        <p className="text-sm text-muted-foreground">
          {item.city} · salon time <strong className="text-foreground">{item.salonLocal}</strong> · you {item.yourLocal}
        </p>
        {item.windowLabel ? <p className="mt-0.5 text-xs text-muted-foreground">Window: {item.windowLabel}</p> : null}
        {item.otherCall ? <p className="mt-0.5 text-xs text-muted-foreground">Other call: {item.otherCall}</p> : null}
        {item.earlyMinutes > 15 ? (
          <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            Not due for {item.earlyMinutes >= 120 ? `${Math.round(item.earlyMinutes / 60)} hours` : `${item.earlyMinutes} minutes`}. {item.type === "B" ? "Calling before the salon closes would test in-hours answering, not after-hours coverage." : "Calling outside the peak window weakens the proof."} Wait for the slot unless you have a reason.
          </p>
        ) : null}
        {item.autoNote ? <p className="mt-2 rounded bg-muted p-2 text-xs">{item.autoNote}{item.currentOutcome ? ` · auto-classified as ${OUTCOME_META[item.currentOutcome].label}` : ""}</p> : null}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          {browserCalling && item.phoneE164 ? (
            <BrowserDialer to={item.phoneE164} onBeforeCall={begin} disabled={!canLog} />
          ) : (
            <Button asChild size="lg" className="h-14 text-lg sm:w-auto" onClick={(e) => { if (!canLog) e.preventDefault(); else void begin(); }}>
              <a href={`tel:${item.phoneE164 ?? item.phone}`}>
                <Phone /> Call {item.phone}
              </a>
            </Button>
          )}
          <div className={cn("flex h-14 items-center justify-center gap-2 rounded-md border px-4 font-mono text-xl tabular-nums", startedAt ? "border-primary text-primary" : "text-muted-foreground")} aria-live="off" aria-label="Call timer">
            <Timer className="h-5 w-5" /> {mm}:{ss}
          </div>
          {!startedAt ? (
            <Button variant="ghost" onClick={() => setStartedAt(Date.now())}>Start timer only</Button>
          ) : (
            <Button variant="ghost" onClick={() => { setStartedAt(null); void releaseCall(item.id); }}>
              <PhoneOff /> Reset
            </Button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          {item.website ? <a className="inline-flex items-center gap-1 text-primary hover:underline" href={item.website} target="_blank" rel="noreferrer noopener">Website <ExternalLink className="h-3 w-3" /></a> : null}
          {item.bookingPlatform ? <span className="text-muted-foreground">Books via {item.bookingPlatform}</span> : null}
          <a className="text-primary hover:underline" href={`/leads/${item.leadId}`}>Lead details</a>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <button className="flex w-full items-center justify-between p-4 text-left text-sm font-medium" onClick={() => setShowScript(!showScript)} aria-expanded={showScript}>
          Script reminder <ChevronDown className={cn("h-4 w-4 transition-transform", showScript && "rotate-180")} />
        </button>
        {showScript ? <p className="whitespace-pre-line px-4 pb-4 text-sm text-muted-foreground">{script}</p> : null}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">What happened? <span className="hidden font-normal text-muted-foreground sm:inline">Press 1–8</span></p>
        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
          {CALL_OUTCOMES.map((o) => {
            const m = OUTCOME_META[o];
            return (
              <button
                key={o}
                disabled={!canLog || pending}
                onClick={() => submit(o)}
                className={cn("flex min-h-14 items-center gap-3 rounded-lg border-2 bg-card px-3 py-2 text-left text-sm font-medium transition-colors disabled:opacity-50", toneClass[m.tone], item.currentOutcome === o && "ring-2 ring-primary")}
              >
                <kbd className="flex h-7 w-7 shrink-0 items-center justify-center rounded border bg-muted font-mono text-xs">{m.key}</kbd>
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="notes" className="text-sm font-medium">Notes <span className="font-normal text-muted-foreground">(press N)</span></label>
        <Textarea id="notes" ref={notesRef} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Who answered, prices quoted, voicemail wording…" />
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" disabled={pending || !canLog} onClick={() => start(async () => { const r = await skipCall(item.id, notes); if (r.ok) { toast.success(r.message); router.refresh(); } else toast.error(r.error); })}>
            Snooze 1 hour
          </Button>
        </div>
      </div>
    </div>
  );
}
