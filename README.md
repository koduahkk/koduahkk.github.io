# Kingsley Koduah — Data Analyst Portfolio

Personal portfolio site, live at **https://koduahkk.github.io**.

> I turn messy data into decisions people can actually act on.

Plain HTML/CSS/JS, no build step — GitHub Pages serves it as is. Styled to the personal brand guide: Void Black `#0A0A0A`, Signal Lime `#D4F44B`, Panel Gray `#131313`, Muted Gray `#9A9A9A`; Archivo for headlines, Inter for body copy.

## Structure

```
index.html              page content
assets/css/style.css    all styles (brand colours are CSS variables at the top)
assets/js/main.js       mobile menu, scroll reveal, skill bars
assets/images/          photo, KK logo, project previews
```

## Updating content

Search `index.html` for `💡UPDATE` comments. Still to fill in:

- **Projects 02–04** are placeholders: swap the preview image in `assets/images/`, plus the title, copy, tags, metrics and link.
- **Experience** entries are placeholders.
- **Contact**: replace `YOUR_EMAIL` (form + mailto) and `YOUR_LINKEDIN`. The form uses [formsubmit.co](https://formsubmit.co) and sends a confirmation email the first time.
- **CV**: drop your CV into `assets/` and update the "Download CV" link.
- **Skill levels**: the `data-level` value (0–100) on each skill.
