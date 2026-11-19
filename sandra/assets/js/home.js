/* =============================================================================
   Home page: renders every section from window.SITE.
   ========================================================================== */
(function () {
  "use strict";
  const { S, esc, t, html, $, $$, icon, highlight, reduceMotion } = window.UI;
  const P = S.person;

  UI.renderHeader("home");
  UI.renderFooter("home");

  /* ---------- Section heading with the "axis" motif ---------------------- */
  const axisHead = (n, label) =>
    `<div class="axis-head reveal" aria-hidden="true"><span class="axis-idx mono">${n}</span><span class="axis-label mono">${esc(label)}</span><span class="axis-ticks"></span></div>`;

  const caseUrl = (p) => `case-study.html?p=${encodeURIComponent(p.slug)}`;

  /* ---------- Hero ------------------------------------------------------- */
  function hero() {
    const stats = S.stats.map((s) => {
      const num = typeof s.value === "number"
        ? `<span data-count="${s.value}">0</span>${esc(s.suffix)}`
        : `${t("[X]")}${esc(s.suffix)}`;
      return `<li class="stat"><span class="stat-num mono">${num}</span><span class="stat-label">${t(s.label)}</span></li>`;
    }).join("");

    return html`
      <section class="hero" id="top" aria-labelledby="hero-title">
        <div class="container hero-grid">
          <div class="hero-copy">
            <p class="eyebrow mono reveal">
              <span>${esc(P.name)}</span><span class="sep" aria-hidden="true">/</span>
              <span>${esc(P.title)}${P.titleDetail ? ` · ${t(P.titleDetail)}` : ""}</span>
            </p>
            <h1 id="hero-title" class="hero-title reveal">${highlight(S.hero.headline, S.hero.highlight)}</h1>
            <p class="hero-sub reveal">${t(S.hero.sub)}</p>
            <div class="hero-ctas reveal">
              <a class="btn btn-primary" href="#work">View My Work ${icon("arrow", 18)}</a>
              <a class="btn btn-ghost" href="#contact">Let’s Talk</a>
            </div>
            <p class="hero-meta mono reveal">
              <span class="status-dot" aria-hidden="true"></span>${t(P.location)} · Open to ${t(P.openTo)}
            </p>
          </div>
          <figure class="hero-viz reveal" aria-labelledby="viz-cap">
            ${heroViz()}
            <figcaption id="viz-cap" class="viz-cap mono">
              <span>Fig. 1: Scattered data points sorting into a clear chart</span>
              <button class="link-btn" type="button" data-replay>${icon("replay", 14)}<span>Replay</span></button>
            </figcaption>
          </figure>
        </div>
        <div class="container">
          <ul class="impact-strip reveal" aria-label="Impact at a glance">${stats}</ul>
        </div>
      </section>`;
  }

  /* Chaos → clarity: dots start scattered and settle into a unit bar chart.
     One column (the "insight") takes the accent colour and is also labelled. */
  function heroViz() {
    const cols = [5, 8, 6, 12, 7, 4], hlCol = 3;
    const W = 480, H = 400, base = 336, r = 7, gap = 19, x0 = 78, dx = 66;
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    let dots = "", i = 0;
    cols.forEach((n, c) => {
      for (let k = 0; k < n; k++) {
        const cx = x0 + c * dx, cy = base - 14 - k * gap;
        const sx = 24 + rand() * (W - 48), sy = 24 + rand() * (H - 120);
        dots += `<circle class="vdot${c === hlCol ? " is-hl" : ""}" cx="${cx}" cy="${cy}" r="${r}" style="--sx:${(sx - cx).toFixed(1)}px;--sy:${(sy - cy).toFixed(1)}px;--i:${i++}"/>`;
      }
    });
    const ticks = cols.map((_, c) => `<line class="vtick" x1="${x0 + c * dx}" x2="${x0 + c * dx}" y1="${base}" y2="${base + 6}"/>`).join("");
    const grid = [1, 2, 3, 4].map((g) => `<line class="vgrid" x1="40" x2="${W - 24}" y1="${base - g * 66}" y2="${base - g * 66}"/>`).join("");
    const hx = x0 + hlCol * dx, top = base - 14 - (cols[hlCol] - 1) * gap;
    return html`<svg class="viz" viewBox="0 0 ${W} ${H}" role="img" aria-label="Animated illustration: scattered dots arrange themselves into a bar chart, with one bar highlighted as the key insight.">
      <g class="vgrid-g">${grid}</g>
      <line class="vaxis" x1="40" x2="${W - 24}" y1="${base}" y2="${base}"/>
      <g class="vticks">${ticks}</g>
      <g class="vdots">${dots}</g>
      <g class="vannot">
        <line x1="${hx + 14}" x2="${hx + 46}" y1="${top}" y2="${top - 22}"/>
        <text x="${hx + 50}" y="${top - 26}">the insight</text>
      </g>
      <text class="vlabel" x="40" y="${base + 30}">noise</text>
      <text class="vlabel" x="${W - 24}" y="${base + 30}" text-anchor="end">→ decision</text>
    </svg>`;
  }

  function initHeroViz() {
    const svg = $(".viz");
    if (!svg) return;
    const play = () => {
      svg.classList.remove("ordered");
      if (reduceMotion.matches) return svg.classList.add("ordered", "instant");
      void svg.getBoundingClientRect(); // restart transitions
      setTimeout(() => svg.classList.add("ordered"), 350);
    };
    play();
    $("[data-replay]").addEventListener("click", play);
  }

  /* ---------- Work ------------------------------------------------------- */
  function work() {
    const chips = ["All", ...S.filters].map((f, i) =>
      `<button type="button" class="chip" aria-pressed="${i === 0}" data-filter="${esc(f)}">${esc(f)}</button>`).join("");

    const cards = S.projects.map((p, i) => html`
      <article class="card reveal" data-cats="${esc(p.categories.join("|"))}" style="--d:${(i % 3) * 80}ms">
        <div class="card-media">
          ${p.thumbnail
            ? `<img src="${esc(p.thumbnail)}" alt="${esc(p.thumbnailAlt || p.title)}" loading="lazy" decoding="async" width="640" height="400">`
            : `${UI.projectPreview(p)}${S.meta.highlightPlaceholders ? '<span class="media-tag mono">Preview · add screenshot</span>' : ""}`}
        </div>
        <div class="card-body">
          <p class="card-cat mono">${String(i + 1).padStart(2, "0")} · ${esc(p.categories.join(" · "))}</p>
          <h3 class="card-title"><a href="${caseUrl(p)}" class="stretched">${esc(p.title)}</a></h3>
          <p class="card-outcome"><span class="outcome-mark" aria-hidden="true">${icon("arrowUp", 16)}</span><span><span class="sr-only">Result: </span>${t(p.outcome)}</span></p>
          <ul class="tags" aria-label="Tools">${p.tools.map((tool) => `<li>${esc(tool)}</li>`).join("")}</ul>
          <span class="card-cta link-slide" aria-hidden="true">Read case study ${icon("arrow", 16)}</span>
        </div>
      </article>`).join("");

    return html`
      <section class="section" id="work" aria-labelledby="work-title">
        <div class="container">
          ${axisHead("01", "Selected work")}
          <div class="section-intro">
            <h2 id="work-title" class="section-title reveal">Decisions, not just dashboards.</h2>
            <p class="section-lede reveal">Each project leads with the result. Open one for the full story: the problem, the data, the approach and the impact.</p>
          </div>
          <div class="chips reveal" role="group" aria-label="Filter projects">${chips}</div>
          <p class="sr-only" aria-live="polite" id="filter-status"></p>
          <div class="cards">${cards}</div>
          <p class="empty-state" hidden>No projects in this category yet.</p>
        </div>
      </section>`;
  }

  function initFilters() {
    const chips = $$(".chip");
    const cards = $$(".card");
    chips.forEach((chip) => chip.addEventListener("click", () => {
      const f = chip.dataset.filter;
      chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
      let shown = 0;
      cards.forEach((card) => {
        const match = f === "All" || card.dataset.cats.split("|").includes(f);
        card.hidden = !match;
        if (match) { shown++; card.classList.add("in"); }
      });
      $(".empty-state").hidden = shown > 0;
      $("#filter-status").textContent = `Showing ${shown} project${shown === 1 ? "" : "s"}${f === "All" ? "" : " tagged " + f}.`;
    }));
  }

  /* ---------- About ------------------------------------------------------ */
  function about() {
    const photo = P.headshot
      ? `<img src="${esc(P.headshot)}" alt="${esc(P.headshotAlt)}" width="560" height="640" loading="lazy" decoding="async">`
      : `<div class="headshot-ph" role="img" aria-label="Headshot placeholder"><span class="monogram-lg">${esc(P.initials)}</span>${S.meta.highlightPlaceholders ? '<mark class="ph">[ADD HEADSHOT]</mark>' : ""}</div>`;

    const steps = S.about.process.map((s, i) => html`
      <li class="step reveal" style="--d:${i * 90}ms">
        <span class="step-icon">${icon(s.icon, 22)}</span>
        <span class="step-n mono">0${i + 1}</span>
        <h3 class="step-title">${esc(s.step)}</h3>
        <p>${t(s.text)}</p>
      </li>`).join("");

    return html`
      <section class="section" id="about" aria-labelledby="about-title">
        <div class="container">
          ${axisHead("02", "About")}
          <div class="about-grid">
            <figure class="headshot reveal">${photo}
              <figcaption class="mono">${esc(P.name)} · ${t(P.location)}</figcaption>
            </figure>
            <div class="about-copy">
              <h2 id="about-title" class="section-title reveal">I like finding the <span class="hl">why</span> behind the number.</h2>
              ${S.about.paragraphs.map((p) => `<p class="reveal">${t(p)}</p>`).join("")}
            </div>
          </div>
          <h3 class="sub-title reveal">How I work</h3>
          <ol class="steps">${steps}</ol>
        </div>
      </section>`;
  }

  /* ---------- Skills ----------------------------------------------------- */
  const LEVELS = ["", "Working", "Proficient", "Expert"];
  const dots = (lvl) => `<span class="lvl" aria-hidden="true">${[1, 2, 3].map((k) => `<i class="${k <= lvl ? "on" : ""}"></i>`).join("")}</span>`;

  function skills() {
    const groups = S.skills.map((g, i) => html`
      <section class="skill-group reveal" style="--d:${(i % 3) * 80}ms" aria-labelledby="sg-${i}">
        <h3 id="sg-${i}" class="skill-group-title"><span class="mono">${String(i + 1).padStart(2, "0")}</span> ${esc(g.group)}</h3>
        <ul class="skill-list">
          ${g.tools.map((tool) => `<li class="skill">
            <span class="skill-name">${esc(tool.name)}</span>
            ${tool.level ? `${dots(tool.level)}<span class="sr-only">: ${LEVELS[tool.level]}</span>` : ""}
          </li>`).join("")}
        </ul>
      </section>`).join("");

    return html`
      <section class="section" id="skills" aria-labelledby="skills-title">
        <div class="container">
          ${axisHead("03", "Skills & toolkit")}
          <div class="section-intro">
            <h2 id="skills-title" class="section-title reveal">The toolkit, grouped by the job it does.</h2>
            <ul class="lvl-legend reveal" aria-label="Proficiency key">
              ${[1, 2, 3].map((l) => `<li>${dots(l)} ${LEVELS[l]}</li>`).join("")}
            </ul>
          </div>
          <div class="skill-grid">${groups}</div>
        </div>
      </section>`;
  }

  /* ---------- Experience ------------------------------------------------- */
  function experience() {
    const roles = S.experience.map((r, i) => html`
      <li class="role reveal${i === 0 ? " is-current" : ""}">
        <p class="role-date mono">${t(r.start)} – ${t(r.end)}</p>
        <div class="role-body">
          <h3 class="role-title">${t(r.role)}</h3>
          <p class="role-org">${t(r.org)}${r.place ? ` · ${t(r.place)}` : ""}</p>
          <ul class="role-bullets">${r.bullets.map((b) => `<li>${t(b)}</li>`).join("")}</ul>
        </div>
      </li>`).join("");

    const edu = S.education.map((e) => `<li><strong>${t(e.degree)}</strong><span>${t(e.school)} · <span class="mono">${t(e.year)}</span></span></li>`).join("");
    const certs = S.certifications.map((c) => html`
      <li class="cert">
        <span class="cert-badge" aria-hidden="true">${icon("check", 16)}</span>
        <span class="cert-text"><strong>${t(c.name)}</strong><span>${t(c.issuer)} · <span class="mono">${t(c.year)}</span></span></span>
        ${c.url ? `<a class="link-slide cert-link" href="${esc(c.url)}" target="_blank" rel="noopener">Verify<span class="sr-only"> ${esc(c.name)}</span> ${icon("external", 14)}</a>` : ""}
      </li>`).join("");

    return html`
      <section class="section" id="experience" aria-labelledby="exp-title">
        <div class="container">
          ${axisHead("04", "Experience & education")}
          <h2 id="exp-title" class="section-title reveal">${t(P.yearsExperience)} years of turning questions into answers.</h2>
          <div class="exp-grid">
            <ol class="timeline">${roles}</ol>
            <aside class="exp-aside">
              <div class="panel reveal"><h3 class="panel-title mono">Education</h3><ul class="edu">${edu}</ul></div>
              <div class="panel reveal"><h3 class="panel-title mono">Certifications</h3><ul class="certs">${certs}</ul></div>
            </aside>
          </div>
        </div>
      </section>`;
  }

  /* ---------- Testimonials (only when real quotes exist) ----------------- */
  function testimonials() {
    if (!S.testimonials || !S.testimonials.length) return "";
    return html`
      <section class="section" id="testimonials" aria-labelledby="testi-title">
        <div class="container">
          ${axisHead("05", "Kind words")}
          <h2 id="testi-title" class="section-title reveal">What collaborators say.</h2>
          <div class="quotes">${S.testimonials.map((q) => html`
            <figure class="quote reveal"><blockquote><p>${esc(q.quote)}</p></blockquote>
              <figcaption><strong>${esc(q.name)}</strong><span>${esc(q.role)}</span></figcaption></figure>`).join("")}
          </div>
        </div>
      </section>`;
  }

  /* ---------- Contact ---------------------------------------------------- */
  function contact() {
    const n = S.testimonials.length ? "06" : "05";
    const direct = [
      [P.email && `mailto:${P.email}`, "mail", P.email || "[email]", "Email"],
      [P.links.linkedin, "linkedin", "LinkedIn", "LinkedIn"],
      [P.links.github, "github", "GitHub", "GitHub"],
      [P.links.tableau, "chart", "Tableau Public", "Tableau Public"]
    ].map(([href, ic, text, label]) => href
      ? `<li><a class="direct-link" href="${esc(href)}" ${href.startsWith("http") ? 'target="_blank" rel="noopener"' : ""}>${icon(ic, 18)}<span>${esc(text)}</span></a></li>`
      : `<li><span class="direct-link is-empty">${icon(ic, 18)}<span>${t(`[${label} link]`)}</span></span></li>`).join("");

    return html`
      <section class="section contact" id="contact" aria-labelledby="contact-title">
        <div class="container">
          ${axisHead(n, "Contact")}
          <div class="contact-grid">
            <div class="contact-copy">
              <p class="status-pill reveal"><span class="status-dot" aria-hidden="true"></span>${t(P.availability)}</p>
              <h2 id="contact-title" class="contact-title reveal">${t(S.contact.headline)} <span class="hl">${esc(S.contact.highlight)}</span></h2>
              <p class="section-lede reveal">${t(S.contact.blurb)}</p>
              <ul class="direct-links reveal">${direct}</ul>
            </div>
            <form class="contact-form panel reveal" novalidate>
              <div class="field">
                <label for="cf-name">Name</label>
                <input id="cf-name" name="name" type="text" autocomplete="name" required aria-describedby="cf-name-err">
                <p class="field-err" id="cf-name-err"></p>
              </div>
              <div class="field">
                <label for="cf-email">Email</label>
                <input id="cf-email" name="email" type="email" autocomplete="email" required aria-describedby="cf-email-err">
                <p class="field-err" id="cf-email-err"></p>
              </div>
              <div class="field">
                <label for="cf-msg">Message</label>
                <textarea id="cf-msg" name="message" rows="5" required minlength="10" aria-describedby="cf-msg-err"></textarea>
                <p class="field-err" id="cf-msg-err"></p>
              </div>
              <div class="hp" aria-hidden="true"><label for="cf-web">Leave this empty</label><input id="cf-web" name="_gotcha" tabindex="-1" autocomplete="off"></div>
              <button class="btn btn-primary btn-block" type="submit">Send message ${icon("arrow", 18)}</button>
              <p class="form-status" role="status" aria-live="polite"></p>
            </form>
          </div>
        </div>
      </section>`;
  }

  function initForm() {
    const form = $(".contact-form");
    const status = $(".form-status", form);
    const fields = {
      name: { el: $("#cf-name"), msg: "Please tell me your name." },
      email: { el: $("#cf-email"), msg: "Please enter a valid email address." },
      message: { el: $("#cf-msg"), msg: "Please write a message (at least 10 characters)." }
    };
    const check = (f) => {
      const ok = f.el.checkValidity() && f.el.value.trim().length > 0;
      f.el.setAttribute("aria-invalid", String(!ok));
      $("#" + f.el.getAttribute("aria-describedby")).textContent = ok ? "" : f.msg;
      return ok;
    };
    Object.values(fields).forEach((f) => f.el.addEventListener("blur", () => f.el.value && check(f)));
    Object.values(fields).forEach((f) => f.el.addEventListener("input", () => f.el.getAttribute("aria-invalid") === "true" && check(f)));

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const bad = Object.values(fields).filter((f) => !check(f));
      if (bad.length) { bad[0].el.focus(); status.textContent = ""; return; }
      if ($("#cf-web").value) return; // bot

      const data = { name: fields.name.el.value.trim(), email: fields.email.el.value.trim(), message: fields.message.el.value.trim() };
      const btn = $("button[type=submit]", form);
      btn.disabled = true;

      try {
        if (S.contact.formEndpoint) {
          const res = await fetch(S.contact.formEndpoint, {
            method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data)
          });
          if (!res.ok) throw new Error(res.status);
          success("Thanks, " + data.name.split(" ")[0] + ". Your message is on its way. I’ll be in touch soon.");
        } else if (P.email) {
          const body = encodeURIComponent(`${data.message}\n\n${data.name}\n${data.email}`);
          location.href = `mailto:${P.email}?subject=${encodeURIComponent("Hello from your portfolio")}&body=${body}`;
          success("Your email app should open with the message ready to send.");
        } else {
          throw new Error("No form endpoint or email configured");
        }
      } catch (err) {
        status.className = "form-status is-error";
        status.textContent = P.email
          ? `Something went wrong. Please email me directly at ${P.email}.`
          : "The form isn’t connected yet. Set contact.formEndpoint or person.email in data.js.";
        btn.disabled = false;
      }
      function success(msg) {
        form.classList.add("is-sent");
        form.innerHTML = `<div class="sent" tabindex="-1"><span class="sent-icon">${icon("check", 28)}</span><h3>Message ready</h3><p>${esc(msg)}</p></div>`;
        $(".sent", form).focus();
      }
    });
  }

  /* ---------- Structured data (JSON-LD Person) --------------------------- */
  function jsonLd() {
    const real = (v) => v && !/\[.*\]/.test(v);
    const ld = {
      "@context": "https://schema.org", "@type": "Person",
      name: P.name, jobTitle: P.title, url: S.meta.siteUrl,
      image: real(P.headshot) ? new URL(P.headshot, S.meta.siteUrl).href : undefined,
      email: real(P.email) ? `mailto:${P.email}` : undefined,
      address: real(P.location) ? { "@type": "PostalAddress", addressLocality: P.location } : undefined,
      sameAs: Object.values(P.links).filter(real),
      knowsAbout: S.skills.flatMap((g) => g.tools.map((x) => x.name))
    };
    const s = document.createElement("script");
    s.type = "application/ld+json";
    s.textContent = JSON.stringify(ld);
    document.head.appendChild(s);
  }

  /* ---------- Active nav link on scroll ---------------------------------- */
  function initScrollSpy() {
    if (!("IntersectionObserver" in window)) return;
    const links = $$(".nav-link");
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((a) => {
        const on = a.dataset.section === e.target.id;
        a.classList.toggle("is-active", on);
        on ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current");
      });
    }), { rootMargin: "-45% 0px -50% 0px" });
    links.forEach((a) => { const s = document.getElementById(a.dataset.section); s && io.observe(s); });
  }

  /* ---------- Mount ------------------------------------------------------ */
  $("#main").innerHTML = hero() + work() + about() + skills() + experience() + testimonials() + contact();
  jsonLd();
  initHeroViz();
  initFilters();
  initForm();
  initScrollSpy();
  UI.initReveal();
  UI.initCountUps();
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
})();
