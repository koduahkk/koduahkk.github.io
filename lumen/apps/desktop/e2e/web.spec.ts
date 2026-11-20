import { expect, test } from "@playwright/test";

test("web app: first visit, onboarding, real capture with indicator, consent remembered", async ({ page }) => {
  await page.goto("./");
  await expect(page).toHaveURL(/#\/onboarding$/);
  const h1 = page.getByRole("heading", { level: 1 });
  const next = () => page.getByRole("button", { name: /^(Continue|Skip for now)$/ }).click();

  await expect(h1).toHaveText("Welcome to Lumen");
  await expect(page.getByText(/in the tab title and the Lumen panel/)).toBeVisible();
  await next();

  await expect(h1).toHaveText("Let Lumen see your screen");
  await expect(page.getByRole("status")).toHaveText(
    "Screen recording: Your browser asks each time you start capturing",
  );
  await next();

  await expect(h1).toHaveText("Let Lumen hear you");
  const allowMic = page.getByRole("button", { name: "Allow microphone" });
  if (await allowMic.isVisible()) await allowMic.click();
  await expect(page.getByRole("status")).toHaveText("Microphone: Allowed");
  await next();

  await expect(h1).toHaveText("Meeting and system audio");
  await next();

  await page.getByRole("checkbox", { name: /exams/i }).check();
  await page.getByRole("checkbox", { name: /tell other people/i }).check();
  await next();

  await expect(h1).toHaveText("You're all set");
  await page.getByRole("button", { name: "Start using Lumen" }).click();

  await expect(page).toHaveURL(/#\/panel$/);
  const badge = page.getByTestId("capture-badge");
  await expect(badge).toHaveText("Not capturing");

  await page.getByRole("button", { name: "Microphone" }).click();
  await expect(badge).toHaveText("Capturing microphone");
  await expect(page).toHaveTitle(/^● Recording — /);

  await page.getByRole("button", { name: "Share screen" }).click();
  await expect(badge).toHaveText("Capturing screen, microphone");
  await expect(page.getByLabel("Preview of what Lumen can see")).toBeVisible();

  await page.getByRole("button", { name: "Stop sharing" }).click();
  await page.getByRole("button", { name: "Stop microphone" }).click();
  await expect(badge).toHaveText("Not capturing");
  await expect(page).toHaveTitle("Lumen");

  // Returning visitors skip onboarding.
  await page.goto("./");
  await expect(page).toHaveURL(/#\/panel$/);
});
