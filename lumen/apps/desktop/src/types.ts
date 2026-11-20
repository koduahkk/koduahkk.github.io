// Mirrors lumen-core's serde types (camelCase).

export type Permission = "screenRecording" | "microphone" | "systemAudio";

export type PermissionStatus =
  | "granted"
  | "denied"
  | "notDetermined"
  | "restricted"
  | "grantedNeedsRelaunch"
  | "notApplicable"
  | "unsupported"
  /** Web only: the browser asks every time capture starts, so there is nothing to pre-grant. */
  | "askEachTime";

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

export const isUsable = (s: PermissionStatus) =>
  s === "granted" || s === "notApplicable" || s === "askEachTime";

/** The backend the UI talks to: Tauri IPC on desktop, browser APIs on the web. */
export interface Ipc {
  platform(): Promise<Platform>;
  permissionReport(): Promise<PermissionReport[]>;
  requestPermission(permission: Permission): Promise<PermissionStatus>;
  openPermissionSettings(permission: Permission): Promise<void>;
  consentState(): Promise<ConsentRecord>;
  completeOnboarding(args: {
    acceptableUseAck: boolean;
    disclosureAck: boolean;
    systemAudioOptIn: boolean;
  }): Promise<ConsentRecord>;
  indicatorState(): Promise<IndicatorState>;
  onIndicatorChange(cb: (s: IndicatorState) => void): Promise<() => void>;
  relaunch(): Promise<void>;
}
