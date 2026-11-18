#!/usr/bin/env node
/* =====================================================================
   NeverMissed static build
   ---------------------------------------------------------------------
   Run from the repo root:   node nevermissed/build.mjs
   Reads  nevermissed/src/{config.mjs, partials/*.html, pages/*.html}
   Writes nevermissed/index.html, book-demo/, privacy/, terms/,
          industries/<slug>/  (committed, so GitHub Pages serves them as is)

   Template syntax (deliberately tiny):
     {{> partial}}   include src/partials/partial.html
     {{path.to.key}} insert a value from the page context
   ===================================================================== */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { site, pricing, demos, industries, faqs, results } from './src/config.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const partials = Object.fromEntries(
  readdirSync(join(ROOT, 'src/partials')).map((f) => [f.replace('.html', ''), read(`src/partials/${f}`)])
);

const lookup = (ctx, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), ctx);

function render(tpl, ctx, depth = 0) {
  if (depth > 8) throw new Error('Partial nesting too deep');
  return tpl
    .replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => {
      if (!(name in partials)) throw new Error(`Missing partial: ${name}`);
      return render(partials[name], ctx, depth + 1);
    })
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key) => {
      const v = lookup(ctx, key);
      if (v === undefined) throw new Error(`Missing template value: ${key}`);
      return String(v);
    });
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const stripTags = (s) => String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const fmtMoney = (n) => '$' + n.toLocaleString('en-US');

/* ---------- Generated blocks ---------------------------------------- */

const speaker = (who) => (who === 'ai' ? 'AI receptionist' : 'Caller');

// One audio-demo card. Works with a real <audio> file (data-src) or a
// timer-driven "virtual" playback when no file is set yet.
function demoCard(d, { compact = false } = {}) {
  const lines = d.lines
    .map(
      (l) => `<li class="tline tline--${l.who}" data-t="${l.t}"><span class="tline__who">${speaker(l.who)}</span><span class="tline__text">${esc(l.text)}</span></li>`
    )
    .join('');
  return `
<article class="player${compact ? ' player--compact' : ''}" data-player data-src="${esc(d.src)}" data-duration="${d.duration}" aria-labelledby="demo-${d.id}-title">
  <header class="player__head">
    <span class="tag">${esc(d.industry)}</span>
    <span class="mono muted-text">${esc(d.time)}</span>
  </header>
  <h3 class="player__title" id="demo-${d.id}-title">${esc(d.title)}</h3>
  <div class="player__controls">
    <button class="player__btn" type="button" data-player-toggle aria-label="Play sample call: ${esc(d.industry)}, ${esc(d.title)}" data-track="demo_audio_play" data-track-label="${d.id}">
      <svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>
      <svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>
    </button>
    <div class="player__wave" data-player-wave role="slider" tabindex="0" aria-label="Playback position" aria-valuemin="0" aria-valuemax="${d.duration}" aria-valuenow="0" aria-valuetext="0:00 of ${mmss(d.duration)}"></div>
    <span class="player__time mono" data-player-time>0:00 / ${mmss(d.duration)}</span>
  </div>
  <ol class="transcript" data-player-transcript aria-label="Transcript">${lines}</ol>
  <footer class="player__foot">
    <span class="outcome"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" /></svg>${esc(d.outcome)}</span>
    <span class="ph ph--small" title="Placeholder: replace scripted sample with a real recorded call">Sample script</span>
  </footer>
</article>`;
}

const demoCards = demos.map((d) => demoCard(d)).join('\n');

// Client wordmarks for the hero trust strip (monochrome, one icon each).
const clientIcons = {
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.6 7.6 20 18M8.6 16.4 20 6"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/>',
  dumbbell: '<path d="M3 10v4M6.5 7.5v9M17.5 7.5v9M21 10v4M6.5 12h11"/>',
  pole: '<rect x="8.5" y="3" width="7" height="18" rx="3.5"/><path d="M8.6 9.5l6.8-3.5M8.6 14.5l6.8-3.5M8.6 19.5l6.8-3.5"/>',
  tooth: '<path d="M7.5 4c1.9 0 2.8.9 4.5.9s2.6-.9 4.5-.9c2.6 0 3.7 2.4 3.2 5-.6 3-1.5 4-2 7-.4 2.3-1 4-2.2 4-1.6 0-1.4-5-3.5-5s-1.9 5-3.5 5c-1.2 0-1.8-1.7-2.2-4-.5-3-1.4-4-2-7-.5-2.6.6-5 3.2-5z"/>',
  flame: '<path d="M12 3c.8 3.2 5 5.3 5 10.2a5 5 0 0 1-10 0c0-2.6 1.4-4.2 2.5-5.2.3 2 1.4 3.1 2.5 3.1-.9-2.9-.2-5.6 0-8.1z"/>',
};
const clientLogos = site.clients
  .map(
    (c) => `<li class="cl cl--${c.style}"><svg class="cl__icon" viewBox="0 0 24 24" aria-hidden="true">${clientIcons[c.icon]}</svg><span class="cl__word" aria-hidden="true"><span class="cl__main">${esc(c.main)}</span>${c.sub ? `<span class="cl__sub">${esc(c.sub)}</span>` : ''}</span><span class="sr-only">${esc(c.name)}</span></li>`
  )
  .join('\n');

