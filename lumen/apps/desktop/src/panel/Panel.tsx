import { useEffect, useState } from "react";
import { ipc } from "../ipc";
import { captureShortcut } from "../shortcuts";
import type { Platform } from "../types";
import { CaptureBadge } from "./CaptureBadge";

/** Floating answer panel. Phase 1 shell: header, indicator, empty state. */
export function Panel() {
  const [platform, setPlatform] = useState<Platform>("macos");
  useEffect(() => {
    ipc.platform().then(setPlatform).catch(() => {});
  }, []);

  return (
    <div className="panel">
      <header className="panel-header" data-tauri-drag-region>
        <span className="brand" data-tauri-drag-region>
          Lumen
        </span>
        <CaptureBadge />
      </header>
      <main className="panel-body" aria-label="Answers">
        <p className="empty">
          Press <kbd>{captureShortcut(platform)}</kbd> to capture your screen and ask about it.
        </p>
      </main>
    </div>
  );
}
