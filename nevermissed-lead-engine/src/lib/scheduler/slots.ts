/**
 * Time-slot scheduler (pure — no I/O).
 *
 * Given a salon's weekly hours and IANA time zone, picks:
 *   Call A — inside opening hours AND inside a configured peak window
 *            (e.g. Sat 10–13, weekdays 12–13 and 17–19), salon-local time.
 *   Call B — 30–90 minutes after that day's final closing time.
 *
 * A shared `SlotLoad` map enforces "no more than N calls in the same
 * 15-minute window" across every salon planned in the same run. All math is
 * done with Luxon in the salon's zone, so DST transitions and overnight
 * closing times (e.g. open 18:00, close 02:00) are handled correctly.
 * Output instants are plain JS Dates (UTC).
 */
import { DateTime, Interval } from "luxon";
import { z } from "zod";
import { DAYS, type Day, type WeeklyHours } from "@/lib/domain";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24h HH:mm");
const day = z.enum(DAYS);

export const peakWindowSchema = z.object({
  label: z.string(),
  days: z.array(day).min(1),
  start: hhmm,
  end: hhmm,
});
export type PeakWindow = z.infer<typeof peakWindowSchema>;

export const intervalSchema = z.object({ open: hhmm, close: hhmm });
export const weeklyHoursSchema = z.object(
  Object.fromEntries(DAYS.map((d) => [d, z.array(intervalSchema).optional()])) as Record<
    Day,
    z.ZodOptional<z.ZodArray<typeof intervalSchema>>
  >,
);

export const DEFAULT_PEAK_WINDOWS: PeakWindow[] = [
  { label: "Sat peak", days: ["sat"], start: "10:00", end: "13:00" },
  { label: "Lunch peak", days: ["mon", "tue", "wed", "thu", "fri"], start: "12:00", end: "13:00" },
  { label: "After-work peak", days: ["mon", "tue", "wed", "thu", "fri"], start: "17:00", end: "19:00" },
];

/** Used when a salon's hours are unknown: open 9am–7pm Tue–Sat (flagged). */
export const DEFAULT_ASSUMED_HOURS: WeeklyHours = {
  tue: [{ open: "09:00", close: "19:00" }],
  wed: [{ open: "09:00", close: "19:00" }],
  thu: [{ open: "09:00", close: "19:00" }],
  fri: [{ open: "09:00", close: "19:00" }],
  sat: [{ open: "09:00", close: "19:00" }],
};

export type SchedulerConfig = {
  peakWindows: PeakWindow[];
  afterHoursMinOffsetMin: number;
  afterHoursMaxOffsetMin: number;
  maxCallsPer15Min: number;
  /** Put Call B on a different local day than Call A when possible. */
  separateDays: boolean;
  /** Never schedule sooner than this many minutes from "now". */
  minLeadTimeMin: number;
  /** How many days ahead to search for slots. */
  horizonDays: number;
  defaultHours: WeeklyHours;
};

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  peakWindows: DEFAULT_PEAK_WINDOWS,
  afterHoursMinOffsetMin: 30,
  afterHoursMaxOffsetMin: 90,
  maxCallsPer15Min: 4,
  separateDays: true,
  minLeadTimeMin: 10,
  horizonDays: 7,
  defaultHours: DEFAULT_ASSUMED_HOURS,
};

/** Count of calls already booked per 15-minute bucket (key = bucket start ms UTC). */
export type SlotLoad = Map<number, number>;

const BUCKET_MS = 15 * 60 * 1000;
/** Candidate granularity inside a window. */
const STEP_MIN = 5;

export function bucketOf(at: Date | DateTime): number {
  const ms = at instanceof Date ? at.getTime() : at.toMillis();
  return Math.floor(ms / BUCKET_MS) * BUCKET_MS;
}

export function loadFrom(times: Date[]): SlotLoad {
  const load: SlotLoad = new Map();
  for (const t of times) load.set(bucketOf(t), (load.get(bucketOf(t)) ?? 0) + 1);
  return load;
}

function dayKey(dt: DateTime): Day {
  return DAYS[dt.weekday - 1]; // Luxon: 1 = Monday
}

function atLocal(dayStart: DateTime, time: string): DateTime {
  const [h, m] = time.split(":").map(Number);
  return dayStart.set({ hour: h, minute: m, second: 0, millisecond: 0 });
}

