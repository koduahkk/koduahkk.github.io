import type { Platform } from "./types";

export function captureShortcut(platform: Platform): string {
  return platform === "macos" ? "⌘ ⇧ Space" : "Ctrl + Shift + Space";
}

export function settingsName(platform: Platform): string {
  if (platform === "web") return "your browser's site settings";
  return platform === "macos" ? "System Settings" : "Settings";
}

/** Where the capture indicator lives, for onboarding copy. */
export function indicatorPlace(platform: Platform): string {
  if (platform === "web") return "in the tab title and the Lumen panel";
  return platform === "macos" ? "in the menu bar and the panel" : "in the system tray and the panel";
}
