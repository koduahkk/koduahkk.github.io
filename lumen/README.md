# Lumen (working name)

A desktop assistant that, with your permission, reads your screen and listens
to your microphone, spots questions, and answers them in a small floating panel.
macOS 13+ and Windows 10/11 (Linux is a stretch goal). Built with Tauri 2: a Rust core and a React/TypeScript UI.

- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Decisions and defaults: [DECISIONS.md](DECISIONS.md)
- Acceptable use draft: [docs/ACCEPTABLE_USE.md](docs/ACCEPTABLE_USE.md)

## Web app

The same interface also runs in the browser, published with the portfolio on
GitHub Pages at **https://koduahkk.github.io/lumen/app/** once this branch is
merged into `main`.

- **Screen** uses the browser's share picker (`getDisplayMedia`). The browser
  asks every time, and shows its own "sharing" bar.
- **Microphone** uses the normal per-site permission (`getUserMedia`).
- **Tab or system audio** (Chrome and Edge) is captured when the user ticks "Share audio" in the
  picker. The one-time "tell others" reminder, with a copyable message, appears
  the first time audio is shared.
- **Indicator:** the panel badge plus a `● Recording —` prefix on the tab
  title, driven by the same rule as desktop: no stream before the indicator is on.
- **Floating panel:** in Chrome and Edge, the ⧉ button pops the panel into an
  always-on-top Picture-in-Picture window.
- **Installable** (manifest included). Consent is kept in `localStorage`.
- **Current limit:** answering needs the Phase 4 backend (the browser can't
  hold an API key), so the web preview captures and shows exactly what Lumen
  would see, and sends nothing anywhere.

Build and check it locally:

```bash
pnpm --filter @lumen/desktop build:pages
```

```bash
cd .. && python3 -m http.server 4173
```

Then open http://localhost:4173/lumen/app/. The build output in `lumen/app/` is
committed, because Pages serves this repo as-is with no build step. CI fails if
it's stale.

## Prerequisites

- Rust 1.80+ (`rustup`), Node 20+, pnpm 9 (`corepack enable`)
- macOS: Xcode Command Line Tools
- Windows: Microsoft C++ Build Tools and WebView2 (preinstalled on Windows 11)
- Linux: `libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev libxdo-dev libssl-dev`

```bash
cd lumen && pnpm install
```

## Phase 1: scaffold, architecture, permissions onboarding

What's here:

- **`crates/lumen-core`**: permission model, a **capture indicator** that only
  allows capture while the tray icon and panel badge are visible (an RAII
  `CaptureGuard`), and a versioned consent store.
- **`apps/desktop/src-tauri`**: the Tauri shell. Platform permission backends
  (macOS: CoreGraphics + AVFoundation; Windows: WGC support + privacy
  switches; Linux: portal-based, nothing to pre-flight), a tray icon that is the
  persistent indicator, and IPC commands.
- **`apps/desktop/src`**: a 6-step onboarding (welcome, screen, microphone,
  system audio, responsible use, ready) and the panel shell with a live capture badge.

Run it:

```bash
pnpm dev
```

On first launch the onboarding window opens. Once it's complete, later launches open the
floating panel. To see onboarding again, delete `consent.json` from the app
data folder (`~/Library/Application Support/app.lumen.desktop/` on macOS,
`%APPDATA%\app.lumen.desktop\` on Windows).

Verify:

```bash
pnpm test
```

```bash
pnpm test:e2e
```

```bash
pnpm lint:config
```

```bash
cargo clippy --workspace --all-targets -- -D warnings
```

- `pnpm test`: Vitest UI tests and Rust core tests (indicator invariant,
  permission rules, consent persistence).
- `pnpm test:e2e`: Playwright. **desktop-ui** runs a keyboard-only first-run
  onboarding through to the panel badge reacting to an indicator event.
  **web** runs the Pages build served at `/lumen/app/`, goes through onboarding,
  then does real screen and mic capture (Chromium fake devices), checks the
  indicator, and confirms consent is remembered.
- `pnpm lint:config`: fails if any window is hidden from screen capture.

Manual QA checklist (on real macOS and Windows machines):

1. Fresh install: onboarding opens, and the panel is hidden.
2. macOS: "Allow screen recording" shows the system prompt. Grant it in
   System Settings, choose "relaunch Lumen", and the step shows *Allowed*.
3. Deny the microphone: the step says "Not allowed" and offers "Open System Settings".
   "Skip for now" still works.
4. Windows: turn off *Let desktop apps access your microphone*. The step shows
   *Not allowed*, and "Open Settings" deep-links to the privacy page.
5. Finish: the onboarding window closes and the panel appears, top-most, with the
   *Not capturing* badge and the tray tooltip "Lumen — not capturing".
6. Share your screen in Zoom/Meet/Teams: both Lumen windows are visible to
   viewers.
