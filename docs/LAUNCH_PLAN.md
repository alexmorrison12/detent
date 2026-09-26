# Detent One: the launch plan

**Version 1.0 · Approved · Revised 26 Sep 2026 · Owners: the launch team (founder, growth, community, ops)**

Interactive version, with a dial that previews the whole site in any phase: [/launch-plan/](https://alexmorrison12.github.io/detent/launch-plan/) (noindex).
Numbers live in [`src/data/launch-plan.ts`](../src/data/launch-plan.ts); dates, CTAs and landing pages in [`src/config/launch.ts`](../src/config/launch.ts); prices in [`src/data/product.ts`](../src/data/product.ts). The tables below are generated from those files. If this document and the code ever disagree, the code wins and this document gets fixed.

> Detent is a concept product and this site is a design and engineering demonstration. The plan is written as if we were shipping for real, because that is the only way to design a launch funnel honestly. Every target is a planning number built from published benchmarks, and gets re-baselined after two weeks of real traffic.

## Contents

1. [The plan in one paragraph](#1-the-plan-in-one-paragraph)
2. [Goals and the north star](#2-goals-and-the-north-star)
3. [Positioning and who we sell to](#3-positioning-and-who-we-sell-to)
4. [Pricing](#4-pricing)
5. [Timeline](#5-timeline)
6. [The five phases](#6-the-five-phases)
7. [Funnel and KPIs](#7-funnel-and-kpis)
8. [Channels](#8-channels)
9. [Content calendar, week by week](#9-content-calendar-week-by-week)
10. [Experiment backlog](#10-experiment-backlog)
11. [Risks and mitigations](#11-risks-and-mitigations)
12. [The switch: moving the site between phases](#12-the-switch-moving-the-site-between-phases)
13. [Sources](#13-sources)

---

## 1. The plan in one paragraph

We launch Detent One in five phases driven by one config value. On **Tue 6 Oct** a silhouette and one click of audio go out, and the only ask is an email. On **Tue 20 Oct** we reveal the product, the specs and the price, and open a referral waitlist. On **Tue 10 Nov** we open **$20 fully refundable reservations** that lock the **$299 launch price**, and we aim to fill Batch 1 (2,500 units) before launch day. On **Tue 1 Dec** at 09:00 PT the creator embargo lifts and orders open at $299 for 72 hours. On **Fri 4 Dec** at 09:00 PT the launch price ends, the site flips to the live store at **$349**, and the plan hands over to [OPERATIONS.md](OPERATIONS.md). Batch 1 ships in February 2027 and Batch 2 in April 2027. We sell on our own store, not Kickstarter; we post the open SDK to Hacker News on 27 Oct and the product to Product Hunt on 2 Dec. We never fake urgency, never invent a number, and never test prices.

## 2. Goals and the north star

**North star: committed units.** Deposits held plus orders paid, net of refunds and cancellations. It is the one number that means someone put money down for a thing they can't touch yet. Signups are a leading indicator; committed units are the business.

| By          | Committed units | Why that date                 |
| ----------- | --------------: | ----------------------------- |
| Tue, Dec 1  |           2,500 | Batch 1 is full on deposits   |
| Fri, Dec 4  |           3,300 | Launch pricing ends           |
| Thu, Dec 31 |           4,000 | First month of the live store |

**Five goals**

1. **Fill Batch 1 before launch day.** 2,500 refundable deposits by Dec 1.
2. **Build a line worth converting.** 15,000 confirmed waitlisters by Nov 9.
3. **Sell through launch week.** 800 paid orders by Dec 4, when the $299 price ends.
4. **Keep deposits honest.** Deposit refund rate under 10%; zero fake-urgency incidents.
5. **Stay fast under load.** LCP under 2.0 s at p75 on mobile for every landing page, launch day included.

Committed units by 12.31: 4,002. Gross at a 25% Founders mix: about $1.20M. Launch budget per order: $57.

## 3. Positioning and who we sell to

**The sentence we sell with.** For people who make things on a screen for hours, Detent One is an instrument for software: the first input device whose feel changes with what you're doing. Macro pads and stream controllers give every task the same click. Detent clicks one frame at a time in Resolve, stops dead at 0 dB in Logic, and snaps to every hunk in your diff.

**The sentence we refuse.** ~~A premium customizable controller for creators with beautiful design.~~ Every competitor could write it, so it says nothing.

**The buyer.** Spends four or more hours a day inside one creative or technical app. Owns a keyboard that cost more than $150 and a mouse that cost more than $100, maybe a Stream Deck. Pays for tools that save minutes a day. Trusts specs, demos and other makers; distrusts adjectives.

**Not the buyer.** Gamers shopping for RGB, anyone who wants a $30 volume knob, and procurement departments. We don't chase them.

**The order we go after audiences in** (each has a message-matched page at `/for/<audience>/`):

1. **Video editors** (“Cut on the frame, not near it.”). The sharpest pain, overshooting the frame, and a habit of buying $300+ panels.
2. **Music producers** (“A real knob for every fake one.”). They already think in knobs, and Wall with a bump at unity gain sells itself on audio.
3. **Developers** (“Feel the diff.”). Fewer buyers, but the open SDK makes them the people who build profiles for everyone else. They also own the Hacker News day.
4. **Designers and 3D artists** (“Rotate it by feel.”). Strong fit, longer consideration, reached mostly through the other three audiences' content.

Streamers are a signup segment (“What will you turn?” → Streaming) but not a paid audience at launch; OBS support carries them.

## 4. Pricing

| Price | What             | Job                    | Why                                                                                                                                                                                               |
| ----- | ---------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| $20   | Deposit          | Filters intent         | 6.7% of the launch price. Low enough that nobody needs to ask anyone, high enough to separate a buyer from a browser. Credited in full, refundable in one click.                                  |
| $50   | Founders deposit | Stops serial squatting | A Founders deposit holds one numbered serial out of 2,000. A higher bar keeps people from parking on numbers they won’t buy.                                                                      |
| $299  | Launch price     | Rewards commitment     | $50 off, for reservers until their batch ships and for everyone for 72 hours on launch. A dated reward, not a permanent discount.                                                                 |
| $349  | List price       | The anchor             | Shown next to the launch price from reveal day, so $299 is a real saving and never a fake strikethrough. Priced against the workflow it replaces: a jog wheel, a MIDI encoder and a macro pad.    |
| $449  | Founders Edition | A real second product  | +$100 buys Tally anodize, a serial from 0001 to 2000, the walnut plinth, the Founders feel pack and early firmware for life. It anchors high because it is worth more, not because it is a decoy. |

### Why these numbers

- **$349 list.** It sits where this audience already spends on tools they touch all day (keyboards, mice, audio interfaces), and below dedicated editing panels. We anchor it on the workflow, not on rivals: _replaces a jog wheel, a MIDI encoder and a macro pad._ Plan assumption: landed unit cost under $140 keeps gross margin above 50% even at the launch price.
- **$299 launch price.** A $50 (14%) reward for committing early: reservers keep it until their batch ships, and everyone gets it for the 72 hours after launch. It ends at 17:00 UTC on 4 Dec, which is the only countdown on the site because it is the only real deadline. After that the price is $349 and stays there for the year.
- **$449 Founders Edition.** Not a decoy. It is a real second product: Tally anodize, a serial from 0001 to 2000, the machined walnut plinth ($59 on its own), the Founders feel pack and early firmware for life. No launch discount on Founders; the finite run is the reward.
- **$20 deposit ($50 for Founders).** Research puts deposits at 10–14% of price (Framework and Daylight took $100). We go lower on purpose: 6.7% of the launch price is small enough that nobody needs to ask anyone, which matters because our job is converting a waitlist of skeptics inside 14 days. It still separates a buyer from a browser (Nothing Phone (1) used £20). Founders deposits are $50 because each one holds a numbered serial, and a higher bar stops people parking on numbers they won't buy. The cost of a low deposit is a higher refund rate; we budget 10% and watch it weekly.

### Decoy and anchoring logic

- **No decoy tier.** The decoy effect replicates in roughly one attempt in eight and fades with realistic products. Our buyers smell a dummy tier and it would cost trust we need for a pre-order. Two real editions, an explicit default (Detent One), and a “Most reserved” label only if real data ever supports it.
- **The anchors we do use.** The $349 list price, shown next to the launch price from reveal day, so $299 is a real saving and never a fake strikethrough. The Founders Edition, which anchors high because it is worth more. And the workflow line above.
- **Cost per use** (about $0.28 a workday over five years) is secondary microcopy in a tooltip, and only if it wins test E10. Pennies-a-day framing backfires as prices rise.
- **Pay over time** (4 interest-free payments) appears only in the Live phase, only with the payment provider's own numbers, and never on a $20 deposit.
- **Price lock.** Reservers keep $299 until their batch ships, even if costs or tariffs move the store price. That is a margin risk we price in, not a promise we revisit.

### What we never do with price

- No decoy tier. No price A/B tests: everyone sees the same price on the same day.
- No Black Friday or holiday sale in year one. On 27 Nov we post “Feel Friday, not Black Friday” instead.
- No fake strikethroughs, no “was” prices that never were, no countdowns except the real one.

## 5. Timeline

| Phase                     | Dates                            | Flips at             | Landing page   | Primary CTA          | Offer line                                          |
| ------------------------- | -------------------------------- | -------------------- | -------------- | -------------------- | --------------------------------------------------- |
| **Tease** (`tease`)       | Tue, Oct 6 → Mon, Oct 19 (14 d)  | 09:00 PT / 16:00 UTC | `/l/tease/`    | “Get the first look” | One email on reveal day. Nothing else.              |
| **Waitlist** (`waitlist`) | Tue, Oct 20 → Mon, Nov 9 (21 d)  | 09:00 PT / 16:00 UTC | `/l/waitlist/` | “Join the waitlist”  | Free. Move up the line with every friend who joins. |
| **Reserve** (`reserve`)   | Tue, Nov 10 → Mon, Nov 30 (21 d) | 09:00 PT / 17:00 UTC | `/l/reserve/`  | “Reserve for $20”    | Fully refundable. Locks the $299 launch price.      |
| **Launch day** (`launch`) | Tue, Dec 1 → Thu, Dec 3 (3 d)    | 09:00 PT / 17:00 UTC | `/l/launch/`   | “Order Detent One”   | $299 launch price for 72 hours. Free shipping.      |
| **Live** (`live`)         | Fri, Dec 4 → open                | 09:00 PT / 17:00 UTC | `/`            | “Buy Detent One”     | Free shipping. 60-day studio trial.                 |

Flip times are 09:00 Pacific, which is 16:00 UTC before US daylight saving ends on 1 Nov and 17:00 UTC after. Launch and Live come straight from `LAUNCH.launchDate` and `LAUNCH.launchPriceEnds`.

**Dated moments**

| Date        | Time (PT) | Moment             | Detail                                                          |
| ----------- | --------- | ------------------ | --------------------------------------------------------------- |
| Mon, Sep 28 |           | Prep week          | Creator shortlist, press kit, private Discord seeding           |
| Tue, Oct 6  | 09:00     | Silhouette drop    | The knob in shadow and one click of audio. /l/tease/ goes live. |
| Tue, Oct 13 |           | Games go public    | Crack the Safe and Daily Detent, new every day at 00:00 UTC     |
| Tue, Oct 20 | 09:00     | Reveal             | Film, specs, price. Waitlist and referrals open.                |
| Wed, Oct 21 |           | Reveal week        | The Feel Engine, The Face, Founders Edition: one a day to 10.23 |
| Tue, Oct 27 | 08:30     | Show HN            | The SDK and firmware go public. Discord opens.                  |
| Tue, Nov 3  |           | Date email         | Reservations open 11.10: what $20 does, with a calendar file    |
| Tue, Nov 10 | 09:00     | Reservations open  | 72-hour Founders window for three-referral waitlisters          |
| Fri, Nov 13 | 09:00     | Founders for all   | The priority window closes; numbered serials open to everyone   |
| Mon, Nov 16 |           | Creator units ship | 60 units, embargo until 12.01 at 09:00 PT                       |
| Fri, Nov 27 |           | No Black Friday    | Feel Friday instead. The launch price is the only price cut.    |
| Tue, Dec 1  | 09:00     | Launch             | Embargo lifts. Orders open at the launch price.                 |
| Wed, Dec 2  | 00:01     | Product Hunt       | Maker comment with a feel link                                  |
| Thu, Dec 3  | 10:00     | Discord AMA        | Founders and the firmware lead                                  |
| Fri, Dec 4  | 09:00     | Launch price ends  | The only countdown on the site, and it is real                  |
| Tue, Dec 15 |           | Skip Passes expire | Two per reserver, single use, stated from day one               |

**After the main scale (month precision only; we date nothing suppliers haven't committed to)**

- **January 2027. Review units.** 30 production units go to independent reviewers. Reviews publish while every deposit is still refundable.
- **February 2027. Batch 1 ships.** 2,500 units. Balances are charged as each unit ships, never before.
- **April 2027. Batch 2 ships.** 5,000 units, including launch-week and December orders.

## 6. The five phases

Each phase owns one landing page and one primary action, rendered by `<PhaseCTA>` from `src/config/launch.ts`. Nothing else on the site competes with it.

### 6.1 Tease · Tue 6 Oct → Mon 19 Oct · `/l/tease/`

- **Objective.** Get 4,000 people to hand over an email before they know the price, on the strength of one turn of the dial.
- **Primary CTA.** “Get the first look”. Note: _One email on reveal day. Nothing else._
- **Offer.** A first look on reveal day, and first claim on the $299 launch price. No discount code, no giveaway.
- **Who we talk to.** Warm first: the SmartKnob and maker communities, the founders' own followers, 100 SDK testers. Cold paid traffic only as a capped test of the 5% benchmark.
- **The page.** The dial toy needs no email. The capture form appears after a visitor has turned the dial through three feels (test E01), asks one tap first (“What will you turn?”) and the email second (E02), and never covers more than 30% of the screen.
- **Channels.**
  - Silhouette drop: the knob in shadow, one click of audio
  - Founder essay on /story/: “Why a knob?”
  - Crack the Safe and Daily Detent go public on 10.13
  - Capped cold paid test, $6,000 across four audiences
- **Creators.** Invitations and NDAs go out on 6 Oct. Briefings run 12–23 Oct. No creator posts in this phase.
- **Community.** The Discord stays private while we seed it to 200 people (team, SDK testers, creators).
- **PR.** None. The silhouette is a deliberate “leak” on our own channels, so there is little left for anyone else to leak.
- **Paid.** $6,000 of cold traffic split across the four `/for/` audiences, to prove or kill the 5% visit → email benchmark before we spend real money.
- **KPIs.**

| Measure                    |             Target |         Alarm |
| -------------------------- | -----------------: | ------------: |
| Visit → email              | 5% cold · 12% warm | under 3% cold |
| Visitors who turn the dial |                40% |     under 25% |
| Double opt-in              |                70% |     under 55% |
| Signups by 10.19           |              4,000 |   under 2,000 |

- **Moves on when.** Cold visit → email holds at 5% for seven straight days. If it doesn't, we rewrite the tease before reveal day, not after.

### 6.2 Waitlist · Tue 20 Oct → Mon 9 Nov · `/l/waitlist/`

- **Objective.** Turn curiosity into a line: 15,000 confirmed waitlisters by 11.09, about a quarter of them brought in by a friend.
- **Primary CTA.** “Join the waitlist”. Note: _Free. Move up the line with every friend who joins._
- **Offer and referral milestones.** Rewards are craft and identity, never discounts, and only confirmed friends count:
  - 1 friend: the **Referral Ratchet** feel profile, playable on the site now and on the device later.
  - 3 friends: the **Founders priority window**, 72 hours of first pick of numbered serials from 10 Nov.
  - 10 friends: a **display face with your handle** at first boot.
  - 25 friends: the **early firmware channel for life**, even on Detent One.
  - In demo mode (no endpoint configured) the site shows no queue position and no counts, ever.
- **Who we talk to.** Everyone the reveal reaches, routed by “What will you turn?” into editors, producers, designers and developers.
- **Channels.**
  - Reveal on 10.20: film, specs and price, then one drop a day to 10.23
  - Show HN on 10.27: the SDK and firmware go public
  - Discord opens to everyone on 10.27, once 200 members are seeded
  - Message-matched paid social to /for/ pages, $14,000
  - Creator briefings under a 12.01 embargo
- **Reveal week.** One drop a day, each with its own post and Discord thread: Tue 20 _Detent One_ (film, specs, price), Wed 21 _The Feel Engine_ (motor and encoder teardown), Thu 22 _The Face_ (the round display and integrations), Fri 23 _Founders Edition_.
- **Creators.** Briefings finish; each creator gets beta firmware and the SDK. Three commit to publishing their own feel profile in `/profiles/`.
- **Community.** The Discord opens to everyone on 27 Oct, with 200 people already inside. Onboarding asks “What will you turn?” and sets a role. Feel Friday #1 on 30 Oct.
- **PR.** Embargoed briefing to hardware and maker press lifts with the reveal at 09:00 PT on 20 Oct. The press kit (B-roll, renders, sound pack, fact sheet) goes public on `/press/`. On 27 Oct a technical write-up of the SDK goes to developer media alongside Show HN.
- **Paid.** $14,000, message-matched to the four `/for/` pages (section 8.5).
- **KPIs.**

| Measure                    | Target |        Alarm |
| -------------------------- | -----: | -----------: |
| Signups, all sources       | 21,500 | under 12,000 |
| Confirmed by 11.09         | 15,000 |  under 8,000 |
| Signups who refer a friend |    15% |     under 9% |
| Discord members            |  2,000 |    under 800 |

- **Moves on when.** Reservations open on 11.10 at 09:00 PT whatever the count. The date has been public since reveal day, and we keep dates.

### 6.3 Reserve · Tue 10 Nov → Mon 30 Nov · `/l/reserve/`

- **Objective.** Fill Batch 1: 2,500 refundable deposits before launch day.
- **Primary CTA.** “Reserve for $20”. Note: _Fully refundable. Locks the $299 launch price._
- **Offer.** $20, fully refundable in one click, credited in full, locks the $299 launch price until your batch ships. Founders Edition: $50 holds a numbered serial. Every reserver gets **two Skip Passes**, single-use invitations that let a friend reserve into the same batch; they expire on 15 Dec. If the waitlist turns out shorter than a batch, we drop Skip Passes rather than invent a queue.
- **The deposit, done right.** A captured charge that we refund on cancellation, not an authorization hold (holds expire in 7 days). The balance is a separate charge when the unit ships. Refunds are one click and land within 7 working days. Delay notices follow the FTC Mail Order Rule: a new date, or an honest “we can't date it yet”, and a free cancel.
- **Who we talk to.** Confirmed waitlisters first (the 72-hour Founders window goes to people with three confirmed referrals), then everyone.
- **Channels.**
  - Reservation email to every confirmed waitlister, 11.10 at 09:00 PT
  - Founders priority window 11.10 → 11.13 for three-referral waitlisters
  - “How it’s made” CNC film; batch meter from real counts (live mode)
  - 60 creator units ship 11.16 under embargo
  - Retargeting of waitlisters who haven’t reserved, $18,000
- **Creators.** 60 production-intent units ship on 16 Nov. The embargo lifts for everyone at once: 1 Dec, 09:00 PT.
- **Community.** `#launch-desk` is staffed 09:00–21:00 PT for the first 72 hours of reservations. SDK office hours every Wednesday.
- **PR.** The press gets the reservation terms and batch dates in writing on 10 Nov. On 27 Nov: “Feel Friday, not Black Friday”.
- **Paid.** $18,000, mostly retargeting waitlisters who haven't reserved plus lookalikes of depositors. Cold ads pause over Thanksgiving week while holiday ad prices spike.
- **KPIs.**

| Measure                     |    Target |       Alarm |
| --------------------------- | --------: | ----------: |
| Waitlist → deposit, 14 days |       15% |    under 8% |
| /l/reserve/ visit → deposit |        8% |    under 5% |
| Deposits by 11.30           |     2,500 | under 1,200 |
| Deposit refund rate         | under 10% |    over 15% |

- **Moves on when.** Launch day is fixed. If Batch 1 fills early, Batch 2 opens the same hour with its April date on the button.

### 6.4 Launch day · Tue 1 Dec → Thu 3 Dec · `/l/launch/`

- **Objective.** Turn launch-week attention into 800 paid orders in 72 hours, with no number on the page that we can't source.
- **Primary CTA.** “Order Detent One”. Note: _$299 launch price for 72 hours. Free shipping._
- **Offer.** $299 until 12.04 at 09:00 PT (17:00 UTC). Free shipping, 60-day studio trial, 3-year warranty. Orders are assigned to the next open batch and the date is on the button.
- **Who we talk to.** The whole list, plus everyone the creator embargo lift, the film and Product Hunt bring in.
- **Channels.**
  - Embargo lifts 12.01 at 09:00 PT: 60 creator videos, every one disclosed
  - Launch film and email to the full list
  - Product Hunt 12.02 at 00:01 PT
  - Discord AMA 12.03
  - Launch cut-downs to all four audiences, $12,000
- **Creators.** Embargo lifts at 09:00 PT on 1 Dec. Every video carries the disclosure in the video and in the first line of the post.
- **Community.** Discord AMA with the founders and the firmware lead on 3 Dec at 10:00 PT.
- **PR.** Launch film, updated press kit with production photos, and the unedited one-take demo with a visible latency readout.
- **Platforms.** Product Hunt at 00:01 PT on 2 Dec, a day after launch so launch day belongs to customers.
- **Paid.** $12,000 of launch-film cut-downs to all four audiences, capped at three views per person.
- **KPIs.**

| Measure                       | Target |     Alarm |
| ----------------------------- | -----: | --------: |
| Paid orders by 12.04          |    800 | under 400 |
| Buy clicks per product view   |     8% |  under 5% |
| Checkout completion           |    60% | under 45% |
| Creator posts with disclosure |   100% |  any miss |

- **Moves on when.** Automatic. Launch pricing ends at 17:00 UTC on 12.04 and the site flips to Live the same minute (a manual flip by two people; see section 12).

### 6.5 Live · Fri 4 Dec onward · `/`

- **Objective.** Run the store as one product page: 2.5% of sessions become orders, and every week the page gets a little faster and a little clearer.
- **Primary CTA.** “Buy Detent One”. Note: _Free shipping. 60-day studio trial._
- **Offer.** $349, free shipping, 60-day studio trial, 3-year warranty. Orders ship in the next open batch, dated at checkout. Pay over time appears here for the first time.
- **Channels.**
  - Evergreen /for/ pages and search
  - Creator affiliate codes, disclosed
  - Feel Friday: one community profile a week
  - Weekly CRO review (docs/OPERATIONS.md)
- **Honesty in December.** The product page says plainly that new orders ship in Batch 2, April 2027. It is not a holiday gift, and we say so.
- **KPIs.**

| Measure                    |          Target |      Alarm |
| -------------------------- | --------------: | ---------: |
| Session → order            |            2.5% | under 1.5% |
| Checkout completion        |             60% |  under 45% |
| Deposit → order at capture |             80% |  under 70% |
| AI-referred conversion     | reported weekly |  untracked |

- **Moves on when.** It doesn't. The plan hands over to [OPERATIONS.md](OPERATIONS.md).

## 7. Funnel and KPIs

Each stage has a target and an **alarm**. Below the alarm we stop spending on that stage and fix the page before we buy more traffic.

| Stage                  | Measured as                                 | Target |  Alarm | Published benchmark                                                        |
| ---------------------- | ------------------------------------------- | -----: | -----: | -------------------------------------------------------------------------- |
| Visit → email          | `landing view → lead_submit`                |     7% |   < 4% | Waitlist pages: 3.4% median, 8–9% top decile                               |
| Email → confirmed      | `lead_submit → email_verified`              |    70% |  < 55% | Double opt-in: 55–58% median, 70%+ top quartile                            |
| Email → referral       | `lead_submit → lead_submit (referred)`      |    15% |   < 9% | Share of signups who refer one friend: 9–10% median, 18%+ strong           |
| Waitlist → deposit     | `email_verified → reserve_submit (14 days)` |    15% |   < 8% | Waitlist to paid deposit: 5–25%, about 20% if deposits open within a month |
| Reserve page → deposit | `/l/reserve/ view → reserve_submit`         |     8% |   < 5% | Strong preorder pages: 10–20% of warm visitors                             |
| Deposit → order        | `reserve_submit → balance_paid`             |    80% |  < 70% | No public benchmark. This is our assumption; we re-baseline on Batch 1     |
| Store session → order  | `session → checkout_complete`               |   2.5% | < 1.5% | Consumer electronics stores: 1.2–2.4% sitewide                             |

The four headline conversion rates:

| Stage              |                                       Target |
| ------------------ | -------------------------------------------: |
| Visit → email      |               7% blended (5% cold, 12% warm) |
| Email → referral   | 15% of signups refer a friend; k-factor 0.35 |
| Waitlist → deposit |  15% of confirmed waitlisters within 14 days |
| Deposit → order    |                     80% when the batch ships |

**The chain at plan**

| Step                                                 | Count     |
| ---------------------------------------------------- | --------- |
| Visits before reservations open                      | 230,000   |
| Emails at 7%                                         | 16,100    |
| Friends they bring (k 0.35)                          | +5,635    |
| On the list                                          | 21,735    |
| Confirmed at 70%                                     | 15,214    |
| Deposits from the list, 14 days at 15%               | 2,282     |
| Deposits from 2,750 new /l/reserve/ visitors at 8%   | 220       |
| **Deposits by 12.01**                                | **2,502** |
| Orders from deposits at 80%                          | 2,002     |
| Launch-week orders (12.01–12.04)                     | 800       |
| Live store orders to 12.31 (28,000 sessions at 2.5%) | 700       |
| **Orders at plan**                                   | **3,502** |

**How we measure.** Everything comes from first-party `track()` events (see [OPERATIONS.md](OPERATIONS.md#funnel-dashboard) for the dashboard). AI-assistant referrals are tagged `channel=ai` and reported as their own channel. Nothing is tracked while a page is being prerendered.

## 8. Channels

### 8.1 Platform decisions

- **Kickstarter: no.** We take refundable deposits on our own store. We keep the customer list, set our own one-click refund terms, skip the 5% platform fee on top of card fees, and the store is already the demo. Backers aren't customers; depositors are.
- **Hacker News: yes, Show HN on Tue 27 Oct at 08:30 PT.** Titled plainly (“Show HN: Detent, an open-SDK haptic knob with software-defined detents”), linking the SDK repository and a technical write-up, not the store. The founder answers every comment for six hours. Nobody asks for votes.
- **Product Hunt: yes, Wed 2 Dec at 00:01 PT.** The day after launch so launch day belongs to customers. The maker comment tells the story and links a feel you can turn in `/profiles/`. Supporters come from the Discord over the weeks before, never from vote requests.

### 8.2 Creator seeding

- **60 creators**, 15 per audience: 40 mid-tier (100k–1M subscribers) and 20 tool-obsessed micro creators (10k–100k).
- **20 of the 60 get a flat $2,000–$4,000** for a dedicated video. The rest keep the unit and owe us nothing.
- **No script approval. Negative reviews are allowed, in writing.** Anything else is review suppression.
- **Disclosure in the video and in the first line of the post**, never only in a bio (FTC Endorsement Guides: a free unit is a material connection).
- Every creator gets a `?ref=` code for honest attribution without pixels, early SDK access, and their own feel profile in `/profiles/`.
- Dates: invitations 6 Oct, briefings 12–23 Oct, units ship 16 Nov, one embargo for everyone at 09:00 PT on 1 Dec.

### 8.3 Community (Discord)

- **Opens 27 Oct**, only once 200 people are already inside. An empty server is anti-proof.
- **Onboarding asks one question**, “What will you turn?”, and sets a role: Editing, Music, Design & 3D, Code, Streaming.
- **Channels:** `#start-here`, `#feel-lab`, `#daily-detent`, `#crack-the-safe`, `#show-your-desk`, `#sdk-dev`, `#firmware-roadmap`, `#launch-desk`.
- **One invite code per `/for/` page**, so Discord's own invite counts attribute joins. Invite links can't carry query parameters.
- **Rituals:** Feel Friday (one community profile featured on the site every week), SDK office hours on Wednesdays, the AMA on 3 Dec.
- **Staffing:** someone from the team is in the server 09:00–21:00 PT every day until 4 Dec. Two part-time moderators through launch.
- **Targets:** 2,000 members by 9 Nov, 5,000 by 4 Dec.

### 8.4 PR moments

| Date         | Moment       | What goes out                                                              |
| ------------ | ------------ | -------------------------------------------------------------------------- |
| Tue, Oct 6   | Silhouette   | Our own channels only. No press.                                           |
| Tue, Oct 20  | Reveal       | Embargoed briefing lifts 09:00 PT; press kit public on `/press/`           |
| Tue, Oct 27  | Open SDK     | Technical write-up for developer media, with Show HN                       |
| Tue, Nov 10  | Reservations | Terms and batch dates in writing                                           |
| Tue, Dec 1   | Launch       | Film, creator embargo lift, production photos, unedited demo               |
| January 2027 | Reviews      | 30 production units to independent reviewers before any balance is charged |

### 8.5 Paid social, message-matched to `/for/` pages

| Audience               | Ad headline = page headline       | Landing            | Hook                                                                        | Where                              |  Budget |
| ---------------------- | --------------------------------- | ------------------ | --------------------------------------------------------------------------- | ---------------------------------- | ------: |
| Video editors          | “Cut on the frame, not near it.”  | `/for/editors/`    | One take: trimming in Resolve, frame counter on screen, one click per frame | YouTube in-stream, Instagram Reels | $17,500 |
| Music producers        | “A real knob for every fake one.” | `/for/musicians/`  | A fader ride that bumps at unity gain, audio on                             | YouTube, Instagram, TikTok         | $12,500 |
| Designers & 3D artists | “Rotate it by feel.”              | `/for/designers/`  | Rotate an object to exactly 37.5° without typing                            | Instagram, TikTok                  | $12,500 |
| Developers             | “Feel the diff.”                  | `/for/developers/` | Magnet snapping through a 900-line diff                                     | Reddit, X, newsletter sponsorships |  $7,500 |

Rules:

- The ad headline is the landing page headline, word for word. Both come from `AUDIENCES` in `src/data/product.ts`, so they can't drift.
- The first frame shows the same dial state the page hero shows.
- The landing page's button is `<PhaseCTA>`, so the offer in the ad is the offer on the page, whatever the phase.
- `utm_source` and `utm_campaign=<phase>-<audience>` on every link. Creators use `?ref=` instead.
- Frequency capped at three per person per week. Anyone who converted is excluded.

### 8.6 Budget split

| Line             |  Budget | Share | What it buys                                               |
| ---------------- | ------: | ----: | ---------------------------------------------------------- |
| Creator seeding  | $70,000 |   35% | 60 units at landed cost, 20 flat fees, shipping and duties |
| Paid social      | $50,000 |   25% | Tease $6k, Waitlist $14k, Reserve $18k, Launch $12k        |
| Film and content | $40,000 |   20% | Reveal film, CNC film, four one-take audience clips        |
| PR and press kit | $10,000 |    5% | B-roll, renders, sound pack, briefings                     |
| Community        | $10,000 |    5% | Two part-time moderators through launch, AMA, bots         |
| Tools and ops    | $10,000 |    5% | Email, analytics, waitlist endpoint, support desk          |
| Contingency      | $10,000 |    5% | Held until 12.04, then released to Live                    |

Paid social by phase: Tease $6,000, Waitlist $14,000, Reserve $18,000, Launch $12,000. Contingency is held until 4 Dec, then released to the Live phase.

## 9. Content calendar, week by week

| Week of | Phase      | Site and email                                                                                      | Community                                                                                         | Creators and press                                                                            |                                                                                           Paid |
| ------- | ---------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------: |
| Sep 28  | Prep       | Tease page and dial toy final. Double opt-in and referral codes tested end to end.                  | Private Discord seeded: the team, 100 SDK testers, the creators. Target: 200 people.              | Shortlist of 60 across four audiences. Press kit v1: B-roll, renders, fact sheet, sound pack. |                                                $0: Four one-take clips shot, one per audience. |
| Oct 5   | Tease      | 10.06 at 09:00 PT: /l/tease/ goes live. One email on reveal day, nothing else.                      | Silhouette posted in the SmartKnob and maker communities, inside each one’s self-promotion rules. | Invitations and NDAs go out. No creator posts yet.                                            | $3,000: Cold test to /l/tease/, split across four audiences. Proves or kills the 5% benchmark. |
| Oct 12  | Tease      | 10.13: Crack the Safe and Daily Detent go public. Founder essay: “Why a knob?”                      | A daily clip: one feel, one sound, name it. Answers in #daily-detent.                             | Thirty-minute briefings with the engineer who tuned the feels.                                |                               $3,000: Keep the two best audiences from week one. Cut the rest. |
| Oct 19  | Waitlist   | 10.20 at 09:00 PT: reveal film, specs, price. Waitlist and referrals open. One drop a day to 10.23. | One thread per drop. The team answers every question the same day.                                | Press briefing embargo lifts with the reveal. The press kit goes public on /press/.           |                                           $5,000: Message-matched ads to the four /for/ pages. |
| Oct 26  | Waitlist   | 10.27: the SDK and firmware repositories go public, with a technical write-up on /changelog/.       | 10.27 at 08:30 PT: Show HN. Discord opens to everyone. Feel Friday #1 on 10.30.                   | Creators get beta firmware and the SDK. Three commit to publishing a feel profile.            |                        $5,000: Developers get budget only if Show HN lands. Otherwise hold it. |
| Nov 2   | Waitlist   | 11.03 email: reservations open 11.10, here’s what $20 does, calendar file attached.                 | Referral push: three confirmed friends earn the Founders priority window.                         | List locked at 60. Addresses and disclosure terms signed.                                     |                              $4,000: Retarget tease and waitlist visitors who never signed up. |
| Nov 9   | Reserve    | 11.10 at 09:00 PT: reservations open. Founders priority window to 11.13.                            | #launch-desk staffed 09:00–21:00 PT for the first 72 hours.                                       | Press gets the reservation terms and batch dates in writing.                                  |                       $8,000: Waitlisters who haven’t reserved, plus lookalikes of depositors. |
| Nov 16  | Reserve    | “How it’s made” CNC film on /story/. Batch meter goes live from real counts (live mode).            | Feel Friday #3. SDK office hours.                                                                 | 11.16: 60 creator units ship. Embargo: 12.01 at 09:00 PT.                                     |                                   $6,000: Retargeting plus the best-performing /for/ audience. |
| Nov 23  | Reserve    | 11.27: Feel Friday, not Black Friday. The launch price is the only price cut, and everyone gets it. | Quiet week. Moderators on a light rota.                                                           | Creator questions answered within 24 hours. Disclosure checklist resent.                      |                   $4,000: Warm retargeting only. Cold ads pause while holiday ad prices spike. |
| Nov 30  | Launch day | 12.01 at 09:00 PT: orders open at $299 for 72 hours. 12.04 at 09:00 PT: the site flips to Live.     | 12.03: Discord AMA with the founders and the firmware lead.                                       | 12.01 at 09:00 PT: embargo lifts. 12.02 at 00:01 PT: Product Hunt.                            |        $12,000: Launch film cut-downs to all four audiences, capped at three views per person. |
| Dec 7   | Live       | Weekly CRO review starts. FAQ updated from the first week of tickets.                               | Public launch retro: what worked, what didn’t, what’s next.                                       | A roundup of every creator video, each with its disclosure shown.                             |                        $0: Launch budget closed. Evergreen spend moves to the operations plan. |
| Dec 14  | Live       | The product page says it plainly: new orders ship in Batch 2, April 2027. Not a holiday gift.       | 12.15: Skip Passes expire. Feel Friday continues every week.                                      | Affiliate codes stay live for creators who want them, disclosed.                              |                                                                            $0: Evergreen only. |

## 10. Experiment backlog

Rules:

- **Never tested:** prices, urgency claims, disclosures, refund terms.
- Minimum seven days per test, so every weekday is in both arms.
- Ship a winner at 95% confidence with no guardrail breach. Refund rate and support tickets are guardrails on every test.
- One test per page at a time. The backlog is ordered; the next test starts when the last one ends.
- Sample sizes are per arm for a two-sided test at α 0.05 and 80% power. A test that can't reach its sample in the phase it belongs to waits for the Live phase or doesn't run.

| ID  | Test                           | Hypothesis                                                                                                                                                    | Measure                     | From → to | Needs (per arm) | Phase · where                     |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | --------- | --------------: | --------------------------------- |
| E01 | Ask after the dial, not before | If the email form appears after a visitor has turned the dial through three feels, more of them sign up, because they have felt the product first.            | Visit → email               | 7% → 8.4% |           5,689 | Tease · /l/tease/                 |
| E02 | One tap before the email field | If step one is a single tap (“What will you turn?”) and step two is the email, completion rises, because the first step costs nothing.                        | Form view → lead_submit     | 30% → 34% |           2,623 | Tease · /l/tease/, /l/waitlist/   |
| E03 | Confirm to lock the price      | If the confirmation email says “Confirm to lock the $299 launch price”, more people confirm than with “Confirm your email”.                                   | Email → confirmed           | 60% → 66% |           1,013 | Tease · Confirmation email        |
| E04 | A reward you can feel today    | If the first referral earns a profile that plays on the site immediately, more people refer than when it earns a display face they see in February.           | Signups who refer           | 12% → 15% |           2,033 | Waitlist · Waitlist success state |
| E05 | Share the feel, not a picture  | If the share link opens a dial that feels like the sharer’s profile, more friends sign up per share than from a static image card.                            | Referred signups per sharer | 10% → 13% |           1,772 | Waitlist · Referral share sheet   |
| E06 | Say how the refund works       | If the button note reads “Refund in one click, any time before it ships” instead of “Fully refundable”, more visitors reserve and refunds do not rise.        | Reserve page → deposit      | 8% → 9.2% |           8,565 | Reserve · /l/reserve/             |
| E07 | Turn to reserve                | If the reserve button arms after three detents and an end stop, more visitors reserve, because the commitment is physical. The plain button always works too. | Reserve page → deposit      | 8% → 9.2% |           8,565 | Reserve · /l/reserve/             |
| E08 | Audience demo first            | If /for/ pages open on the app demo (timeline, mixer, canvas, diff) instead of the bare dial, visitors sign up more, because they see their own work.         | Visit → email per audience  | 7% → 8.4% |           5,689 | Waitlist · /for/<audience>/       |
| E09 | Hands, not screens             | If the ad is one take of a hand on the dial with sound, landing visitors sign up more than from a screen recording, because the promise matches the page.     | Paid landing visit → email  | 5% → 6.3% |           5,330 | Waitlist · Paid social            |
| E10 | Cost per workday               | If the price block shows “about $0.28 a workday over five years” in a tooltip, buy clicks rise without more returns.                                          | Product view → buy click    | 8% → 9%   |          13,216 | Live · /shop/                     |
| E11 | Pay over time, quietly         | If a single line under the price shows four interest-free payments, checkout completion rises and average order value does not fall.                          | Checkout completion         | 55% → 59% |           1,982 | Live · /shop/ price block         |
| E12 | Invite after the value moment  | If the Discord invite appears on the signup success state instead of the footer, more signups join, because they just got something.                          | Signups who join Discord    | 8% → 10%  |           2,273 | Waitlist · Waitlist success state |

## 11. Risks and mitigations

| Risk                                                                       | Tripwire                                                         | First move                                                                                                                                                                                                      | Owner         |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Supply chain: the gimbal motor, the encoder or CNC capacity comes up short | Any long-lead part more than two weeks behind its purchase order | Two qualified motor suppliers before deposits open. 15% buffer on long-lead parts. Batch sizes come from signed supplier capacity, never from demand.                                                           | Ops lead      |
| Batch 1 slips past February                                                | An EVT or DVT milestone more than two weeks late                 | A delay notice within 48 hours of knowing, with a new date or an honest “we can’t date it yet”, and a one-click refund. Update launch.ts; the site updates everywhere. Monthly progress log either way.         | Founder       |
| Fake-urgency temptation on a slow day                                      | Anyone proposes a timer, a stock counter or “only a few left”    | The only countdown is the real launch price end. Counts come from real data with an as-of time, in live mode only. “Founders sold out” appears when, and only when, it is true. Anyone on the team can veto.    | Everyone      |
| Refund load: deposit cancellations, then 60-day trial returns              | Deposit refund rate over 10% in any week                         | Refunds are self-serve and one click. Budget 10% refunds plus 3–4% card-fee leakage. Read every cancellation reason that week and fix the page that caused it. Returned units are refurbished and sold as such. | Support lead  |
| Demand below plan                                                          | Fewer than 8,000 confirmed waitlisters on 11.03                  | Drop Skip Passes and the priority window rather than invent a queue. Move paid budget to the best audience. Reservations still open on the published date.                                                      | Growth lead   |
| Demand above plan                                                          | Batch 1 fills before 12.01                                       | Say “Batch 1 is full” in the banner the same hour and open Batch 2 with its April date. Never sell a unit we can’t date.                                                                                        | Ops lead      |
| Reviews say the firmware doesn’t match the demo                            | Any reviewer calls a feel on the site “not what it’s like”       | Review units go out in January, before balances are charged, so buyers can cancel after reading. The web demo uses the firmware’s own profile JSON.                                                             | Firmware lead |
| A creator leaks before the embargo                                         | Footage appears before 12.01 at 09:00 PT                         | The tease is already a deliberate silhouette leak, so there is little left to spoil. Acknowledge it, move nothing.                                                                                              | Growth lead   |
| Launch-day load                                                            | Waitlist or checkout endpoint p95 over 800 ms                    | The site is static on GitHub Pages and doesn’t go down. The endpoint is load-tested to 50× the expected peak; checkout is the commerce provider’s hosted page.                                                  | Ops lead      |

**The honesty rules, which apply on every bad day:** the only countdown on the site is the real launch price end. Counts come from real data with an as-of time, in live mode only; demo mode shows none. “Founders sold out” appears when, and only when, it is true. Tester notes on the site are labelled as illustrative personas. Anyone on the team can veto a change that breaks these rules.

## 12. The switch: moving the site between phases

The whole site reads one value, `BUILD_PHASE`, from the `PUBLIC_LAUNCH_PHASE` environment variable at build time (default `reserve`). Changing it moves every `<PhaseCTA>`, the announcement bar, every `data-phase-only` block and every landing-page offer line at once.

| Set PUBLIC_LAUNCH_PHASE to | On          | Pacific  | UTC       |
| -------------------------- | ----------- | -------- | --------- |
| `tease`                    | Tue, Oct 6  | 09:00 PT | 16:00 UTC |
| `waitlist`                 | Tue, Oct 20 | 09:00 PT | 16:00 UTC |
| `reserve`                  | Tue, Nov 10 | 09:00 PT | 17:00 UTC |
| `launch`                   | Tue, Dec 1  | 09:00 PT | 17:00 UTC |
| `live`                     | Fri, Dec 4  | 09:00 PT | 17:00 UTC |

**Runbook (two people, every flip)**

1. **Rehearse the day before.** Open any page with `?phase=<next>` and walk the header, the announcement bar, the landing page and `/shop/`. Then build it for real:
   ```bash
   export PUBLIC_LAUNCH_PHASE=<next>
   npm run check && npm run build && npm run test
   ```
2. **Freeze `main` two hours before.** The deploy that flips the phase should contain nothing else.
3. **Set the repository variable** at flip time minus 15 minutes (Settings → Secrets and variables → Actions → Variables, or):
   ```bash
   gh variable set PUBLIC_LAUNCH_PHASE --body <next>
   ```
4. **Redeploy.** The variable only takes effect on the next build (about two minutes):
   ```bash
   gh workflow run deploy.yml --ref main && gh run watch
   ```
5. **Verify from outside**, in a private window (so no `?phase=` preview is stored), then in the HTML itself:
   ```bash
   curl -s https://alexmorrison12.github.io/detent/ | grep -o 'data-phase="[a-z]*"'
   ```
6. **Then announce.** Email, Discord and social posts go out after verification, never before.
7. **Roll back** by setting the variable back and running the workflow again.

We don't automate flips with a scheduled workflow. Each flip is also an announcement, and announcements go out after a human has checked the site.

**Before the Reserve flip** (and only when the product is real): set `PUBLIC_WAITLIST_ENDPOINT` to the live waitlist/reservation endpoint and `PUBLIC_SITE_MODE=live`, so forms post for real and structured data includes offers. Until then the site stays in demo mode: nothing leaves the browser and every form says so. See [OPERATIONS.md](OPERATIONS.md#plugging-in-real-backends).

**Previewing without deploying**

- Append `?phase=<id>` to any URL to preview that phase. It persists for the tab (`sessionStorage`) and never reaches another visitor.
- `?phase=reset` returns the tab to the phase the site was built for.
- The phase is applied by an inline script before first paint, so previews never flash the wrong button.
- On [/launch-plan/](https://alexmorrison12.github.io/detent/launch-plan/), turning the five-detent dial or clicking a phase does the same thing in place, without a reload.

## 13. Sources

Benchmarks and patterns come from our research brief ([`docs/research/BUILD_BRIEF.md`](research/BUILD_BRIEF.md), raw findings in [`docs/research/findings.json`](research/findings.json)). Where the brief and our product files disagree (deposit size, Founders price, return window), the product files win.

- Waitlist and funnel benchmarks: [LaunchList waitlist benchmark](https://getlaunchlist.com/tools/waitlist-benchmark), [a16z speedrun on waitlists](https://speedrun.substack.com/p/the-growth-meta-how-to-build-a-waitlist), [Submarine on presales vs waitlists](https://www.getsubmarine.com/blog/presales-vs-waitlists), [Baymard cart abandonment](https://baymard.com/lists/cart-abandonment-rate), [Triple Whale ecommerce benchmarks](https://www.triplewhale.com/blog/ecommerce-benchmarks), [Klaviyo sign-up form practices](https://www.klaviyo.com/blog/sign-up-form-best-practices), [Adobe on AI-referred traffic](https://business.adobe.com/blog/ai-driven-traffic-surges-across-industries).
- Deposits and pre-orders: [Framework pre-orders](https://frame.work/blog/framework-laptop-16-pre-orders-are-now-open), [Nothing Phone (1) invites and deposit](https://www.pocket-lint.com/phones/news/nothing/161635-nothing-opens-the-waitlist-details-invites-and-asks-for-a-deposit-for-nothing-phone-1/), [Stripe on authorization holds](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method), [FTC Mail, Internet or Telephone Order Rule](https://www.ftc.gov/business-guidance/resources/business-guide-ftcs-mail-internet-or-telephone-order-merchandise-rule).
- Pricing: [decoy effect replication](https://atticusli.com/replication-crisis/decoy-effect-asymmetric-dominance/), [Gourville on temporal price framing](https://academic.oup.com/jcr/article-abstract/24/4/395/1797969), [Baymard on product page UX](https://baymard.com/blog/current-state-ecommerce-product-page-ux), [Baymard on delivery dates](https://baymard.com/blog/shipping-speed-vs-delivery-date).
- Honest proof: [FTC rule on fake reviews and testimonials](https://www.ftc.gov/news-events/news/press-releases/2024/08/federal-trade-commission-announces-final-rule-banning-fake-reviews-testimonials), [FTC endorsement guides](https://www.ftc.gov/news-events/news/press-releases/2023/06/federal-trade-commission-announces-updated-advertising-guides-combat-deceptive-reviews-endorsements), [FTC Disclosures 101 for influencers](https://www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers), [Digital Fairness Act overview](https://digitalfairnessact.com/what-is-the-digital-fairness-act).
- Launch lessons: [Playdate battery delay](https://techcrunch.com/2021/11/11/panics-playdate-handheld-wont-ship-until-early-2022-due-to-battery-issues/), [Analogue 3D](https://en.wikipedia.org/wiki/Analogue_3D), [Whoop upgrade policy reversal](https://techcrunch.com/2025/05/11/fitness-tracker-whoop-faces-unhappy-customers-over-upgrade-policy), [Humane](https://techresearchonline.com/blog/humane-ai-pin-failure/).
- Referrals and invites: [Robinhood's referral waitlist](https://viral-loops.com/blog/how-robinhoods-referral-built-a-1m-user/), [LaunchList referral guide](https://getlaunchlist.com/blog/waitlist-referral-program-guide), [Monzo growth and Golden Tickets](https://tomblomfield.com/post/691384431502557184/monzo-growth).
- Platforms: [Product Hunt in 2025](https://awesome-directories.com/blog/product-hunt-launch-guide-2025-algorithm-changes/), [launching on Hacker News](https://www.lucasfcosta.com/blog/hn-launch), [dev tools on HN](https://www.markepear.dev/blog/dev-tool-hacker-news-launch), [Kickstarter follower conversion](https://prelaunch.marketing/blogs/academy/average-conversion-rates-for-kickstarter-followers).
- Community: [Discord Community Onboarding FAQ](https://support.discord.com/hc/en-us/articles/11074987197975-Community-Onboarding-FAQ), [Onboarding examples](https://support.discord.com/hc/en-us/articles/10394859532823-Community-Onboarding-Examples).
