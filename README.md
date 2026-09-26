# Detent One

**Software you can feel.** The website, launch funnel and store for Detent One, a machined aluminum desktop dial with software-defined haptics: it clicks, glides, springs back or stops dead depending on the app you're in.

**Live:** https://alexmorrison12.github.io/detent/

> Detent is a **concept product**. This site is a design and engineering demonstration. Nothing is for sale, forms keep data in your browser unless a real endpoint is configured, and every form says so.

## Highlights

- **The page is the product demo.** The dial on the page turns (drag, wheel, arrow keys), clicks audibly once you opt in to sound, vibrates on Android, and drives the page around it. Six feels (Ratchet, Fluid, Spring, Clock, Wall, Magnet) change the physics, the sound and the display.
- **Play is the funnel.** Crack the Safe (`/crack/`) and Daily Detent (`/daily/`) are daily games you play by feel; the feel library (`/profiles/`) and achievements reward poking around.
- **One value moves the launch.** Tease → Waitlist → Reserve → Launch day → Live. Every call to action, the announcement bar and every phase-specific block follow one build setting (the `LAUNCH_PHASE` repository variable, `PUBLIC_LAUNCH_PHASE` in the build), and any URL previews any phase with `?phase=`.
- **Honest by construction.** Real dates and batch numbers from config, no fake timers or counters, no invented reviews, refundable deposits, demo mode that says it's a demo.
- **Built on the platform, not on a framework runtime.** Static HTML first, light-DOM web components, cross-document View Transitions, Speculation Rules prerendering, `popover` and `<dialog>`, `@starting-style`, scroll-driven animations behind `@supports`, OKLCH color, CSS subgrid, and Archivo's live width axis. three.js loads after first paint and never blocks reading; everything works without WebGL.

## Architecture

```
Static Astro pages (MPA, no client router)
 ├─ BaseLayout      SEO, JSON-LD, OG, phase script (before first paint), speculation rules
 ├─ <PhaseCTA>      the only way to render a buy / reserve / join button
 ├─ <detent-dial>   the dial engine: 3D renderer + physics + audio, SVG fallback
 └─ page scripts    small bundled modules per component, lazy where heavy
Data: src/config/*  src/data/*  →  pages, JSON-LD, OG images, the launch plan
```

- **Pages** are static `.astro` files with scoped styles. Interactivity comes from small `<script>` modules that Astro bundles per component; heavy code loads with `import()` on visibility or idle.
- **Web components.** `<detent-dial>` (contract in `src/scripts/dial/types.ts`) is how every page places a dial: attributes for finish, profile, camera; `detent:tick`, `detent:change`, `detent:press` events out. Pages never import three.js.
- **Phase system.** `src/config/launch.ts` defines the five phases (dates, landing pages, CTA copy). `BUILD_PHASE` comes from `PUBLIC_LAUNCH_PHASE` at build time. An inline script in `BaseLayout` applies `?phase=` or the tab's stored preview before first paint, and CSS shows only the `data-phase-only` blocks that match `<html data-phase>`.
- **Single sources of truth.** `src/data/product.ts` (prices, specs, finishes, feels, integrations, audiences, FAQ), `src/config/launch.ts` (phases, dates, deposit, batches), `src/config/site.ts` (identity, nav), `src/config/og.ts` (social cards), `src/data/launch-plan.ts` (the launch plan).
- **Demo vs live.** `src/lib/waitlist.ts` stores signups and reservations in `localStorage` until `PUBLIC_WAITLIST_ENDPOINT` is set. `PUBLIC_SITE_MODE=live` turns on `Offer` structured data.
- **Analytics.** `track()` in `src/lib/analytics.ts` pushes first-party events to `window.dataLayer` and a `detent:track` DOM event. No third-party scripts ship; AI-assistant referrals are tagged `channel=ai`; nothing fires during prerender.

## Commands

Node 22.12 or newer.

| Command           | Does                                                                 |
| ----------------- | -------------------------------------------------------------------- |
| `npm ci`          | Install exact dependencies                                           |
| `npm run dev`     | Dev server at http://localhost:4321/detent/                          |
| `npm run check`   | Types and diagnostics (`astro check`); must be 0 errors              |
| `npm run build`   | Static build to `dist/`                                              |
| `npm run preview` | Serve the build locally                                              |
| `npm run test`    | Playwright smoke and axe accessibility tests against a built preview |
| `npm run format`  | Prettier                                                             |

## Deploy

GitHub Actions builds and deploys to GitHub Pages on every push to `main`, and on demand from the Actions tab. `.github/workflows/deploy.yml` reads three **repository variables** (Settings → Secrets and variables → Actions → Variables) and hands each one to the build under the `PUBLIC_*` name the site's code reads:

| Repository variable | Build environment it sets  | Default   | Purpose                                                                  |
| ------------------- | -------------------------- | --------- | ------------------------------------------------------------------------ |
| `LAUNCH_PHASE`      | `PUBLIC_LAUNCH_PHASE`      | `reserve` | `tease`, `waitlist`, `reserve`, `launch` or `live`                       |
| `SITE_MODE`         | `PUBLIC_SITE_MODE`         | `demo`    | `live` when real endpoints are configured (adds `Offer` structured data) |
| `WAITLIST_ENDPOINT` | `PUBLIC_WAITLIST_ENDPOINT` | unset     | Where waitlist and reservation forms `POST` JSON                         |

