# Lumen architecture

Status: Phase 1 implemented (scaffold, permissions onboarding, capture indicator).
Boxes marked *(P2–P6)* are planned and drawn here so later phases slot in without
reshaping the system.

## System overview

```mermaid
flowchart LR
  subgraph Device["User's computer"]
    direction TB
    subgraph UI["Web UI (React + TS, in Tauri webview)"]
      Onb["Onboarding window<br/>(P1)"]
      Panel["Floating panel<br/>always-on-top, 380px<br/>CaptureBadge (P1)"]
    end

    subgraph Core["Rust core (Tauri 2)"]
      IPC["IPC commands<br/>commands.rs"]
      Perm["Permissions<br/>macOS / Windows / Linux"]
      Ind["CaptureIndicator<br/>RAII CaptureGuard"]
      Tray["Tray / menu-bar icon"]
      Consent["ConsentStore<br/>versioned JSON"]
      Cap["Screen capture (P2)<br/>ScreenCaptureKit / WGC"]
      OCR["Local OCR (P2)<br/>Apple Vision / Windows.Media.Ocr"]
      Redact["Secret redaction + app blocklist (P5)"]
      Audio["Audio (P3)<br/>mic + SCK audio / WASAPI loopback<br/>30s ring buffer"]
      STT["STT client (P3)<br/>streaming, or local whisper.cpp"]
      QD["Question detector (P3)<br/>classify, debounce, merge"]
      Ctx["Context builder (P2)<br/>screen text + transcript + profile"]
      Hist[("History (P5)<br/>SQLite + SQLCipher")]
      Keys[("OS keychain<br/>session tokens (P4)")]
    end
  end

  subgraph Cloud["Lumen backend (Hono on Fly.io) (P4)"]
    GW["API gateway<br/>JWT verify, rate limit"]
    Quota["Quota + metering<br/>server-time daily counters"]
    LLMp["LLM proxy<br/>provider-agnostic, streaming"]
    STTp["STT proxy<br/>WebSocket relay"]
    Ent["Entitlements"]
    DB[("Postgres<br/>accounts, usage metadata only")]
  end

  Auth["Supabase Auth<br/>magic link, Google, Apple"]
  Stripe["Stripe Checkout +<br/>Customer Portal"]
  Anthropic["Anthropic Claude (default)<br/>other LLM providers"]
  Deepgram["Deepgram (default STT)"]

  Onb <-->|invoke / events| IPC
  Panel <-->|invoke / events| IPC
  IPC --> Perm
  IPC --> Consent
  Cap -. needs CaptureGuard .-> Ind
  Audio -. needs CaptureGuard .-> Ind
  Ind --> Tray
  Ind -->|indicator://changed| Panel
  Cap --> Redact --> OCR --> Ctx
  Audio --> STT --> QD --> Ctx
  Ctx -->|downscaled image + redacted text| GW
  Ctx --> Hist
  GW --> Quota --> LLMp --> Anthropic
  GW --> STTp --> Deepgram
  GW --> Ent
  Quota --> DB
  Ent --> DB
  Stripe -->|webhooks| Ent
  Core -->|sign-in| Auth
  Auth -->|JWT| GW
  Keys --- IPC
```

## Desktop and web share one UI

```mermaid
flowchart LR
  UI["React UI<br/>onboarding + panel"] --> Ipc{"ipc.ts<br/>Ipc interface"}
  Ipc -->|"__TAURI_INTERNALS__ present"| Tauri["ipc.tauri.ts<br/>Rust core via IPC"]
  Ipc -->|"otherwise"| Web["web/ipc.web.ts<br/>getDisplayMedia, getUserMedia,<br/>localStorage, TS CaptureIndicator"]
  Web --> Pages["GitHub Pages<br/>koduahkk.github.io/lumen/app/"]
```

## Capture indicator invariant

The acceptance criterion "indicator visible 100% of the time capture is
active" is enforced in the type system, not just by convention:

```mermaid
sequenceDiagram
  participant Pipe as Capture pipeline (P2/P3)
  participant Ind as CaptureIndicator
  participant Tray as TraySink (tray + panel badge)
  Pipe->>Ind: begin(Screen)
  Ind->>Tray: render(active: [screen])
  alt tray rendered
    Tray-->>Ind: Ok
    Ind-->>Pipe: CaptureGuard
    Note over Pipe: capture APIs take &CaptureGuard,<br/>so capture cannot start without one
    Pipe->>Pipe: capture frames…
    Pipe->>Ind: drop(guard)
    Ind->>Tray: render(active: [])
  else tray failed
    Tray-->>Ind: Err
    Ind-->>Pipe: Err (capture refused, count rolled back)
  end
```

OS capture indicators (the macOS purple/orange dot, the Windows yellow border)
are never suppressed, and no Lumen window ever enables content protection.
`scripts/check-no-content-protection.mjs` fails CI if one does.

## Answer path latency budget (target p50 first token < 1.5 s)

| Step | Budget |
| --- | --- |
| Capture + downscale (to 1280px long edge) | 80 ms |
| Local OCR + redaction | 150 ms |
| TLS request to backend (kept-alive connection) | 60 ms |
| Backend auth + quota check (in-memory cache, async write) | 20 ms |
| LLM time to first token (Claude, streaming, prompt-cached system prompt) | 900 ms |
| Render first token | 10 ms |
| **Total** | **≈ 1.2 s** |

## Repository layout

```
lumen/
  crates/lumen-core/        pure Rust: permissions model, indicator, consent (unit-tested on every OS)
  apps/desktop/             Tauri 2 app
    src/                    React UI (onboarding, panel)
    src-tauri/              Rust shell: IPC commands, tray, platform permission backends
    e2e/                    Playwright happy path with a fake IPC bridge
  apps/backend/             (P4) Hono API
  apps/landing/             (P6) marketing + pricing page
  scripts/                  repo guards used in CI
  docs/                     architecture, acceptable use
```
