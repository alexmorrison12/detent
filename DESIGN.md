---
name: Detent
version: 1
register: brand
tokens: src/styles/tokens.css
---

# DESIGN.md: Detent

## Scene

A mastering room at 11 p.m.: two monitors, one warm lamp, a machined dial catching a rim of light next to the keyboard, and a small red tally light meaning *recording*. That forces **night (graphite) as the home world** for immersive, product-led sections. Reading and buying happen in **day (pure white)**: specs, shop, FAQ, legal. Sections switch worlds deliberately; the switch itself is a designed moment.

Mood phrase: *"on-air light in a dark studio: machined metal, one red signal, everything else quiet."*

## Color (OKLCH; see `src/styles/tokens.css`)

Strategy: **Committed accent on neutral worlds**, plus a **Full palette of feel colors used only inside the feel system**.

- Graphite ramp (hue 355, chroma ≤ 0.008): `--graphite-950 … 500`. Night backgrounds.
- Aluminum ramp: `--alu-400 … 50`. Night ink, day surfaces. Day background is pure white.
- **Tally** `oklch(0.636 0.218 355.3)`: the knob's indicator line, the on-air light. Primary buttons, focus rings, the one thing lit on a dark page. Text on tally fills is **graphite**, never white (white fails contrast). Tally text on night uses `--tally-hot`; on day uses `--tally-deep`.
- Feel colors (`--feel-ratchet|fluid|spring|clock|wall|magnet`): each haptic profile owns one hue and uses it only when that profile is active or being shown (the knob display ring, the playground world, profile cards). Never as general decoration.
- Semantic tokens (`--bg --bg-raised --surface --surface-2 --ink --ink-strong --ink-muted --ink-faint --line --line-strong --accent --accent-text --accent-ink --focus`) flip with `data-world="night|day"`. Components use semantic tokens only.

## Typography

- **Archivo Variable** (wght 100–900, wdth 62–125%). One family, committed contrast:
  - Display: `font-stretch: 125%`, weight 760–800, tracking -0.02em, leading 0.98. Like an engraved instrument scale. Class `.display .display--xl|l|m|s`.
  - UI: `font-stretch: 108%`, weight 560–650.
  - Body: 100%, 400, `--leading-body`.
  - **Signature:** the width axis is live. Where the dial is interactive, turning it may drive `font-stretch`/weight of a nearby headline (the page literally responds to the knob).
- **Martian Mono Variable** for *readouts only*: degrees, detent counts, specs values, prices in configurator summaries, serial numbers. Class `.readout`. Never for paragraphs or labels-as-costume.
- Scale `--step--2 … --step-6` (fluid, ~1.333). Hero max 6rem. `text-wrap: balance` on headings, `pretty` on prose. Body ≤ 66ch.

## Shape, depth, texture

- Radii: `--r-xs 2px`, `--r-s 6px`, `--r-m 10px`, `--r-l 14px` (cards max), `--r-pill` (buttons, chips). True circles for anything dial-shaped.
- Depth: one border **or** one tight shadow (≤ 8px blur), never both.
- Texture comes from the product: machined concentric rings, knurling, engraved tick scales. A ring of tick marks is a legitimate motif **because the product is a measuring instrument**, used on dial-related elements, not as page wallpaper.

## Motion

- Easing: `--ease-out` (expo-like), `--ease-out-quart`. No bounce/elastic except the dial's own spring physics (which is the product).
- Durations: `--dur-1 120ms` (press), `--dur-2 220ms` (hover), `--dur-3 420ms` (reveal), `--dur-4 800ms` (hero choreography).
- Buttons "seat" 1px on press, like a detent.
- Scroll-driven animations (`animation-timeline: view()/scroll()`) inside `@supports`; the non-supporting default is the finished, visible state. Never gate content visibility on JS.
- Cross-document View Transitions are on (`@view-transition { navigation: auto }`); name shared elements (e.g. the dial) with `view-transition-name` sparingly.
- `prefers-reduced-motion: reduce`: no autorotation, no parallax, crossfades only; the dial still turns when the user turns it.

## Layout

- Container 88rem, gutters `--gutter`, sections `--section-y`.
- One dominant idea per viewport on brand pages. Asymmetry is welcome; the dial is often off-center, bleeding off an edge.
- Z-index: use `--z-*` tokens only.

## Components (shared, in `src/components/`)

- `BaseLayout` (world, chrome, SEO, JSON-LD, phase script, speculation rules)
- `SiteHeader` (announcement, nav, sound toggle, cart, phase CTA, mobile popover nav), `SiteFooter`
- `PhaseCTA`: the only way to render the main buy/reserve/join action
- `dial/DialStage` (interactive or display dial), `dial/DialStill` (static image)
- `.btn` `.btn--primary|solid|quiet` `.btn--sm|lg`, `.link-arrow`, `.field` + `.input`, `.readout`, `.lede`, `.concept-note`

## Bans (project-specific, on top of impeccable's)

- No eyebrow kickers above every section; no 01/02/03 section numbering unless it is a real sequence.
- No gradient text, glass cards, gradient blobs, side-stripe borders, identical icon-card grids, hero-metric templates.
- No stock photos of people pretending to work. Imagery is the product (3D/renders), the mechanism, and real UI.
- No fake urgency (countdowns to nothing, "3 left!"); every date and number comes from `src/config/launch.ts` / `src/data/product.ts`.
- No lorem ipsum, no placeholder copy, no "Coming soon" sections.
