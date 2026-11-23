import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { bucketOf, loadFrom, planBatch, planSalonCalls, seededRng, DEFAULT_PEAK_WINDOWS } from "@/lib/scheduler/slots";
import type { WeeklyHours } from "@/lib/domain";

const weekdays = (open: string, close: string): WeeklyHours =>
  Object.fromEntries(["mon", "tue", "wed", "thu", "fri", "sat"].map((d) => [d, [{ open, close }]]));
const local = (d: Date, zone: string) => DateTime.fromJSDate(d, { zone });
const minutesOf = (dt: DateTime) => dt.hour * 60 + dt.minute;

const inPeak = (dt: DateTime) => {
  const day = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"][dt.weekday - 1];
  return DEFAULT_PEAK_WINDOWS.some((w) => {
    if (!w.days.includes(day as never)) return false;
    const [sh, sm] = w.start.split(":").map(Number);
    const [eh, em] = w.end.split(":").map(Number);
    return minutesOf(dt) >= sh * 60 + sm && minutesOf(dt) < eh * 60 + em;
  });
};

// Monday 2026-11-23 08:00 New York time.
const MON_8AM_NY = DateTime.fromISO("2026-11-23T08:00", { zone: "America/New_York" }).toJSDate();

describe("planSalonCalls", () => {
  it("puts Call A in a peak window inside open hours, in the salon's zone", () => {
    for (const zone of ["America/New_York", "America/Chicago", "America/Los_Angeles", "Pacific/Honolulu"]) {
      const p = planSalonCalls({ hours: weekdays("09:00", "18:00"), zone, now: MON_8AM_NY, rng: seededRng(1) })!;
      const a = local(p.a.at, zone);
      expect(inPeak(a), `${zone} ${a.toISO()}`).toBe(true);
      expect(minutesOf(a)).toBeGreaterThanOrEqual(9 * 60);
      expect(minutesOf(a)).toBeLessThan(18 * 60);
      expect(p.hoursAssumed).toBe(false);
    }
  });

  it("puts Call B 30–90 minutes after that day's closing time, for different closing times", () => {
    for (const close of ["17:00", "19:00", "20:30", "21:00"]) {
      const zone = "America/Denver";
      const p = planSalonCalls({ hours: weekdays("10:00", close), zone, now: MON_8AM_NY, rng: seededRng(2) })!;
      const b = local(p.b.at, zone);
      const [ch, cm] = close.split(":").map(Number);
      const delta = minutesOf(b) - (ch * 60 + cm);
      expect(delta, close).toBeGreaterThanOrEqual(30);
      expect(delta, close).toBeLessThanOrEqual(90);
    }
  });

  it("uses the final close when a salon has split hours (lunch break)", () => {
    const hours: WeeklyHours = { tue: [{ open: "09:00", close: "12:30" }, { open: "13:30", close: "18:00" }], wed: [{ open: "09:00", close: "18:00" }] };
    const p = planSalonCalls({ hours, zone: "America/New_York", now: MON_8AM_NY, rng: seededRng(3) })!;
    const b = local(p.b.at, "America/New_York");
    expect(minutesOf(b)).toBeGreaterThanOrEqual(18 * 60 + 30);
  });

  it("handles salons that close after midnight", () => {
    const hours: WeeklyHours = { fri: [{ open: "17:00", close: "01:00" }], sat: [{ open: "10:00", close: "02:00" }] };
    const zone = "America/Chicago";
    const p = planSalonCalls({ hours, zone, now: MON_8AM_NY, rng: seededRng(4) })!;
    const b = local(p.b.at, zone);
    // Fri close 01:00 Sat → B between 01:30 and 02:30 Saturday, or Sat close 02:00 Sun → 02:30–03:30 Sunday.
    expect(["sat", "sun"]).toContain(b.toFormat("ccc").toLowerCase());
    expect(minutesOf(b)).toBeGreaterThanOrEqual(90);
    expect(minutesOf(b)).toBeLessThanOrEqual(210);
  });

  it("puts Call B on a different local day than Call A by default", () => {
    const p = planSalonCalls({ hours: weekdays("09:00", "19:00"), zone: "America/New_York", now: MON_8AM_NY, rng: seededRng(5) })!;
    expect(p.a.localDay).not.toBe(p.b.localDay);
    const same = planSalonCalls({ hours: weekdays("09:00", "19:00"), zone: "America/New_York", now: MON_8AM_NY, rng: seededRng(5), config: { separateDays: false } })!;
    expect(same.a.localDay).toBe(same.b.localDay);
  });

  it("falls back to default hours (Tue–Sat 9–7) and flags it when hours are unknown", () => {
    const p = planSalonCalls({ hours: null, zone: "America/New_York", now: MON_8AM_NY, rng: seededRng(6) })!;
    expect(p.hoursAssumed).toBe(true);
    const a = local(p.a.at, "America/New_York");
    expect(a.weekday).not.toBe(1); // not Monday (closed by default)
    const b = local(p.b.at, "America/New_York");
    expect(minutesOf(b)).toBeGreaterThanOrEqual(19 * 60 + 30);
  });

  it("never schedules in the past", () => {
    const now = DateTime.fromISO("2026-11-24T12:50", { zone: "America/New_York" }).toJSDate();
    const p = planSalonCalls({ hours: weekdays("09:00", "19:00"), zone: "America/New_York", now, rng: seededRng(7) })!;
    expect(p.a.at.getTime()).toBeGreaterThan(now.getTime());
    expect(p.b.at.getTime()).toBeGreaterThan(now.getTime());
  });

  it("falls back to mid-shift when hours never overlap a peak window", () => {
    const hours: WeeklyHours = { sun: [{ open: "09:00", close: "15:00" }] };
    const p = planSalonCalls({ hours, zone: "America/New_York", now: MON_8AM_NY, rng: seededRng(8) })!;
    expect(p.a.windowLabel).toContain("no peak overlap");
  });

  it("handles the DST change (US clocks fall back on 2026-11-01)", () => {
    const now = DateTime.fromISO("2026-10-30T08:00", { zone: "America/New_York" }).toJSDate();
    const p = planSalonCalls({ hours: weekdays("09:00", "19:00"), zone: "America/New_York", now, rng: seededRng(9), config: { horizonDays: 10 } })!;
    const b = local(p.b.at, "America/New_York");
    expect(minutesOf(b) - 19 * 60).toBeGreaterThanOrEqual(30);
    expect(minutesOf(b) - 19 * 60).toBeLessThanOrEqual(90);
  });
});

