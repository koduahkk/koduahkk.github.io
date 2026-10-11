# Kingsley Koduah — Data Analyst Portfolio

Personal portfolio site, live at **https://koduahkk.github.io**.

> I turn messy data into decisions people can actually act on.

Plain HTML/CSS/JS, no build step — GitHub Pages serves it as is. Styled to the personal brand guide: Void Black `#0A0A0A`, Signal Lime `#D4F44B`, Panel Gray `#131313`, Muted Gray `#9A9A9A`; Archivo for headlines, Inter for body copy.

## Structure

```
index.html              page content
assets/css/style.css    all styles (brand colours are CSS variables at the top)
projects/*.html         one case study page per project
assets/js/main.js       mobile menu, scroll reveal, skill bars
assets/images/          photo, KK logo
assets/images/projects/ three dashboard images per project: <slug>-1, -2, -3
```

## Updating content

Search `index.html` for `💡UPDATE` comments. Still to fill in:

- **Projects**: each card on the home page shows three dashboard images (`assets/images/projects/<slug>-1/2/3`) and links to its case study in `projects/<slug>.html`. Projects 02–04 are placeholders, and pages 2–3 of the US Electricity project are placeholder images. Replace the image files (keep the names, or update the `src` in both the home page and the case study) and edit the case study text.
- **Live dashboard links**: the "Open in Power BI" link at the bottom of each case study.
- **Experience** entries are placeholders.
- **Contact**: replace `YOUR_EMAIL` (form + mailto) and `YOUR_LINKEDIN`. The form uses [formsubmit.co](https://formsubmit.co) and sends a confirmation email the first time.
- **CV**: drop your CV into `assets/` and update the "Download CV" link.
- **Skill levels**: the `data-level` value (0–100) on each skill.
