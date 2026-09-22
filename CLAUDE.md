# SantoTech Labs — marketing site

Static marketing site: four pages (`index.html`, `services.html`, `about.html`,
`contact.html`), Tailwind CSS v4, vanilla JS. No framework, no router, no CMS. Built from a Figma file; **pixel accuracy against Figma is a project rule**
— do not improvise values or build from screenshots. Read the design node before changing
layout numbers.

Design file: https://www.figma.com/design/9NPFFy8F7szXQDkyxTXOzA/SantoTech-Labs-Website

## Layout

```
index.html          the home page — every home section lives here
services.html       inner page: hero + jump chips → service cards → ways in → engagement shapes → CTA
about.html          inner page: photo hero → who we are → what sets us apart → process → FAQ → CTA
contact.html        inner page: hero + chips → form + offices → FAQ
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

Every page loads `dist/app.css` and `dist/app.js`. Editing `src/` alone changes nothing
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

**Pages share chrome by copy, not include.** There is no templating step, so the header,
mobile nav and footer are duplicated in all four pages. A change to any of them must be made
in all four. On the inner pages the links to home-only sections are written
`./index.html#partner` etc. The header's phone icon ("Start a project") goes to
`./contact.html` on services and about, to `#contact` (its own CTA) on home, and to
`#contact` (the form band) on contact.

**The primary nav is three page links** — *What we do* (services.html), *Who we are*
(about.html), *Let's talk* (contact.html) — the same three on every page, with
`aria-current="page"` on the one you are on, and the mobile panel carries the same list. The
Figma nav's five in-page links (Services, Client Services, Engagement, How We Work, Global)
were dropped at the owner's request, as were the plain words Services / About / Contact; the
home sections they pointed at are still linked from the footer. The hamburger button is
`xl:hidden` to match the panel it opens — without that it sat there at ≥1280 as a dead
control that still flipped `aria-expanded`.

The footer's last column is **Connect**: labelled rows (`.info-list`) for the enquiry and
sales numbers, the email and the address, in place of the link list it used to hold, plus a
row of social links under the brand blurb. Those social links point at `#` and **the phone
numbers and both addresses are placeholders** — the owner asked for stand-ins until the real
ones exist (`+1 416 555 0134` is a reserved fictional number, `+91 98765 43210` the usual
Indian stand-in). They appear in the footer of all four pages, in contact.html's hero chips
and in its office cards; search for the number, not the page. Replace them all together and
delete the "Placeholder contact details" comments.

**One left edge.** The header's content, every section and the footer all start on the same
line: a column of `--container-max` with a `--container-gutter` either side (`.shell`, and
`.footer-inner` and `.care-inner` carrying the same box). The floating header is the odd one
out — it sits 1rem from the screen edge, so *its inline padding is computed* to land its logo
and nav on that column (1px of the sum is its own border). Three things follow:

- Do not put `xl:px-0` (or `lg:px-0`) back on a `.shell`. That was there originally, and at
  exactly 1280px — the column's own width — it left the text touching both screen edges.
- Do not give `.site-header` a plain horizontal padding; the `max(…)` expression is what
  keeps it aligned. Its docked state deliberately leaves the inline padding alone so the
  logo does not slide sideways as the header docks.
- `.distributed-card` keeps its own `max-width` because it is a surface with a visible edge,
  not a column.

**The inner pages have no Figma frame.** Their styles are the "Inner pages" block at the end
of `@layer components` — shared components, not per-page ones: `.page-hero` / `.page-title` /
`.page-lede`, `.page-light` (the partner section's light band), `.page-statement` (a section heading:
title and paragraph stacked on the page's own left edge, the same stack as the hero. Two
earlier versions were rejected and should not come back — the paragraph in a right-hand
column, which reads as a stock template, and the paragraph indented under the title, which
lines up with nothing else on the page),
`.num-mark-dot` (the purple full stop that closes a heading), `.page-cta` and the contact
form (`.contact-*`, `.field-*`). Services and About each add
their own block, with their breakpoints kept beside them.

Shared by more than one inner page: `.page-chips` / `.page-chip` (a row of small pills
under a hero — the six services on services.html, the direct ways to reach us on
contact.html), `.info-list` / `.info-label` / `.info-value` (a labelled detail row: used in
the office card and the footer's Connect column, with the colours set by the ground it sits
on; `.info-muted` puts a second fact on the same row, as the office hours are) and `.faq-*`, whose `.faq-layout--joined` modifier is only for About,
where the FAQ shares one light band with the section above it (About's process, Contact's
form).

Services: `.svc-grid` / `.svc-card` / `.svc-icon` (the services as
`.partner-card`s led by an icon tile — **no numerals**: the services are a menu, not a
sequence, and the owner asked for icons instead), `.route-*` (the dark band of situations,
editorial rows rather than cards) and `.shape-*` (the engagement shapes, with a CSS tick).
The card ids `#design` … `#ai` are what the chips jump to, and `.svc-card` carries
`scroll-margin-top` so a jump clears the docked header — 180px, not the ~140 it looks like
it needs, because Lenis measures the target's live rect and the reveal's 40px offset is
still on it.

