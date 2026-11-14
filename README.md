# Kingsley Koduah — Data Analyst Portfolio

Personal portfolio site, live at **https://koduahkk.github.io**.

> I turn raw data into decisions.

Design concept: **"The Annotated Chart"**, an editorial data story in the spirit of FT / The Pudding. Gridlines, axis ticks, annotations and data points are the design language.

Plain HTML/CSS/JS with no build step and no dependencies. GitHub Pages serves it as is.

## Design system

| Token | Light | Dark |
|---|---|---|
| Background | `#F7F5F0` paper | `#0F1115` ink |
| Text | `#14161A` | `#ECEAE4` |
| Data accent | `#0FA3A3` teal | |
| Annotation / key insight | `#F2A541` amber | |
| Gridlines | `#DAD6CC` | `#262A31` |

Type: **Fraunces** (display), **Inter** (body), **JetBrains Mono** (numbers, labels, code), with tabular numerals throughout. All colours are CSS variables at the top of `assets/css/style.css`. A light/dark toggle sits in the nav and remembers the choice. Motion respects `prefers-reduced-motion`.

## Structure

```
index.html              home: hero chart, work (filterable), about, skills matrix, experience, contact
projects/<slug>.html    case studies: question → data → approach → insights → impact → dashboard → next
cv.html                 résumé viewer with PDF download
assets/css/style.css    all styles
assets/js/main.js       theme, nav, reveal/count-up, filters, hero chart, case-study charts, code highlighting
assets/images/          photo, project dashboard images (<slug>-1/2/3), CV page images
```

## Updating content

Search the HTML for `💡UPDATE` comments. Still to fill in:

- **Location and roles** in the hero eyebrow (currently "New York", taken from the BNY Mellon role).
- **Projects 02–04** (Retail, Churn, Supply) are placeholders: text, charts and images.
- **Case-study charts** read their data from the `<script type="application/json">` block right after each `.chart`. Edit the numbers there. Bar charts: `data: [{label, value, hl}]`. Line charts: `series: [{name, values: [[x, y], …]}]` plus `annotations`. The electricity trend (Fig. 01.1) is an indicative series; paste in the exact yearly values.
- **Live dashboards**: each case study has a commented-out `<iframe>` for a Power BI / Tableau Public embed in section 06. On the home page, add `GitHub` / `Live dashboard` links inside `.project-links`.
- **Filters**: each project card's `data-tags` drives the chips. A chip with no matching project hides itself (Tableau and Machine Learning will appear once a project uses them).
- **Skills matrix**: `dot core` = daily, `dot used` = regularly.
- **Contact form**: messages go via [formsubmit.co](https://formsubmit.co). The first submission sends a one-time activation email.
- **CV**: replace `assets/Kingsley_Koduah_CV.pdf` and re-render the images in `assets/images/cv/`.
