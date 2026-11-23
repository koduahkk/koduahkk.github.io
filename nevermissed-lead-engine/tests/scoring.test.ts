import { describe, expect, it } from "vitest";
import { DEFAULT_SCORING_RULES, isMissed, scoreLead, scoringRulesSchema, type ScoredCall } from "@/lib/scoring/engine";
import type { CallOutcome } from "@/lib/domain";

const NY = "America/New_York";
// Tue 2026-11-24 12:40 EST = 17:40Z ; Thu 2026-11-26 19:15 EST = 00:15Z Fri
const TUE_1240 = new Date("2026-11-24T17:40:00Z");
const THU_1915 = new Date("2026-11-27T00:15:00Z");
const call = (type: "A" | "B", outcome: CallOutcome, executedAt = type === "A" ? TUE_1240 : THU_1915): ScoredCall => ({ type, outcome, executedAt });

describe("scoreLead", () => {
  it("returns null until both calls are logged", () => {
    expect(scoreLead([call("A", "NO_ANSWER_NO_VOICEMAIL")], NY)).toBeNull();
    expect(scoreLead([], NY)).toBeNull();
  });

  it("HOT: missed in-hours and no after-hours coverage, with exact local times in the reason", () => {
    const r = scoreLead([call("A", "NO_ANSWER_NO_VOICEMAIL"), call("B", "VOICEMAIL_FULL")], NY)!;
    expect(r.tier).toBe("HOT");
    expect(r.reason).toBe("Missed Tue 12:40pm (no answer, no voicemail) · No after-hours coverage Thu 7:15pm (voicemail full)");
    expect(r.evidence.map((e) => [e.day, e.time])).toEqual([["Tue", "12:40pm"], ["Thu", "7:15pm"]]);
  });

  it("HOT when in-hours goes to a voicemail with booking info but after-hours rings out", () => {
    expect(scoreLead([call("A", "VOICEMAIL_WITH_BOOKING_INFO"), call("B", "BUSY")], NY)!.tier).toBe("HOT");
  });

  it("WARM: missed both but a basic voicemail exists (either call)", () => {
    expect(scoreLead([call("A", "NO_ANSWER_NO_VOICEMAIL"), call("B", "VOICEMAIL_BASIC")], NY)!.tier).toBe("WARM");
    expect(scoreLead([call("A", "VOICEMAIL_BASIC"), call("B", "NO_ANSWER_NO_VOICEMAIL")], NY)!.tier).toBe("WARM");
  });

  it("WARM: missed only in-hours", () => {
    expect(scoreLead([call("A", "BUSY"), call("B", "VOICEMAIL_WITH_BOOKING_INFO")], NY)!.tier).toBe("WARM");
  });

  it("WARM: missed only after-hours", () => {
    const r = scoreLead([call("A", "ANSWERED_HUMAN"), call("B", "NO_ANSWER_NO_VOICEMAIL")], NY)!;
    expect(r.tier).toBe("WARM");
    expect(r.reason).toContain("Answered Tue 12:40pm");
  });

  it("COLD: answered in-hours and good after-hours coverage", () => {
    expect(scoreLead([call("A", "ANSWERED_HUMAN"), call("B", "ANSWERED_AI_OR_SERVICE")], NY)!.tier).toBe("COLD");
    expect(scoreLead([call("A", "ANSWERED_AI_OR_SERVICE"), call("B", "VOICEMAIL_WITH_BOOKING_INFO")], NY)!.tier).toBe("COLD");
  });

  it("DEAD: disconnected on either call, even before the other is logged", () => {
    expect(scoreLead([call("A", "DISCONNECTED_OR_WRONG_NUMBER")], NY)!.tier).toBe("DEAD");
    expect(scoreLead([call("A", "ANSWERED_HUMAN"), call("B", "DISCONNECTED_OR_WRONG_NUMBER")], NY)!.tier).toBe("DEAD");
  });

  it("renders times in the salon's own zone", () => {
    const r = scoreLead([call("A", "BUSY"), call("B", "BUSY")], "America/Los_Angeles")!;
    expect(r.evidence[0].time).toBe("9:40am");
    expect(r.evidence[1]).toMatchObject({ day: "Thu", time: "4:15pm" });
  });

  it("respects editable rules", () => {
    const strict = scoringRulesSchema.parse({ basicVoicemailDowngradesHot: false });
    expect(scoreLead([call("A", "NO_ANSWER_NO_VOICEMAIL"), call("B", "VOICEMAIL_BASIC")], NY, strict)!.tier).toBe("HOT");
    const aiIsMiss = scoringRulesSchema.parse({ inHoursAnswered: ["ANSWERED_HUMAN"] });
    expect(isMissed({ type: "A", outcome: "ANSWERED_AI_OR_SERVICE" }, aiIsMiss)).toBe(true);
    expect(isMissed({ type: "A", outcome: "ANSWERED_AI_OR_SERVICE" }, DEFAULT_SCORING_RULES)).toBe(false);
  });
});
