import { defineConfig, devices } from "@playwright/test";

// Two targets:
//  - desktop-ui: the UI as it runs inside Tauri, with the IPC bridge replaced
//    by an in-page fake (e2e/tauri-fake.ts).
//  - web: the static GitHub Pages build, served from the repo root at
//    /lumen/app/ exactly as Pages serves it, using real browser capture APIs
//    with Chromium's fake media devices and auto-accepted prompts.
export default defineConfig({
  testDir: "./e2e",
  use: { ...devices["Desktop Chrome"], deviceScaleFactor: 1 },
  projects: [
    {
      name: "desktop-ui",
      testMatch: "onboarding.spec.ts",
      use: { baseURL: "http://localhost:1420" },
    },
    {
      name: "web",
      testMatch: "web.spec.ts",
      use: {
        baseURL: "http://localhost:4173/lumen/app/",
        permissions: ["microphone"],
        launchOptions: {
          args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
        },
      },
    },
  ],
  webServer: [
    { command: "pnpm dev:web", url: "http://localhost:1420", reuseExistingServer: true },
    {
      command: "pnpm build:pages && python3 -m http.server 4173 --bind 127.0.0.1 --directory ../../..",
      url: "http://localhost:4173/lumen/app/",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
