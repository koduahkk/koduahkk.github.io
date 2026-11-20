// Browser permission model. Screen (and tab/system audio) can't be pre-granted:
// the browser shows its picker every time capture starts. The microphone has a
// real, persistent per-site permission.
import type { Permission, PermissionReport, PermissionStatus } from "../types";

const md = () => (typeof navigator !== "undefined" ? navigator.mediaDevices : undefined);

export const supportsScreenCapture = () => typeof md()?.getDisplayMedia === "function";

/** Chromium-based browsers can share tab audio (and system audio on Windows/ChromeOS). */
export function supportsSystemAudio(): boolean {
  const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData
    ?.brands;
  return supportsScreenCapture() && !!brands?.some((b) => /Chromium|Google Chrome|Microsoft Edge/.test(b.brand));
}

async function micStatus(): Promise<PermissionStatus> {
  if (typeof md()?.getUserMedia !== "function") return "unsupported";
  try {
    const result = await navigator.permissions.query({ name: "microphone" as PermissionName });
    if (result.state === "granted") return "granted";
    if (result.state === "denied") return "denied";
    return "notDetermined";
  } catch {
    // Some browsers can't query the microphone permission; asking is harmless.
    return "notDetermined";
  }
}

export async function status(permission: Permission): Promise<PermissionStatus> {
  switch (permission) {
    case "screenRecording":
      return supportsScreenCapture() ? "askEachTime" : "unsupported";
    case "systemAudio":
      return supportsSystemAudio() ? "askEachTime" : "unsupported";
    case "microphone":
      return micStatus();
  }
}

export async function request(permission: Permission): Promise<PermissionStatus> {
  if (permission !== "microphone") return status(permission);
  try {
    const stream = await md()!.getUserMedia({ audio: true });
    // We only wanted the grant; release the device immediately.
    stream.getTracks().forEach((t) => t.stop());
    return "granted";
  } catch (e) {
    return (e as DOMException)?.name === "NotAllowedError" ? "denied" : micStatus();
  }
}

export async function report(): Promise<PermissionReport[]> {
  const all: Permission[] = ["screenRecording", "microphone", "systemAudio"];
  return Promise.all(
    all.map(async (permission) => ({
      permission,
      status: await status(permission),
      required: permission === "screenRecording",
      settingsUrl: null,
    })),
  );
}
