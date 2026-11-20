// Starts and stops browser capture. Every stream is tied to a CaptureGuard
// taken *before* the browser is asked, and released when the stream ends —
// including when the user clicks the browser's own "Stop sharing" button.
import type { CaptureSource } from "../types";
import { indicator, type CaptureGuard } from "./indicator";

export interface ActiveCapture {
  stream: MediaStream;
  stop(): void;
}

function bind(stream: MediaStream, guards: CaptureGuard[]): ActiveCapture {
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    stream.getTracks().forEach((t) => t.stop());
    guards.forEach((g) => g.release());
  };
  // Browser UI ("Stop sharing") ends tracks without telling us otherwise.
  stream.getTracks().forEach((t) => t.addEventListener("ended", () => {
    if (stream.getTracks().every((x) => x.readyState === "ended")) stop();
  }));
  return { stream, stop };
}

async function withGuards(
  sources: CaptureSource[],
  open: () => Promise<MediaStream>,
): Promise<{ stream: MediaStream; guards: CaptureGuard[] }> {
  const guards = sources.map((s) => indicator.begin(s));
  try {
    return { stream: await open(), guards };
  } catch (e) {
    guards.forEach((g) => g.release());
    throw e;
  }
}

export async function startScreen(opts: { systemAudio: boolean }): Promise<ActiveCapture> {
  const { stream, guards } = await withGuards(
    opts.systemAudio ? ["screen", "systemAudio"] : ["screen"],
    () => navigator.mediaDevices.getDisplayMedia({ video: true, audio: opts.systemAudio }),
  );
  // The user may untick "share audio" in the picker: drop that indicator.
  const audioGuard = guards.find((g) => g.source === "systemAudio");
  if (audioGuard && stream.getAudioTracks().length === 0) {
    audioGuard.release();
    return bind(stream, guards.filter((g) => g !== audioGuard));
  }
  return bind(stream, guards);
}

export async function startMicrophone(): Promise<ActiveCapture> {
  const { stream, guards } = await withGuards(["microphone"], () =>
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }),
  );
  return bind(stream, guards);
}

export function describeError(e: unknown): string {
  const name = (e as DOMException)?.name;
  if (name === "NotAllowedError") return "Capture was cancelled or blocked by the browser.";
  if (name === "NotFoundError") return "No capture device was found.";
  return String((e as Error)?.message ?? e);
}
