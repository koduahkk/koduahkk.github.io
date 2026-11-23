import { Badge } from "@/components/ui/badge";
import { STAGE_LABEL, OUTCOME_META, type LeadStage, type CallOutcome } from "@/lib/domain";
import { Flame, Snowflake, Sun, Skull } from "lucide-react";

const TIER = {
  HOT: { variant: "hot", icon: Flame, label: "Hot" },
  WARM: { variant: "warm", icon: Sun, label: "Warm" },
  COLD: { variant: "cold", icon: Snowflake, label: "Cold" },
  DEAD: { variant: "dead", icon: Skull, label: "Dead" },
} as const;

/** Tier always ships with an icon + label, never color alone. */
export function TierBadge({ tier }: { tier: keyof typeof TIER | null | undefined }) {
  if (!tier) return <Badge variant="secondary">Unscored</Badge>;
  const t = TIER[tier];
  return (
    <Badge variant={t.variant}>
      <t.icon className="h-3 w-3" aria-hidden /> {t.label}
    </Badge>
  );
}

export function StageBadge({ stage }: { stage: LeadStage }) {
  const v = stage === "CUSTOMER" ? "success" : stage === "LOST" ? "dead" : stage === "REPLIED" || stage === "DEMO_BOOKED" || stage === "TRIAL" ? "default" : "outline";
  return <Badge variant={v}>{STAGE_LABEL[stage]}</Badge>;
}

export function OutcomeBadge({ outcome }: { outcome: CallOutcome | null }) {
  if (!outcome) return <Badge variant="secondary">Pending</Badge>;
  const m = OUTCOME_META[outcome];
  const v = m.tone === "good" ? "success" : m.tone === "meh" ? "warning" : m.tone === "bad" ? "hot" : "dead";
  return <Badge variant={v}>{m.label}</Badge>;
}
