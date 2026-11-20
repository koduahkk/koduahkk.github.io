import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaptureIndicator } from "../web/indicator";
import { completeConsent, loadConsent, markMeetingReminderShown, onboardingComplete } from "../web/consent";
import * as permissions from "../web/permissions";

class FakeTrack extends EventTarget {
  readyState: "live" | "ended" = "live";
  constructor(public kind: "audio" | "video") {
    super();
  }
  stop() {
    this.readyState = "ended";
  }
  end() {
    this.readyState = "ended";
    this.dispatchEvent(new Event("ended"));
  }
}
const fakeStream = (...kinds: Array<"audio" | "video">) => {
  const tracks = kinds.map((k) => new FakeTrack(k));
  return {
    tracks,
    getTracks: () => tracks,
    getAudioTracks: () => tracks.filter((t) => t.kind === "audio"),
  } as unknown as MediaStream & { tracks: FakeTrack[] };
};

describe("web CaptureIndicator", () => {
  beforeEach(() => {
    document.title = "Lumen";
  });

  it("shows in the tab title while any guard is held", () => {
    const ind = new CaptureIndicator();
    const a = ind.begin("screen");
    const b = ind.begin("microphone");
    expect(document.title).toBe("● Recording — Lumen");
    expect(ind.state()).toEqual({ active: true, sources: ["screen", "microphone"] });
    a.release();
    a.release(); // idempotent
    expect(ind.state().sources).toEqual(["microphone"]);
    b.release();
    expect(ind.state().active).toBe(false);
    expect(document.title).toBe("Lumen");
  });

  it("notifies subscribers", () => {
    const ind = new CaptureIndicator();
    const seen: boolean[] = [];
    const off = ind.subscribe((s) => seen.push(s.active));
    ind.begin("screen").release();
    off();
    ind.begin("screen");
    expect(seen).toEqual([true, false]);
  });
});

describe("web consent", () => {
  beforeEach(() => localStorage.clear());

  it("fails closed on missing or corrupt storage", () => {
    expect(onboardingComplete(loadConsent())).toBe(false);
    localStorage.setItem("lumen.consent.v1", "{oops");
    expect(onboardingComplete(loadConsent())).toBe(false);
  });

  it("requires both acknowledgements", () => {
    expect(() => completeConsent({ acceptableUseAck: true, disclosureAck: false, systemAudioOptIn: false })).toThrow();
    expect(onboardingComplete(loadConsent())).toBe(false);
  });

  it("persists completion and the one-time meeting reminder", () => {
    completeConsent({ acceptableUseAck: true, disclosureAck: true, systemAudioOptIn: true });
    expect(onboardingComplete(loadConsent())).toBe(true);
    expect(loadConsent().meetingReminderShown).toBe(false);
    markMeetingReminderShown();
    expect(loadConsent()).toMatchObject({ meetingReminderShown: true, systemAudioOptIn: true });
  });
});

describe("web permissions and capture", () => {
  const original = navigator.mediaDevices;
  let getDisplayMedia: ReturnType<typeof vi.fn>;
  let getUserMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getDisplayMedia = vi.fn();
    getUserMedia = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getDisplayMedia, getUserMedia },
    });
  });
  afterEach(() => {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: original });
    vi.resetModules();
  });

  it("reports screen capture as ask-each-time and maps microphone denial", async () => {
    expect(await permissions.status("screenRecording")).toBe("askEachTime");
    getUserMedia.mockRejectedValue(Object.assign(new Error("no"), { name: "NotAllowedError" }));
    expect(await permissions.request("microphone")).toBe("denied");
  });

  it("releases the microphone right after a grant", async () => {
    const stream = fakeStream("audio");
    getUserMedia.mockResolvedValue(stream);
    expect(await permissions.request("microphone")).toBe("granted");
    expect(stream.tracks[0].readyState).toBe("ended");
  });

  it("shows the indicator before asking the browser, and clears it on 'Stop sharing'", async () => {
    const { indicator } = await import("../web/indicator");
    const { startScreen } = await import("../web/capture");
    const stream = fakeStream("video", "audio");
    getDisplayMedia.mockImplementation(async () => {
      // The indicator must already be on when the browser prompt appears.
      expect(indicator.state()).toEqual({ active: true, sources: ["screen", "systemAudio"] });
      return stream;
    });
    await startScreen({ systemAudio: true });
    stream.tracks.forEach((t) => t.end()); // user clicked the browser's Stop sharing
    expect(indicator.state().active).toBe(false);
  });

  it("drops the system-audio indicator if the user didn't share audio, and rolls back on cancel", async () => {
    const { indicator } = await import("../web/indicator");
    const { startScreen } = await import("../web/capture");
    getDisplayMedia.mockResolvedValueOnce(fakeStream("video"));
    const cap = await startScreen({ systemAudio: true });
    expect(indicator.state().sources).toEqual(["screen"]);
    cap.stop();
    expect(indicator.state().active).toBe(false);

    getDisplayMedia.mockRejectedValueOnce(Object.assign(new Error("x"), { name: "NotAllowedError" }));
    await expect(startScreen({ systemAudio: false })).rejects.toThrow();
    expect(indicator.state().active).toBe(false);
  });
});
