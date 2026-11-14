/* =====================================================================
   NeverMissed — interactions
   Vanilla JS, no dependencies. Each feature is a small init function that
   no-ops when its markup isn't on the page, so one file serves every page.
   All motion checks `RM` (prefers-reduced-motion) and falls back to a
   static final state.
   ===================================================================== */
(() => {
  'use strict';

  const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const store = {
    get(k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) { /* storage blocked */ } },
  };

  /* Runs `fn` once when `el` first scrolls into view. */
  function onVisible(el, fn, opts = { threshold: 0.25 }) {
    if (!('IntersectionObserver' in window)) return fn();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { io.disconnect(); fn(); } });
    }, opts);
    io.observe(el);
  }

  /* Shared scroll loop: features register a callback, one rAF per frame. */
  const scrollFns = [];
  let ticking = false;
  function onScroll(fn) { scrollFns.push(fn); fn(); }
  const runScroll = () => { ticking = false; scrollFns.forEach((f) => f()); };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(runScroll); } }, { passive: true });
  window.addEventListener('resize', () => requestAnimationFrame(runScroll), { passive: true });

  /* ---------- Analytics hooks --------------------------------------
     Every CTA carries data-track (+ optional -location / -label).
     Events go to window.dataLayer (GTM / GA4) and a DOM CustomEvent
     ('nm:track') so any other tool can listen. */
  function track(event, detail = {}) {
    const payload = { event, ...detail };
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
    document.dispatchEvent(new CustomEvent('nm:track', { detail: payload }));
  }
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-track]');
    if (!el || el.matches('[data-player-toggle], button[type=submit]')) return;
    track(el.dataset.track, { location: el.dataset.trackLocation || null, label: el.dataset.trackLabel || null, href: el.getAttribute('href') || null });
  });

  /* ---------- Nav: shrink + blur on scroll ------------------------- */
  function initNav() {
    const nav = $('[data-nav]');
    if (!nav) return;
    // Switch to the ink variant while a dark section sits under the nav bar.
    const darks = $$('.section--ink, .footer');
    onScroll(() => {
      nav.classList.toggle('is-scrolled', window.scrollY > 24);
      const y = nav.offsetHeight / 2;
      nav.classList.toggle('is-dark', darks.some((d) => { const r = d.getBoundingClientRect(); return r.top <= y && r.bottom >= y; }));
    });
  }

  /* ---------- Mobile full-screen menu ------------------------------ */
  function initMenu() {
    const btn = $('[data-menu-toggle]');
    const menu = $('[data-menu]');
    if (!btn || !menu) return;
    const focusables = () => [btn, ...$$('a, button', menu)];

    const open = () => {
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add('is-open'));
      btn.setAttribute('aria-expanded', 'true');
      btn.setAttribute('aria-label', 'Close menu');
      document.body.classList.add('menu-open');
      $('a', menu).focus();
    };
    const close = (returnFocus = true) => {
      menu.classList.remove('is-open');
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', 'Open menu');
      document.body.classList.remove('menu-open');
      if (returnFocus) btn.focus();
    };
    btn.addEventListener('click', () => (menu.hidden ? open() : close()));
    $$('[data-menu-link]', menu).forEach((a) => a.addEventListener('click', () => close(false)));
    document.addEventListener('keydown', (e) => {
      if (menu.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') { // simple focus trap
        const f = focusables();
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    });
    window.matchMedia('(min-width: 900px)').addEventListener('change', (m) => { if (m.matches && !menu.hidden) close(false); });
  }

  /* ---------- Sticky mobile CTA bar -------------------------------- */
  function initMobileBar() {
    const bar = $('[data-mobilebar]');
    if (!bar) return;
    const book = $('#book');
    let bookInView = false;
    if (book && 'IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { bookInView = e.isIntersecting; runScroll(); }, { threshold: 0.15 }).observe(book);
    }
    onScroll(() => bar.classList.toggle('is-shown', window.scrollY > 420 && !bookInView));
  }

  /* ---------- Visitor's local clock in the hero -------------------- */
  function initClock() {
    const el = $('[data-clock]');
    if (!el) return;
    const tick = () => {
      const d = new Date();
      el.textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      el.setAttribute('datetime', d.toISOString());
    };
    tick();
    setInterval(tick, 15000);
  }

  /* ---------- Scroll reveals --------------------------------------- */
  function initReveal() {
    const els = $$('.reveal');
    if (RM || !('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    els.forEach((el, i) => { el.style.transitionDelay = `${(i % 3) * 80}ms`; io.observe(el); });
  }

  /* ---------- Count-up numbers ------------------------------------- */
  function initCounters() {
    $$('[data-count]').forEach((el) => {
      const target = Number(el.dataset.count);
      if (RM) { el.textContent = target; return; }
      onVisible(el, () => {
        const start = performance.now();
        const dur = 1600;
        const step = (now) => {
          const p = clamp((now - start) / dur);
          el.textContent = Math.round(target * (1 - Math.pow(1 - p, 4)));
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }, { threshold: 0.6 });
    });
  }

  /* ---------- Hero: live call card --------------------------------- */
  const HERO_SCRIPT = [
    { who: 'ai', text: 'Thanks for calling Brightside Dental, this is Ava. How can I help?' },
    { who: 'caller', text: 'Hi, I chipped a tooth. Can I get in this week?' },
    { who: 'ai', text: "I'm sorry, that sounds painful. I have Tuesday at 10:30 AM or Wednesday at 2:15 PM." },
    { who: 'caller', text: 'Tuesday works.' },
    { who: 'ai', text: "You're booked for Tuesday at 10:30 AM. I'll text you a confirmation now." },
  ];

  function initCallCard() {
    const card = $('[data-callcard]');
    if (!card) return;
    const log = $('[data-cc-log]', card);
    const wave = $('[data-cc-wave]', card);
    const state = $('[data-cc-state]', card);
    const timer = $('[data-cc-timer]', card);
    const BARS = 38;
    wave.innerHTML = '<i></i>'.repeat(BARS);
    const bars = $$('i', wave);

    const lineEl = (l) => {
      const li = document.createElement('li');
      li.className = l.who;
      li.innerHTML = `<span class="who">${l.who === 'ai' ? 'AI · Ava' : 'Caller'}</span><span class="txt"></span>`;
      log.appendChild(li);
      return $('.txt', li);
    };

    if (RM) { // static final state
      card.classList.add('is-live', 'is-saved', 'is-booked');
      state.textContent = 'Answered';
      timer.textContent = '0:52';
      HERO_SCRIPT.forEach((l) => { lineEl(l).textContent = l.text; });
      return;
    }

    // Pause the loop when the card is off-screen or the tab is hidden.
    let visible = true;
    let waiters = [];
    const setVisible = (v) => { visible = v; if (v) { waiters.forEach((r) => r()); waiters = []; } };
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => setVisible(e.isIntersecting && !document.hidden)).observe(card);
    document.addEventListener('visibilitychange', () => setVisible(!document.hidden));
    const ready = () => (visible ? Promise.resolve() : new Promise((r) => waiters.push(r)));
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)).then(ready);

    // Waveform: bars jitter while someone is talking.
    let speaking = null;
    setInterval(() => {
      if (!visible) return;
      const t = performance.now() / 1000;
      bars.forEach((b, i) => {
        const s = speaking
          ? 0.18 + Math.abs(Math.sin(i * 0.55 + t * 7) * Math.cos(i * 0.21 - t * 3.3)) * 0.82 * (0.6 + Math.random() * 0.4)
          : 0.1;
        b.style.transform = `scaleY(${s.toFixed(3)})`;
      });
      wave.className = 'callcard__wave' + (speaking ? ` is-${speaking}` : '');
    }, 90);

    let secs = 0;
    let clock = null;

    async function run() {
      for (;;) {
        // reset
        log.innerHTML = '';
        card.classList.remove('is-live', 'is-saved', 'is-booked');
        card.classList.add('is-ringing');
        state.textContent = 'Incoming call';
        timer.textContent = '';
        await sleep(2200);

        // answered on the first ring
        card.classList.remove('is-ringing');
        card.classList.add('is-live', 'is-saved');
        state.textContent = 'Answered';
        secs = 0;
        timer.textContent = '0:00';
        clock = setInterval(() => { if (visible) timer.textContent = mmss(++secs); }, 1000);
        await sleep(500);

        for (const l of HERO_SCRIPT) {
          const el = lineEl(l);
          speaking = l.who;
          const caret = document.createElement('span');
          caret.className = 'caret';
          el.after(caret);
          for (let i = 1; i <= l.text.length; i++) {
            el.textContent = l.text.slice(0, i);
            await sleep(l.who === 'ai' ? 26 : 34);
          }
          caret.remove();
          speaking = null;
          await sleep(l.who === 'ai' ? 700 : 500);
        }
        card.classList.add('is-booked');
        state.textContent = 'Booked';
        clearInterval(clock);
        await sleep(5200);
      }
    }
    run();
  }

  /* ---------- Problem: missed → answered flip stack ---------------- */
  function initFlipStack() {
    const cards = $$('[data-flip]');
    if (!cards.length) return;
    onScroll(() => {
      const line = window.innerHeight * 0.62;
      cards.forEach((c) => c.classList.toggle('is-flipped', c.getBoundingClientRect().top < line));
    });
  }

  /* ---------- Missed-revenue calculator ---------------------------- */
  function initCalculator() {
    const root = $('[data-calc]');
    if (!root) return;
    const inputs = {
      calls: $('[data-calc-input="calls"]', root),
      missed: $('[data-calc-input="missed"]', root),
      value: $('[data-calc-input="value"]', root),
    };
    const rates = $$('[data-calc-input="rate"]', root);
    const out = {
      calls: $('[data-out="calls"]', root),
      missed: $('[data-out="missed"]', root),
      value: $('[data-out="value"]', root),
      total: $('[data-calc-total]', root),
      total2: $('[data-calc-total-2]', root),
      year: $('[data-calc-year]', root),
      missedMonth: $('[data-calc-missed-month]', root),
      lost: $('[data-calc-lost]', root),
      formula: $('[data-calc-formula]', root),
      box: $('.calc__out', root),
    };
    const rateLabel = { '0.25': '1-in-4', '0.333': '1-in-3', '0.5': '1-in-2' };

    // Screen readers get one calm, debounced announcement instead of every tween frame.
    const live = document.createElement('p');
    live.className = 'sr-only';
    live.setAttribute('aria-live', 'polite');
    out.box.appendChild(live);
    let liveT;

    let shown = 0;
    let anim;
    const tweenTo = (target) => {
      cancelAnimationFrame(anim);
      if (RM) { shown = target; paint(); return; }
      const from = shown;
      const start = performance.now();
      const step = (now) => {
        const p = clamp((now - start) / 450);
        shown = from + (target - from) * (1 - Math.pow(1 - p, 3));
        paint();
        if (p < 1) anim = requestAnimationFrame(step);
      };
      anim = requestAnimationFrame(step);
    };
    const paint = () => {
      out.total.textContent = money(shown);
      out.total2.textContent = money(shown);
      out.year.textContent = money(shown * 12);
    };
    const fill = (el) => {
      const p = ((el.value - el.min) / (el.max - el.min)) * 100;
      el.style.setProperty('--p', p + '%');
    };

    function update() {
      const calls = +inputs.calls.value;
      const missed = +inputs.missed.value;
      const value = +inputs.value.value;
      const rateEl = rates.find((r) => r.checked) || rates[1];
      const rate = +rateEl.value;
      Object.values(inputs).forEach(fill);

      const missedMonth = Math.round(calls * (missed / 100) * 30);
      const lost = Math.round(missedMonth * rate);
      const total = lost * value;

      out.calls.textContent = calls;
      out.missed.textContent = missed + '%';
      out.value.textContent = money(value);
      out.missedMonth.textContent = missedMonth.toLocaleString('en-US');
      out.lost.textContent = lost.toLocaleString('en-US');
      out.formula.textContent = `${calls} calls × ${missed}% missed × 30 days × ${rateLabel[rateEl.value]} book × ${money(value)}`;
      tweenTo(total);

      clearTimeout(liveT);
      liveT = setTimeout(() => { live.textContent = `You're losing about ${money(total)} per month, ${money(total * 12)} per year.`; }, 700);
    }
    [...Object.values(inputs), ...rates].forEach((el) => el.addEventListener('input', update));
    let tracked = false;
    root.addEventListener('change', () => { if (!tracked) { tracked = true; track('calculator_used'); } });
    shown = 0;
    update();
  }

  /* ---------- Audio demo players -----------------------------------
     If data-src points at a real file, the <audio> element drives time.
     Otherwise a virtual clock plays the scripted transcript. */
  const players = [];
  function seeded(seed) { let s = seed; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); }

  function initPlayers() {
    $$('[data-player]').forEach((el, idx) => {
      const btn = $('[data-player-toggle]', el);
      const waveEl = $('[data-player-wave]', el);
      const timeEl = $('[data-player-time]', el);
      const tEl = $('[data-player-transcript]', el);
      const lines = $$('.tline', tEl).map((li) => ({ li, t: +li.dataset.t }));
      const src = el.dataset.src;
      let duration = +el.dataset.duration || 40;

      // Deterministic waveform with a speech-like envelope.
      const N = 72;
      const rnd = seeded(idx * 97 + 13);
      waveEl.innerHTML = Array.from({ length: N }, (_, i) => {
        const env = 0.35 + 0.65 * Math.abs(Math.sin((i / N) * Math.PI * 5.3 + idx));
        const h = Math.round(12 + rnd() * 80 * env);
        return `<i style="height:${clamp(h, 10, 100)}%"></i>`;
      }).join('');
      const bars = $$('i', waveEl);

      let audio = null;
      if (src) {
        audio = new Audio();
        audio.preload = 'none'; // lazy: nothing downloads until play
        audio.src = src;
        audio.addEventListener('loadedmetadata', () => { if (isFinite(audio.duration)) duration = audio.duration; });
        audio.addEventListener('ended', () => stop(true));
      }

      let t = 0;
      let playing = false;
      let last = 0;
      let raf;
      let lastNow = -1;

      const render = () => {
        const p = clamp(t / duration);
        const k = Math.floor(p * N);
        bars.forEach((b, i) => { b.classList.toggle('on', i < k); b.classList.toggle('now', playing && i === k); });
        timeEl.textContent = `${mmss(t)} / ${mmss(duration)}`;
        waveEl.setAttribute('aria-valuenow', Math.floor(t));
        waveEl.setAttribute('aria-valuetext', `${mmss(t)} of ${mmss(duration)}`);
        let now = -1;
        lines.forEach((l, i) => { const said = t >= l.t; l.li.classList.toggle('is-said', said); if (said) now = i; });
        lines.forEach((l, i) => l.li.classList.toggle('is-now', i === now && playing));
        if (now !== lastNow && now >= 0) {
          lastNow = now;
          const li = lines[now].li;
          const target = li.offsetTop - tEl.clientHeight + li.offsetHeight + 14;
          tEl.scrollTop = Math.max(0, target);
        }
      };

      const loop = (now) => {
        if (!playing) return;
        if (audio) t = audio.currentTime;
        else { t += (now - last) / 1000; last = now; }
        if (t >= duration) { t = duration; render(); stop(true); return; }
        render();
        raf = requestAnimationFrame(loop);
      };

      const play = () => {
        players.forEach((p) => p !== api && p.pause());
        if (t >= duration) { t = 0; lastNow = -1; tEl.scrollTop = 0; }
        playing = true;
        el.classList.add('is-playing');
        btn.setAttribute('aria-label', btn.getAttribute('aria-label').replace(/^Play/, 'Pause'));
        if (audio) { audio.currentTime = t; audio.play().catch(() => stop()); }
        last = performance.now();
        raf = requestAnimationFrame(loop);
        track('demo_audio_play', { label: btn.dataset.trackLabel });
      };
      const stop = (ended = false) => {
        playing = false;
        cancelAnimationFrame(raf);
        if (audio && !audio.paused) audio.pause();
        el.classList.remove('is-playing');
        btn.setAttribute('aria-label', btn.getAttribute('aria-label').replace(/^Pause/, 'Play'));
        if (ended) track('demo_audio_complete', { label: btn.dataset.trackLabel });
        render();
      };
      const seek = (sec) => {
        t = clamp(sec, 0, duration);
        if (audio) audio.currentTime = t;
        lastNow = -1;
        render();
      };

      btn.addEventListener('click', () => (playing ? stop() : play()));
      const seekFromPointer = (e) => {
        const r = waveEl.getBoundingClientRect();
        seek(((e.clientX - r.left) / r.width) * duration);
      };
      waveEl.addEventListener('pointerdown', (e) => {
        seekFromPointer(e);
        waveEl.setPointerCapture(e.pointerId);
        const move = (ev) => seekFromPointer(ev);
        waveEl.addEventListener('pointermove', move);
        waveEl.addEventListener('pointerup', () => waveEl.removeEventListener('pointermove', move), { once: true });
      });
      waveEl.addEventListener('keydown', (e) => {
        const map = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5 };
        if (e.key in map) { e.preventDefault(); seek(t + map[e.key]); }
        else if (e.key === 'Home') { e.preventDefault(); seek(0); }
        else if (e.key === 'End') { e.preventDefault(); seek(duration); }
        else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); playing ? stop() : play(); }
      });

      const api = { pause: () => playing && stop() };
      players.push(api);
      render();
    });
  }

  /* ---------- Feature art: 24-hour strip --------------------------- */
  function initHours() {
    const el = $('[data-hours]');
    if (!el) return;
    el.innerHTML = Array.from({ length: 24 }, (_, h) => `<span class="${h < 7 || h > 18 ? 'night' : ''}">${String(h).padStart(2, '0')}</span>`).join('');
    const cells = $$('span', el);
    if (RM) { cells.forEach((c) => c.classList.add('on')); return; }
    onVisible(el, () => cells.forEach((c, i) => setTimeout(() => c.classList.add('on'), 200 + i * 55)), { threshold: 0.5 });
  }

  /* ---------- Feature art: language cycle -------------------------- */
  function initLang() {
    // Phrases are listed in the markup (features tile); keep them to languages you support.
    const words = $$('[data-lang-word]');
    if (words.length < 2 || RM) return;
    let i = 0;
    setInterval(() => {
      if (document.hidden) return;
      words[i].classList.remove('is-active');
      i = (i + 1) % words.length;
      words[i].classList.add('is-active');
    }, 2200);
  }

  /* ---------- How it works: progress line -------------------------- */
  function initTimeline() {
    const tl = $('[data-timeline]');
    if (!tl) return;
    const track = $('.timeline__track', tl);
    const steps = $$('[data-step]', tl);
    onScroll(() => {
      const r = track.getBoundingClientRect();
      const vh = window.innerHeight;
      const horizontal = r.width > r.height;
      const p = horizontal ? clamp((vh * 0.85 - r.top) / (vh * 0.45)) : clamp((vh * 0.6 - r.top) / r.height);
      tl.style.setProperty('--progress', p.toFixed(4));
      steps.forEach((s) => {
        const d = $('.step__dot', s).getBoundingClientRect();
        const frac = horizontal ? (d.left - r.left) / r.width : (d.top - r.top) / r.height;
        s.classList.toggle('is-active', p >= frac - 0.001);
      });
    });
  }

  /* ---------- Industry tabs (WAI-ARIA tabs, automatic activation) -- */
  function initTabs() {
    $$('[data-tabs]').forEach((root) => {
      const tabs = $$('[role=tab]', root);
      const select = (tab, focus = true) => {
        tabs.forEach((t) => {
          const on = t === tab;
          t.setAttribute('aria-selected', on);
          t.tabIndex = on ? 0 : -1;
          document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
        });
        if (focus) tab.focus();
        tab.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: RM ? 'auto' : 'smooth' });
      };
      tabs.forEach((t, i) => {
        t.addEventListener('click', () => { select(t, false); track('industry_tab', { label: t.id.replace('tab-', '') }); });
        t.addEventListener('keydown', (e) => {
          const n = tabs.length;
          const map = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 };
          if (e.key in map) { e.preventDefault(); select(tabs[map[e.key]]); }
        });
      });
    });
  }

  /* ---------- Pricing: monthly / annual toggle --------------------- */
  function initBilling() {
    const root = $('[data-billing]');
    if (!root) return;
    const opts = $$('[data-billing-opt]', root);
    opts.forEach((b) => b.addEventListener('click', () => {
      const mode = b.dataset.billingOpt;
      opts.forEach((o) => o.setAttribute('aria-pressed', o === b));
      $$('.price__amount[data-monthly]').forEach((p) => {
        p.textContent = p.dataset[mode];
        p.classList.remove('is-swap'); void p.offsetWidth; p.classList.add('is-swap');
      });
      $$('.tier').forEach((tier) => {
        const note = $('[data-billing-note]', tier);
        if ($('.price__amount[data-monthly]', tier)) note.textContent = mode === 'annual' ? 'Per month, billed annually' : 'Billed monthly';
      });
      track('pricing_toggle', { label: mode });
    }));
  }

  /* ---------- FAQ accordion ---------------------------------------- */
  // One answer open at a time: opening a question closes the one that was open.
  function initFaq() {
    const btns = $$('[data-faq-toggle]');
    const set = (btn, open) => {
      btn.setAttribute('aria-expanded', open);
      btn.closest('.faq__item').classList.toggle('is-open', open);
    };
    btns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const open = btn.getAttribute('aria-expanded') !== 'true';
        if (open) btns.forEach((other) => { if (other !== btn) set(other, false); });
        set(btn, open);
        if (open) track('faq_open', { label: btn.textContent.trim().slice(0, 60) });
      });
    });
  }

  /* ---------- Demo booking form ------------------------------------ */
  function initBooking() {
    $$('[data-booking]').forEach((root) => {
      const form = $('[data-form]', root);
      const done = $('[data-booking-done]', root);
      const rules = {
        name: (v) => (v.trim().length >= 2 ? '' : 'Please enter your name.'),
        business: (v) => (v.trim().length >= 2 ? '' : 'What’s the name of your business?'),
        industry: (v) => (v ? '' : 'Pick the closest match.'),
        volume: (v) => (v ? '' : 'A rough guess is fine.'),
        phone: (v) => (v.replace(/\D/g, '').length >= 10 ? '' : 'Enter a phone number with area code.'),
        email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Enter a valid email, like you@business.com.'),
      };
      const check = (input, show = true) => {
        const msg = rules[input.name](input.value);
        const field = input.closest('.field');
        if (show) {
          field.classList.toggle('is-invalid', !!msg);
          field.classList.toggle('is-valid', !msg);
          input.setAttribute('aria-invalid', !!msg);
          $('.field__err', field).textContent = msg;
        }
        return !msg;
      };
      const fields = $$('input, select', form).filter((i) => rules[i.name]);
      fields.forEach((i) => {
        i.addEventListener('blur', () => { if (i.value) check(i); });
        i.addEventListener('input', () => { if (i.closest('.field').classList.contains('is-invalid')) check(i); });
        i.addEventListener('change', () => { if (i.tagName === 'SELECT') check(i); });
      });

      let started = false;
      form.addEventListener('focusin', () => { if (!started) { started = true; track('form_start_demo'); } });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const results = fields.map((i) => check(i));
        if (results.includes(false)) {
          fields[results.indexOf(false)].focus();
          track('form_error_demo');
          return;
        }
        const data = Object.fromEntries(new FormData(form));
        const label = $('[data-submit-label]', form);
        form.classList.add('is-sending');
        label.textContent = 'Sending…';
        try {
          if (root.dataset.endpoint) {
            const res = await fetch(root.dataset.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) });
            if (!res.ok) throw new Error('Request failed');
          } else {
            await new Promise((r) => setTimeout(r, 600)); // no endpoint configured yet
          }
        } catch (err) {
          form.classList.remove('is-sending');
          label.textContent = 'Continue: pick a time';
          const f = $('.field__err', form.querySelector('[name=email]').closest('.field'));
          f.textContent = 'Something went wrong sending that. Please try again, or call us.';
          return;
        }
        track('form_submit_demo', { label: data.industry, volume: data.volume });
        form.hidden = true;
        done.hidden = false;
        $('[data-booking-name]', done).textContent = data.name.trim().split(' ')[0];
        const embedUrl = root.dataset.embed;
        if (embedUrl) {
          const url = new URL(embedUrl);
          url.searchParams.set('name', data.name);
          url.searchParams.set('email', data.email);
          const frame = document.createElement('iframe');
          frame.src = url.toString();
          frame.title = 'Pick a time for your demo';
          frame.loading = 'lazy';
          const box = $('[data-booking-embed]', done);
          box.innerHTML = '';
          box.appendChild(frame);
        }
        done.focus();
        store.set('nm_booked', '1');
      });
    });
  }

  /* ---------- Exit-intent / scroll-depth nudge ---------------------
     Shows once per session, never on top of the booking form,
     never as a modal. */
  function initNudge() {
    const el = $('[data-nudge]');
    if (!el || store.get('nm_nudged') || store.get('nm_booked')) return;
    const book = $('#book');
    const t0 = Date.now();
    let shown = false;
    const show = (why) => {
      if (shown || Date.now() - t0 < 8000) return;
      if (book) { const r = book.getBoundingClientRect(); if (r.top < window.innerHeight && r.bottom > 0) return; }
      if (document.body.classList.contains('menu-open')) return;
      shown = true;
      store.set('nm_nudged', '1');
      el.hidden = false;
      track('nudge_shown', { label: why });
    };
    const hide = () => { el.hidden = true; };
    $('[data-nudge-close]', el).addEventListener('click', hide);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el.hidden) hide(); });
    document.addEventListener('mouseout', (e) => { if (!e.relatedTarget && e.clientY <= 0) show('exit_intent'); });
    onScroll(() => {
      const depth = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
      if (depth > 0.62) show('scroll_depth');
    });
  }

  /* ---------- Ambient waveform behind the final CTA ---------------- */
  function initAmbient() {
    $$('[data-ambient]').forEach((cv) => {
      const ctx = cv.getContext('2d');
      let w = 0, h = 0, visible = false, raf;
      const size = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        w = cv.clientWidth; h = cv.clientHeight;
        cv.width = w * dpr; cv.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      const waves = [
        { a: 0.09, f: 1.6, s: 0.35, c: 'rgba(43,214,123,.55)', lw: 1.5 },
        { a: 0.14, f: 1.1, s: -0.22, c: 'rgba(43,214,123,.25)', lw: 1 },
        { a: 0.06, f: 2.6, s: 0.5, c: 'rgba(245,242,236,.14)', lw: 1 },
      ];
      const draw = (time) => {
        ctx.clearRect(0, 0, w, h);
        const t = time / 1000;
        waves.forEach((wv) => {
          ctx.beginPath();
          for (let x = 0; x <= w; x += 6) {
            const nx = x / w;
            const env = Math.sin(nx * Math.PI); // taper at the edges
            const y = h * 0.62 + Math.sin(nx * Math.PI * 2 * wv.f + t * wv.s * 3) * h * wv.a * env * (0.7 + 0.3 * Math.sin(t * 0.8 + nx * 6));
            x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.strokeStyle = wv.c; ctx.lineWidth = wv.lw; ctx.stroke();
        });
        if (visible && !RM) raf = requestAnimationFrame(draw);
      };
      size();
      window.addEventListener('resize', () => { size(); if (!visible || RM) draw(0); }, { passive: true });
      if (RM || !('IntersectionObserver' in window)) { draw(0); return; }
      new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        cancelAnimationFrame(raf);
        if (visible) raf = requestAnimationFrame(draw);
      }).observe(cv);
    });
  }

  /* ---------- Boot -------------------------------------------------- */
  const boot = () => {
    [initNav, initMenu, initMobileBar, initClock, initReveal, initCounters, initCallCard, initFlipStack,
      initCalculator, initPlayers, initHours, initLang, initTimeline, initTabs, initBilling, initFaq,
      initBooking, initNudge, initAmbient].forEach((fn) => {
      try { fn(); } catch (err) { console.error('[NeverMissed]', fn.name, err); }
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
