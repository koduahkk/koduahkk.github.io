import { DateTime } from "luxon";

export function fmtIn(d: Date | null | undefined, zone: string | null | undefined, fmt = "ccc LLL d, h:mma") {
  if (!d) return "—";
  return DateTime.fromJSDate(d, { zone: zone || "America/New_York" }).toFormat(fmt).replace(/AM|PM/, (m) => m.toLowerCase());
}

export function zoneAbbr(d: Date, zone: string | null | undefined) {
  return DateTime.fromJSDate(d, { zone: zone || "America/New_York" }).toFormat("ZZZZ");
}

export function relative(d: Date | null | undefined) {
  if (!d) return "—";
  return DateTime.fromJSDate(d).toRelative({ style: "short" }) ?? "";
}

export function titleCase(s: string) {
  return s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
