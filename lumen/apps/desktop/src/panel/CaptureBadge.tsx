import { useEffect, useState } from "react";
import { ipc } from "../ipc";
import type { CaptureSource, IndicatorState } from "../types";

const NAMES: Record<CaptureSource, string> = {
  screen: "screen",
  microphone: "microphone",
  systemAudio: "system audio",
};

export function badgeLabel(state: IndicatorState): string {
  if (!state.active) return "Not capturing";
  return `Capturing ${state.sources.map((s) => NAMES[s]).join(", ")}`;
}

/** Mirrors the tray indicator inside the panel. Always rendered, never hidden. */
export function CaptureBadge() {
  const [state, setState] = useState<IndicatorState>({ active: false, sources: [] });

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    ipc.indicatorState().then((s) => !cancelled && setState(s)).catch(() => {});
    ipc
      .onIndicatorChange(setState)
      .then((fn) => (cancelled ? fn() : (unlisten = fn)))
      .catch(() => {});
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  return (
    <div
      className={`badge ${state.active ? "live" : "idle"}`}
      role="status"
      aria-live="polite"
      data-testid="capture-badge"
    >
      <span className="dot" aria-hidden="true" />
      {badgeLabel(state)}
    </div>
  );
}
