# Detent site: engineering conventions

Static multi-page site for **Detent One** (a concept haptic dial). Astro 7 + TypeScript (strict) + vanilla web components + three.js. Hosted on GitHub Pages under a sub-path (`/detent/`). Read `PRODUCT.md` (who/why/voice) and `DESIGN.md` (visual system) before designing anything.

## Commands

```bash
npm run dev            # astro dev (http://localhost:4321/detent/)
npm run build          # astro build -> dist/
npm run check          # astro check (types + diagnostics), must be 0 errors
npm run test           # playwright smoke + a11y tests against a built preview
npm run format         # prettier
```

When starting the dev server manually for a quick look, pick your own port (`npx astro dev --port 43xx`) so parallel work doesn't collide, and stop it when done.

## Non-negotiables

1. **Base-aware URLs.** The site lives at `/detent/`. Never hard-code `href="/shop/"` or `src="/renders/x.png"`. Use `url('/shop/')` from `@/lib/url` in Astro and TS. Public assets too: `url('/renders/raw-hero.avif')`.
2. **Single source of truth.** Prices, specs, finishes, profiles, integrations, audiences, FAQs: `@/data/product`. Launch phases, dates, CTA copy: `@/config/launch`. Site identity/nav: `@/config/site`. Never hard-code a price, date or spec in a page. Add new data in your own `src/data/<feature>.ts` if you need it.
3. **Primary CTAs go through `<PhaseCTA placement="…"/>`.** Anything phase-specific uses `data-phase-only="waitlist reserve"`; CSS shows it only in those phases. Preview any phase with `?phase=live` (`?phase=reset` clears).
4. **Dials go through `<DialStage/>` or `<detent-dial>`** (contract: `src/scripts/dial/types.ts`). Pages never import three.js. Listen to `detent:tick`, `detent:change`, `detent:press` events.
5. **Styling:** semantic tokens only (`var(--ink)`, `var(--accent)`, `var(--space-m)`…) from `src/styles/tokens.css`. Scoped `<style>` in components; global CSS stays in `src/styles/`. Worlds via `data-world="night|day"`. OKLCH for any new color. Use `--z-*` tokens for stacking.
6. **Progressive enhancement.** Content is visible and usable without JS and without WebGL. Animations enhance an already-visible default. Modern CSS (scroll-driven animations, anchor positioning, `@starting-style`) always inside `@supports` or with a harmless fallback.
7. **Accessibility:** WCAG 2.2 AA. Semantic HTML first; one `<h1>` per page; labelled controls; visible focus; keyboard for everything; `prefers-reduced-motion` handled for every animation; sound opt-in via `@/lib/sound`.
8. **Performance:** no third-party scripts, no runtime CSS-in-JS, lazy-load heavy modules (`import()` on visibility/idle). Images: AVIF/WebP with explicit width/height. Target LCP < 2 s, CLS < 0.05, INP < 150 ms.
9. **Honesty:** Detent is a concept. Forms never send data anywhere unless an endpoint is configured; they say so with a `.concept-note`. No fake reviews from real people or publications, no fake scarcity, no real brand logos.
10. **Analytics:** `track(event, props)` from `@/lib/analytics`, or `data-track="event"` + `data-track-*` attributes on clickable elements.

## Structure

```
src/
  config/        site.ts, launch.ts             (shared; do not change semantics)
  data/          product.ts (+ feature data files)
  lib/           url, storage, analytics, sound, cart (+ feature libs)
  styles/        tokens.css, global.css         (shared)
  layouts/       BaseLayout.astro               (shared)
  components/    shared components; feature folders: home/, shop/, launch/, audience/, feel/, info/, dial/
  scripts/       client TS; dial/ owns the 3D + haptics engine
  pages/         routes (file-based; trailing slashes)
public/          static assets (renders/, og/, icons)
docs/            LAUNCH_PLAN.md and other docs
tests/           Playwright
```

Shared files (`BaseLayout`, `SiteHeader`, `SiteFooter`, `PhaseCTA`, `tokens.css`, `global.css`, `config/*`, `data/product.ts`, `lib/{url,storage,analytics,sound,cart}.ts`) are owned by the integrator. If a feature needs a change there, make the smallest additive change possible and call it out in your commit message.

## Copy rules

Voice: machined, exacting, playful (see PRODUCT.md). Short declaratives, concrete verbs, real numbers. Banned words: revolutionary, seamless, unleash, elevate, game-changer, cutting-edge, next-level, supercharge, effortless, unlock (except the safe), "in today's fast-paced world". No em-dash-heavy AI cadence; prefer periods and commas.

## Docs

Full Astro docs: https://docs.astro.build. Dev server background mode: `astro dev --background`, manage with `astro dev stop|status|logs`.