Contact: one `.office-card` beside the form holding both `.office-block`s, on top of the
form's own `.contact-*` / `.field-*`. Two things there are deliberate and were asked for:
the offices sit **beside the form**, not in a band of their own, and there is no "what
happens next" list — it repeated the home partner section's four bullets word for word. The
card is one card rather than two because two ran ~250px past the bottom of the form beside
it; the office hours share the phone's row for the same reason. The form and the FAQ share
one `.page-light` wrapper, split by `.faq-layout--joined`, so the two do not seam.

About adds, with its breakpoints kept
beside it: `.page-hero--photo` + `.page-hero-media` (full-bleed photo banner, no buttons
— home already carries them), `.page-cta--media` (a CTA with its own photo instead of the
hand artwork), `.page-split` +
`.page-collage` (photo collage beside the story), `.pvm-*` (purpose / vision / mission
rows in the partner bullets' coloured tiles), `.page-care` (the home care band, reusing
`.care-head` / `.care-card` as they are), `.page-timeline` and `.faq-*`. Services and About deliberately use *different*
compositions of these — the pages should not read as one template with the words swapped. Every value is lifted from an existing home component, named in a
comment beside it, rather than invented — keep it that way, and add a new inner page by
composing these rather than adding a page-specific block. The inner pages load the same
`dist/app.js`, which is null-guarded throughout, but skip Swiper since they have no carousel.
About has its own copy, written for the page rather than lifted from home (at the owner's
request). It describes approach and working style only — keep it that way: no invented
history, headcount, client names, statistics, awards, address or phone number.

**`.page-cta` reuses the home CTA's `assets/cta/artwork.jpg`** (a hand reaching in from the
right). From 1024 the copy keeps to the left 7/12 over a flat scrim in the art's own ground
colour: without it the network's brightest nodes measured 2.6:1 behind white text; with it,
7.3:1. Below 1024 the art sits under the copy at full width instead.

`.page-care` reuses the home `.care-title` / `.care-card-desc` classes; wrapping fixes
for them (`balance` / `pretty`) are scoped under `.page-care` so the home cards stay as
designed.

**`.page-timeline` (about)** is the home model timeline on its side from 1024, vertical
below. Its attribute is `data-timeline-row`, not `data-timeline` — home's `.timeline`
already uses that one. `script.js` scrubs `--tl` (drawn fraction) and sets `data-active` on
each step once the line reaches its dot; with no script the CSS default draws it in full.

**About's photos are Pexels stock** (`assets/about/`, sources in `SOURCES.txt`): a team +
AI banner, a team collage with an AI inset, and a generative-AI render for the CTA — chosen
by the owner over the earlier faceless workspace shots. They are stock people, not the
studio's team: swap in real photos when they exist (keep the file names or update
`about.html`). Text sits on the photos through a wash in the hero's own colours; white copy
measured ≥ 6.4:1 at the worst single pixel. Re-measure if a photo is replaced. The banner
headline is deliberately smaller than the other pages' `.page-title` — it takes the
`.cta-title` 30→60 curve, because at 68px it ran four lines deep and covered the photograph.

**The About FAQ is native `<details>`** — keyboard and screen-reader support come free, and
`name="faq"` gives one-open-at-a-time where supported. The open animation is CSS-only
(`::details-content` + `interpolate-size`) and simply snaps open in browsers without it.
Because opening an answer moves everything below, `script.js` calls
`ScrollTrigger.refresh()` on `toggle` — without it the CTA reveal fires from a stale position.

**The contact form is Netlify Forms** (`data-netlify`, honeypot `bot-field`). Netlify only
processes it once **form detection is switched on** in the site's Netlify dashboard — until
then a submission 404s. A successful POST redirects to `/contact.html?sent=1#sent`: CSS swaps
the form for the confirmation on `#sent:target`, and `script.js` adds `.form-sent` from the
query string in case the fragment is lost, then focuses the confirmation so it is announced.
Locally there is no form handler; test the sent state by opening that URL directly.

**The six services are written twice** — the home pinned panels (`.service-panel`) and the
`services.html` cards (`.svc-card`) — plus the six pagination `aria-label`s on home and the
footer's Services column on all four pages. Change a service in every place. The capability line under each uses the shared `.caps-list`;
on home it also carries `.service-caps`, which lightens it because the Figma `.service-desc`
above it is Nunito 200 and the list would otherwise outweigh it.

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
- inner-page `.page-cta` below 1024 — bottom padding adds `40.18vw`, the artwork's own
  height at full width, so the art sits under the copy

**Cursor spotlight.** `.partner-card` / `.svc-card` / `.care-card` carry a `::before` radial glow; JS
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
