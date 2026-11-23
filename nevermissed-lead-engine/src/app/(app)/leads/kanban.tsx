"use client";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Mail, AtSign } from "lucide-react";
import { TierBadge } from "@/components/app/badges";
import { setStage } from "@/app/actions/leads";
import { LEAD_STAGES, STAGE_LABEL, type LeadStage, type ScoreTier } from "@/lib/domain";
import { cn } from "@/lib/utils";

export type KanbanLead = { id: string; name: string; city: string | null; stage: LeadStage; tier: ScoreTier | null; reason: string | null; hasEmail: boolean; instagram: string | null };

/** Drag a card between columns (desktop) or use the stage menu on the card (phone). */
export function Kanban({ leads, canEdit }: { leads: KanbanLead[]; canEdit: boolean }) {
  const [, start] = useTransition();
  const [items, move] = useOptimistic(leads, (state, { id, stage }: { id: string; stage: LeadStage }) => state.map((l) => (l.id === id ? { ...l, stage } : l)));

  const moveTo = (id: string, stage: LeadStage) =>
    start(async () => {
      move({ id, stage });
      const r = await setStage(id, stage);
      if (r.ok) toast.success(r.message);
      else toast.error(r.error);
    });

  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
      {LEAD_STAGES.map((stage) => {
        const col = items.filter((l) => l.stage === stage);
        return (
          <section
            key={stage}
            aria-label={STAGE_LABEL[stage]}
            className="flex w-64 shrink-0 snap-start flex-col rounded-lg bg-muted/60 p-2"
            onDragOver={(e) => canEdit && e.preventDefault()}
            onDrop={(e) => {
              const id = e.dataTransfer.getData("text/lead");
              if (id && canEdit) moveTo(id, stage);
            }}
          >
            <header className="mb-2 flex items-center justify-between px-1 text-sm font-medium">
              {STAGE_LABEL[stage]} <span className="text-xs text-muted-foreground">{col.length}</span>
            </header>
            <div className="flex min-h-16 flex-col gap-2">
              {col.map((l) => (
                <article
                  key={l.id}
                  draggable={canEdit}
                  onDragStart={(e) => e.dataTransfer.setData("text/lead", l.id)}
                  className={cn("rounded-md border bg-card p-2.5 text-sm shadow-sm", canEdit && "cursor-grab active:cursor-grabbing")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/leads/${l.id}`} className="font-medium hover:underline">
                      {l.name}
                    </Link>
                    <TierBadge tier={l.tier} />
                  </div>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    {l.city}
                    {l.hasEmail ? <Mail className="h-3 w-3" aria-label="Has email" /> : null}
                    {l.instagram ? <AtSign className="h-3 w-3" aria-label="Has Instagram" /> : null}
                  </p>
                  {l.reason ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{l.reason}</p> : null}
                  {canEdit ? (
                    <select aria-label={`Move ${l.name}`} className="mt-2 w-full rounded border bg-card px-1 py-1 text-xs" value={l.stage} onChange={(e) => moveTo(l.id, e.target.value as LeadStage)}>
                      {LEAD_STAGES.map((s) => (
                        <option key={s} value={s}>
                          {STAGE_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