/** Absolute open intervals for one local calendar day (overnight closes roll into the next day). */
export function openIntervalsOn(hours: WeeklyHours, dayStart: DateTime): Interval[] {
  const out: Interval[] = [];
  for (const iv of hours[dayKey(dayStart)] ?? []) {
    const start = atLocal(dayStart, iv.open);
    let end = atLocal(dayStart, iv.close);
    if (end <= start) end = atLocal(dayStart.plus({ days: 1 }), iv.close);
    const interval = Interval.fromDateTimes(start, end);
    if (interval.isValid) out.push(interval);
  }
  return out.sort((x, y) => x.start!.toMillis() - y.start!.toMillis());
}

export function hasAnyHours(hours: WeeklyHours | null | undefined): hours is WeeklyHours {
  return !!hours && DAYS.some((d) => (hours[d]?.length ?? 0) > 0);
}

/** Candidate start times every STEP_MIN inside [start, end) that are >= earliest. */
function candidatesIn(iv: Interval, earliest: DateTime, tailMin = STEP_MIN): DateTime[] {
  const out: DateTime[] = [];
  let t = iv.start!;
  // Align the first candidate to the step grid after `earliest`.
  if (t < earliest) {
    const mins = Math.ceil(earliest.diff(t, "minutes").minutes / STEP_MIN) * STEP_MIN;
    t = t.plus({ minutes: mins });
  }
  const last = iv.end!.minus({ minutes: tailMin });
  while (t <= last) {
    out.push(t);
    t = t.plus({ minutes: STEP_MIN });
  }
  return out;
}

/** Pick the least-loaded candidate whose bucket is under capacity (random among ties). */
function pickLeastLoaded(cands: DateTime[], load: SlotLoad, cap: number, rng: () => number): DateTime | null {
  let best: DateTime[] = [];
  let bestLoad = Infinity;
  for (const c of cands) {
    const l = load.get(bucketOf(c)) ?? 0;
    if (l >= cap) continue;
    if (l < bestLoad) {
      bestLoad = l;
      best = [c];
    } else if (l === bestLoad) best.push(c);
  }
  if (!best.length) return null;
  return best[Math.floor(rng() * best.length) % best.length];
}

function book(load: SlotLoad, at: DateTime) {
  const k = bucketOf(at);
  load.set(k, (load.get(k) ?? 0) + 1);
}

export type PlannedCall = { at: Date; windowLabel: string; localDay: string };
export type SalonPlan = { a: PlannedCall; b: PlannedCall; hoursAssumed: boolean };

export type PlanInput = {
  hours: WeeklyHours | null | undefined;
  zone: string;
  now: Date;
  config?: Partial<SchedulerConfig>;
  load?: SlotLoad;
  rng?: () => number;
};

function fmtWindow(label: string, start: DateTime, end: DateTime) {
  return `${label} ${start.toFormat("ccc HH:mm")}–${end.toFormat("HH:mm")}`;
}

