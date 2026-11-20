import type { Permission, PermissionStatus, Platform } from "../types";
import { settingsName } from "../shortcuts";

export interface PermissionCopy {
  title: string;
  why: string[];
  never: string;
}

export const PERMISSION_COPY: Record<Permission, PermissionCopy> = {
  screenRecording: {
    title: "Screen recording",
    why: [
      "Lumen reads your screen only when you capture (or while Listen mode is on) so it can answer questions about what you're looking at.",
      "Text is extracted on your device first, and passwords, card numbers and API keys are removed before anything is sent.",
      "You can draw a box to limit capture to part of the screen, and block apps such as password managers entirely.",
    ],
    never: "Screenshots are processed in memory and discarded. They are never stored on our servers.",
  },
  microphone: {
    title: "Microphone",
    why: [
      "Lumen transcribes speech to spot questions — in Manual mode it uses only the last 30 seconds when you press the hotkey.",
      "In Listen mode it transcribes continuously until you turn it off.",
    ],
    never: "Audio is streamed for transcription and discarded. It is never stored on our servers.",
  },
  systemAudio: {
    title: "System audio",
    why: [
      "Optional. Lets Lumen hear the other side of a call or a video you're watching.",
      "This records other people. Lumen will remind you to tell them you're using an AI note-taker.",
    ],
    never: "Off by default. You can turn it on or off at any time in Settings.",
  },
};

export function statusText(status: PermissionStatus, platform: Platform): string {
  const settings = settingsName(platform);
  switch (status) {
    case "granted":
      return "Allowed";
    case "notApplicable":
      return "No permission needed on this system";
    case "notDetermined":
      return "Not allowed yet";
    case "denied":
      return `Not allowed — turn it on in ${settings}`;
    case "restricted":
      return "Blocked by your organisation's device policy";
    case "grantedNeedsRelaunch":
      return "Allowed — relaunch Lumen to apply";
    case "unsupported":
      return platform === "web"
        ? "Not supported in this browser — try Chrome, Edge or Firefox on a computer"
        : "Not supported on this version of your operating system";
    case "askEachTime":
      return "Your browser asks each time you start capturing";
  }
}
