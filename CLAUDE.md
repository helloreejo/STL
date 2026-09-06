# SantoTech Labs — marketing site

Static marketing site: one `index.html`, Tailwind CSS v4, vanilla JS. No framework, no
router, no CMS. Built from a Figma file; **pixel accuracy against Figma is a project rule**
— do not improvise values or build from screenshots. Read the design node before changing
layout numbers.

Design file: https://www.figma.com/design/9NPFFy8F7szXQDkyxTXOzA/SantoTech-Labs-Website

## Layout

```
index.html          the whole page — every section lives here
src/css/input.css   THE stylesheet you edit (~1800 lines, Tailwind v4 entry)
src/js/script.js    THE script you edit (vanilla IIFE)
dist/               BUILD OUTPUT — generated, gitignored, never edit by hand
assets/             images, organised per section (partner/, services/, cta/ …)
assets/vendor/      self-hosted third-party libs — pinned copies, do not edit
```

Third-party JS/CSS is vendored, not loaded from a CDN: GSAP 3.12.5 + ScrollTrigger,
Swiper 14.2.0, Lenis 1.3.26 under `assets/vendor/`. They are the upstream minified builds
with the trailing `sourceMappingURL` comment stripped (the `.map` files are not vendored,
so leaving it makes devtools 404 on every load). To upgrade, re-download the same file
from jsdelivr, strip that comment, and bump the version here.

Google Fonts is the one remaining external request, deliberately. **Do not "trim" the
weight list to save bytes** — Sora and Nunito are variable fonts, so all their weights come
from one file each and dropping weights saves nothing. Only Solway is static (one file per
weight).

`index.html` loads `dist/app.css` and `dist/app.js`. Editing `src/` alone changes nothing
in the browser until you build.

**Favicons** live in `assets/favicon/`, with `favicon.ico` at the site root so the implicit
`/favicon.ico` request resolves. The mark is the "s" glyph lifted from `assets/images/logo.svg`
(the wordmark's first glyph, at x 1.0–25.6 / y 12.8–45.9 in its viewBox), clipped out of the
full wordmark path and filled with the brand ramp. The `*-source.svg` files are generation
inputs, not served — they exist so the PNGs can be regenerated. Three insets are deliberate:
14% for the tab icon, 8% for the 16px (the strokes vanish at the roomier inset), and a 45%
safe zone for the Android maskable, which launchers crop to a circle.

## Commands

```bash
npm run dev     # watch css + js and serve on :5173
npm run build   # minified dist/app.css + dist/app.js
```

Always `npm run build` (or have `dev` running) before verifying in a browser.

## The one rule that keeps biting

**Tailwind's utilities layer outranks `@layer components`, regardless of specificity.**

A rule in `input.css` can never override a utility sitting on the element. So when a
property has to change per state or per breakpoint from the stylesheet, that property must
not also exist as a utility in the markup. This is why `.site-header`, `.hero-layout`,
`.mobile-nav-panel` and `.service-panel` own their position/size in CSS instead of in
`class="…"`. Where the markup still needs to win — a one-off gutter like `xl:px-0` on a
`.shell` — that is deliberate.

## Conventions

**Where values live.** `@theme` is only for tokens that should generate Tailwind utilities
(colours, font families) — entries there can be pruned if unused. Tokens that only this
stylesheet consumes go in `:root` under `@layer base`: `--section-py`, `--container-max`,
`--container-gutter`.

**Sections.** Every section's inner wrapper is `.shell` (centred, `--container-max` wide,
gutter). Vertical rhythm is `--section-py` on every content section. Three deliberate
exceptions, each commented at its rule:

- hero — sized to the viewport, not the rhythm
- services — padding is `vh`-based because the section is pinned and must fit one screen
- contact CTA — bottom padding is `1.5 × --section-py` plus a `32vw` floor, because the
  artwork is absolutely positioned along the bottom edge

**Per-section styling** stays as component classes in `@layer components`, headed by a
`pixel-perfect from Figma node X:Y` comment. Do **not** convert these to utility soup in
the markup — the values are a design system with provenance, and inlining them loses both.

## Traps found the hard way

- **GSAP owns `transform` on anything it animates.** It also folds the CSS `translate`
  property into its own inline `transform`. Never centre a GSAP-animated element with
  `transform` or `translate` — it gets applied twice. Use insets (`left/right`, or
  `margin-inline: auto`). See `.site-header`.
- **Inline styles beat CSS rules**, so GSAP's leftover inline `transform` silently kills
  `:hover { transform: … }` on revealed elements. `[data-reveal-block]` tweens carry
  `clearProps: "transform"` to hand the element back to CSS.
- **`ch` is unreliable with Sora** — its digit is 0.73em, so `62ch` computed *wider* than
  the container and capped nothing. Use `em` for line-measure caps (~0.473em per character
  in this face).
- **Pinned sections must fill the viewport.** GSAP's pin-spacer is transparent; a pinned
  section shorter than the screen shows the page background through as a black band.
  `.services-section` has `min-height: 100svh` for this reason.
- **Lenis drives scrolling.** `window.scrollTo()` fights it — use `lenis.scrollTo()`.
  When testing, instant `scrollTo` jumps produce garbage results; drive real wheel events.

## Verifying changes

There is no test suite. Verify in a real browser — headless Chrome over CDP:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --remote-debugging-port=9222 --hide-scrollbars --user-data-dir=/tmp/chrome-prof about:blank
```

Then drive it from Node (v24 has a global `WebSocket`, no puppeteer needed): connect to
the target from `http://127.0.0.1:9222/json/new`, and measure with `Runtime.evaluate`
rather than eyeballing screenshots. Measure geometry, computed styles and line breaks —
several bugs here were only visible as numbers.

Check at minimum: 390 (phone), 1280×720 (short laptop), 1512×870, 1920×1080. Watch for
horizontal scroll, hero fitting the viewport, and the services pin engaging.

Reduced motion and `?nofx` both disable Lenis and GSAP — the site must stay usable in
both, and both are useful for testing static layout.