describe("planBatch capacity", () => {
  it("never puts more than N calls in the same 15-minute window", () => {
    const salons = Array.from({ length: 50 }, (_, i) => ({ id: `s${i}`, hours: weekdays("09:00", "19:00"), zone: i % 2 ? "America/New_York" : "America/Chicago" }));
    const { planned, unplannable } = planBatch(salons, { now: MON_8AM_NY, config: { maxCallsPer15Min: 3 }, rng: seededRng(10) });
    expect(unplannable).toEqual([]);
    expect(planned).toHaveLength(50);
    const load = loadFrom(planned.flatMap((p) => [p.a.at, p.b.at]));
    expect(Math.max(...load.values())).toBeLessThanOrEqual(3);
  });

  it("counts calls already on the calendar", () => {
    const existing = planSalonCalls({ hours: weekdays("12:00", "13:00"), zone: "America/New_York", now: MON_8AM_NY, rng: seededRng(11) })!;
    const busy = Array(2).fill(existing.a.at);
    const { planned } = planBatch([{ id: "x", hours: weekdays("12:00", "13:00"), zone: "America/New_York" }], { now: MON_8AM_NY, config: { maxCallsPer15Min: 2 }, existing: busy, rng: seededRng(11) });
    expect(bucketOf(planned[0].a.at)).not.toBe(bucketOf(existing.a.at));
  });
});
