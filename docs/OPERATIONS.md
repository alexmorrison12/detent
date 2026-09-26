# Operating the Detent site

**Version 1.0 · Revised 26 Sep 2026 · Takes over from [LAUNCH_PLAN.md](LAUNCH_PLAN.md) on Fri 4 Dec 2026, when the site flips to the Live phase.**

After launch the site is a store with one product, a feel library, two daily games and a community that ships profiles. Running it well is mostly rhythm: look at the same numbers every week, fix the page the numbers point at, ship small, write it down. This document is that rhythm.

> Detent is a concept product. Everything below describes how we would run the site for real; the sections on backends say exactly what to plug in when that day comes. Until then the site runs in demo mode and no data leaves the browser.

## Contents

1. [The rhythm](#1-the-rhythm)
2. [Weekly CRO review](#2-weekly-cro-review)
3. [Funnel dashboard](#3-funnel-dashboard)
4. [Content operations](#4-content-operations)
5. [Release process](#5-release-process)
6. [SEO and agent readiness](#6-seo-and-agent-readiness)
7. [Support loop](#7-support-loop)
8. [Seasonal campaigns](#8-seasonal-campaigns)
9. [Plugging in real backends](#9-plugging-in-real-backends)
10. [Quarterly roadmap for the site](#10-quarterly-roadmap-for-the-site)
11. [Who owns what](#11-who-owns-what)

---

## 1. The rhythm

| Cadence                     | Ritual                         | Who                                                         | Output                                                                 |
| --------------------------- | ------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| Daily, 09:30 PT             | Support triage                 | Support lead                                                | Every ticket tagged with one FAQ topic; refunds processed the same day |
| Monday, 10:00 PT            | CRO review (45 min)            | Growth lead (chair), design engineer, support lead, founder | Ship, kill or start one test; one page fix assigned                    |
| Tuesday to Thursday         | Release window                 | Design engineer                                             | Deploys between 09:00 and 15:00 PT only                                |
| Wednesday                   | SDK office hours in `#sdk-dev` | Firmware lead                                               | Answers, and issues filed on the SDK repo                              |
| Friday                      | Feel Friday                    | Community lead                                              | One community profile featured on `/profiles/` and in Discord          |
| First Tuesday of the month  | Progress log                   | Founder                                                     | A dated entry, even when nothing changed, until Batch 2 ships          |
| First Monday of the quarter | Roadmap review                 | Everyone                                                    | The next quarter in section 10 confirmed or rewritten                  |

## 2. Weekly CRO review

**Agenda (fixed, 45 minutes).**

1. **North star and alarms, 5 min.** Committed units this week and cumulative. Any stage under its alarm (table below) goes first and gets an owner before the meeting ends.
2. **Funnel dashboard, 15 min.** The tiles in the next section, week over week, split by channel. AI-referred traffic is always its own line.
3. **Running test, 10 min.** Sample reached? Guardrails (refund rate, support tickets) intact? Decide: ship, kill or keep running. The backlog is in [LAUNCH_PLAN.md §10](LAUNCH_PLAN.md#10-experiment-backlog).
4. **Top five support questions, 10 min.** Each one becomes a page fix or an FAQ edit (section 7).
5. **Decide and write down, 5 min.** Five lines in `#growth`: what we saw, what we changed, what we're testing next.

**Decision rules.**

- Minimum seven days per test so every weekday is in both arms. Ship at 95% confidence with no guardrail breach.
- One test per page at a time. Never test prices, urgency claims, disclosures or refund terms.
- A stage under its alarm for two weeks running gets a redesign, not another test.
- If a number can't be sourced, it doesn't go on the site. That includes “most popular”, stock levels and review counts.

**Stages and alarms** (the same numbers the plan uses; they re-baseline after the first four weeks of Live):

| Stage                  | Measured as                                 | Target |  Alarm | Published benchmark                                                        |
| ---------------------- | ------------------------------------------- | -----: | -----: | -------------------------------------------------------------------------- |
| Visit → email          | `landing view → lead_submit`                |     7% |   < 4% | Waitlist pages: 3.4% median, 8–9% top decile                               |
| Email → confirmed      | `lead_submit → email_verified`              |    70% |  < 55% | Double opt-in: 55–58% median, 70%+ top quartile                            |
| Email → referral       | `lead_submit → lead_submit (referred)`      |    15% |   < 9% | Share of signups who refer one friend: 9–10% median, 18%+ strong           |
| Waitlist → deposit     | `email_verified → reserve_submit (14 days)` |    15% |   < 8% | Waitlist to paid deposit: 5–25%, about 20% if deposits open within a month |
| Reserve page → deposit | `/l/reserve/ view → reserve_submit`         |     8% |   < 5% | Strong preorder pages: 10–20% of warm visitors                             |
| Deposit → order        | `reserve_submit → balance_paid`             |    80% |  < 70% | No public benchmark. This is our assumption; we re-baseline on Batch 1     |
| Store session → order  | `session → checkout_complete`               |   2.5% | < 1.5% | Consumer electronics stores: 1.2–2.4% sitewide                             |

<a id="funnel-dashboard"></a>

## 3. Funnel dashboard

The site ships no third-party scripts. Every interaction goes through `track(event, props)` in `src/lib/analytics.ts`, which pushes a payload onto `window.dataLayer` and dispatches a `detent:track` DOM event. Any analytics tool can listen to that (section 9.4). Nothing fires while a page is being speculatively prerendered.

**Every payload carries:** `event`, `channel` (`ai` for ChatGPT, Perplexity, Gemini, Copilot and Claude referrals; `direct`; or the referrer host), `phase` (the launch phase the visitor saw), `path`, `ts`, plus the event's own props.

**Events**

| Event               | Fires when                                | Props                                       | Status  |
| ------------------- | ----------------------------------------- | ------------------------------------------- | ------- |
| `cta_click`         | Any PhaseCTA button                       | placement, cta (<phase>:primary\|secondary) | in code |
| `banner_click`      | Announcement bar link                     | (none)                                      | in code |
| `lead_submit`       | Waitlist or tease signup succeeds         | source, segment, referred                   | in code |
| `reserve_submit`    | A reservation is placed                   | source, edition, finish                     | in code |
| `phase_preview`     | Someone previews a phase on /launch-plan/ | phase, via (dial\|link\|reset)              | in code |
| `email_verified`    | Double opt-in link clicked                | segment, referred                           | backend |
| `balance_paid`      | A deposit becomes an order at ship time   | edition, batch                              | backend |
| `deposit_refund`    | A deposit is cancelled                    | reason, days_held                           | backend |
| `checkout_complete` | The commerce provider confirms payment    | edition, finish, value                      | backend |

Declarative tracking also works: any element with `data-track="event_name"` and `data-track-*` attributes is tracked on click.

**Dashboard tiles** (one row per tile, week over week, split by `channel`):

| Tile                   | Computed as                                                                     | Watch for                                                    |
| ---------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Sessions by channel    | page views from the analytics tool, grouped by `channel`                        | AI share rising; referral hosts from creator videos          |
| Primary CTA rate       | `cta_click` where `cta` ends in `:primary`, divided by sessions, by `placement` | a placement that never gets clicked is a placement to remove |
| Lead rate              | `lead_submit` / sessions on pages with a signup form, by `source` and `segment` | segments that sign up but never buy                          |
| Referred share         | `lead_submit` with `referred=true` / all `lead_submit`                          | falls when the share artifact stops being fun                |
| Reservation rate       | `reserve_submit` / `/l/reserve/` sessions, by `edition` and `finish`            | Founders share; finish mix for the next batch order          |
| Checkout completion    | `checkout_complete` / `cta_click` with `cta=live:primary`                       | under 45% is an alarm                                        |
| Deposit refunds        | `deposit_refund` / `reserve_submit`, by `reason`                                | over 10% in any week                                         |
| Balance capture        | `balance_paid` / deposits due in the batch                                      | under 70% is an alarm                                        |
| AI-referred conversion | any of the above filtered to `channel=ai`                                       | treat as its own audience                                    |
| Core Web Vitals        | p75 LCP, INP, CLS per template from the analytics tool's field data             | LCP over 2.0 s on mobile; CLS over 0.05                      |
| Phase previews         | `phase_preview` (internal, from `/launch-plan/`)                                | exclude from every other tile                                |

## 4. Content operations

### Changelog (`/changelog/`)

- Every firmware release, every Detent Studio release and every site change a buyer would notice gets an entry: date, version, what changed, and what it means for your hands.
- **Policy changes are changelog entries.** Warranty, trial, price lock, “no subscription”, data handling. We never edit a published promise silently; the entry says what it said before.
- At most one entry a week for the site itself. Firmware entries go out with the release.

### Feel library curation (`/profiles/`)

- **Feel Friday.** One community profile a week, featured on `/profiles/` and posted in `#feel-lab`. Criteria: useful in a real app, audibly and physically distinct from the six built-in feels, physics inside the SDK's safe clamps, and the author said yes to being credited.
- **Intake.** Profiles arrive as feel links (the `#v1.<payload>` fragment) posted in Discord, or as pull requests with the profile JSON. CI validates the schema and clamps every value; a curator turns it on real hardware before merging.
- **Credit.** Every community profile shows its author's handle. Creator profiles made with a free unit show that disclosure next to the name.
- **Upkeep.** A profile that stops behaving after a firmware update is marked “needs retuning” and its author is pinged. We don't delete people's work.

### Progress log

- The first Tuesday of every month until Batch 2 ships: where manufacturing is (EVT, DVT, PVT, tooling), what moved, what's next, and the batch dates as they stand. If a date moves, the delay notice goes to reservers first and the log second.

### Facts live in one place

- Prices, specs, finishes, integrations, audiences and FAQs: `src/data/product.ts`. Phases, dates, CTA copy: `src/config/launch.ts`. Plan numbers: `src/data/launch-plan.ts`. A fact typed into a page is a bug.

## 5. Release process

1. **Branch** from `main`: `feat/<thing>` or `fix/<thing>`.
2. **Build and look.** `npm run dev`, then check the change at 1440 and 390 px, in every phase that affects it (`?phase=tease` … `?phase=live`), with reduced motion on, and with JavaScript off for anything that renders content.
3. **Open a pull request** with before/after screenshots and one line on what changes for a buyer.
4. **Required checks** (CI and locally):

   ```bash
   npm run check   # astro check: types and diagnostics, 0 errors
   npm run build   # static build to dist/
   npm run test    # Playwright smoke and axe accessibility tests against the built preview
   ```

5. **Performance budgets** on every template the change touches:

   | Metric                                              | Budget                                   |
   | --------------------------------------------------- | ---------------------------------------- |
   | LCP, mobile p75                                     | under 2.0 s                              |
   | INP                                                 | under 150 ms                             |
   | CLS                                                 | under 0.05                               |
   | JavaScript for the page shell                       | about 30 KB brotli                       |
   | 3D chunk (loaded after first paint, never blocking) | about 210 KB brotli                      |
   | Images                                              | AVIF/WebP with explicit width and height |

6. **Merge to `main`.** The Pages workflow builds with the repository variables and deploys in about two minutes.
7. **Release windows.** Tuesday to Thursday, 09:00–15:00 PT. No merges on a phase-flip day except the flip itself, and none in the two hours before it.
8. **Rollback.** Revert the commit on `main` and let the workflow redeploy, or re-run the last good workflow run from the Actions tab.

## 6. SEO and agent readiness

**Every release that adds a page**

- One `<h1>`, a specific `title` and meta `description`, `ogImage={ogPath('<slug>')}` with a matching entry in `src/config/og.ts`, and JSON-LD where it means something.
- Base-aware links through `url()`; nothing hard-coded to `/`.

**Monthly**

- The sitemap is generated by `@astrojs/sitemap` (internal pages such as `/launch-plan/`, `/render/` and `/og/` are excluded). Check it in Search Console and Bing Webmaster Tools; fix crawl errors within a week.
- Validate structured data on the product, shop and FAQ templates. `Product` data comes from `src/data/product.ts`; `Offer` objects appear only when `PUBLIC_SITE_MODE=live`; there is no `aggregateRating` until real reviews exist.
- Read the month's search queries and AI-assistant referrals. A question people keep asking becomes an FAQ entry or a paragraph on the page they landed on.

**Agent readiness, always**

- Every fact shown in 3D or canvas also exists as HTML text on the same page.
- FAQs stay question-shaped HTML.
- Configured products stay deterministic URLs, so an assistant can hand someone a ready-made build that still checks out on our site.
- When the SDK docs ship, publish `llms.txt` generated from them, for coding agents, and keep it current with each SDK release.

## 7. Support loop

- **Channels.** Email (`hello@`), and `#support` in Discord once Batch 1 ships. One queue.
- **Triage daily.** Tag every ticket with exactly one FAQ topic, the same five the site uses (`Buying`, `Shipping`, `Product`, `Software`, `Launch` in `Faq.topic`).
- **Service levels.** First reply within one business day. Deposit cancellations and refunds processed the same day (they land within 7 working days, usually minutes).
- **From tickets to the site, weekly.** Any question that shows up five or more times in a week and isn't answered on the page where it came up gets fixed there: an edit to `FAQS` in `src/data/product.ts`, or a sentence on the page itself. Next week, check that the topic's ticket count fell.
- **Macros kept current:** deposit cancellation, delay notice (FTC Mail Order Rule wording: a new date or an honest “we can't date it yet”, plus a free cancel), return label, warranty claim, spare parts (battery, foot, knob cap), “my app isn't supported”.
- **Feedback into the CRO review.** Refund and cancellation reasons are a standing item on Monday.

## 8. Seasonal campaigns

Campaigns are content, profiles and demos. **They are never discounts.** A price change, if one ever happens, is announced a month ahead in the changelog.

| When          | Moment                        | Audience                 | What we do                                                                                         |
| ------------- | ----------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------- |
| January       | NAMM                          | Music producers          | Producer feel pack, a fader-ride demo with audio, creator sessions                                 |
| February      | Batch 1 ships                 | Everyone                 | Setup guide, unboxing with no cuts, first owner profiles                                           |
| April         | NAB Show; Batch 2 ships       | Video editors            | Resolve and Premiere profile updates, a one-take trim demo                                         |
| June          | WWDC week                     | Developers               | SDK release, Xcode debugger profile, a write-up of what the community built                        |
| September     | Back to the desk              | Everyone                 | `#show-your-desk` roundup on the site, credited                                                    |
| October       | Adobe MAX, Blender Conference | Designers and 3D artists | Figma, Photoshop and Blender profile drops                                                         |
| Late November | Feel Friday, not Black Friday | Everyone                 | A new built-in feel for every owner. No sale.                                                      |
| December 1    | One year                      | Owners                   | “Year in feel”, an opt-in recap computed on the device; Founders serial wall for owners who opt in |

<a id="plugging-in-real-backends"></a>

## 9. Plugging in real backends

The site is static on GitHub Pages. Anything that stores data or takes money runs elsewhere and is wired in through build-time variables. **`PUBLIC_*` values are baked into public JavaScript: never put a secret in one.**

### 9.1 Build variables

The deploy workflow (`.github/workflows/deploy.yml`) reads three repository variables (Settings → Secrets and variables → Actions → Variables) and passes each one to `npm run build` under the `PUBLIC_*` name the code reads. The `PUBLIC_*` names are the build-time environment, not repository variables; for a local build, set them in your shell.

| Repository variable | Build environment          | Default      | Effect                                                        |
| ------------------- | -------------------------- | ------------ | ------------------------------------------------------------- |
| `LAUNCH_PHASE`      | `PUBLIC_LAUNCH_PHASE`      | `reserve`    | The phase every CTA, banner and landing page is built for     |
| `SITE_MODE`         | `PUBLIC_SITE_MODE`         | `demo`       | `live` emits `Offer` structured data and treats forms as real |
| `WAITLIST_ENDPOINT` | `PUBLIC_WAITLIST_ENDPOINT` | unset (demo) | Waitlist and reservation forms `POST` here                    |

`SITE_URL` and `SITE_BASE` come from the Pages configuration (`actions/configure-pages`), so a custom domain needs no variable. Local builds default to `https://alexmorrison12.github.io` and `/detent`; for a custom domain, build with `SITE_URL=https://detent.example SITE_BASE=/`.

### 9.2 The waitlist and reservation endpoint

`src/lib/waitlist.ts` is the only thing that talks to it. With `PUBLIC_WAITLIST_ENDPOINT` set, forms send `POST` with `content-type: application/json`:

```jsonc
// join
{ "action": "join", "email": "…", "segment": "editing", "finish": "graphite", "handle": "…", "source": "l-waitlist", "referredBy": "7K3Q9MXA" }
// → 200 WaitlistEntry
{ "email": "…", "code": "B4TR2QZN", "referredBy": "7K3Q9MXA", "segment": "editing", "joinedAt": 1792400000000, "referrals": 0 }

// reserve
{ "action": "reserve", "email": "…", "edition": "one", "finish": "raw", "source": "l-reserve" }
// → 200 Reservation
{ "id": "DT1-R-7K3Q9M", "email": "…", "edition": "one", "finish": "raw", "createdAt": 1792400000000 }
```

Any non-2xx response shows the visitor “We couldn't reach the server” and nothing is saved, so fail loudly rather than silently.

The endpoint must:

- Allow CORS from the site's origin only.
- Send a double opt-in email and count a referral only after the friend confirms.
- Mint referral codes randomly (8 characters of Crockford base32 from a CSPRNG), never derived from the email.
- Rate-limit per IP and per email domain, and store consent with a timestamp. Delete on request within 30 days.
- Return a queue position only if it maps to a real batch. Otherwise return none; the site shows none.

**What we'd build:** a Cloudflare Worker (or a Supabase Edge Function) with a small database, about 150 lines. Set its URL as the `WAITLIST_ENDPOINT` repository variable, set `SITE_MODE` to `live`, redeploy.

### 9.3 Commerce: deposits and orders

**Decision: Stripe for deposits and orders at launch.** One provider means one refund flow, one tax setup and one set of webhooks for a store that sells one product in two editions. We would revisit Shopify only if the accessory catalog grows past a handful of items and fulfilment integrations start to matter.

- **Deposits.** A Stripe Checkout Session in `payment` mode for $20 ($50 Founders), with `setup_future_usage: 'off_session'` so the balance can be charged when the unit ships. It is a **captured charge refunded on cancellation**, not an authorization hold: holds expire after 7 days. Cancel is one click and calls `refunds.create`.
- **Balance at ship.** An off-session PaymentIntent on the saved method; if strong customer authentication blocks it (UK/EU), email a confirm-your-payment link.
- **Orders (launch and live).** The shop's checkout reads the cart from `src/lib/cart.ts` and posts its lines to the Worker, which maps each line to a Stripe Price ID, creates a Checkout Session (Stripe Tax on, Apple Pay, Google Pay and Link enabled) and returns the session URL for the browser to follow.
- **Zero-backend alternative.** Shopify cart permalinks need no server: map each cart line to a variant ID and send the buyer to `https://<shop>.myshopify.com/cart/<variant-id>:<qty>,<variant-id>:<qty>`. Fine for a first test; it gives up the deposit flow above.
- **Webhooks** (`checkout.session.completed`, `charge.refunded`) write the order and fire the backend events in section 3 (`checkout_complete`, `deposit_refund`, `balance_paid`).
- **Pay over time** in the Live phase uses the provider's own messaging so the numbers always match their terms.

### 9.4 Analytics

Pick a cookieless tool (Plausible, Fathom, or self-hosted Umami) so no consent banner is needed, and serve its script from our own origin to keep the no-third-party-scripts rule. Forward our events to it with one small module loaded from `BaseLayout`:

```ts
// src/lib/analytics-forward.ts (sketch)
window.addEventListener('detent:track', (e) => {
  const { event, ...props } = (e as CustomEvent).detail;
  window.plausible?.(event, { props });
});
```

## 10. Quarterly roadmap for the site

| Quarter           | Theme                             | Ships                                                                                                                                                                                                                                |
| ----------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Q1 2027 (Jan–Mar) | Go live for real                  | Endpoints and live mode; batch meter from real counts with an as-of time; order status page; a `/setup/` page for Batch 1 owners (Web Serial, with a simulated device where unsupported); review roundup with every disclosure shown |
| Q2 2027 (Apr–Jun) | The library becomes a community   | Profile pull requests validated in CI; profile pages with author credit; creator profile pages; prices and copy for the UK, EU and Japan with duties included; “see it on your desk” AR models                                       |
| Q3 2027 (Jul–Sep) | Software you can feel, on the web | A browser profile editor that talks to the device; SDK docs site and `llms.txt`; an integrations directory whose status comes from the SDK repository; WebGPU as the default 3D path                                                 |
| Q4 2027 (Oct–Dec) | One year                          | “Year in feel” opt-in recap; anniversary campaign; opt-in Founders serial wall; the next batch or product teased only once it has a date                                                                                             |

Every quarter also: the experiment backlog keeps running, performance budgets are re-measured on a mid-range Android phone, and this document is revised.

## 11. Who owns what

| Area                                | Owner                                | Source of truth                                             |
| ----------------------------------- | ------------------------------------ | ----------------------------------------------------------- |
| Launch phase, dates, CTA copy       | Founder with the growth lead         | `src/config/launch.ts`, the `LAUNCH_PHASE` variable         |
| Plan numbers, funnel targets, tests | Growth lead                          | `src/data/launch-plan.ts`, [LAUNCH_PLAN.md](LAUNCH_PLAN.md) |
| Product facts, prices, FAQ          | Ops lead (facts), support lead (FAQ) | `src/data/product.ts`                                       |
| Feel library and Feel Friday        | Community lead                       | `/profiles/`, profile pull requests                         |
| Changelog and progress log          | Firmware lead and founder            | `/changelog/`                                               |
| Site code, releases, performance    | Design engineer                      | this repository, CI                                         |
| Backends and payments               | Ops lead                             | the Worker, Stripe dashboard                                |
