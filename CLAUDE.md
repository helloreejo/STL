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
dist/               BUILD OUTPUT — generated, but COMMITTED (see below). Never edit by hand
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

**`dist/` is committed on purpose.** Netlify runs no build step — it publishes the repo as
it stands (see `netlify.toml`). That means the build output in git *is* what production
serves, so:

> **Run `npm run build` and commit `dist/` before pushing, or production ships stale CSS
> and JS while `src/` looks correct.**

This is the one sharp edge of the setup. The site was once deployed with `dist/` gitignored
and every other asset resolving fine — `app.css` and `app.js` 404'd and the page rendered as
unstyled text. If production ever looks wrong in a way local does not, check that `dist/`
in `HEAD` matches a fresh `npm run build` before looking anywhere else.

**Favicons** live in `assets/favicon/`, with `favicon.ico` at the site root so the implicit
`/favicon.ico` request resolves. `favicon.svg` is the supplied brand mark used **verbatim**
— no tile, no background — and every PNG is rendered from it, transparent. Keep it that way:
the mark was checked against white, a dark tab (`#202124`) and black, and it reads on all
three, so a background tile is not needed and would only be something to keep in sync.

`maskable-source.svg` is the one generated variant: Android launchers crop maskable icons to
a circle, so it re-insets the same artwork into a 46% safe zone. It is a generation input,
not served. The mark's measured ink box is x 9.67 / y 2.0 / 30.67 x 46.

When rendering the PNGs, set `Emulation.setDefaultBackgroundColorOverride` to alpha 0 —
Chrome otherwise paints an opaque white page and the transparency is lost.

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

**Cursor spotlight.** `.partner-card` / `.care-card` carry a `::before` radial glow; JS
only publishes `--spot-x` / `--spot-y` from `pointermove`. All visuals stay in CSS, so the
glow degrades to nothing when JS is idle. Gated on `(hover: hover) and (pointer: fine)` —
on touch there is no hover, and the glow would stick where the last tap landed. The rect is
read inside the rAF, not cached on pointerenter, because the page scrolls under the cursor.

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
- **A pin must refresh before anything below it.** ScrollTrigger refreshes in creation
  order, and the services pin is created last. Pinning inserts a spacer as tall as the pin,
  which pushes every later section down — so the reveals in care, testimonials, contact and
  the footer had measured their start positions before that spacer existed and fired a full
  pin-length (~2.4k px) early, while still far below the fold. It looked exactly like "those
  sections have no animation". `ScrollTrigger.refresh()` does **not** fix it; the pin needs
  `refreshPriority: 1`. Symptom to watch for: a trigger's `start` is off by precisely the
  pin's length.
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