The `PUBLIC_*` names are build-time environment variables, not repository variables: the workflow sets them, and a local build reads them from your shell (`PUBLIC_LAUNCH_PHASE=live npm run build`). Astro inlines `PUBLIC_*` values into public JavaScript, so never put a secret in one.

`SITE_URL` and `SITE_BASE` are not repository variables either. The workflow takes them from the Pages configuration (`actions/configure-pages`), so a custom domain or a renamed repository needs no change. Local builds default to `https://alexmorrison12.github.io` and `/detent` (`astro.config.mjs`); set both in the environment to build for another host, for example `SITE_URL=https://detent.example SITE_BASE=/`.

## Switching launch phases

```bash
gh variable set LAUNCH_PHASE --body waitlist
gh workflow run deploy.yml --ref main && gh run watch
```

The variable takes effect on the next build. For a one-off build in another phase without changing the variable, run the workflow with its `phase` input: `gh workflow run deploy.yml --ref main -f phase=launch`. To look at a phase without deploying, add `?phase=launch` to any URL (it sticks for the tab; `?phase=reset` clears it), or turn the dial on [`/launch-plan/`](https://alexmorrison12.github.io/detent/launch-plan/). Flip times, the two-person runbook and rollback are in [docs/LAUNCH_PLAN.md §12](docs/LAUNCH_PLAN.md#12-the-switch-moving-the-site-between-phases).

## Configuring endpoints

Set the `WAITLIST_ENDPOINT` repository variable (the build's `PUBLIC_WAITLIST_ENDPOINT`) to a URL that accepts `POST` JSON with `action: "join"` or `action: "reserve"` and returns the entry or reservation. Request and response shapes, CORS, double opt-in and the Stripe deposit flow are specified in [docs/OPERATIONS.md §9](docs/OPERATIONS.md#9-plugging-in-real-backends). Until it is set, the site runs in demo mode; set `SITE_MODE` to `live` once the endpoint is real.

## Project structure

```
src/
  config/        site.ts, launch.ts, og.ts          identity, phases, social cards
  data/          product.ts, launch-plan.ts, …      facts and plans (no facts in pages)
  lib/           url, storage, analytics, sound, cart, waitlist
  styles/        tokens.css, global.css             OKLCH tokens, night/day worlds
  layouts/       BaseLayout.astro
  components/    shared + feature folders (dial/, plan/, games/, …)
  scripts/       client TypeScript; dial/ owns the 3D and haptics engine
  pages/         routes: /, /shop/, /specs/, /profiles/, /integrations/, /story/,
                 /support/, /press/, /changelog/, /crack/, /daily/, /for/<audience>/,
                 /l/tease|waitlist|reserve|launch/, /legal/*, /launch-plan/
public/          favicon, manifest, robots, static assets
docs/            LAUNCH_PLAN.md, OPERATIONS.md, research/
```

Before designing anything, read [`AGENTS.md`](AGENTS.md) (engineering rules), [`PRODUCT.md`](PRODUCT.md) (who it's for, voice) and [`DESIGN.md`](DESIGN.md) (visual system).

## Quality gates

- `npm run check` with 0 errors and a clean `npm run build` on every pull request.
- `npm run test`: Playwright smoke tests and axe checks. Target: WCAG 2.2 AA, zero axe violations, every dial keyboard-operable, reduced motion honored, sound opt-in.
- Performance budgets: LCP under 2.0 s at p75 on mobile, CLS under 0.05, INP under 150 ms, about 30 KB of brotli JavaScript for the page shell, 3D loaded after first paint.
- Content is readable without JavaScript and without WebGL.

## Docs

- [docs/LAUNCH_PLAN.md](docs/LAUNCH_PLAN.md): goals, positioning, pricing, the five phases, funnel targets, channels, week-by-week calendar, experiments, risks and the phase switch. Interactive version at [`/launch-plan/`](https://alexmorrison12.github.io/detent/launch-plan/).
- [docs/OPERATIONS.md](docs/OPERATIONS.md): running the site after launch.
- [docs/research/BUILD_BRIEF.md](docs/research/BUILD_BRIEF.md): the research synthesis behind the build.

## Credits and licensing

- Type: [Archivo](https://github.com/Omnibus-Type/Archivo) by Omnibus-Type and [Martian Mono](https://github.com/evilmartians/mono) by Evil Martians, both under the SIL Open Font License 1.1, self-hosted via Fontsource.
- Built with [Astro](https://astro.build) (MIT) and [three.js](https://threejs.org) (MIT).
- The haptic idea owes a debt to Scott Bezek's open-source [SmartKnob](https://github.com/scottbez1/smartknob).
- App names on the site (DaVinci Resolve, Ableton Live, Figma, VS Code and others) are trademarks of their owners and describe compatibility only. No affiliation or endorsement is implied.
- Tester notes on the site are illustrative personas for a concept product.
- There is no license file yet; until one is added, the site's code and content are all rights reserved.
