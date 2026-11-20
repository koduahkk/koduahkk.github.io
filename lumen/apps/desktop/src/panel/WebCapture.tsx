import { useEffect, useRef, useState } from "react";
import { ipc } from "../ipc";
import type { ConsentRecord } from "../types";
import { describeError, startMicrophone, startScreen, type ActiveCapture } from "../web/capture";
import { markMeetingReminderShown } from "../web/consent";
import { supportsSystemAudio } from "../web/permissions";

export const ANNOUNCE_SNIPPET =
  "Heads up: I'm using Lumen, an AI assistant, to help me follow along. It can hear this call. Let me know if you'd rather I turn it off.";

/** Browser capture controls with a live preview of exactly what Lumen sees. */
export function WebCapture() {
  const [consent, setConsent] = useState<ConsentRecord | null>(null);
  const [screen, setScreen] = useState<ActiveCapture | null>(null);
  const [mic, setMic] = useState<ActiveCapture | null>(null);
  const [withAudio, setWithAudio] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reminder, setReminder] = useState(false);
  const [copied, setCopied] = useState(false);
  const preview = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    ipc.consentState().then((c) => {
      setConsent(c);
      setWithAudio(c.systemAudioOptIn && supportsSystemAudio());
    });
  }, []);

  // Stop everything if the panel goes away.
  const live = useRef<{ screen: ActiveCapture | null; mic: ActiveCapture | null }>({ screen: null, mic: null });
  live.current = { screen, mic };
  useEffect(() => () => {
    live.current.screen?.stop();
    live.current.mic?.stop();
  }, []);

  useEffect(() => {
    if (preview.current) preview.current.srcObject = screen?.stream ?? null;
  }, [screen]);

  const track = (cap: ActiveCapture, clear: () => void) => {
    cap.stream.getTracks().forEach((t) =>
      t.addEventListener("ended", () => {
        if (cap.stream.getTracks().every((x) => x.readyState === "ended")) clear();
      }),
    );
  };

  const toggleScreen = async () => {
    setError(null);
    if (screen) {
      screen.stop();
      setScreen(null);
      return;
    }
    try {
      const cap = await startScreen({ systemAudio: withAudio });
      track(cap, () => setScreen(null));
      setScreen(cap);
      if (cap.stream.getAudioTracks().length > 0 && consent && !consent.meetingReminderShown) {
        setReminder(true);
        markMeetingReminderShown();
        setConsent({ ...consent, meetingReminderShown: true });
      }
    } catch (e) {
      setError(describeError(e));
    }
  };

  const toggleMic = async () => {
    setError(null);
    if (mic) {
      mic.stop();
      setMic(null);
      return;
    }
    try {
      const cap = await startMicrophone();
      track(cap, () => setMic(null));
      setMic(cap);
    } catch (e) {
      setError(describeError(e));
    }
  };

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(ANNOUNCE_SNIPPET);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const audioAllowed = !!consent?.systemAudioOptIn && supportsSystemAudio();

  return (
    <div className="web-capture">
      <div className="row">
        <button type="button" className={`btn ${screen ? "danger" : "primary"}`} aria-pressed={!!screen} onClick={toggleScreen}>
          {screen ? "Stop sharing" : "Share screen"}
        </button>
        <button type="button" className={`btn ${mic ? "danger" : ""}`} aria-pressed={!!mic} onClick={toggleMic}>
          {mic ? "Stop microphone" : "Microphone"}
        </button>
      </div>

      {audioAllowed && !screen && (
        <label className="check small">
          <input type="checkbox" checked={withAudio} onChange={(e) => setWithAudio(e.target.checked)} />
          <span>Include tab or system audio (tick "Share audio" in the browser picker)</span>
        </label>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {reminder && (
        <div className="reminder" role="alertdialog" aria-labelledby="reminder-title" aria-describedby="reminder-body">
          <p id="reminder-title" className="reminder-title">
            Let others know Lumen is listening
          </p>
          <p id="reminder-body">Lumen can hear other people on this call. You could paste this into the chat:</p>
          <blockquote>{ANNOUNCE_SNIPPET}</blockquote>
          <div className="row">
            <button type="button" className="btn primary" onClick={copySnippet}>
              {copied ? "Copied" : "Copy message"}
            </button>
            <button type="button" className="btn ghost" onClick={() => setReminder(false)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {screen ? (
        <video ref={preview} className="preview" autoPlay muted playsInline aria-label="Preview of what Lumen can see" />
      ) : (
        <p className="empty">Share a screen, window or tab to let Lumen see it.</p>
      )}

      <p className="note">
        Preview release: Lumen shows what it would capture, but answering questions is coming in the next
        update. Nothing you share leaves this browser.
      </p>
    </div>
  );
}
