import { describe, expect, it } from "vitest";
import { buildMergeData, renderTemplate, missingFields } from "@/lib/email/merge";
import { composeEmail, ComplianceError } from "@/lib/email/compose";
import { allocateSendTimes, nextSendWindow } from "@/lib/email/allocate";
import { DEFAULT_STEPS } from "@/lib/email/templates";
import { seededRng } from "@/lib/scheduler/slots";
import { classifyAutomatedCall } from "@/lib/twilio/classify";

const lead = { name: "Glow Studio", city: "Atlanta", bookingPlatform: "Vagaro", reviewCount: 212, googleRating: 4.8, timezone: "America/New_York" };
const calls = [
  { type: "A" as const, outcome: "NO_ANSWER_NO_VOICEMAIL" as const, executedAt: new Date("2026-11-24T17:40:00Z") },
  { type: "B" as const, outcome: "VOICEMAIL_FULL" as const, executedAt: new Date("2026-11-27T00:15:00Z") },
];

describe("merge fields", () => {
  it("builds exact missed-call proof in the salon's zone with fallbacks", () => {
    const d = buildMergeData(lead, calls, { senderName: "Sam" });
    expect(d).toMatchObject({ missed_call_1_day: "Tuesday", missed_call_1_time: "12:40pm", missed_call_2_day: "Thursday", missed_call_2_time: "7:15pm" });
    expect(renderTemplate("Hi {{owner_first_name}},", d)).toBe("Hi there,");
    expect(renderTemplate("Hi {{owner_first_name|friend}}", d)).toBe("Hi friend");
  });
  it("supports present / absent sections", () => {
    const d = buildMergeData({ ...lead, bookingPlatform: null }, calls.slice(0, 1), {});
    const t = "{{#booking_platform}}into {{booking_platform}}{{/booking_platform}}{{^booking_platform}}into your calendar{{/booking_platform}}{{#missed_call_2_day}} and {{missed_call_2_day}}{{/missed_call_2_day}}.";
    expect(renderTemplate(t, d)).toBe("into your calendar.");
  });
  it("renders every default template without leftover tags", () => {
    const d = buildMergeData(lead, calls, { senderName: "Sam", demoLink: "https://cal.example/demo", demoPhone: "(404) 555-0100" });
    for (const s of DEFAULT_STEPS) {
      const out = renderTemplate(s.subject + "\n" + s.body, d);
      expect(out).not.toMatch(/\{\{|\}\}/);
    }
    expect(renderTemplate(DEFAULT_STEPS[0].body, d)).toContain("on Tuesday at 12:40pm and again on Thursday at 7:15pm");
    expect(renderTemplate(DEFAULT_STEPS[0].body, d)).toContain("straight into Vagaro");
  });
  it("escapes values in HTML mode and reports missing fields", () => {
    expect(renderTemplate("{{salon_name}}", { salon_name: "<b>A&B</b>" }, { html: true })).toBe("&lt;b&gt;A&amp;B&lt;/b&gt;");
    expect(missingFields("{{demo_link}} {{owner_first_name}}", {})).toEqual(["demo_link"]);
  });
});

describe("compose (CAN-SPAM)", () => {
  it("adds the physical address, unsubscribe link and one-click headers", () => {
    const r = composeEmail({ bodyText: "Hello https://x.com/a", businessName: "NeverMissed", businessAddress: "1 Main St\nAtlanta, GA 30301", unsubscribeUrl: "https://app/u/t", trackLink: (u) => `https://app/c?u=${encodeURIComponent(u)}` });
    expect(r.text).toContain("1 Main St, Atlanta, GA 30301");
    expect(r.text).toContain("https://app/u/t");
    expect(r.html).toContain('href="https://app/c?u=https%3A%2F%2Fx.com%2Fa"');
    expect(r.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });
  it("refuses to send without a business address", () => {
    expect(() => composeEmail({ bodyText: "x", businessName: "N", businessAddress: " ", unsubscribeUrl: "u" })).toThrow(ComplianceError);
  });
});

describe("send allocation", () => {
  const now = new Date("2026-11-24T14:00:00Z");
  it("enforces daily limits per mailbox and spaces sends", () => {
    const out = allocateSendTimes({ senders: [{ id: "a", dailyLimit: 3, usedToday: 1, lastScheduledAt: null }, { id: "b", dailyLimit: 2, usedToday: 0, lastScheduledAt: null }], count: 10, now, minSpacingSec: 60, maxSpacingSec: 120, rng: seededRng(1) });
    expect(out).toHaveLength(4);
    for (const id of ["a", "b"]) {
      const t = out.filter((o) => o.senderId === id).map((o) => o.at.getTime());
      for (let i = 1; i < t.length; i++) expect(t[i] - t[i - 1]).toBeGreaterThanOrEqual(60_000);
    }
  });
  it("finds the next send window in the lead's local time", () => {
    // Sat 2026-11-28 10:00 NY → Monday 08:30 NY
    const sat = new Date("2026-11-28T15:00:00Z");
    expect(nextSendWindow(sat, "America/New_York", "08:30", "17:30", ["mon", "tue", "wed", "thu", "fri"]).toISOString()).toBe("2026-11-30T13:30:00.000Z");
    expect(nextSendWindow(now, "America/New_York", "08:30", "17:30", ["tue"]).toISOString()).toBe(now.toISOString());
  });
});

describe("automated call classification", () => {
  it("maps Twilio facts to outcomes", () => {
    expect(classifyAutomatedCall({ callStatus: "busy" }).outcome).toBe("BUSY");
    expect(classifyAutomatedCall({ callStatus: "no-answer" }).outcome).toBe("NO_ANSWER_NO_VOICEMAIL");
    expect(classifyAutomatedCall({ callStatus: "failed", sipResponseCode: 404 })).toMatchObject({ outcome: "DISCONNECTED_OR_WRONG_NUMBER", needsReview: false });
    expect(classifyAutomatedCall({ callStatus: "completed", answeredBy: "human" })).toMatchObject({ outcome: "ANSWERED_HUMAN", needsReview: true });
    expect(classifyAutomatedCall({ callStatus: "completed", answeredBy: "machine_end_beep" }).outcome).toBe("VOICEMAIL_BASIC");
  });
});
