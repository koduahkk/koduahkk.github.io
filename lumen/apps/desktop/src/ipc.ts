// The only module that talks to the Rust side. Components import from here so
// tests can mock one file.
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  ConsentRecord,
  IndicatorState,
  Permission,
  PermissionReport,
  PermissionStatus,
  Platform,
} from "./types";

export const INDICATOR_EVENT = "indicator://changed";

export const ipc = {
  platform: () => invoke<Platform>("platform"),
  permissionReport: () => invoke<PermissionReport[]>("permission_report"),
  requestPermission: (permission: Permission) =>
    invoke<PermissionStatus>("request_permission", { permission }),
  openPermissionSettings: (permission: Permission) =>
    invoke<void>("open_permission_settings", { permission }),
  consentState: () => invoke<ConsentRecord>("consent_state"),
  completeOnboarding: (args: {
    acceptableUseAck: boolean;
    disclosureAck: boolean;
    systemAudioOptIn: boolean;
  }) => invoke<ConsentRecord>("complete_onboarding", args),
  indicatorState: () => invoke<IndicatorState>("indicator_state"),
  onIndicatorChange: (cb: (s: IndicatorState) => void): Promise<UnlistenFn> =>
    listen<IndicatorState>(INDICATOR_EVENT, (e) => cb(e.payload)),
  relaunch: () => invoke<void>("relaunch"),
};
