# Decisions

Defaults chosen without blocking on the product owner. Each can be revisited;
the "Revisit if" line says when.

## D1 — Code lives in `lumen/` inside the portfolio repo (for now)
The only repository this work could write to is the GitHub Pages portfolio, so
Lumen is a self-contained subfolder with its own workspaces and `.gitignore`.
Nothing in the portfolio site was changed.
**Recommended:** move to a dedicated private repo before Phase 4 (secrets,
release signing and a public Pages site should not share a repo).
`git subtree split -P lumen` keeps the history.

## D2 — Tauri 2, not Electron
Every capture API we need is reachable from Rust: ScreenCaptureKit and Apple
Vision through the `objc2-*` crates, Windows.Graphics.Capture, WASAPI and
Windows.Media.Ocr through the `windows` crate. Electron would not unlock
anything, and Tauri gives a roughly 10× smaller binary, lower idle memory and CPU
(which matters for the < 8% idle target), and a Rust core where the capture
pipeline runs off the UI thread.

## D3 — Pure-Rust core crate
`crates/lumen-core` has no Tauri or OS dependencies, so the logic that matters
(permission rules, the indicator invariant, consent) is unit-tested on every
OS in CI. The Tauri crate is a thin shell.

## D4 — The capture indicator is enforced by an RAII guard
Capture code must hold a `CaptureGuard`, which only `CaptureIndicator::begin`
hands out after the tray icon and panel badge have rendered successfully. If
the tray can't be shown, capture is refused. This makes "indicator visible 100%
of the time capture is active" a property of the code, not of discipline.

## D5 — Screen Recording is the only required permission
Every mode reads the screen. The microphone is optional, so screen-only
users are never forced to grant it. System audio is opt-in, off by default,
and has its own consent step because it records other people.

## D6 — Platform permission specifics
- **macOS:** `CGPreflightScreenCaptureAccess`/`CGRequestScreenCaptureAccess`
  (the same TCC grant ScreenCaptureKit and its audio use); AVFoundation for the
  mic. macOS can't distinguish "never asked" from "denied" for screen recording
  and applies new grants only after relaunch, so onboarding offers "Open System
  Settings" and "relaunch Lumen".
- **Windows:** WGC needs no grant (we check `IsSupported`). Unpackaged desktop
  apps never get a mic prompt, so we read the privacy switches from the
  CapabilityAccessManager consent store and deep-link to `ms-settings:`.
- **Linux (stretch):** reports `notApplicable`; screen capture will go through
  the xdg-desktop-portal at capture time.

## D7 — Consent stored locally, versioned
`consent.json` in the app data directory. Bumping `CURRENT_TERMS_VERSION`
re-runs the responsible-use step. A missing or corrupt file means "not
onboarded" (fail closed). In Phase 4 acceptance is also recorded server-side
against the account.

## D8 — No window ever enables content protection
Every window sets `"contentProtected": false` explicitly, and
`scripts/check-no-content-protection.mjs` fails CI on any config or code that
would hide a window from capture (`SetWindowDisplayAffinity`, `NSWindowSharingNone`, …).

## D9 — Testing strategy
- Rust unit tests for the core, plus clippy `-D warnings` across the workspace.
- Vitest + Testing Library for UI logic and accessibility behaviour (focus
  management, roles, labels).
- E2E happy path: Playwright drives the real UI in Chromium with the Tauri IPC
  bridge replaced by an in-page fake (`e2e/tauri-fake.ts`) that mirrors the
  Rust command names. Rationale: `tauri-driver` has no macOS support. A
  native WebDriver run on Windows and Linux will be added in Phase 6 CI.
- CI type-checks the macOS and Windows backends on real runners (the
  development container is Linux).

## D10 — Panel window
Undecorated, always on top, 380×520 default, resizable (min 300×240), with a
draggable header. Separate onboarding window (600×700) so the first-run
flow is roomy and the panel stays small.

## D11 — Choices for later phases (decided now to keep the architecture stable)
- **Auth:** Supabase Auth (magic link, Google, Apple). Its Postgres also holds
  entitlements and usage counters, so there is one vendor instead of Clerk plus a database.
- **Backend:** Hono on Fly.io (TypeScript, Web-standard streaming, small cold start).
- **STT:** Deepgram streaming by default (low latency, WebSocket); whisper.cpp
  `base.en`/`small` for the Private tier.
- **LLM:** provider interface; Claude as the default model; system prompt cached.
- **Quota integrity:** the Free tier requires sign-in; daily counters live on
  the server, keyed by account and server-side UTC date; the client clock is never
  trusted; reinstalling doesn't reset an account. A device fingerprint (hashed
  machine id) limits repeated free sign-ups per device.
- **Offline grace:** a signed entitlement token (Ed25519, 72h expiry, verified
  against the server time at last sync plus monotonic uptime) is cached in the
  OS keychain.
- **Bundle identifier:** `app.lumen.desktop` (placeholder until the name is final).

## D12 — Web app on GitHub Pages
The UI depends on one `Ipc` interface (`src/types.ts`). `src/ipc.ts` picks
the Tauri backend when `__TAURI_INTERNALS__` is present, and otherwise the
browser backend in `src/web/`, so the desktop and web apps share every screen.
- **Hosting:** GitHub Pages at `/lumen/app/`, from this repo's `main` branch.
  Pages builds this repo with no build step, so the Vite output (relative
  `base: ./`) is committed to `lumen/app/`, and CI rebuilds it and fails on any
  difference. Switching Pages to "GitHub Actions" as the source would remove the
  committed build, but it changes how the whole portfolio deploys, so it's left
  to the owner.
- **Permissions on the web:** screen and tab audio can't be pre-granted, so
  they report `askEachTime`. Onboarding explains that the browser asks each
  time, and doesn't block on it.
- **Indicator:** same rule as `lumen-core` (guard first, then ask the browser,
  roll back on cancel, release when the browser's own "Stop sharing" ends the
  tracks). It shows in the tab title, the panel badge and the browser's sharing UI.
- **Always on top:** the Document Picture-in-Picture API (Chrome and Edge 116+). Other
  browsers get a normal tab.
- **No answers yet on the web:** answers need the Phase 4 backend, because API keys
  never go in a client, including the browser. The preview says so and sends no data.
