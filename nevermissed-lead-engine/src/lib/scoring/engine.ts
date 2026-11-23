/**
 * Lead scoring engine (pure — no I/O).
 *
 * Inputs are the two test calls; output is a tier plus a human-readable,
 * evidence-backed reason such as:
 *   "Missed Tue 12:40pm (no answer, no voicemail) · No after-hours coverage Thu 7:15pm (voicemail full)"
 *
 * Default rules (business spec):
 *   DEAD  any call reached a disconnected / wrong number.
 *   HOT   missed Call A (in-hours) AND no useful after-hours coverage on Call B.
 *   WARM  missed exactly one of the two, OR missed both but a basic voicemail exists.
 *   COLD  answered in-hours AND good after-hours coverage.
 *
 * Every outcome list below is editable in Settings → Scoring.
 */
import { DateTime } from "luxon";
import { z } from "zod";
import { CALL_OUTCOMES, OUTCOME_META, type CallOutcome, type CallType, type ScoreTier } from "@/lib/domain";

const outcome = z.enum(CALL_OUTCOMES);

export const scoringRulesSchema = z.object({
  version: z.number().int().default(1),
  /** Call A outcomes that count as "the salon picked up" (i.e. NOT missed). */
  inHoursAnswered: z.array(outcome).default(["ANSWERED_HUMAN", "ANSWERED_AI_OR_SERVICE"]),
  /** Call B outcomes that count as useful after-hours coverage. */
  afterHoursCovered: z
    .array(outcome)
    .default(["ANSWERED_HUMAN", "ANSWERED_AI_OR_SERVICE", "VOICEMAIL_WITH_BOOKING_INFO"]),
  /** Outcomes that count as "has a basic voicemail" (downgrades HOT → WARM). */
  basicVoicemail: z.array(outcome).default(["VOICEMAIL_BASIC"]),
  /** If true, missing both calls with a basic voicemail is WARM, not HOT. */
  basicVoicemailDowngradesHot: z.boolean().default(true),
  /** Outcomes that make the lead DEAD (excluded from outreach). */
  dead: z.array(outcome).default(["DISCONNECTED_OR_WRONG_NUMBER"]),
});
export type ScoringRules = z.infer<typeof scoringRulesSchema>;
export const DEFAULT_SCORING_RULES: ScoringRules = scoringRulesSchema.parse({});

export type ScoredCall = {
  type: CallType;
  outcome: CallOutcome;
  /** When the call was actually placed (UTC). */
  executedAt: Date;
};

export type Evidence = {
  type: CallType;
  outcome: CallOutcome;
  missed: boolean;
  /** Salon-local day, e.g. "Tue". */
  day: string;
  /** Salon-local time, e.g. "12:40pm". */
  time: string;
  /** Full sentence fragment used in the reason. */
  label: string;
};

export type ScoreResult = {
  tier: ScoreTier;
  reason: string;
  evidence: Evidence[];
};

/** Format a UTC instant as salon-local "Tue" / "12:40pm". */
export function localDayTime(at: Date, zone: string): { day: string; time: string } {
  const dt = DateTime.fromJSDate(at, { zone });
  const valid = dt.isValid ? dt : DateTime.fromJSDate(at, { zone: "UTC" });
  return {
    day: valid.toFormat("ccc"),
    time: valid.toFormat("h:mma").toLowerCase(),
  };
}

/** Did the salon fail to pick up / cover this call under the given rules? */
export function isMissed(call: Pick<ScoredCall, "type" | "outcome">, rules: ScoringRules = DEFAULT_SCORING_RULES): boolean {
  if (call.type === "A") return !rules.inHoursAnswered.includes(call.outcome);
  return !rules.afterHoursCovered.includes(call.outcome);
}

function describe(call: ScoredCall, missed: boolean, zone: string): Evidence {
  const { day, time } = localDayTime(call.executedAt, zone);
  const what = OUTCOME_META[call.outcome].short;
  let label: string;
  if (call.type === "A") {
    label = missed ? `Missed ${day} ${time} (${what})` : `Answered ${day} ${time} (${what})`;
  } else {
    label = missed
      ? `No after-hours coverage ${day} ${time} (${what})`
      : `After-hours covered ${day} ${time} (${what})`;
  }
  return { type: call.type, outcome: call.outcome, missed, day, time, label };
}

/**
 * Score a lead. Returns `null` until both calls are logged — unless one call
 * is already DEAD, which is decisive on its own (no point placing Call B).
 */
export function scoreLead(
  calls: ScoredCall[],
  zone: string,
  rules: ScoringRules = DEFAULT_SCORING_RULES,
): ScoreResult | null {
  const a = calls.find((c) => c.type === "A");
  const b = calls.find((c) => c.type === "B");

  const deadCall = calls.find((c) => rules.dead.includes(c.outcome));
  if (deadCall) {
    const ev = describe(deadCall, true, zone);
    return {
      tier: "DEAD",
      reason: `Number unreachable ${ev.day} ${ev.time} (${OUTCOME_META[deadCall.outcome].short}) — excluded`,
      evidence: [ev],
    };
  }
  if (!a || !b) return null;

  const missedA = isMissed(a, rules);
  const missedB = isMissed(b, rules);
  const evidence = [describe(a, missedA, zone), describe(b, missedB, zone)];
  const reason = evidence.map((e) => e.label).join(" · ");

  let tier: ScoreTier;
  if (missedA && missedB) {
    const hasBasicVm = rules.basicVoicemail.includes(a.outcome) || rules.basicVoicemail.includes(b.outcome);
    tier = hasBasicVm && rules.basicVoicemailDowngradesHot ? "WARM" : "HOT";
  } else if (missedA || missedB) {
    tier = "WARM";
  } else {
    tier = "COLD";
  }
  return { tier, reason, evidence };
}

/** Which stage a freshly scored lead moves to. */
export function stageForTier(tier: ScoreTier): "HOT" | "WARM" | "COLD" | "LOST" {
  return tier === "DEAD" ? "LOST" : tier;
}
