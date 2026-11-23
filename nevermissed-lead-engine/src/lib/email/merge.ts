/**
 * Merge-field rendering for email templates, Instagram DMs and walk-in scripts.
 *
 *   {{salon_name}}                 plain field (HTML-safe when rendering HTML)
 *   {{owner_first_name|there}}     inline fallback
 *   {{#booking_platform}}…{{/booking_platform}}   section shown only if field is non-empty
 *   {{^booking_platform}}…{{/booking_platform}}   section shown only if field is empty
 */
import { DateTime } from "luxon";
import type { CallOutcome, CallType } from "@/lib/domain";
import { isMissed, type ScoringRules } from "@/lib/scoring/engine";

export const MERGE_FIELDS = [
  "salon_name",
  "owner_first_name",
  "city",
  "missed_call_1_day",
  "missed_call_1_time",
  "missed_call_2_day",
  "missed_call_2_time",
  "booking_platform",
  "review_count",
  "google_rating",
  "sender_name",
  "demo_link",
  "demo_phone",
] as const;
export type MergeField = (typeof MERGE_FIELDS)[number];
export type MergeData = Record<MergeField, string>;

/** Fallbacks used when a field is empty and the template gives no inline fallback. */
export const DEFAULT_FALLBACKS: Partial<Record<MergeField, string>> = {
  owner_first_name: "there",
  city: "your area",
  booking_platform: "your booking system",
};

export type MergeLead = {
  name: string;
  ownerFirstName?: string | null;
  city?: string | null;
  bookingPlatform?: string | null;
  reviewCount?: number | null;
  googleRating?: number | null;
  timezone?: string | null;
};
export type MergeCall = { type: CallType; outcome: CallOutcome | null; executedAt: Date | null };

/** Build merge data. Missed calls are in chronological order, in the salon's local time. */
export function buildMergeData(
  lead: MergeLead,
  calls: MergeCall[],
  ctx: { senderName?: string; demoLink?: string; demoPhone?: string; rules?: ScoringRules },
): MergeData {
  const zone = lead.timezone || "America/New_York";
  const missed = calls
    .filter((c): c is MergeCall & { outcome: CallOutcome; executedAt: Date } => !!c.outcome && !!c.executedAt)
    .filter((c) => isMissed({ type: c.type, outcome: c.outcome }, ctx.rules))
    .sort((x, y) => x.executedAt.getTime() - y.executedAt.getTime());
  const fmt = (c?: { executedAt: Date }) => {
    if (!c) return { day: "", time: "" };
    const dt = DateTime.fromJSDate(c.executedAt, { zone });
    return { day: dt.toFormat("cccc"), time: dt.toFormat("h:mma").toLowerCase() };
  };
  const m1 = fmt(missed[0]);
  const m2 = fmt(missed[1]);
  return {
    salon_name: lead.name,
    owner_first_name: lead.ownerFirstName?.trim() || "",
    city: lead.city ?? "",
    missed_call_1_day: m1.day,
    missed_call_1_time: m1.time,
    missed_call_2_day: m2.day,
    missed_call_2_time: m2.time,
    booking_platform: lead.bookingPlatform ?? "",
    review_count: lead.reviewCount != null ? String(lead.reviewCount) : "",
    google_rating: lead.googleRating != null ? lead.googleRating.toFixed(1) : "",
    sender_name: ctx.senderName ?? "",
    demo_link: ctx.demoLink ?? "",
    demo_phone: ctx.demoPhone ?? "",
  };
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Render a template against merge data. Unknown fields render empty. */
export function renderTemplate(tpl: string, data: Partial<MergeData>, opts: { html?: boolean } = {}): string {
  const val = (k: string) => (data as Record<string, string | undefined>)[k]?.trim() ?? "";
  // Sections first (non-greedy, same-name close tag; nesting different names is fine).
  // Repeat so nested sections (inner ones exposed by the outer pass) are expanded too.
  let out = tpl;
  for (let i = 0; i < 5; i++) {
    const next = out.replace(/\{\{([#^])\s*([a-z0-9_]+)\s*\}\}([\s\S]*?)\{\{\/\s*\2\s*\}\}/g, (_m, kind, key, inner) => {
      const present = val(key) !== "";
      return (kind === "#") === present ? inner : "";
    });
    if (next === out) break;
    out = next;
  }
  out = out.replace(/\{\{\s*([a-z0-9_]+)\s*(?:\|([^}]*))?\}\}/g, (_m, key: string, inline?: string) => {
    const v = val(key) || inline?.trim() || DEFAULT_FALLBACKS[key as MergeField] || "";
    return opts.html ? escapeHtml(v) : v;
  });
  return out;
}

/** Fields referenced by a template that would render empty (for the preview warning). */
export function missingFields(tpl: string, data: Partial<MergeData>): string[] {
  const out = new Set<string>();
  for (const m of tpl.matchAll(/\{\{\s*([a-z0-9_]+)\s*(\|[^}]*)?\}\}/g)) {
    const k = m[1];
    if (!m[2] && !DEFAULT_FALLBACKS[k as MergeField] && !(data as Record<string, string>)[k]) out.add(k);
  }
  return Array.from(out);
}
