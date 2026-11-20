import type { Platform } from "./types";

export function captureShortcut(platform: Platform): string {
  return platform === "macos" ? "⌘ ⇧ Space" : "Ctrl + Shift + Space";
}

export function settingsName(platform: Platform): string {
  return platform === "macos" ? "System Settings" : "Settings";
}
