# Kingsley Koduah — Data Analyst Portfolio

Personal portfolio site, live at **https://koduahkk.github.io**.

> I turn messy data into decisions people can actually act on.

Plain HTML/CSS/JS, no build step — GitHub Pages serves it as is. Styled to the personal brand guide v2.0: Paper `#F5F2EC`, Ink `#0E0E0C` and Signal Green `#2BD67B` (Green Ink `#08703A` for green text on paper); Archivo for headlines, Inter for body copy, JetBrains Mono for labels and numbers.

## Structure

```
index.html              home page: hero, by the numbers, about, what I deliver,
                        projects (tabs), toolkit, how I work, experience, contact
projects/*.html         one case study per project (financial, retail, churn, supply)
cv.html                 CV shown as page images, with Download PDF
404.html                branded "page not found"
assets/css/style.css    all styles; colours are role tokens at the top (--bg, --text, --accent…),
                        and dark "ink" sections remap them in .on-ink / .section--ink
assets/js/main.js       menu, scroll reveal, count-up stats, toolkit bars, project tabs,
                        timeline fill, recruiter nudge, contact form sending
assets/images/          photo, KK logo, link-preview banner
assets/images/projects/ three dashboard images per project: <slug>-1, -2, -3
assets/images/cv/       CV page images used by cv.html
```

## Updating content

Search `index.html` for `💡UPDATE` comments.

- **Projects**: case study 01 (YellowJacket Financial Analysis) uses the real dashboard. Retail, Churn and Supply Chain are placeholders: replace their images in `assets/images/projects/` (keep the names, or update the `src` on the home page and in the case study) and edit the text in the Projects tabs on the home page and in `projects/<slug>.html`.
- **Contact form**: messages go to kingsleykoduah3030@gmail.com via [formsubmit.co](https://formsubmit.co), sent in the background by `main.js`. The first message triggers a one-time "Activate Form" email to that inbox — click it once to start receiving messages.
- **CV**: replace `assets/Kingsley_Koduah_CV.pdf`, then re-render the page images in `assets/images/cv/` (e.g. `pdftoppm -r 170 -png Kingsley_Koduah_CV.pdf page`).
- **Skill levels**: the `data-level` value (0–100) and the matching `%` text on each toolkit skill.
- **Experience figures**: the `data-count` values in the "By the numbers" section.
