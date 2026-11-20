import { defineConfig, devices } from "@playwright/test";

// The E2E suite drives the real UI in Chromium with the Tauri IPC bridge
// replaced by an in-page fake (see e2e/tauri-mock.ts). Native permission
// behaviour is covered by Rust tests and manual QA on macOS/Windows.
export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://localhost:1420", ...devices["Desktop Chrome"], deviceScaleFactor: 1 },
  webServer: { command: "pnpm dev:web", url: "http://localhost:1420", reuseExistingServer: true },
});
