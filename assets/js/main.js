/* Kingsley Koduah — portfolio interactions & charts (no dependencies) */
(function () {
    'use strict';

    var root = document.documentElement;
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var NS = 'http://www.w3.org/2000/svg';

    function $(s, c) { return (c || document).querySelector(s); }
    function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
    function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

    /* ---------- Theme ---------- */
    var toggle = $('.theme-toggle');
    function currentTheme() {
        return root.getAttribute('data-theme') ||
            (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    }
    function syncToggle() {
        $$('.theme-toggle').forEach(function (b) {
            var dark = currentTheme() === 'dark';
            b.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
            b.setAttribute('aria-pressed', dark ? 'true' : 'false');
        });
        var meta = $('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', currentTheme() === 'dark' ? '#0F1115' : '#F7F5F0');
    }
    if (!root.getAttribute('data-theme')) root.setAttribute('data-theme', currentTheme());
    $$('.theme-toggle').forEach(function (b) {
        b.addEventListener('click', function () {
            var next = currentTheme() === 'dark' ? 'light' : 'dark';
            root.setAttribute('data-theme', next);
            store('kk-theme', next);
            syncToggle();
        });
    });
    syncToggle();

    /* ---------- Nav ---------- */
    var nav = $('.nav');
    function onScroll() { if (nav) nav.classList.toggle('scrolled', window.scrollY > 8); }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    var menu = $('.mobile-menu'), menuBtn = $('.menu-btn');
    function setMenu(open) {
        if (!menu) return;
        menu.classList.toggle('open', open);
        menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        document.body.style.overflow = open ? 'hidden' : '';
        if (open) { var f = $('.menu-close', menu); if (f) f.focus(); } else { menuBtn.focus({ preventScroll: true }); }
    }
    if (menu && menuBtn) {
        menuBtn.addEventListener('click', function () { setMenu(true); });
        $$('.menu-close, nav a, .btn', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu.classList.contains('open')) setMenu(false); });
    }

    // Scroll spy
    var spyLinks = $$('.nav-links a[href^="#"]');
    if ('IntersectionObserver' in window && spyLinks.length) {
        var spy = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (!e.isIntersecting) return;
                spyLinks.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id); });
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        spyLinks.forEach(function (a) { var s = $(a.getAttribute('href')); if (s) spy.observe(s); });
    }

    // Persistent "Let's talk": visible after the hero, hidden while contact is on screen
    var talk = $('.talk');
    if (talk && 'IntersectionObserver' in window) {
        var pastHero = false, atContact = false;
        var hero = $('.hero') || $('.cs-hero'), contact = $('#contact');
        var upd = function () { talk.classList.toggle('show', pastHero && !atContact); };
        if (hero) new IntersectionObserver(function (e) { pastHero = !e[0].isIntersecting; upd(); }).observe(hero);
        if (contact) new IntersectionObserver(function (e) { atContact = e[0].isIntersecting; upd(); }, { threshold: 0.15 }).observe(contact);
    }

    /* ---------- Reveal + count-up ---------- */
    function countUp(el) {
        var end = parseFloat(el.getAttribute('data-count'));
        var dec = (el.getAttribute('data-count').split('.')[1] || '').length;
        if (reduced || isNaN(end)) { el.textContent = end.toFixed(dec); return; }
        var t0 = null, dur = 1400;
        function step(t) {
            if (!t0) t0 = t;
            var p = Math.min((t - t0) / dur, 1), e = 1 - Math.pow(1 - p, 3);
            el.textContent = (end * e).toFixed(dec);
            if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }
    var revealEls = $$('.rv, .chart, .matrix-wrap, .gantt, [data-count]');
    if ('IntersectionObserver' in window && !reduced) {
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (!e.isIntersecting) return;
                e.target.classList.add('in');
                if (e.target.hasAttribute('data-count')) countUp(e.target);
                io.unobserve(e.target);
            });
        }, { threshold: 0.18, rootMargin: '0px 0px -40px 0px' });
        revealEls.forEach(function (el) { io.observe(el); });
    } else {
        revealEls.forEach(function (el) { el.classList.add('in'); if (el.hasAttribute('data-count')) countUp(el); });
    }

    /* ---------- Project filters ---------- */
    var filterBar = $('.filters');
    if (filterBar) {
        var cards = $$('.project');
        var counts = {};
        cards.forEach(function (c) { c.getAttribute('data-tags').split(',').forEach(function (t) { t = t.trim(); counts[t] = (counts[t] || 0) + 1; }); });
        $$('.chip', filterBar).forEach(function (chip) {
            var f = chip.getAttribute('data-filter');
            var n = f === 'all' ? cards.length : (counts[f] || 0);
            if (!n) { chip.remove(); return; }
            var ct = document.createElement('span'); ct.className = 'ct'; ct.textContent = n; chip.appendChild(ct);
            chip.addEventListener('click', function () {
                $$('.chip', filterBar).forEach(function (c) { c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'); });
                var shown = 0;
                cards.forEach(function (c) {
                    var ok = f === 'all' || c.getAttribute('data-tags').split(',').map(function (s) { return s.trim(); }).indexOf(f) > -1;
                    c.hidden = !ok; if (ok) shown++;
                });
                var live = $('.filter-status'); if (live) live.textContent = shown + ' project' + (shown === 1 ? '' : 's') + ' shown';
            });
        });
    }

    /* ---------- SVG helpers ---------- */
    function el(name, attrs, parent) {
        var n = document.createElementNS(NS, name);
        for (var k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) n.setAttribute(k, attrs[k]);
        if (parent) parent.appendChild(n);
        return n;
    }
    function text(parent, x, y, str, attrs) { var t = el('text', Object.assign({ x: x, y: y }, attrs || {}), parent); t.textContent = str; return t; }
    function niceTicks(min, max, count) {
        var span = max - min || 1, step = Math.pow(10, Math.floor(Math.log10(span / count)));
        var err = (count * step) / span;
        if (err <= 0.15) step *= 10; else if (err <= 0.35) step *= 5; else if (err <= 0.75) step *= 2;
        var out = [], v = Math.floor(min / step) * step;
        for (; v <= max + step * 0.5; v += step) out.push(+v.toFixed(10));
        return out;
    }
    function fmt(v, f) {
        f = f || {};
        var d = f.decimals == null ? 0 : f.decimals;
        var s = Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
        return (f.prefix || '') + s + (f.suffix || '');
    }
    function tipFor(container) {
        var t = $('.tip', container);
        if (!t) { t = document.createElement('div'); t.className = 'tip'; t.setAttribute('role', 'status'); container.appendChild(t); }
        return t;
    }
    function setLen(path) { try { var L = path.getTotalLength(); path.style.setProperty('--len', Math.ceil(L)); } catch (e) { /* noop */ } }

    /* ---------- Hero chart: noise resolving into a trend ---------- */
    function heroChart(box) {
        var seed = 7;
        function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
        function gauss() { return (rand() + rand() + rand() - 1.5) * 1.15; }
        var N = 64, pts = [];
        // Flat-ish, then a clear break upward: the "insight"
        function trend(i) { var x = i / (N - 1); return 22 + 10 * x + 46 / (1 + Math.exp(-(x - 0.58) * 13)); }
        for (var i = 0; i < N; i++) pts.push({ i: i, t: trend(i), y: trend(i) + gauss() * 6, y0: 8 + rand() * 88 });
        var kneeIdx = 36;

        var svg, W, H, m, sx, sy, dots = [], line, anno, raf;
        function draw(final) {
            box.innerHTML = '';
            W = box.clientWidth; H = box.clientHeight;
            m = { t: 24, r: W < 560 ? 12 : 140, b: 30, l: 34 };
            sx = function (i) { return m.l + (i / (N - 1)) * (W - m.l - m.r); };
            sy = function (v) { return m.t + (1 - v / 100) * (H - m.t - m.b); };
            svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Animated chart: scattered noisy points resolve into a clear upward trend, with an annotation marking where the insight was found.' }, box);
            var g = el('g', { 'class': 'c-grid' }, svg);
            [0, 25, 50, 75, 100].forEach(function (v) {
                el('line', { x1: m.l, x2: W - m.r, y1: sy(v), y2: sy(v) }, g);
                text(svg, m.l - 8, sy(v) + 4, v, { 'class': 'c-label', 'text-anchor': 'end' });
            });
            el('line', { 'class': 'base', x1: m.l, x2: W - m.r, y1: sy(0), y2: sy(0), stroke: 'currentColor' }, el('g', { 'class': 'c-axis' }, svg)).style.stroke = 'var(--ink)';
            for (var k = 0; k <= 60; k += 10) {
                var xx = sx(k * (N - 1) / 60);
                el('line', { x1: xx, x2: xx, y1: sy(0), y2: sy(0) + 5, stroke: 'var(--ink)' }, svg);
                text(svg, xx, sy(0) + 19, 't' + String(k).padStart(2, '0'), { 'class': 'c-label', 'text-anchor': 'middle' });
            }
            // trend line
            var d = pts.map(function (p, j) { return (j ? 'L' : 'M') + sx(p.i).toFixed(1) + ' ' + sy(p.t).toFixed(1); }).join(' ');
            var area = el('path', { 'class': 'c-area', d: d + ' L' + sx(N - 1) + ' ' + sy(0) + ' L' + sx(0) + ' ' + sy(0) + 'Z', opacity: 0 }, svg);
            line = el('path', { 'class': 'c-line', d: d }, svg);
            var L = line.getTotalLength();
            line.style.strokeDasharray = L; line.style.strokeDashoffset = final ? 0 : L;
            dots = pts.map(function (p) {
                return el('circle', { 'class': 'c-noise', cx: sx(p.i), cy: sy(final ? p.y : p.y0), r: 2.6 }, svg);
            });
            // annotation
            var kp = pts[kneeIdx], ax = sx(kp.i), ay = sy(kp.t);
            anno = el('g', { opacity: final ? 1 : 0 }, svg);
            el('circle', { 'class': 'c-anno-ring', cx: ax, cy: ay, r: 9 }, anno);
            el('circle', { 'class': 'c-anno-dot', cx: ax, cy: ay, r: 3.5 }, anno);
            var lx = W < 560 ? ax - 10 : W - m.r + 14, ly = W < 560 ? sy(92) : sy(kp.t + 6);
            if (W < 560) {
                el('path', { 'class': 'c-anno-line', d: 'M' + ax + ' ' + (ay - 10) + ' L' + ax + ' ' + (ly + 8) }, anno);
                text(anno, ax + 6, ly, 'insight found', { 'class': 'c-anno big', 'text-anchor': 'end' });
            } else {
                el('path', { 'class': 'c-anno-line', d: 'M' + (ax + 10) + ' ' + ay + ' L' + (ax + 40) + ' ' + ly + ' L' + (lx - 6) + ' ' + ly }, anno);
                text(anno, lx, ly + 4, '← insight found', { 'class': 'c-anno big' });
                text(anno, lx, ly + 22, 'trend breaks at t' + Math.round(kneeIdx * 60 / (N - 1)), { 'class': 'c-label' });
                text(anno, lx, ly + 38, '+' + Math.round(pts[N - 1].t - kp.t) + ' pts after', { 'class': 'c-label' });
            }
            // hover layer
            var cross = el('line', { 'class': 'c-cross', y1: m.t, y2: sy(0), opacity: 0 }, svg);
            var hov = el('circle', { 'class': 'c-hover', r: 5, opacity: 0 }, svg);
            var hit = el('rect', { 'class': 'c-hit', x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b }, svg);
            var tip = tipFor(box);
            function move(ev) {
                var r = svg.getBoundingClientRect(), x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
                var j = Math.max(0, Math.min(N - 1, Math.round((x - m.l) / (W - m.l - m.r) * (N - 1)))), p = pts[j];
                var px = sx(j), py = sy(p.y), res = p.y - p.t;
                cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('opacity', 1);
                hov.setAttribute('cx', px); hov.setAttribute('cy', py); hov.setAttribute('opacity', 1);
                tip.innerHTML = '<span class="k">obs</span> #' + String(j + 1).padStart(2, '0') + '<br><span class="k">value</span> ' + p.y.toFixed(1) +
                    '<br><span class="k">trend</span> ' + p.t.toFixed(1) + '<br><span class="k">noise</span> <b>' + (res >= 0 ? '+' : '') + res.toFixed(1) + '</b>';
                tip.style.left = px + 'px'; tip.style.top = py + 'px'; tip.classList.add('on');
            }
            function leave() { cross.setAttribute('opacity', 0); hov.setAttribute('opacity', 0); tip.classList.remove('on'); }
            hit.addEventListener('mousemove', move); hit.addEventListener('touchstart', move, { passive: true });
            hit.addEventListener('touchmove', move, { passive: true });
            hit.addEventListener('mouseleave', leave); hit.addEventListener('touchend', leave);
            return { area: area, L: L };
        }

        var r = draw(reduced);
        if (reduced) { r.area.setAttribute('opacity', 1); return; }
        var start = null;
        function frame(t) {
            if (!start) start = t;
            var el2 = t - start;
            dots.forEach(function (c, j) {
                var p = pts[j], d0 = 300 + j * 12, k = Math.min(Math.max((el2 - d0) / 1100, 0), 1);
                var e = 1 - Math.pow(1 - k, 3);
                c.setAttribute('cy', sy(p.y0 + (p.y - p.y0) * e));
            });
            var lk = Math.min(Math.max((el2 - 1200) / 1300, 0), 1), le = 1 - Math.pow(1 - lk, 3);
            line.style.strokeDashoffset = r.L * (1 - le);
            r.area.setAttribute('opacity', le);
            anno.setAttribute('opacity', Math.min(Math.max((el2 - 2300) / 500, 0), 1));
            if (el2 < 2900) raf = requestAnimationFrame(frame);
        }
        raf = requestAnimationFrame(frame);
        var w = box.clientWidth, to;
        window.addEventListener('resize', function () {
            if (box.clientWidth === w) return; w = box.clientWidth;
            clearTimeout(to); to = setTimeout(function () { cancelAnimationFrame(raf); var rr = draw(true); rr.area.setAttribute('opacity', 1); }, 120);
        });
    }
    var heroBox = $('.hero-chart');
    if (heroBox) heroChart(heroBox);

    /* ---------- Generic charts for case studies ---------- */
    function lineChart(box, spec) {
        var W = Math.max(box.clientWidth, 280), H = spec.height || Math.round(Math.min(380, Math.max(240, W * 0.52)));
        var m = { t: 28, r: W < 480 ? 14 : 24, b: 30, l: 48 };
        var all = []; spec.series.forEach(function (s) { s.values.forEach(function (v) { all.push(v); }); });
        var xs = all.map(function (v) { return v[0]; }), ys = all.map(function (v) { return v[1]; });
        var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
        var yMin = spec.yMin != null ? spec.yMin : Math.min(0, Math.min.apply(null, ys));
        var ticks = niceTicks(yMin, Math.max.apply(null, ys), 4), y1 = ticks[ticks.length - 1];
        var sx = function (v) { return m.l + (v - x0) / (x1 - x0) * (W - m.l - m.r); };
        var sy = function (v) { return m.t + (1 - (v - yMin) / (y1 - yMin)) * (H - m.t - m.b); };
        var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': spec.alt || '' }, box);
        var g = el('g', { 'class': 'c-grid' }, svg);
        ticks.forEach(function (v) { el('line', { x1: m.l, x2: W - m.r, y1: sy(v), y2: sy(v) }, g); text(svg, m.l - 8, sy(v) + 4, fmt(v, spec.yFmt), { 'class': 'c-label', 'text-anchor': 'end' }); });
        el('line', { x1: m.l, x2: W - m.r, y1: sy(yMin), y2: sy(yMin), stroke: 'var(--ink)' }, svg);
        var xt = spec.xTicks || niceTicks(x0, x1, W < 480 ? 3 : 6).filter(function (v) { return v >= x0 && v <= x1; });
        xt.forEach(function (v) { el('line', { x1: sx(v), x2: sx(v), y1: sy(yMin), y2: sy(yMin) + 5, stroke: 'var(--ink)' }, svg); text(svg, sx(v), sy(yMin) + 19, v, { 'class': 'c-label', 'text-anchor': 'middle' }); });
        spec.series.forEach(function (s, si) {
            var d = s.values.map(function (v, j) { return (j ? 'L' : 'M') + sx(v[0]).toFixed(1) + ' ' + sy(v[1]).toFixed(1); }).join(' ');
            if (!s.ctx && si === 0) el('path', { 'class': 'c-area late', d: d + ' L' + sx(x1) + ' ' + sy(yMin) + ' L' + sx(x0) + ' ' + sy(yMin) + 'Z' }, svg);
            var p = el('path', { 'class': 'c-line draw' + (s.ctx ? ' ctx' : ''), d: d }, svg); setLen(p);
            if (s.label !== false && spec.series.length > 1) {
                var last = s.values[s.values.length - 1];
                text(svg, sx(last[0]) - 4, sy(last[1]) - 10, s.name, { 'class': 'c-label late', 'text-anchor': 'end' });
            }
        });
        (spec.annotations || []).forEach(function (a) { annotate(svg, sx(a.x), sy(a.y), a, W, m); });
        // crosshair tooltip on the primary series' x values
        var base = spec.series[0].values, cross = el('line', { 'class': 'c-cross', y1: m.t, y2: sy(yMin), opacity: 0 }, svg);
        var hovs = spec.series.map(function () { return el('circle', { 'class': 'c-hover', r: 4.5, opacity: 0 }, svg); });
        var hit = el('rect', { 'class': 'c-hit', x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b }, svg), tip = tipFor(box);
        function move(ev) {
            var r = svg.getBoundingClientRect(), x = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left) * (W / r.width);
            var best = 0; base.forEach(function (v, j) { if (Math.abs(sx(v[0]) - x) < Math.abs(sx(base[best][0]) - x)) best = j; });
            var xv = base[best][0], px = sx(xv), html = '<b>' + xv + '</b>', topY = H;
            spec.series.forEach(function (s, si) {
                var v = s.values.filter(function (q) { return q[0] === xv; })[0];
                if (!v) { hovs[si].setAttribute('opacity', 0); return; }
                hovs[si].setAttribute('cx', px); hovs[si].setAttribute('cy', sy(v[1])); hovs[si].setAttribute('opacity', 1);
                topY = Math.min(topY, sy(v[1]));
                html += '<br><span class="k">' + s.name + '</span> ' + fmt(v[1], spec.yFmt);
            });
            cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('opacity', 1);
            tip.innerHTML = html; tip.style.left = (px / W * r.width) + 'px'; tip.style.top = (topY / H * r.height) + 'px'; tip.classList.add('on');
        }
        function leave() { cross.setAttribute('opacity', 0); hovs.forEach(function (h) { h.setAttribute('opacity', 0); }); tip.classList.remove('on'); }
        hit.addEventListener('mousemove', move); hit.addEventListener('touchmove', move, { passive: true }); hit.addEventListener('touchstart', move, { passive: true });
        hit.addEventListener('mouseleave', leave); hit.addEventListener('touchend', leave);
    }

    function annotate(svg, x, y, a, W, m) {
        var g = el('g', { 'class': 'late' }, svg);
        el('circle', { 'class': 'c-anno-ring', cx: x, cy: y, r: 8 }, g);
        el('circle', { 'class': 'c-anno-dot', cx: x, cy: y, r: 3 }, g);
        var dx = a.dx != null ? a.dx : -60, dy = a.dy != null ? a.dy : -40;
        var tx = Math.max(m.l + 4, Math.min(W - m.r - 4, x + dx)), ty = Math.max(14, y + dy);
        var lines = String(a.text).split('\n');
        var tw = Math.max.apply(null, lines.map(function (l) { return l.length; })) * 7.6;
        if (dx >= 0 && tx + tw > W - m.r) { dx = -Math.abs(dx); tx = Math.max(m.l + 4, x + dx); }
        else if (dx < 0 && tx - tw < 0) { dx = Math.abs(dx); tx = Math.min(W - m.r - 4, x + dx); }
        var anchor = dx < 0 ? 'end' : 'start';
        if ((anchor === 'start' && tx + tw > W - m.r + 8) || (anchor === 'end' && tx - tw < -8)) {
            // Fits on neither side (narrow screens): stack the note at the top, leader straight up
            tx = Math.max(m.l + 4, Math.min(W - m.r - tw, x - tw / 2)); ty = m.t + 2; anchor = 'start';
            el('path', { 'class': 'c-anno-line', d: 'M' + x + ' ' + (y - 9) + ' L' + x + ' ' + (ty + (lines.length - 1) * 16 + 10) }, g);
            lines.forEach(function (ln, i) { text(g, tx, ty + 4 + i * 16, ln, { 'class': 'c-anno' + (i === 0 ? ' big' : ''), 'text-anchor': anchor }); });
            return;
        }
        el('path', { 'class': 'c-anno-line', d: 'M' + x + ' ' + (y + (dy < 0 ? -9 : 9)) + ' L' + x + ' ' + ty + ' L' + (tx + (dx < 0 ? 4 : -4)) + ' ' + ty }, g);
        lines.forEach(function (ln, i) { text(g, tx, ty + 4 + i * 16, ln, { 'class': 'c-anno' + (i === 0 ? ' big' : ''), 'text-anchor': anchor }); });
    }

    function barChart(box, spec) {
        var W = Math.max(box.clientWidth, 280), row = 34, gap = 10;
        var labW = Math.min(W * 0.34, spec.labelWidth || 150);
        var m = { t: 8, r: 64, b: spec.annotation ? 44 : 8, l: labW };
        var H = m.t + m.b + spec.data.length * (row + gap) - gap;
        var max = spec.max || Math.max.apply(null, spec.data.map(function (d) { return d.value; }));
        var sx = function (v) { return (v / max) * (W - m.l - m.r); };
        var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': spec.alt || '' }, box);
        var tip = tipFor(box);
        if (spec.ref != null) {
            var rx = m.l + sx(spec.ref.value);
            el('line', { x1: rx, x2: rx, y1: m.t - 4, y2: H - m.b + 4, stroke: 'var(--ink-3)', 'stroke-dasharray': '3 3' }, svg);
            text(svg, rx + 6, H - m.b + 16, spec.ref.label, { 'class': 'c-label' });
        }
        spec.data.forEach(function (d, i) {
            var y = m.t + i * (row + gap), w = Math.max(sx(d.value), 2);
            text(svg, m.l - 12, y + row / 2 + 4, d.label, { 'class': 'c-label', 'text-anchor': 'end', style: 'fill:var(--ink-2);font-size:12px' });
            var cls = 'c-bar grow' + (d.hl ? ' hl' : d.ctx ? ' ctx' : '');
            // rounded data-end, square at the baseline
            var r = Math.min(4, w / 2), x0 = m.l, x1 = m.l + w;
            el('path', { 'class': cls, d: 'M' + x0 + ' ' + y + ' H' + (x1 - r) + ' Q' + x1 + ' ' + y + ' ' + x1 + ' ' + (y + r) + ' V' + (y + row - r) + ' Q' + x1 + ' ' + (y + row) + ' ' + (x1 - r) + ' ' + (y + row) + ' H' + x0 + ' Z' }, svg);
            text(svg, x1 + 8, y + row / 2 + 4, fmt(d.value, spec.fmt), { 'class': 'c-value late' });
            var hit = el('rect', { 'class': 'c-hit', x: 0, y: y - gap / 2, width: W, height: row + gap }, svg);
            hit.addEventListener('mousemove', function () {
                tip.innerHTML = '<b>' + d.label + '</b><br>' + fmt(d.value, spec.fmt) + (d.note ? '<br><span class="k">' + d.note + '</span>' : '');
                tip.style.left = (x1 / W * svg.getBoundingClientRect().width) + 'px';
                tip.style.top = (y / H * svg.getBoundingClientRect().height) + 'px';
                tip.classList.add('on');
            });
            hit.addEventListener('mouseleave', function () { tip.classList.remove('on'); });
        });
        if (spec.annotation) {
            var g = el('g', { 'class': 'late' }, svg);
            var ty = H - 14;
            var ax0 = W < 520 ? 0 : m.l;
            el('line', { 'class': 'c-anno-line', x1: ax0, x2: ax0 + 18, y1: ty - 4, y2: ty - 4 }, g);
            text(g, ax0 + 24, ty, spec.annotation, { 'class': 'c-anno big' });
        }
    }

    function renderCharts() {
        $$('.chart[data-spec]').forEach(function (box) {
            var src = document.getElementById(box.getAttribute('data-spec'));
            if (!src) return;
            var spec; try { spec = JSON.parse(src.textContent); } catch (e) { return; }
            var tip = $('.tip', box); box.innerHTML = ''; if (tip) box.appendChild(tip);
            if (spec.type === 'line') lineChart(box, spec); else barChart(box, spec);
        });
    }
    renderCharts();
    var lastW = window.innerWidth, rt;
    window.addEventListener('resize', function () {
        if (window.innerWidth === lastW) return; lastW = window.innerWidth;
        clearTimeout(rt); rt = setTimeout(renderCharts, 150);
    });

    /* ---------- Tiny syntax highlighter (SQL / Python / DAX) ---------- */
    var KW = {
        sql: 'select|from|where|join|left|inner|on|group|by|order|having|with|as|case|when|then|else|end|and|or|not|in|is|null|create|view|or replace|sum|count|avg|coalesce|distinct|over|partition|desc|asc|limit|union|all|between|cast|date_trunc|nullif|round|lag',
        python: 'import|from|as|def|return|for|in|if|else|elif|and|or|not|None|True|False|lambda|with',
        dax: 'VAR|RETURN|CALCULATE|DIVIDE|SUM|FILTER|ALL|SAMEPERIODLASTYEAR|DATEADD|SELECTEDVALUE|RANKX|ALLSELECTED|IF|BLANK|let|in|each|Table|Text'
    };
    $$('pre code[data-lang]').forEach(function (code) {
        var lang = code.getAttribute('data-lang'), src = code.textContent;
        var esc = function (s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
        var comment = lang === 'python' ? '#[^\\n]*' : lang === 'dax' ? '//[^\\n]*|--[^\\n]*' : '--[^\\n]*';
        var re = new RegExp('(' + comment + ')|(\'(?:[^\'\\\\]|\\\\.)*\'|"(?:[^"\\\\]|\\\\.)*")|(\\b\\d+(?:\\.\\d+)?\\b)|(\\b(?:' + KW[lang] + ')\\b)|(\\b[A-Za-z_][\\w.]*(?=\\())', lang === 'sql' ? 'gi' : 'g');
        var out = '', last = 0, mm;
        while ((mm = re.exec(src))) {
            out += esc(src.slice(last, mm.index));
            var cls = mm[1] ? 'c' : mm[2] ? 's' : mm[3] ? 'n' : mm[4] ? 'k' : 'f';
            out += '<span class="tk-' + cls + '">' + esc(mm[0]) + '</span>';
            last = re.lastIndex;
        }
        code.innerHTML = out + esc(src.slice(last));
    });

    var y = $('#year'); if (y) y.textContent = new Date().getFullYear();
})();
