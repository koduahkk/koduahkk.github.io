import { expect, test } from "@playwright/test";
import { installTauriFake } from "./tauri-fake";

test("first run: keyboard-only onboarding through to the panel indicator", async ({ page }) => {
  await page.addInitScript(installTauriFake);
  await page.goto("/#/onboarding");

  const primary = (name: string | RegExp) => page.getByRole("button", { name });

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome to Lumen");
  await primary("Continue").press("Enter");

  // Screen recording is required: Continue stays disabled until granted.
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await expect(primary("Continue")).toBeDisabled();
  await primary("Allow screen recording").press("Enter");
  await expect(page.getByRole("status")).toHaveText("Screen recording: Allowed");
  await primary("Continue").press("Enter");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Let Lumen hear you");
  await primary("Allow microphone").press("Enter");
  await expect(page.getByRole("status")).toHaveText("Microphone: Allowed");
  await primary("Continue").press("Enter");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Meeting and system audio");
  await page.getByRole("checkbox", { name: /capture system audio/i }).press("Space");
  await primary("Continue").press("Enter");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Using Lumen responsibly");
  await expect(primary("Continue")).toBeDisabled();
  await page.getByRole("checkbox", { name: /exams/i }).press("Space");
  await page.getByRole("checkbox", { name: /tell other people/i }).press("Space");
  await primary("Continue").press("Enter");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("You're all set");
  await primary("Start using Lumen").press("Enter");

  const completed = await page.evaluate(() =>
    (window as any).__lumenFake.calls.find((c: any) => c.cmd === "complete_onboarding"),
  );
  expect(completed.args).toEqual({ acceptableUseAck: true, disclosureAck: true, systemAudioOptIn: true });

  // The panel window: the capture badge is always present and mirrors the tray.
  await page.goto("/#/panel");
  await page.reload(); // each Tauri window is a separate page load
  const badge = page.getByTestId("capture-badge");
  await expect(badge).toHaveText("Not capturing");
  await page.waitForFunction(() => (window as any).__lumenFake.calls.some((c: any) => c.cmd === "plugin:event|listen"));
  await page.evaluate(() =>
    (window as any).__lumenFake.emit("indicator://changed", { active: true, sources: ["screen", "microphone"] }),
  );
  await expect(badge).toHaveText("Capturing screen, microphone");
});
