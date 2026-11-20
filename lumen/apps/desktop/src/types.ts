// Mirrors lumen-core's serde types (camelCase).

export type Permission = "screenRecording" | "microphone" | "systemAudio";

export type PermissionStatus =
  | "granted"
  | "denied"
  | "notDetermined"
  | "restricted"
  | "grantedNeedsRelaunch"
  | "notApplicable"
  | "unsupported";

export interface PermissionReport {
  permission: Permission;
  status: PermissionStatus;
  required: boolean;
  settingsUrl: string | null;
}

export type CaptureSource = "screen" | "microphone" | "systemAudio";

export interface IndicatorState {
  active: boolean;
  sources: CaptureSource[];
}

export interface ConsentRecord {
  termsVersion: number;
  completedAt: number | null;
  acceptableUseAck: boolean;
  disclosureAck: boolean;
  systemAudioOptIn: boolean;
  meetingReminderShown: boolean;
}

export type Platform = "macos" | "windows" | "linux" | string;

export const isUsable = (s: PermissionStatus) => s === "granted" || s === "notApplicable";
