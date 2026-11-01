# Labÿrínta

Labÿrínta is an experimental agentic art project: a public website (live at https://lukebradford.github.io/labyrinta/, repo `lukebradford/labyrinta`) that started out totally blank and is grown entirely by agent sessions run in this directory. The original brief is in `spec.txt`.

The project is open-ended, but heavily inspired (especially at the start) by the labyrinth and maze material on this laptop. That material is catalogued in `notes/INSPIRATION.md`. Its heart is the owner's own long-running typographic series, "A Labyrinth Is a …".

## When the user types "Continue"

This is the core loop. You have full creative ownership of the site; the user will not tell you what to build.

1. **Orient.**
   - Read `VISION.md`, `notes/INSPIRATION.md`, the last few entries in `changes.json`, and `git log --oneline -15`.
   - Look at the site as a visitor would. Serve it with `python3 -m http.server 8000 -d site` (in the background) and view it in a browser if browser tools are available, at desktop and mobile widths, in light and dark mode. Otherwise read the source carefully.
   - Check the latest deploy succeeded: `gh run list --limit 3`. If it failed, fix that first.
   - Go back to the source material: open one or two of the works in `notes/INSPIRATION.md` itself (images, PDFs, code), not just the catalogue. If you find new labyrinth or maze material on the laptop, add it to the catalogue.
2. **Ask yourself**, honestly and specifically about what is actually there:
   > What can I do to make this website more beautiful, detailed, compelling, engaging, polished, unique, performant, subtle, surprising, mobile-friendly, reliable, secure, cohesive, outlandish, intriguing, well designed, and technically impressive? What are the bugs I can identify and fix? What would draw more people in to increase the reach of the site? What is my vision for the future of this project?
3. **Decide** on one or more specific, contained sets of changes. Each set should be something a visitor could notice and describe in a sentence. Prefer one excellent change over several shallow ones. Fix real bugs before adding new things.
4. **Implement** the first set. Verify it in the browser: desktop and mobile, touch and keyboard, light and dark, reduced motion, no console errors, no broken links.
5. **Update `VISION.md`** if your thinking about where the site is going has changed. It is your memory between sessions: keep it current, short, and opinionated.
6. **Publish** the set:
   ```
   node tools/publish.mjs --title "Short title" --summary "One or two sentences on what changed and why." \
     --detail "Specific change" --detail "Another specific change" --co-author "<your model name> <noreply@anthropic.com>"
   ```
   This checks the site (relative URLs, nothing loaded from other origins, size budget), appends to `changes.json`, cache-busts the site's own CSS/JS, commits, and pushes. GitHub Actions then deploys `site/` to GitHub Pages.
7. Repeat steps 4–6 for any further sets. Each set becomes its own commit and `changes.json` entry.
8. **Confirm the deploy**: `gh run watch` on the latest run, then fetch the live URL to confirm the change is there.
9. **Report** to the user in a few lines: what you changed, why, and the live link.

## Rules

- **Notes stay local.** `notes/` is gitignored and must never be committed or deployed; `publish.mjs` refuses if it is staged. It may reference private files. The site may draw on the owner's published works (titles, phrases, ideas, visual grammar), and reinterpreting them is the point, but don't copy raw source files (InDesign/PDF/PNG) into `site/`, and never put anything private or personal from the laptop on the site.
- **Static and relative.** `site/` is deployed as-is: plain HTML, CSS, and JS with no build step. All internal URLs must be relative (no leading `/`), because the site is served from `/labyrinta/`. Vendor any dependencies into `site/`; don't load third-party scripts, fonts, trackers, or analytics from other origins.
- **Lean.** The whole site has a 5 MB budget. Prefer SVG, canvas, CSS, and code over images. Generative beats stored.
- **History is append-only.** Don't edit past entries in `changes.json`. If the site ever shows its own history, generate it from that file.
- **Honest.** No fabricated testimonials, stats, people, or claims. Invented content is fine as art or fiction, never presented as fact.

## Taste

- The site began as nothing. Let it grow like a labyrinth does: each change extends what is there and makes the whole more coherent, rather than bolting on an unrelated feature. The blank page was the first room.
- Develop a distinct identity rooted in the source material. Avoid the generic look of AI-generated sites: no hero-plus-three-cards, no stock gradients, no buzzwords, no explanatory marketing copy. Mystery is allowed; it is a labyrinth.
- Subtlety and craft over volume. Details, motion, typography, and small surprises matter. Outlandish is welcome when it is well made.
- Performance and accessibility are part of the design: semantic HTML, real contrast, `prefers-reduced-motion`, fast first paint, works on a phone.

## Layout

- `site/` — the deployed website.
- `changes.json` — the log of published changes (not deployed).
- `tools/publish.mjs` — checks, records, and publishes a change.
- `VISION.md` — the agent's evolving vision for the site.
- `notes/` — local-only research (gitignored). `notes/INSPIRATION.md` is the catalogue of labyrinth material on this laptop.
- `.github/workflows/deploy.yml` — deploys `site/` to GitHub Pages on every push to `main`.
