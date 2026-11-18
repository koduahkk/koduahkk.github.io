# NeverMissed: marketing site

AI receptionist agency site. Static HTML/CSS/JS with no runtime dependencies, served by GitHub Pages at `/nevermissed/`.

> Every call answered. Every lead captured. Every hour of the day.

## How it's built

```
nevermissed/
  build.mjs               tiny static build: renders src/ → HTML pages
  src/config.mjs          ALL content: phone numbers, prices, industries, demo calls, FAQ, placeholders
  src/partials/*.html     head, nav, footer (+ mobile bar, nudge), booking form
  src/pages/*.html        page templates (index, book-demo, privacy, terms, industry)
  assets/css/tokens.css   design tokens (single source of truth)
  assets/css/main.css     components + sections, mobile-first
  assets/js/main.js       all interactions, vanilla JS, reduced-motion aware
  assets/img/             favicon.svg, og.png (1200×630), apple-touch-icon.png, logo.png
  assets/audio/           drop real call recordings here
  index.html, book-demo/, privacy/, terms/, industries/<slug>/   ← generated, committed
```

Edit anything in `src/`, then rebuild (Node 18+):

```bash
node nevermissed/build.mjs
```

Generated pages are committed, so GitHub Pages serves them as is. Don't hand-edit the generated `index.html` etc. Your changes will be overwritten.

### Pages
- `/` homepage with all 15 sections
- `/book-demo/` two-step booking (qualify, then pick a time)
- `/industries/<slug>/` 9 generated landing pages: dental, medical, hvac, home-services, legal, salons-spas, gyms, real-estate, auto
- `/privacy/`, `/terms/` outlines for counsel to finish

Pricing, FAQ and contact live as homepage sections (`#pricing`, `#faq`, `#book`) rather than separate pages.

## Design tokens (`assets/css/tokens.css`)

**Concept: "signal and calm."** Paper and ink, one green signal for *answered*, one red-orange alert reserved for *the problem*.

| Token | Value | Use |
|---|---|---|
| `--paper` | `#F5F2EC` | page background |
| `--paper-2` | `#EDE9E1` | alternate warm sections |
| `--ink` | `#0E0E0C` | text, dark sections |
| `--ink-2` / `--ink-3` | `#1A1A17` / `#262622` | raised surfaces / borders on ink |
| `--gray-200` / `--gray-400` | `#E6E1D8` / `#C9C3B8` | hairlines, borders on paper |
| `--gray-500` | `#8A857C` | secondary text **on ink only** (5.3:1) |
| `--gray-600` | `#5E5A53` | secondary text on paper (6.1:1) |
| `--green` | `#2BD67B` | CTAs (with ink text), live dots, text on ink. Never text on paper |
| `--green-ink` | `#08703A` | green text on paper (5.6:1) |
| `--red` | `#FF4D2E` | missed-call badges/stats, problem only |
| `--red-ink` | `#C2321A` | red text on paper |

**Type:** Space Grotesk 500–700 (display, tracking −0.035em), Inter 400–600 (body), JetBrains Mono 400–500 (timestamps, transcripts, stats). Loaded with `display=swap` plus metric-matched local fallbacks to minimise layout shift.

| Step | Size (375px → 1440px) |
|---|---|
| `--fs-hero` | 2.75rem → 5.75rem |
| `--fs-mega` (final CTA) | 3.25rem → 10rem |
| `--fs-h2` | 2.25rem → 4.75rem |
| `--fs-stat` | 3.5rem → 7rem |
| `--fs-h3` | 1.3rem → 1.7rem |
| `--fs-lead` | 1.075rem → 1.3rem |
| body / sm / xs / mono | 1rem / .9375rem / .8125rem / .78rem |

**Spacing:** 4px base, `--s-1` (4px) through `--s-10` (128px). Section padding `--section-y` is fluid 5rem → 9.5rem; gutter 1rem → 2.5rem; max content width 1320px.
**Radii:** 8 / 12 / 14px, pill 999px. **Lines:** 1px warm hairlines. **Motion:** `--ease-out: cubic-bezier(.16,1,.3,1)`, 160 / 420 / 900ms.

## Placeholders to replace before launch

Every placeholder renders with a **dashed underline and a tooltip** (`class="ph"`). To find them all:

```bash
grep -rn 'class="ph\|\[PLACEHOLDER\|\[CONFIRM\|\[X\]' nevermissed/src
```

| What | Where |
|---|---|
| Demo line number `(555) 010-0199` and sales number `(555) 010-0123` | `src/config.mjs` → `site.demoPhone`, `site.phone` |
| Email, address, social links, real domain (`site.url`, used for canonical, OG and schema) | `src/config.mjs` → `site` |
| Client logo strip (6 businesses under "Trusted by 200+"). **Confirm each is a real client who agreed to be shown**, or swap in ones who are | `site.clients` in `src/config.mjs` (name, icon, wordmark style); count in `site.clientCount` |
| Supported languages | `site.languages`, plus the cycle list in `assets/js/main.js` (`initLang`) |
| Audio recordings for the 4 sample calls (currently scripted, timer-driven) | add files to `assets/audio/`, set `src` + line timings in `demos` |
| Industry sample calls for Medical, Plumbing & Electrical, Gyms & Fitness, Real Estate, Auto | add to `demos`, set `demo:` on the industry |
| Included minutes and feature lists per tier (prices and setup fees are confirmed) | `pricing` in `src/config.mjs` |
| Annual billing (optional): set `annual` per tier and the toggle reappears | `pricing` in `src/config.mjs` |
| Comparison "from $299" | section 10 |
| Results cards: 3 **sample** results tagged "Sample result". Replace with real client results (with permission) and delete `sample: true` | `results` in `src/config.mjs` |
| HIPAA / BAA / data retention, outage failover | `faqs` in `src/config.mjs` |
| Booking calendar (Cal.com / Calendly inline URL) | `site.bookingEmbedUrl` (name + email are prefilled) |
| Form endpoint (Formspree, Basin, your API) | `site.formEndpoint` (JSON POST); empty = success state only, nothing is sent |
| Privacy Policy and Terms | `src/pages/privacy.html`, `terms.html` (outlines, need counsel) |

## Analytics

Every CTA has `data-track` (plus `data-track-location` / `data-track-label`). Events are pushed to `window.dataLayer` (GTM / GA4 ready) and dispatched as a `nm:track` DOM event. Tracked: `cta_book_demo`, `cta_call_demo`, `cta_call_sales`, `cta_pricing`, `cta_calculator`, `industry_page`, `industry_tab`, `demo_audio_play`, `demo_audio_complete`, `calculator_used`, `pricing_toggle`, `faq_open`, `form_start_demo`, `form_error_demo`, `form_submit_demo`, `nudge_shown`.

## Quality checks run

- Lighthouse (local, uncompressed server): homepage Performance 92 / Accessibility 100 / Best Practices 100 / SEO 100; industry and book-demo pages Performance 99, the other categories 100. GitHub Pages adds gzip, which helps further.
- No horizontal scroll at 375 / 768 / 1280 / 1440px; no console errors.
- Keyboard: skip link, focus-trapped mobile menu (Esc closes), ARIA tabs with arrow keys, accordion `aria-expanded`, audio scrubber as `role="slider"` (arrows / Home / End / Space).
- `prefers-reduced-motion`: animations off, call card shows its final booked state, marquee becomes a static wrap.
- Schema: Organization + FAQPage JSON-LD; one H1 per page.
