/**
 * Suppression / do-not-call checks.
 *
 * The pure helpers (normalization + `checkSuppression`) are unit tested. The
 * DB-backed helpers below them are what every call and every email send goes
 * through — nothing is dialed or emailed without passing `assertCallable` /
 * `assertEmailable`.
 */
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export type SuppressionKind = "PHONE" | "EMAIL";
export type SuppressionEntry = { kind: SuppressionKind; value: string; reason: string };

/** Normalize to E.164 (defaults to US). Returns null for unparseable / invalid numbers. */
export function normalizePhone(raw: string | null | undefined, country: CountryCode = "US"): string | null {
  if (!raw) return null;
  const cleaned = String(raw).trim();
  if (!cleaned) return null;
  const parsed = parsePhoneNumberFromString(cleaned, country);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number; // E.164
}

/**
 * Normalize an email for suppression matching: trim + lower-case, and strip
 * "+tag" sub-addressing so `jo+promo@x.com` matches an unsubscribe of `jo@x.com`.
 */
export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const e = String(raw).trim().toLowerCase();
  const m = e.match(/^([^\s@]+)@([^\s@]+\.[^\s@]+)$/);
  if (!m) return null;
  const local = m[1].split("+")[0];
  return `${local}@${m[2]}`;
}

export function normalizeFor(kind: SuppressionKind, raw: string | null | undefined): string | null {
  return kind === "PHONE" ? normalizePhone(raw) : normalizeEmail(raw);
}

export type SuppressionCheck =
  | { allowed: true; normalized: string }
  | { allowed: false; normalized: string | null; reason: string };

/**
 * Pure check against an in-memory list. Also matches whole-domain email
 * suppressions written as "@domain.com".
 */
export function checkSuppression(
  kind: SuppressionKind,
  raw: string | null | undefined,
  list: SuppressionEntry[],
): SuppressionCheck {
  const normalized = normalizeFor(kind, raw);
  if (!normalized) return { allowed: false, normalized: null, reason: kind === "PHONE" ? "INVALID_PHONE" : "INVALID_EMAIL" };
  for (const s of list) {
    if (s.kind !== kind) continue;
    if (kind === "EMAIL" && s.value.startsWith("@")) {
      if (normalized.endsWith(s.value.toLowerCase())) return { allowed: false, normalized, reason: s.reason };
      continue;
    }
    const sv = normalizeFor(kind, s.value) ?? s.value;
    if (sv === normalized) return { allowed: false, normalized, reason: s.reason };
  }
  return { allowed: true, normalized };
}

// ───────────────────────── DB-backed helpers ─────────────────────────

type SuppressionDb = {
  suppression: {
    findMany(args: unknown): Promise<{ kind: SuppressionKind; value: string; reason: string }[]>;
    upsert(args: unknown): Promise<unknown>;
  };
};

async function entriesFor(db: SuppressionDb, kind: SuppressionKind, normalized: string) {
  const values = [normalized];
  if (kind === "EMAIL") values.push("@" + normalized.split("@")[1]);
  return db.suppression.findMany({ where: { kind, value: { in: values } } });
}

export async function isSuppressed(db: SuppressionDb, kind: SuppressionKind, raw: string | null | undefined) {
  const normalized = normalizeFor(kind, raw);
  if (!normalized) return checkSuppression(kind, raw, []);
  return checkSuppression(kind, normalized, await entriesFor(db, kind, normalized));
}

export async function suppress(
  db: SuppressionDb,
  kind: SuppressionKind,
  raw: string,
  reason: "DO_NOT_CALL" | "UNSUBSCRIBE" | "BOUNCE" | "COMPLAINT" | "MANUAL",
  note?: string,
) {
  const value = raw.trim().startsWith("@") ? raw.trim().toLowerCase() : normalizeFor(kind, raw);
  if (!value) throw new Error(`Invalid ${kind.toLowerCase()}: ${raw}`);
  await db.suppression.upsert({
    where: { kind_value: { kind, value } },
    create: { kind, value, reason, note },
    update: {}, // first reason wins; an unsubscribe is never downgraded
  });
  return value;
}
