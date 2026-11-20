import { useState } from "react";
import type { Permission, PermissionReport, Platform } from "../types";
import { isUsable } from "../types";
import { settingsName } from "../shortcuts";
import { PERMISSION_COPY, statusText } from "./copy";

interface Props {
  permission: Permission;
  report: PermissionReport | undefined;
  platform: Platform;
  onRequest: (p: Permission) => Promise<void>;
  onOpenSettings: (p: Permission) => Promise<void>;
  onRelaunch: () => Promise<void>;
}

export function PermissionDetails({
  permission,
  report,
  platform,
  onRequest,
  onOpenSettings,
  onRelaunch,
}: Props) {
  const copy = PERMISSION_COPY[permission];
  const [busy, setBusy] = useState(false);
  const status = report?.status ?? "notDetermined";
  const usable = isUsable(status);
  const statusId = `${permission}-status`;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  // macOS applies a new Screen Recording grant only after relaunch.
  const offerRelaunch =
    platform === "macos" &&
    (permission === "screenRecording" || permission === "systemAudio") &&
    !usable;

  return (
    <>
      <ul className="why">
        {copy.why.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="never">{copy.never}</p>

      <div className={`perm-status ${usable ? "ok" : "pending"}`}>
        <span className="dot" aria-hidden="true" />
        <span id={statusId} role="status" aria-live="polite">
          {copy.title}: {statusText(status, platform)}
        </span>
      </div>

      {!usable && (
        <div className="row">
          {status === "notDetermined" && (
            <button
              type="button"
              className="btn primary"
              disabled={busy}
              aria-describedby={statusId}
              onClick={() => run(() => onRequest(permission))}
            >
              Allow {copy.title.toLowerCase()}
            </button>
          )}
          {report?.settingsUrl && status !== "unsupported" && (
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => run(() => onOpenSettings(permission))}
            >
              Open {settingsName(platform)}
            </button>
          )}
          {offerRelaunch && (
            <button type="button" className="btn ghost" disabled={busy} onClick={() => run(onRelaunch)}>
              I've turned it on — relaunch Lumen
            </button>
          )}
        </div>
      )}
    </>
  );
}
