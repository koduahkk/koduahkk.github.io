# NeverMissed Lead Engine

Internal sales tool for the **NeverMissed AI Receptionist**. It finds salons, proves they miss calls with two test calls, scores them, and runs email outreach that cites the exact missed call times.

```
Import (Google Places / CSV) → enrich website → daily planner (50/day)
  → Call A (in-hours peak) + Call B (30–90 min after close)
  → score HOT / WARM / COLD / DEAD → email sequence or Instagram/walk-in tasks
  → replies → demo → trial → customer
```

## Stack

Next.js 15 (App Router) + TypeScript, Tailwind CSS, shadcn/ui-style components (Radix), PostgreSQL via Supabase (auth + RLS) with Prisma, Inngest for background jobs, Twilio (Voice, Lookup), Resend or SendGrid, Google Places API (New), Luxon for time zones. All timestamps are stored in UTC.

## Quick start (demo, no API keys)

Requires Node 20+ and a Postgres database (local or Supabase).

```bash
cd nevermissed-lead-engine
npm install
```

```bash
cp .env.example .env
```

Set `DATABASE_URL`, `DIRECT_URL` and `APP_ENCRYPTION_KEY` in `.env` (generate the key with `openssl rand -base64 32`). Keep `DEMO_MODE="true"` for local demos.

```bash
npx prisma migrate deploy
```

```bash
npm run db:seed
```

```bash
npm run dev
```

Open http://localhost:3000 and pick a seeded user: **Alex Admin**, **Casey Caller** or **Vic Viewer**.

The seed creates 20 fictional salons in 8 cities. Every tier and pipeline stage is represented: emails sent, opened, replied and unsubscribed, a do-not-call number, Instagram/walk-in tasks, and calls scheduled for the coming days. Phone numbers use the reserved 555-01xx range and emails use the reserved `.example` domain, so nothing can reach a real business. Email sending defaults to the **console** provider, which logs emails to the server output instead of sending them.

## Environment variables

Every variable is documented in [`.env.example`](.env.example).

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL`, `DIRECT_URL` | yes | Postgres. On Supabase, use the pooled URL (6543, `?pgbouncer=true`) and the direct URL (5432) for migrations. |
| `APP_URL` | yes | Public base URL for unsubscribe and tracking links and Twilio callbacks. |
| `APP_ENCRYPTION_KEY` | yes | Encrypts API keys saved in Settings; signs links and demo cookies. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | prod | Supabase Auth (magic link). |
| `DEMO_MODE` | dev | Seeded-user login. Ignored in production unless `ALLOW_DEMO_IN_PRODUCTION=true`. |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` / `INNGEST_DEV` | jobs | Background jobs. |
| `PLANNER_CRON_TZ` | no | Time zone for the 7:00 planner and 3:00 Places refresh. |
| `GOOGLE_PLACES_API_KEY` | import | Places search and refresh. |
| `TWILIO_*` | optional | Browser calling, automated mode, line-type lookup. |
| `RESEND_*` / `SENDGRID_*` | sending | Email provider and signed event webhooks. |
| `INBOUND_WEBHOOK_TOKEN` | replies | Protects `/api/webhooks/email/inbound`. |
| `IMAP_*` | optional | IMAP polling for replies, instead of webhooks. |

API keys can also be pasted into **Settings → Integrations**. They are stored AES-256-GCM encrypted and are never sent to the browser. Environment variables always take precedence.

## Background jobs

| Job | Schedule | Code |
|---|---|---|
| Daily call planner | 07:00 (`PLANNER_CRON_TZ`) | `src/lib/jobs/planner.ts` |
| Email dispatcher (queue, space and send due steps) | every 5 min | `src/lib/jobs/email.ts` |
| Automated-call sweeper (only when automated mode is on) | every minute | `src/lib/jobs/automated.ts` |
| Website enrichment (per new lead, plus hourly backfill) | event + hourly | `src/lib/jobs/enrich.ts` |
| Google Places cache refresh (older than 30 days) | 03:00 | `src/lib/jobs/places.ts` |
| IMAP reply poller | every 5 min | `src/lib/jobs/imap.ts` |