function snippetHtml(snippet) {
  return snippet
    .map(([who, text]) => `<p class="snip snip--${who}"><span class="mono">${who === 'ai' ? 'AI' : 'Caller'}</span>${esc(text)}</p>`)
    .join('');
}

// Homepage industry tabs (ARIA tabs pattern, panels are server-rendered).
const industryTabs = `
<div class="tabs__list" role="tablist" aria-label="Industries">
${industries
  .map(
    (ind, i) =>
      `<button class="tabs__tab" role="tab" id="tab-${ind.slug}" aria-controls="panel-${ind.slug}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(ind.name)}</button>`
  )
  .join('\n')}
</div>
${industries
  .map(
    (ind, i) => `
<div class="tabs__panel" role="tabpanel" id="panel-${ind.slug}" aria-labelledby="tab-${ind.slug}" tabindex="0"${i === 0 ? '' : ' hidden'}>
  <div class="ind">
    <div class="ind__copy">
      <p class="eyebrow">${esc(ind.name)}</p>
      <h3 class="ind__headline">${esc(ind.headline)}</h3>
      <ul class="ind__uses">
        ${ind.useCases.map(([t, d]) => `<li><strong>${esc(t)}</strong><span>${esc(d)}</span></li>`).join('')}
      </ul>
      <a class="btn btn--primary btn--lg" href="industries/${ind.slug}/" data-track="industry_page" data-track-label="${ind.slug}">See NeverMissed for ${esc(ind.inSentence)}</a>
    </div>
    <figure class="ind__snippet">
      <figcaption class="mono"><span class="live-dot" aria-hidden="true"></span>Live transcript · ${esc(ind.name)}</figcaption>
      ${snippetHtml(ind.snippet)}
    </figure>
  </div>
</div>`
  )
  .join('')}`;

// Results cards. `sample: true` entries carry a visible "Sample result" tag.
const resultCards = results
  .map(
    (r) => `
<article class="case reveal${r.sample ? ' case--sample' : ''}">
  <header class="case__top">
    <span class="tag">${esc(r.industry)}</span>
    ${r.sample ? '<span class="case__sample mono" title="Sample content for layout. Replace with a real client result in src/config.mjs">Sample result</span>' : ''}
  </header>
  <p class="case__metric">${esc(r.metric)}</p>
  <p class="case__metric-label mono">${esc(r.metricLabel)}</p>
  <blockquote class="case__quote"><p>\u201c${esc(r.quote)}\u201d</p></blockquote>
  <footer class="case__who">
    ${r.photo ? `<img class="avatar avatar--photo" src="${esc(r.photo)}" alt="" width="44" height="44" loading="lazy">` : `<span class="avatar" aria-hidden="true">${esc(r.initials || '')}</span>`}
    <span><strong>${esc(r.business)}</strong><br><span class="muted-text">${esc(r.who)}</span></span>
  </footer>
</article>`
  )
  .join('');
const resultsLead = results.some((r) => r.sample)
  ? 'What answering every call looks like for businesses like yours. Cards tagged \u201cSample result\u201d show the layout until real client results are added.'
  : 'What answering every call looks like for businesses like yours.';

const industryFooterLinks = (root) =>
  industries.map((i) => `<li><a href="${root}industries/${i.slug}/">${esc(i.name)}</a></li>`).join('');

const industryOptions = industries.map((i) => `<option value="${i.slug}">${esc(i.name)}</option>`).join('') + '<option value="other">Other</option>';

// Pricing cards with monthly/annual values in data attributes.
const pricingCards = pricing.tiers
  .map((t) => {
    const price =
      t.monthly == null
        ? `<span class="price__amount">Custom</span>`
        : `<span class="price__amount ph" title="Placeholder: sample price" data-monthly="${fmtMoney(t.monthly)}" data-annual="${fmtMoney(t.annual)}">${fmtMoney(t.monthly)}</span><span class="price__per">/mo</span>`;
    const cta =
      t.monthly == null
        ? `<a class="btn btn--ghost btn--block" href="#book" data-track="cta_pricing" data-track-label="${t.id}">Talk to us</a>`
        : `<a class="btn ${t.popular ? 'btn--primary' : 'btn--ghost'} btn--block" href="#book" data-track="cta_pricing" data-track-label="${t.id}">Book a Free Demo</a>`;
    return `
