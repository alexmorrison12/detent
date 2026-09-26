# READ FIRST: how to use the research brief below

The research brief was written before our design system and scaffold were committed. **Where it conflicts with PRODUCT.md, DESIGN.md, AGENTS.md, src/config/* or src/data/*, those files win.** Specifically:

- **Visual system:** use DESIGN.md: Archivo Variable (width axis is the signature) + Martian Mono for readouts, graphite/day worlds, **tally** `oklch(0.636 0.218 355.3)` as the one signal color, `--feel-*` colors per profile. IGNORE the brief's Mona Sans / JetBrains Mono / `--ink --paper --signal` orange palette.
- **Product facts:** use src/data/product.ts: Ø72 mm base / Ø58 mm knob / 412 g / 1.43″ AMOLED; six profiles (ratchet, fluid, spring, clock, wall, magnet); finishes raw/graphite/glacier + tally (Founders only); **$349** / Founders **$449** (numbered 0001–2000, walnut plinth) / **$299 launch price**; **60-day studio trial**, 3-year warranty. IGNORE the brief's brass finish, $399 Founders, $49 deposit, 100-day returns, Ø36/Ø50 dimensions.
- **Launch:** use src/config/launch.ts: **$20 refundable deposit** (Founders $50), dates, batches (Feb/Apr 2027), phase CTAs. Routes are ours: `/l/tease/ /l/waitlist/ /l/reserve/ /l/launch/`, `/shop/` (configurator + cart drawer + checkout demo), `/profiles/` (feel library), `/crack/`, `/daily/`, `/for/<audience>/`, `/specs/ /integrations/ /support/ /story/ /press/ /changelog/ /legal/* /launch-plan/`. Map the brief's `/configure` → `/shop/`, `/launch/*` → `/l/*`, `/feels` + `/f/` feel links → `/profiles/` (with `#v1.<payload>` fragments), `/toy` → the home hero / `/profiles/` feel station, `/pass` → the waitlist success state.
- **Mode:** `MODE` from src/config/launch.ts is `'demo'` by default. In demo mode: forms go through `@/lib/waitlist` (nothing leaves the browser, and every form shows a `.concept-note`); **no invented queue positions or counts**; **JSON-LD omits Offer/price objects unless MODE === 'live'** (Product + specs are fine); checkout is a clearly labelled demo.
- **Honesty:** TESTER_NOTES are illustrative personas for a concept product. If you show them, label them plainly (e.g. "Illustrative notes from early-tester personas"). No real publications, no press logos, no fake counters.
- **Tooling:** no new npm dependencies (no zod, detect-gpu or invokers-polyfill). Use small hand-written equivalents: clamp-and-validate functions, simple GPU tiering, and feature detection with graceful fallbacks.
- **Adopt from the brief:** honest urgency, prerender-safe side effects (`document.prerendering`), bfcache-safe (no `unload`), and the 3D loading, physics, audio and tiering recipes. Also adopt the accessibility specifics (APG slider, ±44 px buttons, wheel only when focused or hovered, 4 Hz announcement throttle), Feel Links, Founder Pass (holographic foil tilt), Record 6s clips, Daily Detent, "What it can't do (yet)", credit to the open-source SmartKnob project as inspiration, and the avoid list.

---

# Detent One: Build Brief

**Stack:** static Astro multi-page app (MPA), TypeScript, light-DOM web components, and three.js **r186.1 pinned exactly**. It deploys to GitHub Pages through `withastro/action`. The site ships with `mode: 'demo'`. Detent One is a concept product, so every number on the site is either real or labelled "Demo data".

## 1. North star

- **The product is the interface.** A single global `<detent-dial>` controls the site. It dispatches `detent` CustomEvents shaped `{index, profile, velocity, atEndStop}`, and each section maps rotation to exactly one parameter. The dial never blocks a task: anything the dial does, a button and the keyboard can also do.
- **HTML first, platform-native, with 3D on top.** The site is a true multi-page app with no client router (no ClientRouter, Swup or Barba). Use cross-document View Transitions, Speculation Rules, popover, `<dialog>` and invoker commands, and CSS scroll timelines. The LCP element is an AVIF poster, and three.js loads after it. Any fact shown in WebGL must also exist in semantic HTML.
- **One source of truth.** These three files generate the copy, CTAs, JSON-LD, feeds, OG images, `.ics` files and speculation rules:
  - `src/config/launch.ts`: phase, mode, UTC timestamps, batches, prices, `revealAt`, targets
  - `src/data/product.ts`
  - `profiles/*.json`

  Changing phase means editing the config and running a scheduled rebuild. Nothing is hard-coded in pages.
- **Honest by construction.** No invented counts, reviews, timers or scarcity. `<live-count>` requires `{source, asOf}` and fails the build if given a literal number. Every promise (pay once, no subscription, local-first, price lock, one-click refund) lives in versioned `/policies` pages with a changelog. Our audience is skeptical creators, and trust is part of what the premium price buys.
- **Play is the funnel, and every share is playable.** The toy is free and needs no email. Rewards are craft and identity (feel profiles, display faces, serial numbers), never discounts. Treat accessibility and performance as product features, and win the developer sub-scores that recent winners lost (Igloo, Site of the Year 2024, scored 6.6 on Accessibility).

## 2. Signature moments

**Art direction baseline.** The theme is dark-first with two colours plus one signal:
- `--ink: oklch(.16 .012 255)`
- `--paper: oklch(.97 .006 85)`
- `--signal: oklch(.70 .19 42)`, used only for Reserve and live states

`--profile-hue` (Ratchet 85, Fluid 210, Spring 150, Clock achromatic, End-stops 330) appears only on the round display, the LED ring and a 1px progress rule. Surfaces are opaque, with 1px `color-mix` hairlines. Type is Mona Sans variable (wght/wdth) plus JetBrains Mono for tabular readouts, with a size-adjusted fallback face. Lighting sets the mood of each section: a cold studio for engineering and a warm desk for workflows.

**1. Turn the page** (home hero; reused on `/configure` and `/for/*`)
- **Mechanic:** drag, flick, mouse wheel or arrow keys turn the knob. A registered `@property --dial`, scoped to the hero, drives three things:
  - the weight of the headline word "Feel" (`wght` 200 to 900, inside a fixed-width inline-block so nothing reflows);
  - the profile accent colour;
  - the key light's azimuth, so reflections sweep as the knob turns.

  The round display shows the current detent index. `view-transition-name: dial` makes the knob fly between pages.
- **Fallback:** AVIF poster, a native range input and −/+ buttons that fire the same events.
- **Why:** one physical idea is the pattern behind recent Sites of the Year (Messenger, Bruno Simon's folio), and it makes a 10-second clip.

**2. Five feels in ten seconds** (home section 2, `/feels/[slug]`, `/for/*`)
- **Mechanic:** chips wired with invoker commands (`commandfor="dial" command="--profile-ratchet"`) switch between Ratchet 24, Fluid, Spring-return, 12-click Clock and End-stops ±135°. The physics, synthesized click, display face and base tick ring all change together. On Android each detent also vibrates.
- **Fallback:** sound plus a visual tick flash, with captions for the audio.
- **Why:** it demonstrates software-defined feel, which is what justifies $349. The third profile change triggers email capture.

**3. The teardown** (home section 3, `/specs`)
- **Mechanic:** a single fixed canvas sits behind the DOM sections. Scroll progress separates the parts in this order: glass → 1.28″ display → CNC 6061-T6 shell → BLDC gimbal motor → 14-bit encoder (16,384 positions/rev) → PCB → weighted base.
  - Part labels are `popover=hint` elements anchored to projected `<span>`s.
  - Cap the pinned section at 250vh.
  - Only the camera is damped (lerp 0.1); scroll itself is never damped or hijacked.
  - Below 480px wide, the labels become a stacked list.
- **Fallback:** a 60-frame AVIF image sequence on tier-1 devices, or a static exploded poster. The spec `<dl>` is always rendered.
- **Why:** engineering proof is the case for the premium price (as on iyO's Site of the Day).

**4. Turn to Reserve** (`/launch/reserve`, `/configure`)
- **Mechanic:** three detents, then a virtual end-stop thud (140 Hz tone, 4px overshoot, `vibrate([12,40,12])`) arms the CTA with a signal-colour fill.
- **Fallback:** the plain "Reserve for $49 · fully refundable" button is always visible and works on the first click.
- **Why:** a memorable commitment ritual in the spirit of Playdate's "crank to buy", without blocking anyone.

**5. Feel Links** (`/f/[archetype]/#v1.<payload>`)
- **Mechanic:** any feel profile is encoded into the URL fragment as JSON, compressed with deflate-raw and base64url-encoded, in 200 characters or fewer.
  - Decode it through a versioned zod schema and clamp every numeric value, so a hostile link can't produce harmful audio or vibration.
  - Link unfurls show the archetype's OG image (Satori + resvg at build); the page itself loads the exact feel.
  - CTAs: "Feel this", "Remix", "Reserve one that feels like this".
- **Fallback:** an invalid payload loads the archetype.
- **Why:** the shared thing is the demo itself (the Wordle and CodePen loop). It needs no server and stays private by default, because fragments never reach a server.

**6. Founder Pass** (`/pass`, shown after signup and again after a deposit)
- **Mechanic:** the pass is rendered in the browser with OffscreenCanvas at 1200×630 and 1080×1920. It shows:
  - the handle the user typed;
  - their finish;
  - a generative "feel signature" ring;
  - a pass ID (`DEMO-7K3Q` style in demo mode).

  The `File` is regenerated whenever the pass changes, so `navigator.share({files})` can run synchronously inside the click. A holographic foil uses an `@property` conic-gradient with `color-dodge` and follows pointer tilt. After a deposit it becomes the Reservation Pass and shows the chosen Founders serial, which is also engraved as a decal on the 3D model's underside. Collecting all five Launch Week stamps unlocks a holo finish.
- **Fallback:** `share({url})` → `clipboard.write(ClipboardItem png)` → `<a download>`.
- **Why:** identity plus an honest limit (the Vercel and Supabase ticket loop).

**7. Record 6s** (`/toy`, `/configure`, Feel Links)
- **Mechanic:** `canvas.captureStream(60)` plus an audio track from `createMediaStreamDestination()` feed MediaRecorder. Record MP4 (`avc1.42E01E,mp4a.40.2`) when `isTypeSupported` allows it, otherwise WebM VP9/Opus. Burn the site URL into the frames as a watermark and lower DPR while recording. `/toy?clean=1` gives a chrome-free view with a 9:16 safe area.
- **Fallback:** hide the button where recording is unsupported.
- **Why:** hardware goes viral through short video (the SmartKnob reveal, Flipper Zero).

**8. Daily Detent** (`/daily`)
- **Mechanic:** each day you hear (and on Android feel) a hidden profile and identify it in five tries.
  - The seed is the UTC epoch day, and answers are stored as SHA-256 hashes.
  - The share text looks like `Detent #37 ●●◐○○ 3/5 <url>/daily`.
  - Streaks get one free freeze a week, and nothing is framed as a loss.
  - Tries 3 to 5 show torque-curve hints.
  - The end screen offers "Feel today's profile in the configurator".
- **Why:** a daily habit that teaches the vocabulary (detent density, end-stops) that justifies the price.

## 3. Conversion system

**Editions.** Two real editions, no decoy tier:
- **Detent One, $349:** Raw Aluminum or Anodized Graphite.
- **Founders Edition, $399:** $50 more for an exclusive machined Brass finish, a laser-engraved serial from #0001 to #2000, and a Batch 1 ship window.

The default selection is explicit. Show a "Most reserved" label only once real data supports it.

**Price block, in this order:**
1. Price.
2. Pill: "Pay once · No account · No subscription · Works offline".
3. "100-day returns, free both ways · 3-year warranty".
4. A calendar delivery date ("Arrives Mar 17–20"), never "Q1".
5. The BNPL line, in the live phase only, through Stripe's Payment Method Messaging Element.
6. Anchor line: "Replaces a jog wheel, a MIDI encoder and a macro pad."

Put the cost-per-use figure (about $0.28 per workday over 5 years) in a tooltip only, and A/B test it.

**Premium proof stack:**
- exact specs (6061-T6, 16,384 positions/rev, latency in ms, detent torque in mN·m);
- a one-take, unedited hardware video with a visible latency readout;
- a "What it can't do (yet)" section;
- credit to Scott Bezek's open-source SmartKnob;
- GitHub stars baked in at build and refreshed by a scheduled Action;
- a `/repair` parts price list;
- "Updates for 7 years, SDK forever open";
- a monthly `/progress` log;
- a founder letter signed by a named person.

**Demo mode vs live mode.** Waitlist and reservation logic sit behind adapter interfaces.
- **DemoAdapter** stores data in localStorage behind the banner "Concept demo: nothing was sent". Checkout is a `<dialog>` watermarked "Demo, no charge".
- **LiveAdapter** calls `/api/*` on a Cloudflare Worker backed by Stripe:
  - the $49 deposit is a captured charge, not an authorization hold, created with `setup_future_usage:'off_session'`;
  - cancellation is one click and calls `refunds.create`;
  - serials are held atomically for 10 minutes during checkout;
  - delay-notice emails follow the FTC Mail Order Rule (16 CFR 435).

**Analytics.** Use cookieless analytics (Plausible or Umami), so no consent banner is needed. Tag referrers from chatgpt.com, perplexity.ai, gemini.google.com and Copilot as `channel=ai`. Never fire analytics during prerender.

**Funnel by phase**

**Tease** (`/launch/tease`)
- **CTA:** "Get early access".
- **Offer:** eligibility for the first reservation wave and first pick of serials. No discount.
- **Friction reducers:**
  - The toy never asks for an email.
  - The capture sheet is a non-modal `<dialog>` taking at most 30% of the viewport. It opens after 3 profile changes or at 60% scroll depth.
  - Step 1 is a single tap: Editing / Music / 3D & Design / Code / Streaming. The answer segments the email list and routes the visitor to `/for/<segment>`.
  - Step 2 is the email field.
  - Show it at most once per session, suppress it for 30 days after dismissal, and leave a small teaser pill behind.
- **Trust:** manifesto, named founder, SmartKnob credit, `/honest`.
- **Urgency:** only a real date. Offer an `.ics` for the reservation opening, generated from `launch.ts`.
- **Targets:** 5% of cold visitors and 12% of warm visitors sign up. At least 70% confirm their email, prompted by "Confirm to lock your place".

**Waitlist** (`/launch/waitlist`, `/pass`)
- **CTA:** "Share your pass".
- **Milestone rewards:**

  | Verified referrals | Reward |
  |---|---|
  | 1 | Referral Ratchet profile, playable immediately |
  | 3 | First-wave 72-hour priority window |
  | 10 | Choose a Founders serial before the public |
  | 25 | Engraved knob face |

  The invited friend also gets the Founders display face.
- **Referral rules:** a referral counts only after the friend confirms their email. Referral codes are 8 characters of Crockford base32 from `crypto.getRandomValues`, passed as `?ref=`, and never derived from the email address.
- **Queue position:** show one only if it maps to a real batch. Demo mode shows no position at all.
- **Targets:** at least 15% of signups refer someone; k-factor 0.3–0.5.

**Reserve** (`/launch/reserve`)
- **CTA:** "Reserve for $49 · fully refundable".
- **Offer:**
  - the deposit is credited in full to the order;
  - price lock ("Your $349 is locked, even if tariffs move the store price");
  - the batch ship window;
  - a Founders serial picker (an accessible radio `<fieldset>`).
- **Friction reducers:** guest checkout, express wallets, and terms in a `<dialog>`. Next to the button: "Refundable in one click any time before your Detent ships. Refunds land within 7 working days."
- **Trust:** batch meters from real counts with an `asOf` timestamp, e.g. "Batch 2 · 1,000 units · ships by Mar 14 2027".
- **Urgency:** a 72-hour priority window per wave, enforced server-side. Founders pricing ends when #2000 is reserved or when the store opens, whichever comes first.
- **Targets:** 15% of verified waitlisters reserve within 14 days; 8% of reserve-page visitors; deposit refund rate under 10% (internal assumption).

**Launch** (`/launch/live`, T0)
- **CTA:** same as Reserve.
- **Content:** creator videos go live at the embargo lift, each with its disclosure. Every reserver gets 2 single-use Skip Passes that expire at T+14.
- **Target:** at least 80% of deposits convert to a paid balance.

**Live store** (`/configure` acts as the product page)
- **CTA:** "Buy, $349", with the Express Checkout Element (Apple Pay, Google Pay, Link, PayPal) directly underneath.
- **Checkout:**
  - no cart; accessories are one-tap order bumps inside checkout;
  - guest checkout with no more than 8 fields;
  - a passkey is offered only after purchase;
  - the build is saved to the URL and localStorage.
- **Targets:** sitewide conversion at least 2.5%; buy-click rate at least 8%; checkout completion at least 60%; abandonment below 60%.

## 4. Platform feature matrix

| Feature | Where | Support (Sep 2026) | Fallback |
|---|---|---|---|
| Cross-document View Transitions (`pageswap`/`pagereveal`, types) | Dial morph between pages; `zoom-in` for card → detail; `forward` for funnel steps | Chromium 126+, Safari 18.2+ | Normal navigation |
| Speculation Rules (inline script) | Prerender `/*` at moderate eagerness, excluding `/launch/reserve*`, `?ref=` and `[data-no-prerender]`; the next funnel step comes from config | Chromium | None. Gate side effects on `document.prerendering` |
| Scroll-driven animations | Reveals, reading hairline | Chrome 115+, Safari 26+; Firefox behind a flag | Content visible in its end state |
| Popover, `<dialog>`, invoker commands | Settings, terms, share sheet, capture sheet, profile chips | Baseline | invokers-polyfill, loaded only when detection fails |
| `closedby`, `popover=hint`, `interestfor` | Light dismiss, glossary hints, integration cards | Partial | Backdrop click handler; open on click |
| Anchor positioning (core) | 3D hotspots, tooltips | Baseline since Jan 2026 | Centred popover |
| `@starting-style`, `<details name>`, `::details-content` | Popover entrances, FAQ | Baseline | Instant |
| `interpolate-size` | Accordion height | Chrome only | Opens instantly |
| `appearance: base-select` | "Map it to your app" list | Chrome, Safari 27 | Native select. Finishes stay radio swatches |
| `text-wrap`, `text-box` trim, `sibling-index()` | Type, tick rings, stagger | Baseline 2024 to Aug 2026 | Build-time `--i`/`--n` |
| OKLCH, `light-dark()`, `contrast-color()`, `color-mix()` | `@layer tokens`; finish, profile and audience hues | Baseline | Earlier declaration; sRGB before P3 |
| Container style queries + `[data-phase]` | Phase-driven component variants | Baseline since May 2026 | None needed |
| `scroll-state(stuck)` | Sticky Reserve bar | Chromium | IntersectionObserver sentinel setting `data-stuck` |
| Navigation API | `/configure` URL state, filters, transition direction | Baseline | `history.replaceState` |
| WebGPU via `three/webgpu` | 3D | About 87% | Automatic WebGL2 |
| Vibration API | Detent ticks | Android only | Audio |
| Web Share Level 2 (files) | Pass, clips | Safari, Chromium | Clipboard, then download |
| MediaRecorder | Record 6s | All browsers (MP4 or WebM) | Hide the button |
| AR Quick Look (`rel=ar`) | "View on your desk" | iOS | Hidden |
| Web Serial | `/setup` after shipping | Chromium desktop, Firefox 151 | Simulated device |
| Service Worker + Static Routing | Cache hashed `/_astro/*` files and fonts | Routing in Chromium and Safari 27 | Navigation preload |
| `scheduler.yield()` | Work after input | Chrome, Firefox | `setTimeout(0)` |

## 5. 3D/WebGL spec

**Renderer**
- Import only from `three/webgpu`; never mix in plain `three`.
- Write all shading in TSL and post-processing with `RenderPipeline`. ShaderMaterial, `onBeforeCompile` and EffectComposer are not allowed.
- Call `await renderer.init()` before rendering.
- `?gl` sets `forceWebGL` for QA.
- Send `renderer.backend.isWebGPUBackend` to real-user monitoring.
- Use one renderer per page.
- Use `setAnimationLoop` with `Timer`.

**Loading**
- The poster is a `<picture>` with AVIF, WebP and JPEG sources at 1x and 2x, marked `fetchpriority=high`, inside an `aspect-ratio` stage. It is rendered from the same camera as the 3D scene's first frame.
- Boot the 3D module on the `load` event through `requestIdleCallback` (timeout 2,500 ms), or earlier on `pointerenter`, `focusin` or `touchstart` over the stage.
- Never boot while `document.prerendering` is true.
- Don't auto-boot on Save-Data, `deviceMemory < 4` or tier 0. Show a "Turn it in 3D" button instead.
- Boot sequence: build the scene, run `compileAsync`, build the PMREM (yield between steps), render one frame, then crossfade over 240ms (instant under reduced motion).
- No preloader: all geometry is procedural, so there is nothing to download.

**Geometry and materials**
- **Geometry:**
  - Built in meters (knob Ø36mm, base Ø50mm).
  - A lathe top ring with 256 segments, 0.5mm 45° chamfers, a separate open cylinder for the knurl, and an index dot so rotation reads clearly.
  - `toCreasedNormals` at 30°.
  - The display and glass sit in a group that does not rotate with the knob.
- **Environment:**
  - RoomEnvironment through PMREM plus two emissive strips.
  - No punctual lights.
  - `NeutralToneMapping` at exposure 1.0.
- **Material recipes:** all MeshPhysicalMaterial with metalness 1.

  | Part | Colour | Roughness | Anisotropy | Notes |
  |---|---|---|---|---|
  | Spun top | #d4d6da | .28 | .9 | |
  | Chamfers | — | .12 | .6 | |
  | Knurled side | — | .38 | .5 | TSL diamond knurl (T=120, R=8, fwidth fade); a 1.3 KB PNG normal map on WebGL |
  | Base | — | .5 | 0 | Bead-blasted |
  | Graphite finish | #2a2c30 | .5 | — | |
  | Brass finish | #c9a25e | .3 | .8 | |

- **Glass:** black, roughness .02, opacity .25, clearcoat 1, IOR 1.52. No transmission.
- **Display:**
  - A 480² CanvasTexture in sRGB with no mipmaps and `toneMapped:false`, updated only when state changes.
  - One shared `drawDisplay(ctx, state, profile)` also draws the 2D cards and OG images.
- **Shadow and bloom:**
  - The contact shadow is baked once.
  - Bloom runs on the display only, and only on tier 3 with WebGPU; every other tier uses a halo sprite.

**Physics and feedback**
- **Physics:**
  - `packages/feel-core` (no DOM) mirrors SmartKnob's config (`position_width_radians`, `detent_strength_unit`, `endstop_strength_unit`, `snap_point` 1.1, `min/max_position`, `detent_positions`), so the web demo and the firmware share one JSON format.
  - Fixed timestep 1/240 s with at most 8 substeps.
  - Detent stiffness K ≈ 2,500 s⁻², damping ζ .55 for clicky profiles and 1.0 for fluid ones; end-stops use 4K.
  - The knob follows the pointer through a coupling spring (K_c ≈ 5,000, raised with speed), never at a 1:1 angle.
  - Pointer angle is `atan2` around the knob's projected centre, using `getCoalescedEvents()`.
  - Release velocity comes from a fit over the last 80 ms, capped at 25 rad/s, with friction τ = 0.4 s.
- **Audio:**
  - One `AudioContext({latencyHint:'interactive'})`, created on the first `pointerdown`.
  - Clicks are pre-rendered with OfflineAudioContext at `ctx.sampleRate`:

    | Profile | Recipe |
    |---|---|
    | Ratchet | Noise through a 3.5 kHz bandpass (Q 8) |
    | Clock | 1.8 kHz |
    | Fluid | Low-passed noise with gain following angular velocity |
    | Spring | Sine whose pitch rises with deflection |
    | End-stop | 140 Hz thud, 80 ms |

  - Add ±3% random jitter and allow at most one voice per 12 ms.
  - Never set `audioSession.type='playback'`, which would pause the user's music and override the silent switch.
  - Sound stays off until the user taps a "Hear the detents?" chip.
- **Haptics:**
  - Android: `vibrate(10)` per detent, at least 40 ms apart.
  - iOS: a trusted-tap switch overlay on discrete buttons only, behind the `haptics.iosSwitch` flag so it can be removed in one line.

**Loop and quality tiers**
- Render on demand: a dirty flag starts the loop, and it stops once motion settles. Pause when the stage leaves the viewport (IntersectionObserver) and on `visibilitychange`.
- Tiers:

  | Tier | Settings |
  |---|---|
  | T0 | Poster only |
  | T1 | DPR 1.0 on phones and 1.25 on desktop, no antialiasing, no anisotropy |
  | T2 | DPR 1.5, MSAA |
  | T3 | DPR 2, display bloom |

- Pick the starting tier with detect-gpu, self-hosting its benchmark files.
- A frame-time governor steps down when p90 frame time exceeds 1.25× budget for 2 s, steps up after 5 s below 0.6×, locks after two direction flips, and applies changes only once the dial settles.

**Performance budgets (enforced in CI)**
- p75 on mobile: LCP ≤ 1.8 s, INP ≤ 150 ms, CLS ≤ 0.02.
- JavaScript: site shell ≤ 30 KB brotli; 3D chunk ≤ 210 KB brotli.
- Poster ≤ 25 KB at 1x.
- GPU: at most 20 draw calls, 60k triangles and 48 MB of VRAM. p90 frame time while dragging ≤ 12 ms on a Pixel 6a-class phone. Zero frames rendered while idle.
- Checks: Lighthouse mobile Performance ≥ 90, and Accessibility, SEO and Best Practices at 100. axe reports zero violations.

**Accessibility**
- A transparent circular hit area sits over the knob's projected position. Only that element gets `touch-action:none`; the rest of the hero keeps `pan-y`. The canvas is `aria-hidden`.
- Inside the hit area, use a visually hidden `<input type=range>` for bounded profiles and `role=spinbutton` for unbounded ones.
- `aria-valuetext` uses the audience's language, e.g. "Frame 42 of 240" for editors.
- Keyboard follows the APG slider pattern.
- −/+ buttons are at least 44px.
- The wheel turns the dial only while it is focused or hovered, and releases the page scroll at an end-stop.
- Announcements are throttled to 4 Hz or less during flicks.
- Under reduced motion there is no inertia, no attract spin and no camera drift.
- If the GPU context is lost, show the poster again and rebuild at most twice.
- On `pagehide`, stop the render loop and suspend audio. Register no `unload` handlers, so back/forward cache keeps working.

**Asset pipeline**
- A noindex `/_render` route is driven by Playwright (SwiftShader, `forceWebGL`). It produces posters for each finish, audience and phase; 1200×630 JPEG OG images; and golden images compared with pixelmatch at 0.5% tolerance whenever three.js is upgraded.
- GLTFExporter and USDZExporter produce a GLB and USDZ per finish, used for AR and for the structured-data 3D model.

## 6. Agent-ready commerce

- **Structured data.** `src/lib/schema.ts` builds JSON-LD from the same config files the UI uses:
  - **ProductGroup** `DT1`, varying by color and material. Each variant carries `sku`, `mpn`, `material: '6061-T6 aluminum'`, and a `subjectOf` 3DModel pointing to the GLB.
  - **Founders Edition** as its own Product.
  - **Organization** with `hasMerchantReturnPolicy`: 100 days, return by mail, free returns.
  - **BreadcrumbList** on the `/for`, `/feels` and `/integrations` pages.
- **Offers only in live mode.** `Offer` objects (availability PreOrder, then InStock; `availabilityStarts`; `OfferShippingDetails`) are emitted only when `mode:'live'`. Demo mode omits offers, so nothing claims a real sale. There is no `aggregateRating` until real reviews exist. CI validates the markup.
- **Feeds.** Generated at build:
  - `/feeds/openai.jsonl`: `pre_order`, `enable_search:true`, `enable_checkout:false`;
  - `/feeds/google.xml`;
  - `/.well-known/ucp.json`: catalog only;
  - `public/.nojekyll`, so GitHub Pages serves the dot-directory.

  Feeds are submitted to platforms only in live mode.
- **Agent handoff URLs.** Every build is a deterministic, crawlable URL such as `/configure/?finish=graphite&edition=founders&feel=ratchet-24`. An AI agent can hand a buyer a pre-configured page, and checkout stays on our site.
- **llms.txt.** `/llms.txt` and `/llms-full.txt` are generated from the SDK docs only, for coding agents, not as an SEO measure. The FAQ is written as question-shaped HTML. A `/agents` page documents the feeds.

## 7. Avoid list

- SPA routers, including Astro's ClientRouter with `transition:persist`, which loses the WebGL context on Safari (Astro issue #15727).
- Smooth-scroll libraries, scroll-jacking, and pinned sections longer than 300vh.
- A canvas as the LCP element, three.js in `<head>`, full-screen preloaders, and intro animations that replay for returning visitors.
- Continuous rendering, uncapped DPR, live shadow maps, downloaded HDR/EXR environments, dark environments for metal, ACES tone mapping, stacked post-processing effects, and Spline runtime embeds.
- Text or UI that exists only in the canvas, and content hidden until a scroll animation reveals it.
- Fake timers, invented counters, "X people viewing" widgets and invented queue positions. Also fabricated reviews, testimonials or press logos, and a decoy third tier.
- Discount popups, spin-to-win wheels, confirmshaming, pre-checked add-ons, email walls, and full-screen or exit-intent popups.
- Forced accounts, a cart page for a single product, authorization holds used as deposits, hard-to-cancel flows, and "ships Q1".
- Subscriptions or cloud lock-in, and silent edits to published policies.
- Promising iPhone haptics, autoplaying audio, and creating an AudioContext per click.
- Prerendering reservation, checkout or `?ref=` URLs; analytics firing during prerender; `unload` handlers.
- Chromium-only features without `@supports` guards; glassmorphism over WebGL; gradient blobs; bento filler; cursor followers; marquees; split-letter kinetic type.
- Personal data in URLs, and runtime dependencies loaded from third-party CDNs.

## 8. Launch plan inputs

**Sequence.** T0 is launch day: public reservations open and the creator embargo lifts at 9am PT on a Tuesday, Wednesday or Thursday.

| When | What |
|---|---|
| T−35 | **Tease.** A deliberate "leak" of the silhouette only. Launch the dial toy, the manifesto and email capture. Run a weekly cipher-trail chapter: skill-based, with cosmetic rewards only. Brief 60–100 creators across the five audiences. Their contracts require disclosure and allow negative reviews. |
| T−21 | **Waitlist.** Referral milestones, Founder Pass, Feel Links and Daily Detent. Open Discord only once about 200 members are seeded; onboarding asks "What will you turn?" and gives one invite code per audience. |
| T−14 | **Show HN.** Open-source the SDK and link the repo, not the shop. The founder answers every comment. |
| T−7 to T−3 | **Launch Week.** Reveals: Feel Engine, The Face, Integrations, Creator Profiles, Founders & Price. A GitHub Actions cron (scheduled 15 minutes early) rebuilds the site, and `revealAt` filtering keeps unrevealed content out of the bundle. |
| T−3 | **Priority wave.** People with 3 or more referrals get a 72-hour window. |
| T0 | **Public reservations.** Embargo lifts; unedited demo video goes live. |
| T+1 | **Product Hunt** at 12:01am PT, with the maker comment including a Feel Link. |
| T+2 | **Discord AMA.** |
| T+14 | **Skip Passes expire.** |

Deposits must open no more than 30 days after the tease peak.

**Before charging Batch 1 balances:** send 20–50 production units to independent reviewers. Their reviews publish while cancellation is still open.

**Channels:**
- Owned: site, segmented email, GitHub, Discord.
- Hacker News and Product Hunt.
- Creators on YouTube, TikTok and X.
- Communities (following each one's self-promotion rules): editors, music producers, Blender artists, streamers, and the SmartKnob community.
- Hardware press (Hackaday, The Verge).
- A `/press` kit: 4K B-roll, GLB/USDZ models, WAV sound packs, fact sheet.
- Capped paid cold traffic, used only to validate the 5% tease benchmark.

**KPIs:**
- Signup rate by phase, confirmation rate, referral rate and k-factor.
- Feel Link opens per share, clips recorded and shared, Daily Detent return rate.
- Waitlist-to-deposit conversion within 14 days, deposit refund rate, deposit-to-balance rate.
- Live-store conversion and checkout completion.
- Conversion from AI-referred traffic.
- Core Web Vitals p75, split by render tier and backend.
- Hacker News rank and whether Product Hunt features the launch.
- Reservations attributed to each creator through `?ref=`.
- Discord joins per audience invite code.

**Operating the site after launch:**
- a monthly `/progress` entry;
- a weekly "Feel Friday" featured community profile;
- community profile pull requests validated in CI;
- `/setup` over Web Serial once units ship;
- an on-device, opt-in "Detent Year" recap.