**Run them locally with Inngest.** Start the dev server:

```bash
npm run dev
```

Then, in a second terminal (with `INNGEST_DEV=1` in `.env`):

```bash
npm run inngest:dev
```

The Inngest dashboard at http://localhost:8288 shows every function and lets you trigger crons by hand.

**Run them without Inngest.** Each job is a plain function, so it can be run once from the CLI:

```bash
npm run jobs:planner
```

```bash
npm run jobs:emails
```

Also available: `jobs:enrich`, `jobs:refresh-places`, `jobs:imap` and `jobs:automated-calls`. In the UI, Admins have **Run planner now** (Today's Calls) and **Send due emails now** (Sequences).

## Business rules

**Scoring** (`src/lib/scoring/engine.ts`; editable in Settings → Scoring, with a live A×B preview):

- **DEAD**: a disconnected or wrong number on either call. The other call is cancelled and the lead moves to Lost.
- **HOT**: missed Call A and no useful after-hours coverage on Call B.
- **WARM**: missed exactly one call, or missed both but a basic voicemail exists.
- **COLD**: answered in hours and covered after hours.
- The reason uses salon-local times, e.g. `Missed Tue 12:40pm (no answer, no voicemail) · No after-hours coverage Thu 7:15pm (voicemail full)`.

**Scheduling** (`src/lib/scheduler/slots.ts`):

- Call A falls inside open hours ∩ peak windows (Sat 10–13, weekdays 12–13 and 17–19), in the salon's zone.
- Call B falls 30–90 minutes after the day's final close, on a different day by default.
- Split hours, closing after midnight and DST are handled.
- Unknown hours fall back to Tue–Sat 9–19, and those calls are flagged.
- A shared load map caps calls per 15-minute window.

**After scoring:**

- HOT and WARM leads with a mailable email are auto-enrolled in the matching sequence.
- Leads without one get an Instagram DM task (if a handle is known) and a walk-in task, each with a ready-to-copy draft using the same missed-call proof.

## Compliance built in

- **Do-not-call and suppression list.** Checked before every call (planner, queue preflight, browser dialer, automated dialer) and every email (enroll, queue, send). Unsubscribes and complaints can never be removed.
- **CAN-SPAM.**
  - Sending is blocked until a physical business address is set.
  - Every email carries the address and a one-click unsubscribe link, plus `List-Unsubscribe` and `List-Unsubscribe-Post` headers (RFC 8058).
  - Unsubscribes take effect immediately.
  - A bounce, complaint, unsubscribe or reply stops the sequence.
  - Sends happen only in the lead's local business window, with per-mailbox daily limits (default 40) and random spacing.
- **Automated calls.** Off by default, behind a toggle with a persistent TCPA warning.
  - Every call runs a Twilio Lookup line-type check first; mobile or unknown numbers go to a human caller.
  - The TwiML is a silent `<Pause>` then `<Hangup>`: no artificial or prerecorded voice is ever played.
  - If AMD detects a person, the call ends immediately.
  - Greetings are recorded only when enabled, only in states you allow, and never in all-party-consent states.
  - Ambiguous classifications are flagged for human review in the Call Queue.
- **Google Places.** Only `place_id` is stored permanently. Other fields are cached with `placesRefreshedAt`, refreshed after 30 days, and can be refreshed by hand on the lead page.
- **Webhooks.** Each one is verified:
  - Twilio: `X-Twilio-Signature` plus an HMAC per call.
  - Resend: Svix signature.
  - SendGrid: ECDSA signature.
  - Inbound replies: shared token.
  - Click redirects are HMAC-signed, so they can't be used as an open redirect.
- **Database access.** The RLS migration denies Supabase's `anon` and `authenticated` roles; the app reaches the database only server-side through Prisma.
- **Audit log.** Stage changes, outcomes, settings changes, enabling automated calling, suppressions and more.

> Automated calling rules (TCPA and state laws) vary. Confirm with a lawyer before enabling automated mode or call recording.

## Roles

- **Admin**: everything, including settings, imports, the planner, sequences and the team.
- **Caller**: Call Queue, outcomes, notes, tasks, stage changes, do-not-call.
- **Viewer**: read-only.

Invite people in Settings → Team. With Supabase Auth, the first person to sign in on an empty database becomes Admin. After that, only invited emails can sign in.

## Tests

```bash
npm test
```

43 unit tests cover:

- **Scoring engine**: every tier, local-time reasons, editable rules.
- **Time-slot scheduler**: four US zones, closing times of 17:00, 19:00, 20:30 and 21:00, split hours, after-midnight closes, unknown hours, DST, never in the past, the 15-minute capacity cap across 50 salons, existing calendar load.
- **Suppression checks**: phone/email normalization, `+tag` and domain matching, invalid input.
- **Other**: merge fields and sections, the CAN-SPAM composer, send-slot allocation and send windows, Twilio AMD classification, website enrichment extraction, Google hours parsing, and CSV mapping.

`npm run typecheck` runs TypeScript.

## Deploying to Vercel

Vercel runs `npm run vercel-build`, which applies migrations (`prisma migrate deploy`), loads demo data when `SEED_DEMO_DATA=true` **and** the database has no users yet (redeploys never wipe data), then builds the app.

1. **Supabase**: create a project. Under *Connect → ORMs → Prisma*, copy:
   - `DATABASE_URL`: the **Transaction pooler** URL (port 6543), with `?pgbouncer=true&connection_limit=1` appended.
   - `DIRECT_URL`: the **Session pooler** URL (port 5432). Don't use the "Direct connection" host: it is IPv6-only and Vercel's build can't reach it.
2. **Vercel**: import the GitHub repo, set **Root Directory** to `nevermissed-lead-engine`, and add the environment variables:
   - `DATABASE_URL`, `DIRECT_URL`, `APP_ENCRYPTION_KEY` (from `openssl rand -base64 32`).
   - For a demo deployment: `DEMO_MODE=true`, `ALLOW_DEMO_IN_PRODUCTION=true`, `SEED_DEMO_DATA=true`. Anyone with the link can sign in as Admin, so use this only with fake data.
   - `APP_URL` is optional; it defaults to the Vercel production domain.
3. To deploy a branch other than `main`, set it under *Settings → Git → Production Branch*, then redeploy.
4. **Going live with real data**:
   - Remove `DEMO_MODE`, `ALLOW_DEMO_IN_PRODUCTION` and `SEED_DEMO_DATA`.
   - Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - In Supabase Auth, set the Site URL and add `https://<domain>/auth/callback` as a redirect URL.
   - Clear the demo tables (`npx prisma migrate reset` against that database), then sign in first so you become Admin.
5. **Background jobs**: install the Inngest Vercel integration (it sets `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY`) and sync `https://<domain>/api/inngest`. Until then, use *Run planner now* and *Send due emails now* in the UI.
6. Point provider webhooks at the URLs in Settings → Integrations.

## Project layout

```
prisma/              schema, migrations (init + Supabase RLS), seed
src/lib/scoring      pure scoring engine
src/lib/scheduler    pure time-slot scheduler
src/lib/email        merge fields, CAN-SPAM composer, send allocation, providers, templates
src/lib/jobs         planner, scoring side effects, email engine, enrichment, Places, automated calls, IMAP
src/lib/twilio       client, AMD classification, webhook auth
src/inngest.ts       Inngest functions (thin wrappers around src/lib/jobs)
src/app/(app)        pages: dashboard, leads, calls, queue, sequences, inbox, tasks, settings
src/app/api          Inngest, webhooks, tracking, unsubscribe, Twilio token
tests/               Vitest unit tests
```
