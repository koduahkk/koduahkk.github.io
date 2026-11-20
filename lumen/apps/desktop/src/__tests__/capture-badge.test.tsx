import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { IndicatorState } from "../types";

const listeners: Array<(s: IndicatorState) => void> = [];

vi.mock("../ipc", () => ({
  ipc: {
    indicatorState: vi.fn(async () => ({ active: false, sources: [] })),
    onIndicatorChange: vi.fn(async (cb: (s: IndicatorState) => void) => {
      listeners.push(cb);
      return () => {};
    }),
  },
}));

import { badgeLabel, CaptureBadge } from "../panel/CaptureBadge";

describe("CaptureBadge", () => {
  it("labels states", () => {
    expect(badgeLabel({ active: false, sources: [] })).toBe("Not capturing");
    expect(badgeLabel({ active: true, sources: ["screen", "systemAudio"] })).toBe(
      "Capturing screen, system audio",
    );
  });

  it("is always rendered and follows indicator events", async () => {
    render(<CaptureBadge />);
    const badge = screen.getByTestId("capture-badge");
    expect(badge).toHaveTextContent("Not capturing");
    expect(badge).toHaveAttribute("role", "status");

    await act(async () => {});
    act(() => listeners.forEach((l) => l({ active: true, sources: ["microphone"] })));
    expect(badge).toHaveTextContent("Capturing microphone");
    expect(badge).toHaveClass("live");
  });
});
