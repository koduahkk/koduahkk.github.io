# Sandra Abrafi · Data Analyst Portfolio

Live at **https://koduahkk.github.io/sandra/**. Plain HTML/CSS/JS, no build step.

## Edit content in one place

**Everything lives in [`assets/js/data.js`](assets/js/data.js)**: bio, stats, projects, case studies,
chart data, skills, experience, certifications and contact settings. You never need to touch the layout code.

- Text in `[square brackets]` is a placeholder. It shows on the page with a dashed yellow outline until replaced.
  When all are filled in, set `meta.highlightPlaceholders: false`.
- **Add a project**: copy an object in `projects`, give it a new `slug`, and it gets a card plus a case-study page at
  `case-study.html?p=<slug>`. Also add that URL to `sitemap.xml`.
- **Screenshots**: put images in `assets/img/projects/` and set `thumbnail`. Without one, a generated preview is shown.
- **Charts**: `bar` (`items`, `highlight`, optional `reference` line) or `line` (`x`, `series`, optional `dashedFrom`
  for a forecast). Set `illustrative: false` once the figures are real.
- **Contact form**: set `contact.formEndpoint` (Formspree, Getform…) to receive messages, or just set `person.email`
  and the form opens the visitor's email app with the message pre-filled.
- **Testimonials**: only real quotes. The section is hidden while the list is empty.

## Files

```
index.html            home page shell (meta, OG, fonts)
case-study.html       case-study template, filled from ?p=<slug>
assets/js/data.js     ← all content
assets/js/ui.js       shared: header/footer, theme, charts, code highlighting
assets/js/home.js     renders the home page sections
assets/js/case.js     renders a case study
assets/css/styles.css design tokens (top of file), layout, components
assets/img/           favicon, touch icon, og-image.png (1200×630)
```

Colours, type and spacing are CSS variables at the top of `styles.css`, with separate light and dark values.
