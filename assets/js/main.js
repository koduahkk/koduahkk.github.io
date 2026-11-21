// Kingsley Koduah — portfolio interactions

(function () {
    const nav = document.querySelector('.nav');
    const toggle = document.getElementById('nav-toggle');
    const links = document.getElementById('nav-links');

    // Mobile menu
    toggle.addEventListener('click', () => {
        const open = links.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open);
        toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    links.querySelectorAll('a').forEach((a) =>
        a.addEventListener('click', () => {
            links.classList.remove('open');
            toggle.setAttribute('aria-expanded', 'false');
        })
    );

    // Nav border once scrolled
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Highlight the current section in the nav
    const navLinks = [...links.querySelectorAll('a[href^="#"]:not(.btn)')];
    const sections = navLinks.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    if ('IntersectionObserver' in window) {
        const spy = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                if (!e.isIntersecting) return;
                navLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        sections.forEach((s) => spy.observe(s));
    }

    // Reveal on scroll
    const revealTargets = document.querySelectorAll(
        '.section-head, .numbers-head, .stats, .statement, .about-text, .tile, .ptabs, .tool-card, .steps li, .timeline li, .contact-card'
    );
    if ('IntersectionObserver' in window) {
        revealTargets.forEach((el) => el.classList.add('reveal'));
        const io = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                if (!e.isIntersecting) return;
                e.target.classList.add('in');
                io.unobserve(e.target);
            });
        }, { threshold: 0.12 });
        revealTargets.forEach((el) => io.observe(el));
    }

    // Toolkit bars: fill row by row with the percentage counting alongside,
    // every time a card scrolls into view; empty again once it leaves
    const motionOff = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const setBar = (li, v) => {
        li.style.setProperty('--fill', v + '%');
        const pct = li.querySelector('.pct');
        if (pct) pct.textContent = Math.round(v) + '%';
    };
    const playBars = (card) => {
        card._run = (card._run || 0) + 1;
        const run = card._run;
        card.querySelectorAll('[data-level]').forEach((li, i) => {
            const end = +li.dataset.level;
            if (motionOff) { setBar(li, end); return; }
            const t0 = performance.now() + 250 + i * 140, dur = 1100;
            const frame = (t) => {
                if (card._run !== run) return;                 // a newer play or a reset took over
                const k = Math.max(0, Math.min(1, (t - t0) / dur));
                setBar(li, end * (1 - Math.pow(1 - k, 3)));   // ease-out
                if (k < 1) requestAnimationFrame(frame);
            };
            requestAnimationFrame(frame);
        });
    };
    const resetBars = (card) => {
        card._run = (card._run || 0) + 1;
        card.querySelectorAll('[data-level]').forEach((li) => setBar(li, 0));
    };
    const cards = document.querySelectorAll('.tool-card');
    if ('IntersectionObserver' in window && !motionOff) {
        cards.forEach(resetBars);
        const bo = new IntersectionObserver((entries) => entries.forEach((e) => {
            const card = e.target;
            if (e.intersectionRatio >= 0.35 && !card._shown) { card._shown = true; playBars(card); }
            else if (!e.isIntersecting && card._shown) { card._shown = false; resetBars(card); }
        }), { threshold: [0, 0.35] });
        cards.forEach((c) => bo.observe(c));
    } else {
        cards.forEach(playBars);
    }

    document.getElementById('year').textContent = new Date().getFullYear();

    // Project tabs (arrow keys, Home and End move between them)
    document.querySelectorAll('[data-ptabs]').forEach((root) => {
        const tabs = [...root.querySelectorAll('[role="tab"]')];
        const select = (tab, focus) => {
            tabs.forEach((t) => {
                const on = t === tab;
                t.setAttribute('aria-selected', on);
                t.tabIndex = on ? 0 : -1;
                document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
            });
            if (focus) tab.focus();
        };
        // Auto-advance while the section is on screen, until the visitor takes over
        const reduceTabs = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const DELAY = 7000;
        let timer = null, started = 0, remaining = DELAY, stopped = reduceTabs, inView = false, hovering = false;
        const current = () => tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
        const restartBar = () => {
            const bar = tabs[current()].querySelector('.ptab-bar');
            bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = '';
        };
        const schedule = (ms) => {
            clearTimeout(timer);
            started = performance.now(); remaining = ms;
            timer = setTimeout(() => {
                const next = tabs[(current() + 1) % tabs.length];
                select(next); restartBar(); schedule(DELAY);
                const list = next.parentElement;   // keep the active tab in view when the row scrolls sideways (phones)
                if (list.scrollWidth > list.clientWidth) list.scrollTo({ left: next.offsetLeft - 24, behavior: 'smooth' });
            }, ms);
        };
        const run = () => {
            if (stopped || !inView || hovering) return;
            root.classList.add('is-auto'); root.classList.remove('is-paused'); schedule(remaining);
        };
        const pause = () => {
            if (stopped) return;
            clearTimeout(timer); remaining = Math.max(0, remaining - (performance.now() - started));
            root.classList.add('is-paused');
        };
        const stop = () => { stopped = true; clearTimeout(timer); root.classList.remove('is-auto', 'is-paused'); };
        if (!reduceTabs && 'IntersectionObserver' in window) {
            new IntersectionObserver(([e]) => { inView = e.isIntersecting; inView ? run() : pause(); }, { threshold: 0.4 }).observe(root);
            const list = root.querySelector('[role="tablist"]');
            list.addEventListener('mouseenter', () => { hovering = true; pause(); });
            list.addEventListener('mouseleave', () => { hovering = false; run(); });
        }

        tabs.forEach((t, i) => {
            t.addEventListener('click', () => { stop(); select(t); });
            t.addEventListener('keydown', (e) => {
                const k = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
                if (k === undefined) return;
                e.preventDefault();
                stop();
                select(tabs[(k + tabs.length) % tabs.length], true);
            });
        });
    });

    // Visitor's local time in the hero status line
    const clock = document.querySelector('[data-clock]');
    const tick = () => { if (clock) clock.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
    tick(); setInterval(tick, 30000);

    // Count the big numbers up once they scroll into view
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const counters = document.querySelectorAll('[data-count]');
    const countUp = (el) => {
        const end = +el.dataset.count;
        if (reduce) { el.textContent = end; return; }
        const t0 = performance.now(), dur = 1200;
        const step = (t) => {
            const k = Math.min(1, (t - t0) / dur);
            el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3)));
            if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    };
    if ('IntersectionObserver' in window) {
        const co = new IntersectionObserver((es) => es.forEach((e) => {
            if (e.isIntersecting) { countUp(e.target); co.unobserve(e.target); }
        }), { threshold: 0.6 });
        counters.forEach((c) => co.observe(c));
    } else counters.forEach((c) => (c.textContent = c.dataset.count));

    // How I work: fill the line and light each step as the section scrolls past
    const steps = document.querySelector('[data-steps]');
    if (steps) {
        const items = [...steps.children];
        const update = () => {
            const r = steps.getBoundingClientRect();
            const k = Math.max(0, Math.min(1, (innerHeight * 0.75 - r.top) / (r.height + innerHeight * 0.25)));
            steps.style.setProperty('--progress', (k * 100).toFixed(1) + '%');
            items.forEach((li, i) => li.classList.toggle('is-on', k >= i / items.length + 0.02));
        };
        if (reduce) { steps.style.setProperty('--progress', '100%'); items.forEach((li) => li.classList.add('is-on')); }
        else { window.addEventListener('scroll', update, { passive: true }); update(); }
    }

    // Recruiter nudge: slides in once, after a good look at the work
    const nudge = document.querySelector('[data-nudge]');
    let dismissed = false;
    try { dismissed = sessionStorage.getItem('nudge-closed') === '1'; } catch (e) {}
    if (nudge && !dismissed) {
        const onScroll = () => {
            const k = scrollY / (document.documentElement.scrollHeight - innerHeight);
            if (k > 0.35 && k < 0.85) {
                nudge.hidden = false;
                requestAnimationFrame(() => nudge.classList.add('show'));
                window.removeEventListener('scroll', onScroll);
            }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        nudge.querySelectorAll('[data-nudge-close]').forEach((b) => b.addEventListener('click', () => {
            nudge.classList.remove('show');
            setTimeout(() => (nudge.hidden = true), 400);
            try { sessionStorage.setItem('nudge-closed', '1'); } catch (e) {}
        }));
    }

    // Contact form: send to kingsleykoduah3030@gmail.com in the background (formsubmit.co AJAX endpoint),
    // keep the visitor on the page, and show a clear result. Without JS, the normal POST still works.
    const form = document.querySelector('[data-contact-form]');
    if (form && window.fetch) {
        const btn = form.querySelector('[data-send]');
        const status = form.querySelector('[data-form-status]');
        const label = btn.innerHTML;
        const show = (kind, html) => { status.hidden = false; status.className = 'form-status is-' + kind; status.innerHTML = html; };
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (form._honey && form._honey.value) return;          // bots fill the hidden field
            const data = Object.fromEntries(new FormData(form));
            data._subject = 'Portfolio message from ' + (data.name || 'a visitor');
            data._replyto = data.email;                             // "Reply" in Gmail answers the visitor
            delete data._next; delete data._honey;
            btn.disabled = true; btn.innerHTML = 'Sending…';
            status.hidden = true;
            try {
                const res = await fetch(form.action.replace('formsubmit.co/', 'formsubmit.co/ajax/'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                    body: JSON.stringify(data),
                });
                const out = await res.json().catch(() => ({}));
                if (!res.ok || String(out.success) === 'false') throw new Error(out.message || 'HTTP ' + res.status);
                form.reset();
                show('ok', '<span class="dot" aria-hidden="true"></span> Thanks, your message is on its way. I\'ll reply within two working days.');
            } catch (err) {
                // Background send refused (e.g. the inbox isn't activated yet) or blocked: fall back to a normal
                // form submission, so formsubmit.co can show its own page (activation / spam check) and then
                // return the visitor here via _next. HTMLFormElement.submit() skips this listener.
                console.warn('Background send failed, falling back to normal submit:', err.message);
                show('ok', 'Sending…');
                HTMLFormElement.prototype.submit.call(form);
                return;
            } finally {
                btn.disabled = false; btn.innerHTML = label;
            }
        });
    }

    // Back from formsubmit.co after sending: show a thank-you note in the contact card
    if (new URLSearchParams(location.search).get('sent') === '1') {
        const note = document.getElementById('form-sent');
        if (note) note.hidden = false;
    }
})();
