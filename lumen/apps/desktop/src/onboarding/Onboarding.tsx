import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ipc } from "../ipc";
import { captureShortcut, indicatorPlace } from "../shortcuts";
import type { Permission, PermissionReport, Platform } from "../types";
import { isUsable } from "../types";
import { PermissionDetails } from "./PermissionStep";

const TERMS_URL =
  "https://github.com/koduahkk/koduahkk.github.io/blob/main/lumen/docs/ACCEPTABLE_USE.md";

export const STEPS = ["welcome", "screen", "microphone", "systemAudio", "responsibleUse", "ready"] as const;
type Step = (typeof STEPS)[number];

const TITLES: Record<Step, string> = {
  welcome: "Welcome to Lumen",
  screen: "Let Lumen see your screen",
  microphone: "Let Lumen hear you",
  systemAudio: "Meeting and system audio",
  responsibleUse: "Using Lumen responsibly",
  ready: "You're all set",
};

export function Onboarding() {
  const [index, setIndex] = useState(0);
  const [platform, setPlatform] = useState<Platform>("macos");
  const [reports, setReports] = useState<PermissionReport[]>([]);
  const [systemAudioOptIn, setSystemAudioOptIn] = useState(false);
  const [acceptableUse, setAcceptableUse] = useState(false);
  const [disclosure, setDisclosure] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const headingId = useId();

  const step = STEPS[index];
  const report = (p: Permission) => reports.find((r) => r.permission === p);

  const refresh = useCallback(async () => {
    try {
      setReports(await ipc.permissionReport());
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    ipc.platform().then(setPlatform).catch(() => {});
    void refresh();
    // Re-check when the user comes back from System Settings.
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  // Move focus to the new step's heading so screen readers announce it.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [index]);

  const onRequest = async (p: Permission) => {
    setError(null);
    try {
      await ipc.requestPermission(p);
    } catch (e) {
      setError(String(e));
    }
    await refresh();
  };
  const onOpenSettings = async (p: Permission) => {
    setError(null);
    try {
      await ipc.openPermissionSettings(p);
    } catch (e) {
      setError(String(e));
    }
  };
  const onRelaunch = () => ipc.relaunch();

  const screenOk = isUsable(report("screenRecording")?.status ?? "notDetermined");
  const micOk = isUsable(report("microphone")?.status ?? "notDetermined");

  const canContinue = (() => {
    switch (step) {
      case "screen":
        return screenOk;
      case "responsibleUse":
        return acceptableUse && disclosure;
      default:
        return true;
    }
  })();

  const continueLabel = step === "microphone" && !micOk ? "Skip for now" : "Continue";

  const finish = async () => {
    setFinishing(true);
    setError(null);
    try {
      await ipc.completeOnboarding({
        acceptableUseAck: acceptableUse,
        disclosureAck: disclosure,
        systemAudioOptIn,
      });
    } catch (e) {
      setError(String(e));
      setFinishing(false);
    }
  };

  const next = () => setIndex((i) => Math.min(i + 1, STEPS.length - 1));
  const back = () => setIndex((i) => Math.max(i - 1, 0));

  return (
    <main className="onboarding">
      <p className="progress" aria-live="polite">
        Step {index + 1} of {STEPS.length}
      </p>
      <div className="progress-bar" aria-hidden="true">
        <div style={{ width: `${((index + 1) / STEPS.length) * 100}%` }} />
      </div>

      <section aria-labelledby={headingId} className="step">
        <h1 id={headingId} ref={headingRef} tabIndex={-1}>
          {TITLES[step]}
        </h1>

        {step === "welcome" && (
          <>
            <p className="lede">
              Lumen answers questions about what's on your screen and what's being said — in a small panel
              that stays out of your way.
            </p>
            <ul className="why">
              <li>You decide when it captures. A red indicator {indicatorPlace(platform)} shows whenever it does.</li>
              <li>Nothing is captured until you finish setup and turn it on.</li>
              <li>Lumen never hides itself from screen sharing or recording.</li>
            </ul>
            <p className="never">The next steps explain each permission and why Lumen asks for it.</p>
          </>
        )}

        {step === "screen" && (
          <PermissionDetails
            permission="screenRecording"
            report={report("screenRecording")}
            platform={platform}
            onRequest={onRequest}
            onOpenSettings={onOpenSettings}
            onRelaunch={onRelaunch}
          />
        )}

        {step === "microphone" && (
          <PermissionDetails
            permission="microphone"
            report={report("microphone")}
            platform={platform}
            onRequest={onRequest}
            onOpenSettings={onOpenSettings}
            onRelaunch={onRelaunch}
          />
        )}

        {step === "systemAudio" && (
          <>
            <PermissionDetails
              permission="systemAudio"
              report={report("systemAudio")}
              platform={platform}
              onRequest={onRequest}
              onOpenSettings={onOpenSettings}
              onRelaunch={onRelaunch}
            />
            <label className="check">
              <input
                type="checkbox"
                checked={systemAudioOptIn}
                onChange={(e) => setSystemAudioOptIn(e.target.checked)}
              />
              <span>Let Lumen capture system audio (I'll tell others on the call)</span>
            </label>
          </>
        )}

        {step === "responsibleUse" && (
          <>
            <p className="lede">Lumen is a study, accessibility and productivity aid. Please confirm:</p>
            <label className="check">
              <input
                type="checkbox"
                checked={acceptableUse}
                onChange={(e) => setAcceptableUse(e.target.checked)}
              />
              <span>
                I won't use Lumen where AI help isn't allowed — exams, proctored assessments, or interviews
                that don't permit it.
              </span>
            </label>
            <label className="check">
              <input type="checkbox" checked={disclosure} onChange={(e) => setDisclosure(e.target.checked)} />
              <span>I'll tell other people when Lumen is listening to a conversation they're part of.</span>
            </label>
            <p className="never">
              These are part of the{" "}
              <a href={TERMS_URL} target="_blank" rel="noreferrer">
                Terms of Service
              </a>
              . Breaking them can end your account.
            </p>
          </>
        )}

        {step === "ready" && (
          <>
            <p className="lede">
              {platform === "web" ? (
                <>Press <strong>Share screen</strong> in the Lumen panel whenever you want it to look.</>
              ) : (
                <>
                  Press <kbd>{captureShortcut(platform)}</kbd> to capture your screen and ask about it.
                </>
              )}
            </p>
            <ul className="why">
              <li>
                Screen recording:{" "}
                {platform === "web" ? "your browser will ask when you start" : screenOk ? "on" : "off"}
              </li>
              <li>Microphone: {micOk ? "on" : "off — you can turn it on later in Settings"}</li>
              <li>System audio: {systemAudioOptIn ? "on (with reminders)" : "off"}</li>
            </ul>
          </>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>

      <nav className="actions" aria-label="Setup navigation">
        {index > 0 && (
          <button type="button" className="btn ghost" onClick={back} disabled={finishing}>
            Back
          </button>
        )}
        {step === "ready" ? (
          <button type="button" className="btn primary" onClick={finish} disabled={finishing}>
            {finishing ? "Starting…" : "Start using Lumen"}
          </button>
        ) : (
          <button type="button" className="btn primary" onClick={next} disabled={!canContinue}>
            {continueLabel}
          </button>
        )}
      </nav>
    </main>
  );
}
