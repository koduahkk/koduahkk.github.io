/**
 * App settings: one singleton row with four JSON sections, each validated by
 * zod with defaults so a fresh database works out of the box.
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { DAYS } from "@/lib/domain";
import { scoringRulesSchema } from "@/lib/scoring/engine";
import { DEFAULT_SCHEDULER_CONFIG, peakWindowSchema, weeklyHoursSchema } from "@/lib/scheduler/slots";
import { sourcingSchema } from "@/lib/sourcing/plan";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const generalSchema = z.object({
  dailyQuota: z.number().int().min(1).max(500).default(50),
  priorityTerritoryId: z.string().nullable().default(null),
  /** Zone the daily planner runs in and "today" is computed in. */
  plannerTimezone: z.string().default("America/New_York"),
  businessName: z.string().default("NeverMissed"),
  /** CAN-SPAM requires a valid physical postal address in every email. */
  businessAddress: z.string().default(""),
  senderName: z.string().default(""),
  demoLink: z.string().default(""),
  demoPhone: z.string().default(""),
});

export const callingSchema = z.object({
  peakWindows: z.array(peakWindowSchema).default(DEFAULT_SCHEDULER_CONFIG.peakWindows),
  afterHoursMinOffsetMin: z.number().int().min(0).max(240).default(30),
  afterHoursMaxOffsetMin: z.number().int().min(5).max(300).default(90),
  maxCallsPer15Min: z.number().int().min(1).max(50).default(4),
  separateDays: z.boolean().default(true),
  minLeadTimeMin: z.number().int().min(0).default(10),
  horizonDays: z.number().int().min(1).max(14).default(7),
  defaultHours: weeklyHoursSchema.default(DEFAULT_SCHEDULER_CONFIG.defaultHours),
  callerScript: z
    .string()
    .default(
      "Hi! I was hoping to book an appointment — do you have anything open this week?\n\nIf they answer: ask one real question (price of a cut / availability), thank them, and say you'll book online. Keep it under 60 seconds. Never mention this is a test.",
    ),
  /** Twilio browser calling (Voice SDK) instead of tel: links. */
  browserCalling: z.boolean().default(false),
  /** Automated test-call mode (Twilio + AMD). OFF by default. */
  automatedEnabled: z.boolean().default(false),
  /** Record the greeting on automated calls (only where legally permitted). */
  recordGreetings: z.boolean().default(false),
  /** States (2-letter) where recording is allowed. All-party-consent states are always excluded. */
  recordingAllowedStates: z.array(z.string().length(2)).default([]),
  maxRingSeconds: z.number().int().min(10).max(60).default(30),
});

export const emailSchema = z.object({
  provider: z.enum(["console", "resend", "sendgrid"]).default("console"),
  defaultDailyLimit: z.number().int().min(1).max(500).default(40),
  minSpacingSec: z.number().int().min(10).default(90),
  maxSpacingSec: z.number().int().min(10).default(420),
  trackOpens: z.boolean().default(false),
  trackClicks: z.boolean().default(true),
  /** Send only inside this window in the LEAD's local time. */
  sendWindowStart: hhmm.default("08:30"),
  sendWindowEnd: hhmm.default("17:30"),
  sendDays: z.array(z.enum(DAYS)).default(["mon", "tue", "wed", "thu", "fri"]),
  /** Domain whose replies are routed to the inbound webhook, e.g. "reply.nevermissed.ai". */
  replyDomain: z.string().default(""),
});

export const settingsSchema = z.object({
  general: generalSchema,
  calling: callingSchema,
  scoring: scoringRulesSchema,
  email: emailSchema,
  sourcing: sourcingSchema,
});
export type AppSettings = z.infer<typeof settingsSchema>;
export type SettingsSection = keyof AppSettings;

export const DEFAULT_SETTINGS: AppSettings = settingsSchema.parse({ general: {}, calling: {}, scoring: {}, email: {}, sourcing: {} });

/** Load settings, filling in defaults for any missing / invalid keys. */
export async function getSettings(): Promise<AppSettings> {
  const row = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!row) return DEFAULT_SETTINGS;
  const safe = <T extends z.ZodTypeAny>(schema: T, v: unknown, fallback: z.infer<T>): z.infer<T> => {
    const r = schema.safeParse(v ?? {});
    return r.success ? r.data : fallback;
  };
  return {
    general: safe(generalSchema, row.general, DEFAULT_SETTINGS.general),
    calling: safe(callingSchema, row.calling, DEFAULT_SETTINGS.calling),
    scoring: safe(scoringRulesSchema, row.scoring, DEFAULT_SETTINGS.scoring),
    email: safe(emailSchema, row.email, DEFAULT_SETTINGS.email),
    sourcing: safe(sourcingSchema, row.sourcing, DEFAULT_SETTINGS.sourcing),
  };
}

export async function saveSettingsSection<K extends SettingsSection>(section: K, value: unknown) {
  const parsed = settingsSchema.shape[section].parse(value) as AppSettings[K];
  const current = await getSettings();
  const next = { ...current, [section]: parsed };
  await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1, ...next },
    update: { [section]: parsed },
  });
  return next;
}

/** All-party-consent states for call recording (keep reviewed with counsel). */
export const ALL_PARTY_CONSENT_STATES = ["CA", "CT", "DE", "FL", "IL", "MD", "MA", "MI", "MT", "NV", "NH", "OR", "PA", "WA"];

export function recordingPermitted(calling: AppSettings["calling"], state: string | null | undefined) {
  if (!calling.recordGreetings || !state) return false;
  const st = state.toUpperCase();
  if (ALL_PARTY_CONSENT_STATES.includes(st)) return false;
  return calling.recordingAllowedStates.map((s) => s.toUpperCase()).includes(st);
}
