/* =============================================================================
   Case-study page: case-study.html?p=<slug>
   Story template: Problem → Data → Approach → Insight → Impact → Tools & links
   ========================================================================== */
(function () {
  "use strict";
  const { S, esc, t, html, $, $$, icon } = window.UI;

  UI.renderHeader("case");
  UI.renderFooter("case");

  const slug = new URLSearchParams(location.search).get("p");
  const idx = S.projects.findIndex((p) => p.slug === slug);
  const main = $("#main");

  if (idx < 0) {
    document.title = `Case study not found | ${S.person.name}`;
    main.innerHTML = html`<section class="section"><div class="container narrow">
      <p class="eyebrow mono">404</p><h1 class="section-title">That case study doesn’t exist.</h1>
      <p><a class="btn btn-primary" href="index.html#work">${icon("arrowLeft", 18)} Back to all work</a></p></div></section>`;
    return;
  }

  const p = S.projects[idx];
  const next = S.projects[(idx + 1) % S.projects.length];
  const plain = (s) => String(s).replace(/\[|\]/g, "");

  // Page metadata
  document.title = `${p.title}: Case Study | ${S.person.name}`;
  $('meta[name="description"]').setAttribute("content", `${plain(p.outcome)} A data case study by ${S.person.name}.`);
  $('meta[property="og:title"]').setAttribute("content", `${p.title} | ${S.person.name}`);
  $('meta[property="og:description"]').setAttribute("content", plain(p.outcome));
  $('link[rel="canonical"]').setAttribute("href", `${S.meta.siteUrl}case-study.html?p=${p.slug}`);

  const sections = [
    ["problem", "a", "The Problem"], ["data", "b", "The Data"], ["approach", "c", "The Approach"],
    ["insight", "d", "The Insight"], ["impact", "e", "The Impact"], ["tools", "f", "Tools & links"]
  ];
  const head = (id) => {
    const [, letter, label] = sections.find((s) => s[0] === id);
    return `<div class="axis-head" aria-hidden="true"><span class="axis-idx mono">${letter}.</span><span class="axis-label mono">${label}</span><span class="axis-ticks"></span></div>`;
  };

  const isIllustrative = (c) => c.illustrative !== false;
  const insights = p.insights.map((ins, i) => html`
    <figure class="insight reveal">
      <p class="insight-n mono">Finding ${i + 1}</p>
      <h3 class="insight-title">${t(ins.title)}</h3>
      <p>${t(ins.body)}</p>
      <div class="chart-card">
        <p class="chart-label">${esc(ins.chart.label)}</p>
        <div class="chart" data-chart="${i}"></div>
        ${isIllustrative(ins.chart) ? `<figcaption class="chart-src mono">Illustrative data${S.meta.highlightPlaceholders ? ': <mark class="ph">[replace with real figures]</mark>' : ""}</figcaption>` : ""}
      </div>
    </figure>`).join("");

  const linkBtn = (url, ic, label) => url
    ? `<a class="btn btn-ghost" href="${esc(url)}" target="_blank" rel="noopener">${icon(ic, 18)} ${label} ${icon("external", 14)}</a>`
    : (S.meta.highlightPlaceholders ? `<span class="btn btn-ghost is-empty" aria-disabled="true">${icon(ic, 18)} ${label} <mark class="ph">[link]</mark></span>` : "");

  main.innerHTML = html`
    <article class="case">
      <header class="case-hero">
        <div class="container">
          <a class="back-link link-slide" href="index.html#work">${icon("arrowLeft", 16)} All work</a>
          <p class="eyebrow mono">Case study ${String(idx + 1).padStart(2, "0")} · ${esc(p.categories.join(" · "))}</p>
          <h1 class="case-title">${esc(p.title)}</h1>
          <p class="case-outcome"><span class="outcome-mark" aria-hidden="true">${icon("arrowUp", 20)}</span><span>${t(p.outcome)}</span></p>
          <dl class="case-meta">
            <div><dt>Role</dt><dd>${t(p.meta.role)}</dd></div>
            <div><dt>Timeline</dt><dd>${t(p.meta.timeline)}</dd></div>
            <div><dt>Stakeholders</dt><dd>${t(p.meta.stakeholders)}</dd></div>
            <div><dt>Tools</dt><dd>${esc(p.tools.join(", "))}</dd></div>
          </dl>
          ${p.thumbnail ? `<img class="case-cover" src="${esc(p.thumbnail)}" alt="${esc(p.thumbnailAlt || p.title)}" width="1280" height="800">` : ""}
        </div>
      </header>

      <div class="container case-layout">
        <nav class="toc" aria-label="Case study sections">
          <p class="toc-title mono">On this page</p>
          <ol>${sections.map(([id, l, label]) => `<li><a href="#${id}" data-toc="${id}"><span class="mono">${l}.</span> ${label}</a></li>`).join("")}</ol>
        </nav>

        <div class="case-body">
          <section id="problem" class="case-sec">
            ${head("problem")}
            <h2 class="case-h">The problem</h2>
            <p>${t(p.problem.context)}</p>
            <blockquote class="question"><p class="mono">The question</p><p>${t(p.problem.question)}</p></blockquote>
          </section>

          <section id="data" class="case-sec">
            ${head("data")}
            <h2 class="case-h">The data</h2>
            <dl class="data-facts">
              <div><dt>Source</dt><dd>${t(p.data.source)}</dd></div>
              <div><dt>Size</dt><dd class="mono">${t(p.data.size)}</dd></div>
            </dl>
            <h3 class="mini-h">What made it messy</h3>
            <ul class="dot-list">${p.data.messiness.map((m) => `<li>${t(m)}</li>`).join("")}</ul>
            <aside class="note"><p class="mono">Ethics &amp; privacy</p><p>${t(p.data.ethics)}</p></aside>
          </section>

          <section id="approach" class="case-sec">
            ${head("approach")}
            <h2 class="case-h">The approach</h2>
            <ol class="num-list">${p.approach.steps.map((s) => `<li>${t(s)}</li>`).join("")}</ol>
            ${p.approach.code ? UI.codeBlock(p.approach.code) : ""}
          </section>

          <section id="insight" class="case-sec">
            ${head("insight")}
            <h2 class="case-h">The insight${p.insights.length > 1 ? "s" : ""}</h2>
            ${insights}
          </section>

          <section id="impact" class="case-sec">
            ${head("impact")}
            <h2 class="case-h">The impact</h2>
            <div class="impact-card">
              <p class="impact-metric mono">${t(p.impact.metric)}</p>
              <p class="impact-label">${t(p.impact.metricLabel)}</p>
            </div>
            <p>${t(p.impact.body)}</p>
            <p><strong>What happened next.</strong> ${t(p.impact.next)}</p>
          </section>

          <section id="tools" class="case-sec">
            ${head("tools")}
            <h2 class="case-h">Tools &amp; links</h2>
            <ul class="tags tags-lg">${p.tools.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
            <div class="link-row">
              ${linkBtn(p.links.dashboard, "chart", "Live dashboard")}
              ${linkBtn(p.links.github, "github", "GitHub")}
              ${linkBtn(p.links.notebook, "notebook", "Notebook")}
            </div>
          </section>
        </div>
      </div>

      <div class="container">
        <a class="next-case" href="case-study.html?p=${encodeURIComponent(next.slug)}">
          <span class="mono">Next case study</span>
          <span class="next-title">${esc(next.title)} ${icon("arrow", 24)}</span>
          <span class="next-outcome">${t(next.outcome)}</span>
        </a>
      </div>
    </article>`;

  // Charts
  $$("[data-chart]").forEach((el) => UI.renderChart(el, p.insights[+el.dataset.chart].chart));
  UI.initCopyButtons();

  // Table-of-contents scroll spy
  if ("IntersectionObserver" in window) {
    const links = $$("[data-toc]");
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((a) => {
        const on = a.dataset.toc === e.target.id;
        a.classList.toggle("is-active", on);
        on ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current");
      });
    }), { rootMargin: "-30% 0px -60% 0px" });
    $$(".case-sec").forEach((s) => io.observe(s));
  }

  $$(".case-sec").forEach((s) => s.classList.add("reveal"));
  UI.initReveal();
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
})();
