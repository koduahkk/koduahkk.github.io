import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PermissionReport, PermissionStatus } from "../types";

const state = vi.hoisted(() => ({
  statuses: {} as Record<string, string>,
}));

vi.mock("../ipc", () => ({
  ipc: {
    platform: vi.fn(async () => "macos"),
    permissionReport: vi.fn(async () =>
      (["screenRecording", "microphone", "systemAudio"] as const).map(
        (permission): PermissionReport => ({
          permission,
          status: (state.statuses[permission] ?? "notDetermined") as PermissionStatus,
          required: permission === "screenRecording",
          settingsUrl: "x-apple.systempreferences:test",
        }),
      ),
    ),
    requestPermission: vi.fn(async (p: string) => {
      state.statuses[p] = "granted";
      return "granted";
    }),
    openPermissionSettings: vi.fn(async () => {}),
    completeOnboarding: vi.fn(async () => ({})),
    relaunch: vi.fn(async () => {}),
  },
}));

import { ipc } from "../ipc";
import { Onboarding } from "../onboarding/Onboarding";

const continueBtn = () => screen.getByRole("button", { name: /continue|skip for now/i });

describe("Onboarding", () => {
  beforeEach(() => {
    state.statuses = {};
    vi.clearAllMocks();
  });

  it("starts on the welcome step and announces progress", async () => {
    render(<Onboarding />);
    await act(async () => {});
    expect(screen.getByRole("heading", { level: 1, name: "Welcome to Lumen" })).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 6")).toBeInTheDocument();
  });

  it("blocks the screen step until screen recording is allowed", async () => {
    const user = userEvent.setup();
    render(<Onboarding />);
    await user.click(continueBtn());

    const heading = screen.getByRole("heading", { name: "Let Lumen see your screen" });
    expect(heading).toHaveFocus();
    expect(continueBtn()).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Allow screen recording" }));
    expect(ipc.requestPermission).toHaveBeenCalledWith("screenRecording");
    await waitFor(() => expect(continueBtn()).toBeEnabled());
    expect(screen.getByRole("status")).toHaveTextContent("Screen recording: Allowed");
  });

  it("offers settings and relaunch on macOS when screen recording is denied", async () => {
    state.statuses.screenRecording = "denied";
    const user = userEvent.setup();
    render(<Onboarding />);
    await user.click(continueBtn());

    await screen.findByText(/Not allowed — turn it on in System Settings/);
    expect(screen.queryByRole("button", { name: /allow screen recording/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open System Settings" }));
    expect(ipc.openPermissionSettings).toHaveBeenCalledWith("screenRecording");
    await user.click(screen.getByRole("button", { name: /relaunch Lumen/ }));
    expect(ipc.relaunch).toHaveBeenCalled();
  });

  it("lets the user skip the optional microphone step", async () => {
    state.statuses.screenRecording = "granted";
    const user = userEvent.setup();
    render(<Onboarding />);
    await waitFor(() => expect(ipc.permissionReport).toHaveBeenCalled());
    await user.click(continueBtn()); // welcome -> screen
    await waitFor(() => expect(continueBtn()).toBeEnabled());
    await user.click(continueBtn()); // screen -> mic
    expect(screen.getByRole("button", { name: "Skip for now" })).toBeEnabled();
  });

  it("requires both responsible-use acknowledgements before finishing", async () => {
    state.statuses.screenRecording = "granted";
    state.statuses.microphone = "granted";
    const user = userEvent.setup();
    render(<Onboarding />);
    await waitFor(() => expect(ipc.permissionReport).toHaveBeenCalled());
    for (let i = 0; i < 3; i++) {
      await waitFor(() => expect(continueBtn()).toBeEnabled());
      await user.click(continueBtn());
    }
    await user.click(screen.getByRole("checkbox", { name: /capture system audio/i }));
    await user.click(continueBtn());

    expect(screen.getByRole("heading", { name: "Using Lumen responsibly" })).toBeInTheDocument();
    expect(continueBtn()).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: /exams, proctored assessments/i }));
    expect(continueBtn()).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: /tell other people/i }));
    await user.click(continueBtn());

    expect(screen.getByText("System audio: on (with reminders)")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start using Lumen" }));
    expect(ipc.completeOnboarding).toHaveBeenCalledWith({
      acceptableUseAck: true,
      disclosureAck: true,
      systemAudioOptIn: true,
    });
  });

  it("shows backend errors in an alert", async () => {
    state.statuses.screenRecording = "granted";
    vi.mocked(ipc.completeOnboarding).mockRejectedValueOnce("screen recording permission is still needed");
    const user = userEvent.setup();
    render(<Onboarding />);
    await waitFor(() => expect(ipc.permissionReport).toHaveBeenCalled());
    for (let i = 0; i < 4; i++) {
      await waitFor(() => expect(continueBtn()).toBeEnabled());
      await user.click(continueBtn());
    }
    await user.click(screen.getByRole("checkbox", { name: /exams/i }));
    await user.click(screen.getByRole("checkbox", { name: /tell other people/i }));
    await user.click(continueBtn());
    await user.click(screen.getByRole("button", { name: "Start using Lumen" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("screen recording permission is still needed");
  });
});
