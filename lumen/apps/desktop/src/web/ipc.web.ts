// Web backend: implements the same Ipc contract as the desktop app using
// browser APIs.
import type { Ipc } from "../types";
import { completeConsent, loadConsent } from "./consent";
import { indicator } from "./indicator";
import * as permissions from "./permissions";

export const webIpc: Ipc = {
  platform: async () => "web",
  permissionReport: () => permissions.report(),
  requestPermission: (p) => permissions.request(p),
  openPermissionSettings: async () => {},
  consentState: async () => loadConsent(),
  completeOnboarding: async (args) => {
    const record = completeConsent(args);
    window.location.hash = "#/panel";
    return record;
  },
  indicatorState: async () => indicator.state(),
  onIndicatorChange: async (cb) => indicator.subscribe(cb),
  relaunch: async () => window.location.reload(),
};
