/**
 * Shared domain constants and labels. Kept free of Prisma/runtime imports so
 * it can be used from client components and pure unit-tested modules alike.
 * The string unions mirror the Prisma enums one-to-one.
 */

export const CALL_OUTCOMES = [
  "ANSWERED_HUMAN",
  "ANSWERED_AI_OR_SERVICE",
  "VOICEMAIL_WITH_BOOKING_INFO",
  "VOICEMAIL_BASIC",
  "VOICEMAIL_FULL",
  "NO_ANSWER_NO_VOICEMAIL",
  "BUSY",
  "DISCONNECTED_OR_WRONG_NUMBER",
] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export type CallType = "A" | "B";
export type ScoreTier = "HOT" | "WARM" | "COLD" | "DEAD";

export const OUTCOME_META: Record<
  CallOutcome,
  { label: string; short: string; key: string; tone: "good" | "meh" | "bad" | "dead" }
> = {
  ANSWERED_HUMAN: { label: "Answered by a person", short: "answered", key: "1", tone: "good" },
  ANSWERED_AI_OR_SERVICE: { label: "Answered by AI / answering service", short: "answering service", key: "2", tone: "good" },
  VOICEMAIL_WITH_BOOKING_INFO: { label: "Voicemail with booking info", short: "voicemail with booking link", key: "3", tone: "meh" },
  VOICEMAIL_BASIC: { label: "Basic voicemail", short: "basic voicemail", key: "4", tone: "meh" },
  VOICEMAIL_FULL: { label: "Voicemail full", short: "voicemail full", key: "5", tone: "bad" },
  NO_ANSWER_NO_VOICEMAIL: { label: "No answer, no voicemail", short: "no answer, no voicemail", key: "6", tone: "bad" },
  BUSY: { label: "Busy", short: "busy signal", key: "7", tone: "bad" },
  DISCONNECTED_OR_WRONG_NUMBER: { label: "Disconnected / wrong number", short: "disconnected", key: "8", tone: "dead" },
};

export const LEAD_STAGES = [
  "NEW",
  "TESTING",
  "HOT",
  "WARM",
  "COLD",
  "EMAILED",
  "REPLIED",
  "DEMO_BOOKED",
  "TRIAL",
  "CUSTOMER",
  "LOST",
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const STAGE_LABEL: Record<LeadStage, string> = {
  NEW: "New",
  TESTING: "Testing",
  HOT: "Hot",
  WARM: "Warm",
  COLD: "Cold",
  EMAILED: "Emailed",
  REPLIED: "Replied",
  DEMO_BOOKED: "Demo booked",
  TRIAL: "Trial",
  CUSTOMER: "Customer",
  LOST: "Lost",
};

export const SALON_CATEGORIES = [
  { value: "hair_salon", label: "Hair salon", placesType: "hair_salon", query: "hair salon" },
  { value: "nail_salon", label: "Nail salon", placesType: "nail_salon", query: "nail salon" },
  { value: "barber_shop", label: "Barbershop", placesType: "barber_shop", query: "barbershop" },
  { value: "beauty_salon", label: "Beauty salon", placesType: "beauty_salon", query: "beauty salon" },
  { value: "spa", label: "Spa", placesType: "spa", query: "day spa" },
  { value: "lash_brow", label: "Lash / brow studio", placesType: null, query: "lash and brow studio" },
] as const;

export const BOOKING_PLATFORMS = [
  "Vagaro",
  "Booksy",
  "Fresha",
  "GlossGenius",
  "Square",
  "StyleSeat",
  "Schedulicity",
] as const;
export type BookingPlatform = (typeof BOOKING_PLATFORMS)[number];

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Day = (typeof DAYS)[number];

/** One open interval in local "HH:mm". `close` <= `open` means it closes after midnight. */
export type HoursInterval = { open: string; close: string };
export type WeeklyHours = Partial<Record<Day, HoursInterval[]>>;
