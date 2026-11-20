// Versioned consent record in localStorage. Mirrors lumen-core::consent.
// Fails closed: unreadable or missing storage means "not onboarded".
import type { ConsentRecord } from "../types";

export const CURRENT_TERMS_VERSION = 1;
const KEY = "lumen.consent.v1";

export const emptyConsent = (): ConsentRecord => ({
  termsVersion: 0,
  completedAt: null,
  acceptableUseAck: false,
  disclosureAck: false,
  systemAudioOptIn: false,
  meetingReminderShown: false,
});

export function onboardingComplete(r: ConsentRecord): boolean {
  return (
    r.termsVersion >= CURRENT_TERMS_VERSION && r.acceptableUseAck && r.disclosureAck && r.completedAt !== null
  );
}

export function loadConsent(): ConsentRecord {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyConsent();
    return { ...emptyConsent(), ...JSON.parse(raw) };
  } catch {
    return emptyConsent();
  }
}

export function completeConsent(args: {
  acceptableUseAck: boolean;
  disclosureAck: boolean;
  systemAudioOptIn: boolean;
}): ConsentRecord {
  if (!args.acceptableUseAck || !args.disclosureAck) {
    throw new Error("You must accept the responsible-use terms to continue.");
  }
  const record: ConsentRecord = {
    ...loadConsent(),
    termsVersion: CURRENT_TERMS_VERSION,
    completedAt: Math.floor(Date.now() / 1000),
    acceptableUseAck: true,
    disclosureAck: true,
    systemAudioOptIn: args.systemAudioOptIn,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    // Private mode / blocked storage: consent holds for this page load only.
  }
  return record;
}

export function markMeetingReminderShown(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...loadConsent(), meetingReminderShown: true }));
  } catch {
    /* storage unavailable: the reminder may show again, which is the safe side */
  }
}