/** Plan Call A + Call B for one salon. Returns null if nothing fits in the horizon. */
export function planSalonCalls(input: PlanInput): SalonPlan | null {
  const cfg = { ...DEFAULT_SCHEDULER_CONFIG, ...input.config };
  const load = input.load ?? new Map();
  const rng = input.rng ?? Math.random;
  const zone = DateTime.local().setZone(input.zone).isValid ? input.zone : "America/New_York";
  const hoursAssumed = !hasAnyHours(input.hours);
  const hours = hoursAssumed ? cfg.defaultHours : (input.hours as WeeklyHours);

  const now = DateTime.fromJSDate(input.now, { zone });
  const earliest = now.plus({ minutes: cfg.minLeadTimeMin });
  const today = now.startOf("day");
  const days = Array.from({ length: cfg.horizonDays + 1 }, (_, i) => today.plus({ days: i }));

  // ── Call A: open hours ∩ peak windows ──
  let a: PlannedCall | null = null;
  for (const d of days) {
    const open = openIntervalsOn(hours, d);
    const cands: { t: DateTime; label: string }[] = [];
    for (const w of cfg.peakWindows.filter((pw) => pw.days.includes(dayKey(d)))) {
      const peak = Interval.fromDateTimes(atLocal(d, w.start), atLocal(d, w.end));
      for (const iv of open) {
        const overlap = iv.intersection(peak);
        if (!overlap || overlap.length("minutes") < STEP_MIN) continue;
        for (const t of candidatesIn(overlap, earliest)) cands.push({ t, label: fmtWindow(w.label, overlap.start!, overlap.end!) });
      }
    }
    const pick = pickLeastLoaded(cands.map((c) => c.t), load, cfg.maxCallsPer15Min, rng);
    if (pick) {
      a = { at: pick.toJSDate(), windowLabel: cands.find((c) => c.t.equals(pick))!.label, localDay: pick.toISODate()! };
      book(load, pick);
      break;
    }
  }
  // Fallback: open hours that never overlap a peak window — call mid-shift.
  if (!a) {
    for (const d of days) {
      const cands: DateTime[] = [];
      for (const iv of openIntervalsOn(hours, d)) {
        if (iv.length("minutes") < 90) continue;
        const inner = Interval.fromDateTimes(iv.start!.plus({ minutes: 30 }), iv.end!.minus({ minutes: 30 }));
        cands.push(...candidatesIn(inner, earliest));
      }
      const pick = pickLeastLoaded(cands, load, cfg.maxCallsPer15Min, rng);
      if (pick) {
        a = { at: pick.toJSDate(), windowLabel: `Open hours ${pick.toFormat("ccc")} (no peak overlap)`, localDay: pick.toISODate()! };
        book(load, pick);
        break;
      }
    }
  }
  if (!a) return null;

  // ── Call B: final close of the day + [min, max] minutes ──
  const tryB = (allowSameDay: boolean): PlannedCall | null => {
    for (const d of days) {
      const open = openIntervalsOn(hours, d);
      if (!open.length) continue;
      if (!allowSameDay && d.toISODate() === a!.localDay) continue;
      const close = open[open.length - 1].end!;
      const win = Interval.fromDateTimes(
        close.plus({ minutes: cfg.afterHoursMinOffsetMin }),
        close.plus({ minutes: cfg.afterHoursMaxOffsetMin }),
      );
      // Skip if the window overlaps the next day's opening (e.g. 24h salons).
      const nextOpen = openIntervalsOn(hours, d.plus({ days: 1 }));
      const cands = candidatesIn(win, earliest, 0).filter(
        (t) => !nextOpen.some((iv) => iv.contains(t)) && !open.some((iv) => iv.contains(t)),
      );
      const pick = pickLeastLoaded(cands, load, cfg.maxCallsPer15Min, rng);
      if (pick) {
        book(load, pick);
        return {
          at: pick.toJSDate(),
          windowLabel: `After close ${close.toFormat("ccc HH:mm")} +${cfg.afterHoursMinOffsetMin}–${cfg.afterHoursMaxOffsetMin}m`,
          localDay: d.toISODate()!,
        };
      }
    }
    return null;
  };
  const b = (cfg.separateDays ? tryB(false) : null) ?? tryB(true);
  if (!b) {
    // Release A's booking so the caller can retry this salon another day.
    const k = bucketOf(new Date(a.at));
    load.set(k, Math.max(0, (load.get(k) ?? 1) - 1));
    return null;
  }
  return { a, b, hoursAssumed };
}

export type SalonForPlanning = { id: string; hours: WeeklyHours | null | undefined; zone: string };

/** Plan a batch, sharing one SlotLoad so capacity is enforced across salons. */
export function planBatch(
  salons: SalonForPlanning[],
  opts: { now: Date; config?: Partial<SchedulerConfig>; existing?: Date[]; rng?: () => number },
): { planned: (SalonPlan & { id: string })[]; unplannable: string[] } {
  const load = loadFrom(opts.existing ?? []);
  const planned: (SalonPlan & { id: string })[] = [];
  const unplannable: string[] = [];
  for (const s of salons) {
    const plan = planSalonCalls({ hours: s.hours, zone: s.zone, now: opts.now, config: opts.config, load, rng: opts.rng });
    if (plan) planned.push({ id: s.id, ...plan });
    else unplannable.push(s.id);
  }
  return { planned, unplannable };
}

/** Deterministic PRNG (mulberry32) for tests and reproducible plans. */
export function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
