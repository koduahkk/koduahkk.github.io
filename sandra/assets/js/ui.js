/* =============================================================================
   Shared UI: helpers, icons, header/footer, theme, reveal, charts, code blocks.
   Used by both index.html (home.js) and case-study.html (case.js).
   ========================================================================== */
(function () {
  "use strict";

  const S = window.SITE;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- Text helpers ---------------------------------------------- */

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /** Escape text and mark any [placeholder] so it is easy to spot and replace. */
  const t = (s) => {
    const out = esc(s);
    return S.meta.highlightPlaceholders ? out.replace(/\[[^\]]+\]/g, (m) => `<mark class="ph">${m}</mark>`) : out;
  };

  const html = (strings, ...vals) => strings.reduce((a, s, i) => a + s + (i < vals.length ? vals[i] ?? "" : ""), "");
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /** Wrap `word` inside `text` in an accent highlight (used for hero + contact lines). */
  const highlight = (text, word) => {
    const safe = t(text);
    if (!word) return safe;
    const w = esc(word);
    const i = safe.indexOf(w);
    return i < 0 ? safe : safe.slice(0, i) + `<span class="hl">${w}</span>` + safe.slice(i + w.length);
  };

  /* ---------- Icons (inline SVG, 24px grid, 1.5px stroke) --------------- */

  const P = {
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    arrowLeft: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    linkedin: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7"/>',
    github: '<path d="M9 19c-4 1.5-4-2-6-2.5M15 21v-3.5a3 3 0 0 0-.9-2.4c3-.3 6-1.5 6-6.6a5 5 0 0 0-1.4-3.6 4.7 4.7 0 0 0-.1-3.5s-1.1-.3-3.6 1.4a12.4 12.4 0 0 0-6.4 0C6.1 1.1 5 1.4 5 1.4a4.7 4.7 0 0 0-.1 3.5A5 5 0 0 0 3.5 8.5c0 5 3 6.3 6 6.6a3 3 0 0 0-.9 2.4V21"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    notebook: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 11h6M9 15h3"/>',
    replay: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"/>',
    // How-I-work steps
    ask: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17v.01"/>',
    clean: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
    analyze: '<path d="M4 20V4M4 20h16"/><circle cx="9" cy="14" r="1.5"/><circle cx="13" cy="10" r="1.5"/><circle cx="17" cy="7" r="1.5"/><path d="m8 16 10-10" stroke-dasharray="2 2.5"/>',
    communicate: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 13v-2M12 13V8M16 13v-4"/>'
  };
  const icon = (name, size = 20) =>
    `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[name] || ""}</svg>`;

  /* ---------- Theme ------------------------------------------------------ */
  // The inline script in <head> sets data-theme before paint; this wires the toggle.

  function currentTheme() {
    return document.documentElement.dataset.theme ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }
  function setTheme(mode) {
    document.documentElement.dataset.theme = mode;
    try { localStorage.setItem("sa-theme", mode); } catch (e) { /* storage unavailable */ }
    $$("[data-theme-toggle]").forEach(updateToggle);
    document.dispatchEvent(new CustomEvent("themechange"));
  }
  function updateToggle(btn) {
    const dark = currentTheme() === "dark";
    btn.innerHTML = icon(dark ? "sun" : "moon", 18);
    btn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    btn.setAttribute("title", dark ? "Light mode" : "Dark mode");
  }

  /* ---------- Header & footer -------------------------------------------- */

  const resumeButton = (cls = "") => {
    const url = S.person.resumeUrl;
    return url
      ? `<a class="btn btn-primary btn-sm ${cls}" href="${esc(url)}" download>${icon("download", 16)}<span>Download Résumé</span></a>`
      : `<a class="btn btn-primary btn-sm ${cls}" href="#contact" title="Add person.resumeUrl in data.js">${icon("download", 16)}<span>Résumé ${S.meta.highlightPlaceholders ? '<mark class="ph">[PDF]</mark>' : ""}</span></a>`;
  };

  function renderHeader(page) {
    const base = page === "home" ? "" : "index.html";
    const links = [["work", "Work"], ["about", "About"], ["skills", "Skills"], ["experience", "Experience"], ["contact", "Contact"]];
    const el = $("#site-header");
    el.className = "site-header";
    el.innerHTML = html`
      <a class="skip-link" href="#main">Skip to content</a>
      <div class="container header-inner">
        <a class="wordmark" href="${base || "#top"}" aria-label="${esc(S.person.name)}, home">
          <span class="monogram" aria-hidden="true">${esc(S.person.initials)}</span>
          <span class="wordmark-name">${esc(S.person.name)}</span>
        </a>
        <nav class="primary-nav" id="primary-nav" aria-label="Primary">
          <ul>
            ${links.map(([id, label]) => `<li><a class="nav-link" href="${base}#${id}" data-section="${id}">${label}</a></li>`).join("")}
          </ul>
          ${resumeButton("nav-resume-mobile")}
        </nav>
        <div class="header-actions">
          <button class="icon-btn" type="button" data-theme-toggle></button>
          ${resumeButton("nav-resume")}
          <button class="icon-btn menu-btn" type="button" aria-expanded="false" aria-controls="primary-nav" aria-label="Open menu">
            <span class="menu-bars" aria-hidden="true"><span></span><span></span></span>
          </button>
        </div>
      </div>`;

    $$("[data-theme-toggle]", el).forEach((b) => {
      updateToggle(b);
      b.addEventListener("click", () => setTheme(currentTheme() === "dark" ? "light" : "dark"));
    });

    // Mobile menu: toggle, close on link, close on Escape, return focus.
    const menuBtn = $(".menu-btn", el);
    const nav = $("#primary-nav", el);
    const close = (focus) => {
      el.classList.remove("menu-open");
      menuBtn.setAttribute("aria-expanded", "false");
      menuBtn.setAttribute("aria-label", "Open menu");
      if (focus) menuBtn.focus();
    };
    menuBtn.addEventListener("click", () => {
      const open = !el.classList.contains("menu-open");
      el.classList.toggle("menu-open", open);
      menuBtn.setAttribute("aria-expanded", String(open));
      menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      if (open) $("a", nav)?.focus();
    });
    $$("a", nav).forEach((a) => a.addEventListener("click", () => close(false)));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && el.classList.contains("menu-open")) close(true);
    });

    // Hairline under the header once the page scrolls.
    const onScroll = () => el.classList.toggle("scrolled", window.scrollY > 4);
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  function socialLinks() {
    const p = S.person;
    const items = [
      [p.email && `mailto:${p.email}`, "mail", "Email"],
      [p.links.linkedin, "linkedin", "LinkedIn"],
      [p.links.github, "github", "GitHub"],
      [p.links.tableau, "chart", "Tableau Public"]
    ].filter(([href]) => href);
    return items.map(([href, ic, label]) =>
      `<a class="icon-btn" href="${esc(href)}" ${href.startsWith("http") ? 'target="_blank" rel="noopener"' : ""} aria-label="${label}">${icon(ic, 18)}</a>`).join("");
  }

  function renderFooter(page) {
    const el = $("#site-footer");
    el.className = "site-footer";
    el.innerHTML = html`
      <div class="container footer-inner">
        <p class="footer-copy"><span class="mono">©&nbsp;${S.meta.year}</span> ${esc(S.person.name)} · Built by ${esc(S.person.firstName)}</p>
        <div class="footer-social">${socialLinks()}</div>
        <a class="link-slide footer-top" href="${page === "home" ? "#top" : "#main"}">Back to top ${icon("arrowUp", 16)}</a>
      </div>`;
  }

  /* ---------- Reveal on scroll + count-ups ------------------------------- */

  function initReveal(root = document) {
    const els = $$(".reveal:not(.in)", root);
    if (reduceMotion.matches || !("IntersectionObserver" in window)) {
      els.forEach((e) => e.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    els.forEach((e) => io.observe(e));
  }

  function countUp(el) {
    const target = parseFloat(el.dataset.count);
    const decimals = (el.dataset.count.split(".")[1] || "").length;
    const fmt = (v) => v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    if (reduceMotion.matches) { el.textContent = fmt(target); return; }
    const dur = 1200, start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      el.textContent = fmt(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  function initCountUps(root = document) {
    const els = $$("[data-count]", root);
    if (!("IntersectionObserver" in window)) return els.forEach(countUp);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { countUp(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.6 });
    els.forEach((e) => io.observe(e));
  }

  /* ---------- Charts ------------------------------------------------------
     Small, dependency-free, accessible charts.
     - Neutral marks + one accent mark: the "highlighted bar" idea.
     - The highlight is also labelled in text, so colour is never the only cue.
     - Every chart has a hover/focus tooltip and a data-table view.
  ------------------------------------------------------------------------ */

  const fmtVal = (v, unit = "") => {
    const n = Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 1 });
    return unit === "k" ? `${n}k` : `${n}${unit}`;
  };

  let tipEl;
  function tooltip() {
    if (!tipEl) {
      tipEl = document.createElement("div");
      tipEl.className = "chart-tip";
      tipEl.setAttribute("role", "status");
      tipEl.setAttribute("aria-live", "polite");
      document.body.appendChild(tipEl);
    }
    return tipEl;
  }
  function showTip(htmlStr, x, y) {
    const tip = tooltip();
    tip.innerHTML = htmlStr;
    tip.classList.add("on");
    const r = tip.getBoundingClientRect();
    let left = x + 14, top = y - r.height - 12;
    if (left + r.width > innerWidth - 8) left = x - r.width - 14;
    if (top < 8) top = y + 16;
    tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  }
  const hideTip = () => tipEl && tipEl.classList.remove("on");

  function dataTable(chart) {
    let head, rows;
    if (chart.type === "bar") {
      head = `<tr><th scope="col">Category</th><th scope="col">Value</th></tr>`;
      rows = chart.items.map((d) => `<tr><th scope="row">${esc(d.label)}</th><td>${fmtVal(d.value, chart.unit)}</td></tr>`).join("");
    } else {
      head = `<tr><th scope="col">${esc(chart.xLabel || "Period")}</th>${chart.series.map((s) => `<th scope="col">${esc(s.name)}</th>`).join("")}</tr>`;
      rows = chart.x.map((x, i) => `<tr><th scope="row">${esc(x)}</th>${chart.series.map((s) =>
        `<td>${fmtVal(s.values[i], chart.unit)}${s.dashedFrom != null && i >= s.dashedFrom ? " (forecast)" : ""}</td>`).join("")}</tr>`).join("");
    }
    return `<details class="chart-table"><summary>View data table</summary><div class="table-scroll"><table><caption class="sr-only">${esc(chart.label)}</caption><thead>${head}</thead><tbody>${rows}</tbody></table></div></details>`;
  }

  /** Horizontal bar chart in HTML/CSS: text stays crisp and legible at any width. */
  function barChart(el, chart) {
    const max = Math.max(...chart.items.map((d) => d.value), chart.reference || 0) * 1.08;
    const pct = (v) => (v / max) * 100;
    el.innerHTML = html`
      <div class="bars" role="list" aria-label="${esc(chart.label)}">
        ${chart.items.map((d) => {
          const hl = d.label === chart.highlight;
          return `<div class="bar-row${hl ? " is-hl" : ""}" role="listitem" tabindex="0"
              data-tip="${esc(d.label)}: <strong>${fmtVal(d.value, chart.unit)}</strong>${hl && chart.note ? `<br>${esc(chart.note)}` : ""}">
            <span class="bar-label">${esc(d.label)}${hl ? '<span class="sr-only"> (highlighted)</span>' : ""}</span>
            <span class="bar-track"><span class="bar-fill" style="--w:${pct(d.value).toFixed(2)}%"></span>${chart.reference != null ? `<span class="bar-ref" style="--x:${pct(chart.reference).toFixed(2)}%" aria-hidden="true"></span>` : ""}</span>
            <span class="bar-value mono">${fmtVal(d.value, chart.unit)}</span>
          </div>`;
        }).join("")}
      </div>
      ${chart.note || chart.reference != null ? `<p class="chart-annot">${chart.note ? `<span class="annot-key" aria-hidden="true"></span>${esc(chart.highlight)}: ${esc(chart.note)}` : ""}${chart.reference != null ? `<span class="ref-key" aria-hidden="true"></span>Dashed line: ${esc(chart.referenceLabel || "benchmark")} (${fmtVal(chart.reference, chart.unit)})` : ""}</p>` : ""}
      ${dataTable(chart)}`;

    $$(".bar-row", el).forEach((row) => {
      const show = (x, y) => showTip(row.dataset.tip, x, y);
      row.addEventListener("pointermove", (e) => show(e.clientX, e.clientY));
      row.addEventListener("pointerleave", hideTip);
      row.addEventListener("focus", () => { const r = $(".bar-fill", row).getBoundingClientRect(); show(r.right, r.top); });
      row.addEventListener("blur", hideTip);
    });
    // Grow bars in when scrolled into view.
    el.classList.add("chart-pending");
    observeOnce(el, () => el.classList.remove("chart-pending"));
  }

  /** Line chart in SVG, drawn at the real pixel width so text never scales. */
  function lineChart(el, chart) {
    el.innerHTML = `<div class="line-wrap"><svg class="line-svg" role="img" tabindex="0" aria-label="${esc(chart.label)}. Use left and right arrow keys to read values."></svg></div>
      ${chart.series.length > 1 || chart.note ? `<ul class="legend">${chart.series.map((s) =>
        `<li class="${s.name === chart.highlight ? "is-hl" : ""}"><span class="legend-key" aria-hidden="true"></span>${esc(s.name)}</li>`).join("")}${chart.note ? `<li class="legend-note">${esc(chart.note)}</li>` : ""}</ul>` : ""}
      ${dataTable(chart)}`;
    const svg = $("svg", el);
    const NS = "http://www.w3.org/2000/svg";
    let state = null;

    function draw() {
      const W = Math.max(280, el.clientWidth), H = Math.round(Math.min(340, Math.max(220, W * 0.5)));
      const m = { t: 16, r: 56, b: 30, l: 44 };
      const all = chart.series.flatMap((s) => s.values);
      let lo = Math.min(...all), hi = Math.max(...all);
      const pad = (hi - lo) * 0.15 || 1; lo -= pad; hi += pad;
      const ticks = niceTicks(lo, hi, 4); lo = ticks[0]; hi = ticks[ticks.length - 1];
      const X = (i) => m.l + (i / (chart.x.length - 1)) * (W - m.l - m.r);
      const Y = (v) => m.t + (1 - (v - lo) / (hi - lo)) * (H - m.t - m.b);
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      svg.setAttribute("width", W); svg.setAttribute("height", H);

      let out = "";
      ticks.forEach((v) => {
        out += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/>`;
        out += `<text class="tick" x="${m.l - 8}" y="${Y(v)}" dy="0.32em" text-anchor="end">${fmtVal(+v.toFixed(2), chart.unit)}</text>`;
      });
      const every = Math.ceil(chart.x.length / Math.max(2, Math.floor((W - m.l - m.r) / 56)));
      chart.x.forEach((x, i) => {
        if (i % every === 0 || i === chart.x.length - 1)
          out += `<text class="tick" x="${X(i)}" y="${H - 8}" text-anchor="middle">${esc(x)}</text>`;
      });
      // Draw neutral series first, highlighted series last (on top).
      const ordered = [...chart.series].sort((a, b) => (a.name === chart.highlight) - (b.name === chart.highlight));
      ordered.forEach((s) => {
        const cls = s.name === chart.highlight ? "line is-hl" : "line";
        const pts = s.values.map((v, i) => [X(i), Y(v)]);
        const d = (arr) => arr.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join("");
        if (s.dashedFrom != null) {
          out += `<path class="${cls}" d="${d(pts.slice(0, s.dashedFrom + 1))}"/>`;
          out += `<path class="${cls} is-forecast" d="${d(pts.slice(s.dashedFrom))}"/>`;
        } else {
          out += `<path class="${cls}" d="${d(pts)}"/>`;
        }
        // Direct label at the line end, so identity is never colour-only.
        const last = pts[pts.length - 1];
        out += `<circle class="${cls} end-dot" cx="${last[0]}" cy="${last[1]}" r="4"/>`;
        if (chart.series.length > 1)
          out += `<text class="direct-label${s.name === chart.highlight ? " is-hl" : ""}" x="${last[0] + 8}" y="${last[1]}" dy="0.32em">${esc(s.name)}</text>`;
      });
      out += `<line class="crosshair" y1="${m.t}" y2="${H - m.b}" x1="0" x2="0"/>`;
      out += chart.series.map(() => `<circle class="hover-dot" r="5" cx="-10" cy="-10"/>`).join("");
      out += `<rect class="hit" x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${H - m.t - m.b}" fill="transparent"/>`;
      svg.innerHTML = out;
      state = { X, Y, m, W };
    }

    function focusIndex(i, clientPt) {
      const { X, Y } = state;
      const cross = $(".crosshair", svg);
      cross.setAttribute("x1", X(i)); cross.setAttribute("x2", X(i));
      svg.classList.add("hovering");
      $$(".hover-dot", svg).forEach((dot, k) => {
        const s = chart.series[k];
        dot.setAttribute("cx", X(i)); dot.setAttribute("cy", Y(s.values[i]));
        dot.classList.toggle("is-hl", s.name === chart.highlight);
      });
      const rows = chart.series.map((s) => `${chart.series.length > 1 ? esc(s.name) + ": " : ""}<strong>${fmtVal(s.values[i], chart.unit)}</strong>${s.dashedFrom != null && i > s.dashedFrom ? " (forecast)" : ""}`).join("<br>");
      const r = svg.getBoundingClientRect();
      const pt = clientPt || { x: r.left + X(i), y: r.top + Y(chart.series[0].values[i]) };
      showTip(`<span class="tip-x">${esc(chart.x[i])}</span>${rows}`, pt.x, pt.y);
      state.idx = i;
    }
    const clear = () => { svg.classList.remove("hovering"); hideTip(); };

    svg.addEventListener("pointermove", (e) => {
      const r = svg.getBoundingClientRect(), { m, W } = state;
      const rel = (e.clientX - r.left - m.l) / (W - m.l - m.r);
      const i = Math.max(0, Math.min(chart.x.length - 1, Math.round(rel * (chart.x.length - 1))));
      focusIndex(i, { x: e.clientX, y: e.clientY });
    });
    svg.addEventListener("pointerleave", clear);
    svg.addEventListener("blur", clear);
    svg.addEventListener("keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
      e.preventDefault();
      const n = chart.x.length, cur = state.idx ?? -1;
      const i = e.key === "Home" ? 0 : e.key === "End" ? n - 1 : Math.max(0, Math.min(n - 1, cur + (e.key === "ArrowRight" ? 1 : -1)));
      focusIndex(i);
    });

    draw();
    if ("ResizeObserver" in window) {
      let w = el.clientWidth;
      new ResizeObserver(() => { if (el.clientWidth !== w) { w = el.clientWidth; draw(); } }).observe(el);
    }
    el.classList.add("chart-pending");
    observeOnce(el, () => el.classList.remove("chart-pending"));
  }

  function niceTicks(lo, hi, count) {
    const span = hi - lo, raw = span / count, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => span / s <= count) || 10 * mag;
    const out = [];
    for (let v = Math.floor(lo / step) * step; v <= hi + step * 0.001; v += step) out.push(+v.toFixed(10));
    if (out[out.length - 1] < hi) out.push(out[out.length - 1] + step);
    return out;
  }

  function observeOnce(el, fn) {
    if (reduceMotion.matches || !("IntersectionObserver" in window)) return fn();
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { fn(); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(el);
  }

  function renderChart(el, chart) {
    (chart.type === "line" ? lineChart : barChart)(el, chart);
  }

  /* ---------- Code blocks: tiny highlighter + copy ----------------------- */

  const KW = {
    sql: "select|from|where|join|left|right|inner|outer|on|group|by|order|having|with|as|and|or|not|in|is|null|case|when|then|else|end|limit|between|filter|distinct|union|all|desc|asc|count|sum|avg|min|max|round|nullif|coalesce|date_trunc",
    python: "import|from|as|def|return|if|elif|else|for|in|while|with|class|lambda|and|or|not|is|None|True|False|print|try|except",
    m: "let|in|each|type|if|then|else|not|and|or|true|false|null"
  };
  function highlightCode(src, lang) {
    const kw = KW[lang] || "";
    const comment = lang === "python" ? "#[^\\n]*" : lang === "sql" ? "--[^\\n]*" : "//[^\\n]*";
    const re = new RegExp(`(${comment})|(f?"(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*')|(\\b\\d[\\d_.]*\\b)|(\\b(?:${kw})\\b)|([A-Za-z_][\\w.]*)(?=\\()`, lang === "sql" ? "gi" : "g");
    let out = "", last = 0, m;
    while ((m = re.exec(src))) {
      out += esc(src.slice(last, m.index));
      const cls = m[1] ? "c" : m[2] ? "s" : m[3] ? "n" : m[4] ? "k" : "f";
      out += `<span class="tok-${cls}">${esc(m[0])}</span>`;
      last = re.lastIndex;
    }
    return out + esc(src.slice(last));
  }

  function codeBlock(code) {
    const langName = { sql: "SQL", python: "Python", m: "Power Query M" }[code.lang] || code.lang;
    return html`
      <figure class="code-block">
        <figcaption class="code-head">
          <span class="code-title">${t(code.label)}</span>
          <span class="code-lang mono">${esc(langName)}</span>
          <button class="copy-btn" type="button" aria-label="Copy code">${icon("copy", 16)}<span>Copy</span></button>
        </figcaption>
        <pre tabindex="0"><code>${highlightCode(code.source, code.lang)}</code></pre>
      </figure>`;
  }
  function initCopyButtons(root = document) {
    $$(".copy-btn", root).forEach((btn) => btn.addEventListener("click", async () => {
      const code = btn.closest(".code-block").querySelector("code").innerText;
      try {
        await navigator.clipboard.writeText(code);
        btn.innerHTML = `${icon("check", 16)}<span>Copied</span>`;
      } catch (e) {
        btn.innerHTML = `<span>Select &amp; copy</span>`;
      }
      setTimeout(() => (btn.innerHTML = `${icon("copy", 16)}<span>Copy</span>`), 1800);
    }));
  }

  /* ---------- Project preview (used when no screenshot is provided) ------ */
  // A small, stylised "dashboard" drawn from the project's first chart, so cards
  // never show an empty box. Replace with a real screenshot via `thumbnail`.
  function projectPreview(p) {
    const c = (p.insights[0] || {}).chart || { type: "bar", items: [] };
    let plot = "";
    if (c.type === "bar") {
      const max = Math.max(...c.items.map((d) => d.value));
      const n = c.items.length, bw = 200 / n;
      plot = c.items.map((d, i) => {
        const h = (d.value / max) * 84;
        return `<rect x="${108 + i * bw + bw * 0.18}" y="${150 - h}" width="${bw * 0.64}" height="${h}" rx="2" class="${d.label === c.highlight ? "pv-hl" : "pv-bar"}"/>`;
      }).join("");
    } else {
      const all = c.series.flatMap((s) => s.values), lo = Math.min(...all), hi = Math.max(...all);
      plot = c.series.map((s) => {
        const d = s.values.map((v, i) => `${i ? "L" : "M"}${(108 + (i / (s.values.length - 1)) * 200).toFixed(1)},${(146 - ((v - lo) / (hi - lo || 1)) * 80).toFixed(1)}`).join("");
        return `<path d="${d}" class="${s.name === c.highlight ? "pv-line-hl" : "pv-line"}"/>`;
      }).join("");
    }
    return html`<svg class="preview" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <rect class="pv-bg" width="320" height="200"/>
      <rect class="pv-panel" x="12" y="12" width="84" height="176" rx="6"/>
      <rect class="pv-ink" x="22" y="26" width="44" height="6" rx="3"/>
      <rect class="pv-soft" x="22" y="48" width="64" height="30" rx="4"/><rect class="pv-ink" x="28" y="56" width="24" height="5" rx="2.5"/><rect class="pv-hl" x="28" y="66" width="38" height="6" rx="3"/>
      <rect class="pv-soft" x="22" y="86" width="64" height="30" rx="4"/><rect class="pv-ink" x="28" y="94" width="24" height="5" rx="2.5"/><rect class="pv-ink2" x="28" y="104" width="30" height="6" rx="3"/>
      <rect class="pv-soft" x="22" y="124" width="64" height="30" rx="4"/><rect class="pv-ink" x="28" y="132" width="24" height="5" rx="2.5"/><rect class="pv-ink2" x="28" y="142" width="34" height="6" rx="3"/>
      <rect class="pv-panel" x="104" y="12" width="204" height="176" rx="6"/>
      <rect class="pv-ink" x="114" y="26" width="70" height="6" rx="3"/>
      <line class="pv-grid" x1="112" x2="300" y1="66" y2="66"/><line class="pv-grid" x1="112" x2="300" y1="108" y2="108"/><line class="pv-axis" x1="112" x2="300" y1="150" y2="150"/>
      ${plot}
      <rect class="pv-ink2" x="114" y="164" width="120" height="5" rx="2.5"/>
    </svg>`;
  }

  window.UI = {
    S, esc, t, html, $, $$, icon, highlight, reduceMotion,
    renderHeader, renderFooter, socialLinks, resumeButton,
    initReveal, initCountUps, renderChart, codeBlock, initCopyButtons, projectPreview, fmtVal
  };
})();
