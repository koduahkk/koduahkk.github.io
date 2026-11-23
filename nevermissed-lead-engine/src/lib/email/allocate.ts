/**
 * Send-slot allocation (pure). Spreads sends across mailboxes, enforces each
 * mailbox's daily limit, and adds random spacing between consecutive sends
 * from the same mailbox so volume looks human.
 */
import { DateTime } from "luxon";
import { DAYS, type Day } from "@/lib/domain";

export type SenderLoad = { id: string; dailyLimit: number; usedToday: number; lastScheduledAt: Date | null };

export function allocateSendTimes(opts: {
  senders: SenderLoad[];
  count: number;
  now: Date;
  minSpacingSec: number;
  maxSpacingSec: number;
  rng?: () => number;
}): { senderId: string; at: Date }[] {
  const rng = opts.rng ?? Math.random;
  const state = opts.senders.map((s) => ({ ...s, next: s.lastScheduledAt }));
  const out: { senderId: string; at: Date }[] = [];
  const lo = Math.min(opts.minSpacingSec, opts.maxSpacingSec);
  const hi = Math.max(opts.minSpacingSec, opts.maxSpacingSec);
  for (let i = 0; i < opts.count; i++) {
    const open = state.filter((s) => s.usedToday < s.dailyLimit);
    if (!open.length) break;
    // Mailbox with the most remaining capacity, then the one free soonest.
    open.sort((a, b) => b.dailyLimit - b.usedToday - (a.dailyLimit - a.usedToday) || (a.next?.getTime() ?? 0) - (b.next?.getTime() ?? 0));
    const s = open[0];
    const gap = (lo + rng() * (hi - lo)) * 1000;
    const base = s.next ? Math.max(opts.now.getTime(), s.next.getTime() + gap) : opts.now.getTime() + rng() * gap;
    const at = new Date(Math.round(base));
    s.next = at;
    s.usedToday++;
    out.push({ senderId: s.id, at });
  }
  return out;
}

/**
 * Next moment at/after `now` that falls inside the send window in the lead's
 * local time (e.g. Mon–Fri 08:30–17:30). Returns `now` if already inside.
 */
export function nextSendWindow(now: Date, zone: string, start: string, end: string, days: Day[]): Date {
  let t = DateTime.fromJSDate(now, { zone: DateTime.local().setZone(zone).isValid ? zone : "America/New_York" });
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  for (let i = 0; i < 8; i++) {
    const day = DAYS[t.weekday - 1];
    const s = t.set({ hour: sh, minute: sm, second: 0, millisecond: 0 });
    const e = t.set({ hour: eh, minute: em, second: 0, millisecond: 0 });
    if (days.includes(day)) {
      if (t < s) return s.toJSDate();
      if (t < e) return t.toJSDate();
    }
    t = t.plus({ days: 1 }).startOf("day");
  }
  return now;
}