<article class="tier${t.popular ? ' tier--popular' : ''}" aria-labelledby="tier-${t.id}">
  ${t.popular ? '<p class="tier__badge mono">Most popular</p>' : ''}
  <h3 class="tier__name" id="tier-${t.id}">${esc(t.name)}</h3>
  <p class="tier__blurb">${esc(t.blurb)}</p>
  <p class="price">${price}</p>
  <p class="tier__billing mono" data-billing-note>${t.monthly == null ? 'Volume pricing' : 'Billed monthly'}</p>
  <ul class="tier__meta mono">
    <li>${esc(t.minutes)}</li>
    <li>${t.setup.includes('[X]') ? `<span class="ph" title="Placeholder: setup fee">${esc(t.setup)}</span>` : esc(t.setup)}</li>
  </ul>
  ${cta}
  <ul class="tier__features">
    ${t.features.map((f) => `<li><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7"/></svg>${esc(f)}</li>`).join('')}
  </ul>
</article>`;
  })
  .join('');

const faqItems = faqs
  .map(
    (f, i) => `
<div class="faq__item">
  <h3 class="faq__q">
    <button type="button" aria-expanded="false" aria-controls="faq-a-${i}" id="faq-q-${i}" data-faq-toggle>
      <span>${esc(f.q)}</span><span class="faq__icon" aria-hidden="true"></span>
    </button>
  </h3>
  <div class="faq__a" id="faq-a-${i}" role="region" aria-labelledby="faq-q-${i}">
    <div><p>${f.a}</p></div>
  </div>
</div>`
  )
  .join('');

/* ---------- Schema.org ---------------------------------------------- */
const orgSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: site.name,
  url: site.url,
  logo: site.url + 'assets/img/logo.png',
  slogan: site.tagline,
  email: site.email,
  telephone: site.phone.tel,
  description: 'NeverMissed builds AI receptionists that answer every call 24/7, book and reschedule appointments and capture every lead for service businesses.',
  contactPoint: [{ '@type': 'ContactPoint', telephone: site.phone.tel, contactType: 'sales', availableLanguage: ['English'] }],
};
const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: stripTags(f.a) } })),
};
const ld = (...objs) => objs.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n');

/* ---------- Pages --------------------------------------------------- */
const base = {
  site,
  year: new Date().getFullYear(),
  blocks: { demoCards, industryTabs, pricingCards, faqItems, industryOptions, clientLogos, resultCards, resultsLead },
};

function page({ src, out, depth, title, description, path, extra = {}, schema = ld(orgSchema) }) {
  const root = depth === 0 ? './' : '../'.repeat(depth);
  const ctx = {
    ...base,
    ...extra,
    root,
    page: {
      title,
      description,
      canonical: site.url + path,
      ogImage: site.url + 'assets/img/og.png',
      schema,
      industryLinks: industryFooterLinks(root),
      bookHref: depth === 0 ? '#book' : `${root}book-demo/`,
    },
  };
  const html = render(read(`src/pages/${src}`), ctx);
  const file = join(ROOT, out);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
  console.log('  wrote', out);
}

console.log('Building NeverMissed…');
page({
  src: 'index.html',
  out: 'index.html',
  depth: 0,
  path: '',
  title: 'NeverMissed | AI Receptionists That Answer Every Call, 24/7',
  description: 'NeverMissed builds AI receptionists that pick up 24/7, book and reschedule appointments and capture every lead, so your business never loses a customer to voicemail again.',
  schema: ld(orgSchema, faqSchema),
});
page({
  src: 'book-demo.html',
  out: 'book-demo/index.html',
  depth: 1,
  path: 'book-demo/',
  title: 'Book a Free Demo | NeverMissed',
  description: 'Book a free 20-minute demo and hear an AI receptionist built for your business answer your calls.',
});
page({ src: 'privacy.html', out: 'privacy/index.html', depth: 1, path: 'privacy/', title: 'Privacy Policy | NeverMissed', description: 'How NeverMissed collects, uses and protects your information.' });
page({ src: 'terms.html', out: 'terms/index.html', depth: 1, path: 'terms/', title: 'Terms of Service | NeverMissed', description: 'The terms that govern your use of NeverMissed.' });

for (const ind of industries) {
  const demo = demos.find((d) => d.id === ind.demo);
  page({
    src: 'industry.html',
    out: `industries/${ind.slug}/index.html`,
    depth: 2,
    path: `industries/${ind.slug}/`,
    title: `AI Receptionist for ${ind.name} | NeverMissed`,
    description: `${ind.headline} ${ind.sub}`.slice(0, 158),
    extra: {
      ind: {
        ...ind,
        nameLower: ind.inSentence,
        useCasesHtml: ind.useCases
          .map(([t, d], i) => `<li class="uc reveal"><span class="uc__n mono">0${i + 1}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></li>`)
          .join(''),
        snippetHtml: snippetHtml(ind.snippet),
        demoHtml: demo
          ? `<div class="ind-demo">${demoCard(demo)}</div>`
          : `<div class="ind-demo ind-demo--empty"><p class="ph" title="Placeholder: record a ${esc(ind.name)} sample call">[${esc(ind.name)} sample call audio coming soon]</p><p>Until then, the fastest way to hear it is to call the demo line yourself.</p></div>`,
        others: industries
          .filter((o) => o.slug !== ind.slug)
          .map((o) => `<a class="chip" href="../${o.slug}/">${esc(o.name)}</a>`)
          .join(''),
      },
    },
  });
}
console.log('Done.');
