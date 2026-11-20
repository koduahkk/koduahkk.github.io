import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ipc } from "../ipc";
import { captureShortcut } from "../shortcuts";
import type { Platform } from "../types";
import { CaptureBadge } from "./CaptureBadge";
import { WebCapture } from "./WebCapture";
import { canPopOut, popOut } from "./popout";

/** Floating answer panel. */
export function Panel() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [pip, setPip] = useState<Window | null>(null);

  useEffect(() => {
    ipc.platform().then(setPlatform).catch(() => setPlatform("web"));
  }, []);

  if (!platform) return null;
  const web = platform === "web";

  const openPip = async () => {
    const w = await popOut();
    w.addEventListener("pagehide", () => setPip(null));
    setPip(w);
  };

  const content = (
    <div className="panel">
      <header className="panel-header" data-tauri-drag-region>
        <span className="brand" data-tauri-drag-region>
          Lumen
        </span>
        <CaptureBadge />
        {web && canPopOut() && !pip && (
          <button type="button" className="icon-btn" onClick={openPip} aria-label="Pop out into a floating window">
            ⧉
          </button>
        )}
      </header>
      <main className="panel-body" aria-label="Lumen panel">
        {web ? (
          <WebCapture />
        ) : (
          <p className="empty">
            Press <kbd>{captureShortcut(platform)}</kbd> to capture your screen and ask about it.
          </p>
        )}
      </main>
    </div>
  );

  // In Picture-in-Picture the same React tree (and its live streams) renders
  // into the floating window.
  if (pip) {
    return (
      <>
        <div className="pip-placeholder">
          <p>Lumen is open in a floating window that stays on top.</p>
          <button type="button" className="btn" onClick={() => pip.close()}>
            Bring it back here
          </button>
        </div>
        {createPortal(content, pip.document.body)}
      </>
    );
  }
  return <div className={web ? "web-shell" : undefined}>{content}</div>;
}
