/**
 * Opening-hours parsing:
 *  - Google Places (New) `regularOpeningHours.periods`
 *  - Free text from CSVs, e.g. "Tue-Fri 9:00-19:00; Sat 9am-5pm; Sun closed"
 */
import { DAYS, type Day, type HoursInterval, type WeeklyHours } from "@/lib/domain";

type GPoint = { day: number; hour: number; minute?: number };
export type GooglePeriod = { open: GPoint; close?: GPoint };

const pad = (n: number) => String(n).padStart(2, "0");
// Google: 0 = Sunday … 6 = Saturday.
const G_DAY: Day[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function fromGooglePeriods(periods: GooglePeriod[] | undefined | null): WeeklyHours | null {
  if (!periods?.length) return null;
  // A single period with no close = open 24/7.
  if (periods.length === 1 && !periods[0].close) {
    return Object.fromEntries(DAYS.map((d) => [d, [{ open: "00:00", close: "23:59" }]]));
  }
  const out: WeeklyHours = {};
  for (const p of periods) {
    if (!p.close) continue;
    const day = G_DAY[p.open.day];
    const iv: HoursInterval = {
      open: `${pad(p.open.hour)}:${pad(p.open.minute ?? 0)}`,
      close: `${pad(p.close.hour)}:${pad(p.close.minute ?? 0)}`,
    };
    (out[day] ??= []).push(iv);
  }
  return Object.keys(out).length ? out : null;
}

function to24(t: string): string | null {
  const m = t.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const ap = m[3];
  if (ap?.startsWith("p") && h < 12) h += 12;
  if (ap?.startsWith("a") && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${pad(h)}:${pad(min)}`;
}

const DAY_ALIASES: Record<string, Day> = {
  mon: "mon", monday: "mon", tue: "tue", tues: "tue", tuesday: "tue", wed: "wed", weds: "wed", wednesday: "wed",
  thu: "thu", thur: "thu", thurs: "thu", thursday: "thu", fri: "fri", friday: "fri", sat: "sat", saturday: "sat",
  sun: "sun", sunday: "sun",
};

/** Parse loose text hours. Returns null if nothing could be understood. */
export function parseHoursText(text: string | null | undefined): WeeklyHours | null {
  if (!text?.trim()) return null;
  const out: WeeklyHours = {};
  for (const part of text.split(/[;\n|]+/)) {
    const m = part.trim().match(/^([a-z]+)\s*(?:[-–to]+\s*([a-z]+))?\s*[: ]\s*(.+)$/i);
    if (!m) continue;
    const from = DAY_ALIASES[m[1].toLowerCase()];
    const to = m[2] ? DAY_ALIASES[m[2].toLowerCase()] : from;
    if (!from || !to) continue;
    if (/closed/i.test(m[3])) continue;
    const range = m[3].match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm|a|p)?)\s*[-–to]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm|a|p)?)/i);
    if (!range) continue;
    const open = to24(range[1]);
    const close = to24(range[2]);
    if (!open || !close) continue;
    const i0 = DAYS.indexOf(from);
    const i1 = DAYS.indexOf(to);
    for (let i = i0; ; i = (i + 1) % 7) {
      (out[DAYS[i]] ??= []).push({ open, close });
      if (i === i1) break;
    }
  }
  return Object.keys(out).length ? out : null;
}

export function formatHours(hours: WeeklyHours | null | undefined): { day: Day; text: string }[] {
  return DAYS.map((d) => ({
    day: d,
    text: hours?.[d]?.length ? hours[d]!.map((iv) => `${iv.open}–${iv.close}`).join(", ") : "Closed",
  }));
}
