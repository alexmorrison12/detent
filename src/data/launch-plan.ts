/**
 * The Detent One launch plan, as data. The /launch-plan/ page renders it and
 * docs/LAUNCH_PLAN.md mirrors it (tables in the doc are generated from this
 * file; if the two ever disagree, this file wins).
 *
 * Dates, CTAs, landing pages and prices are NOT repeated here: they come from
 * src/config/launch.ts and src/data/product.ts, so moving a date there moves
 * it on the plan page too.
 */
import { LAUNCH, PHASES, PHASE_ORDER, type Phase } from '@/config/launch';
import { AUDIENCES, PAYMENT, byEdition, formatUsd, type AudienceId } from '@/data/product';
import { referralSummary } from '@/data/referrals';

const one = byEdition('one');
const founders = byEdition('founders');
/** "$299", "$20": prices always come from config/product data. */
const LP = `$${one.launchPriceUsd}`;
const DEP = `$${LAUNCH.depositUsd}`;
const RUN = LAUNCH.foundersRun.toLocaleString('en-US');

/* -------------------------------------------------------------------------- */
/* Date helpers (UTC, day precision)                                          */
/* -------------------------------------------------------------------------- */

const DAY_MS = 86_400_000;

/** Days since the Unix epoch for an ISO date (YYYY-MM-DD or full ISO). */
export function dayNumber(iso: string): number {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return Math.floor(d.getTime() / DAY_MS);
}

export function isoFromDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  return isoFromDay(dayNumber(iso) + n);
}

export function daysBetween(a: string, b: string): number {
  return dayNumber(b) - dayNumber(a);
}

/** "10.06": the brand's own date shorthand (see the tease banner, "Revealed 10.20"). */
export function fmtDot(iso: string): string {
  return `${iso.slice(5, 7)}.${iso.slice(8, 10)}`;
}

/** "Tue, Oct 6" */
export function fmtDay(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** "Oct 6" */
export function fmtShort(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** "26 Sep 2026" */
export function fmtLong(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** "09:00 PT" from a UTC instant (handles PDT/PST). */
export function fmtPacific(isoInstant: string): string {
  return `${new Date(isoInstant).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Los_Angeles',
  })} PT`;
}

export function fmtUtc(isoInstant: string): string {
  return `${isoInstant.slice(11, 16)} UTC`;
}

export const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');
export const fmtPct = (r: number, digits = 0) =>
  `${(r * 100).toFixed(digits).replace(/\.0$/, '')}%`;

const NUMBER_WORDS = [
  'Zero',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
];
export const numberWord = (n: number) => NUMBER_WORDS[n] ?? String(n);

/* -------------------------------------------------------------------------- */
/* Document meta                                                              */
/* -------------------------------------------------------------------------- */

const REPO = 'https://github.com/alexmorrison12/detent';

export const PLAN_META = {
  version: '1.0',
  revised: '2026-09-26',
  status: 'Approved',
  owner: 'Launch team (founder, growth, community, ops)',
  repo: REPO,
  liveUrl: 'https://alexmorrison12.github.io/detent/',
  docs: {
    plan: `${REPO}/blob/main/docs/LAUNCH_PLAN.md`,
    ops: `${REPO}/blob/main/docs/OPERATIONS.md`,
    readme: `${REPO}/blob/main/README.md`,
    launchConfig: `${REPO}/blob/main/src/config/launch.ts`,
    planData: `${REPO}/blob/main/src/data/launch-plan.ts`,
  },
} as const;

/* -------------------------------------------------------------------------- */
/* Goals and the north star                                                   */
/* -------------------------------------------------------------------------- */

export const BATCHES = [
  { id: 1, ships: LAUNCH.firstShipBatch, units: 2500 },
  { id: 2, ships: LAUNCH.secondShipBatch, units: 5000 },
] as const;

export const NORTH_STAR = {
  name: 'Committed units',
  definition: 'Deposits held plus orders paid, net of refunds and cancellations.',
  why: 'It is the one number that means someone put money down for a thing they can’t touch yet. Signups are a leading indicator; committed units are the business.',
  milestones: [
    { date: '2026-12-01', value: 2500, note: 'Batch 1 is full on deposits' },
    { date: '2026-12-04', value: 3300, note: 'Launch pricing ends' },
    { date: '2026-12-31', value: 4000, note: 'First month of the live store' },
  ],
} as const;

export const GOALS: { title: string; measure: string }[] = [
  {
    title: 'Fill Batch 1 before launch day',
    measure: `${fmtInt(BATCHES[0].units)} refundable deposits by ${fmtShort(PHASES.launch.starts)}`,
  },
  {
    title: 'Build a line worth converting',
    measure: `15,000 confirmed waitlisters by ${fmtShort(addDays(PHASES.reserve.starts, -1))}`,
  },
  {
    title: 'Sell through launch week',
    measure: `800 paid orders by ${fmtShort(PHASES.live.starts)}, when the $${one.launchPriceUsd} price ends`,
  },
  {
    title: 'Keep deposits honest',
    measure: 'Deposit refund rate under 10%; zero fake-urgency incidents',
  },
  {
    title: 'Stay fast under load',
    measure: 'LCP under 2.0 s at p75 on mobile for every landing page, launch day included',
  },
];

/* -------------------------------------------------------------------------- */
/* Funnel model: one set of rates drives the page, the doc and the calculator */
/* -------------------------------------------------------------------------- */

export const MODEL = {
  /** Visits to /l/tease/ and /l/waitlist/ (plus /for/ pages) before reservations open. */
  visits: 230_000,
  /** Blended visit → email (5% cold, 12% warm). */
  signupRate: 0.07,
  /** New signups generated per signup (one generation, conservative). */
  kFactor: 0.35,
  /** Double opt-in completion. */
  confirmRate: 0.7,
  /** Confirmed waitlisters who place a deposit in the first 14 days. */
  waitlistToDeposit: 0.15,
  /** New visitors to /l/reserve/ (not on the list) who place a deposit. */
  reservePageRate: 0.08,
  reservePageVisitors: 2750,
  /** Deposits that become paid orders when the batch ships. */
  depositToOrder: 0.8,
  /** Launch week (12.01–12.04) paid orders. */
  launchWeekOrders: 800,
  /** Live store sessions and conversion, 12.04–12.31. */
  liveSessions: 28_000,
  storeRate: 0.025,
  /** Share of orders that are Founders Edition (plan assumption). */
  foundersMix: 0.25,
  budgetUsd: 200_000,
} as const;

export interface Cohort {
  visits: number;
  signups: number;
  referred: number;
  list: number;
  confirmed: number;
  depositsFromList: number;
  depositsFromReservePage: number;
  deposits: number;
  ordersFromDeposits: number;
}

/** The waitlist chain for a given number of pre-reservation visits. */
export function cohort(visits: number = MODEL.visits): Cohort {
  const signups = visits * MODEL.signupRate;
  const referred = signups * MODEL.kFactor;
  const list = signups + referred;
  const confirmed = list * MODEL.confirmRate;
  const depositsFromList = confirmed * MODEL.waitlistToDeposit;
  const depositsFromReservePage = MODEL.reservePageVisitors * MODEL.reservePageRate;
  const deposits = depositsFromList + depositsFromReservePage;
  return {
    visits,
    signups,
    referred,
    list,
    confirmed,
    depositsFromList,
    depositsFromReservePage,
    deposits,
    ordersFromDeposits: deposits * MODEL.depositToOrder,
  };
}

/** Orders and gross revenue at plan (launch price for reservers and launch week, list after). */
export function planOutcome() {
  const c = cohort();
  const liveOrders = MODEL.liveSessions * MODEL.storeRate;
  const mix = (orders: number, onePrice: number) =>
    orders * MODEL.foundersMix * founders.priceUsd + orders * (1 - MODEL.foundersMix) * onePrice;
  const orders = c.ordersFromDeposits + MODEL.launchWeekOrders + liveOrders;
  const gross =
    mix(c.ordersFromDeposits, one.launchPriceUsd) +
    mix(MODEL.launchWeekOrders, one.launchPriceUsd) +
    mix(liveOrders, one.priceUsd);
  return {
    deposits: c.deposits,
    ordersFromDeposits: c.ordersFromDeposits,
    launchWeekOrders: MODEL.launchWeekOrders,
    liveOrders,
    orders,
    committedByYearEnd: c.deposits + MODEL.launchWeekOrders + liveOrders,
    gross,
    costPerOrder: MODEL.budgetUsd / orders,
    foundersOrders: orders * MODEL.foundersMix,
  };
}

/* -------------------------------------------------------------------------- */
/* Funnel stages (targets, alarms, published benchmarks)                      */
/* -------------------------------------------------------------------------- */

export interface FunnelStage {
  id: string;
  label: string;
  /** How it is measured from track() events (see docs/OPERATIONS.md). */
  events: string;
  target: number;
  /** Below this we stop spending and fix the page. */
  alarm: number;
  /** Published benchmark range, or null where none exists. */
  benchmark: [number, number] | null;
  benchmarkNote: string;
  why: string;
  phase: Phase;
}

export const FUNNEL: FunnelStage[] = [
  {
    id: 'visit-email',
    label: 'Visit → email',
    events: 'landing view → lead_submit',
    target: MODEL.signupRate,
    alarm: 0.04,
    benchmark: [0.034, 0.09],
    benchmarkNote: 'Waitlist pages: 3.4% median, 8–9% top decile',
    why: '5% from cold paid traffic, 12% from warm and referred. The dial is the hook: people who turn it are the ones who sign up.',
    phase: 'tease',
  },
  {
    id: 'email-confirm',
    label: 'Email → confirmed',
    events: 'lead_submit → email_verified',
    target: MODEL.confirmRate,
    alarm: 0.55,
    benchmark: [0.55, 0.72],
    benchmarkNote: 'Double opt-in: 55–58% median, 70%+ top quartile',
    why: 'The confirm email is the reward email: “Confirm and we’ll send you the date reservations open.”',
    phase: 'tease',
  },
  {
    id: 'email-referral',
    label: 'Email → referral',
    events: 'lead_submit → lead_submit (referred)',
    target: 0.15,
    alarm: 0.09,
    benchmark: [0.09, 0.18],
    benchmarkNote: 'Share of signups who refer one friend: 9–10% median, 18%+ strong',
    why: 'Rewards are feel profiles and early access, never discounts. Only confirmed friends count.',
    phase: 'waitlist',
  },
  {
    id: 'waitlist-deposit',
    label: 'Waitlist → deposit',
    events: 'email_verified → reserve_submit (14 days)',
    target: MODEL.waitlistToDeposit,
    alarm: 0.08,
    benchmark: [0.05, 0.25],
    benchmarkNote: 'Waitlist to paid deposit: 5–25%, about 20% if deposits open within a month',
    why: 'Reservations open 21 days after reveal, before the list goes cold.',
    phase: 'reserve',
  },
  {
    id: 'reserve-page',
    label: 'Reserve page → deposit',
    events: '/l/reserve/ view → reserve_submit',
    target: MODEL.reservePageRate,
    alarm: 0.05,
    benchmark: [0.1, 0.2],
    benchmarkNote: 'Strong preorder pages: 10–20% of warm visitors',
    why: 'Blended with cold traffic, so we plan below the warm benchmark on purpose.',
    phase: 'reserve',
  },
  {
    id: 'deposit-order',
    label: 'Deposit → order',
    events: 'reserve_submit → balance_paid',
    target: MODEL.depositToOrder,
    alarm: 0.7,
    benchmark: null,
    benchmarkNote: 'No public benchmark. This is our assumption; we re-baseline on Batch 1.',
    why: 'Review units reach independent reviewers before any balance is charged, so people decide with evidence.',
    phase: 'launch',
  },
  {
    id: 'store',
    label: 'Store session → order',
    events: 'session → checkout_complete',
    target: MODEL.storeRate,
    alarm: 0.015,
    benchmark: [0.012, 0.024],
    benchmarkNote: 'Consumer electronics stores: 1.2–2.4% sitewide',
    why: 'One product, one page that shows the feel, express checkout. Single-SKU stores beat catalog averages.',
    phase: 'live',
  },
];

/* -------------------------------------------------------------------------- */
/* Phases                                                                     */
/* -------------------------------------------------------------------------- */

export interface Kpi {
  metric: string;
  target: string;
  alarm: string;
}

export interface PhasePlan {
  id: Phase;
  /** The instant the phase flips (UTC). Launch and Live come from LAUNCH. */
  flipAt: string;
  objective: string;
  offer: string;
  audience: string;
  channels: string[];
  kpis: Kpi[];
  exit: string;
}

export const PHASE_PLANS: Record<Phase, PhasePlan> = {
  tease: {
    id: 'tease',
    flipAt: '2026-10-06T16:00:00Z',
    objective:
      'Get 4,000 people to hand over an email before they know the price, on the strength of one turn of the dial.',
    offer: `A first look on reveal day, and first claim on the ${LP} launch price. No discount code, no giveaway.`,
    audience:
      'Warm first: the SmartKnob and maker communities, the founders’ own followers, 100 SDK testers. Cold paid traffic only as a capped test of the 5% benchmark.',
    channels: [
      'Silhouette drop: the knob in shadow, one click of audio',
      'Founder essay on /story/: “Why a knob?”',
      'Crack the Safe and Daily Detent go public on 10.13',
      'Capped cold paid test, $6,000 across four audiences',
    ],
    kpis: [
      { metric: 'Visit → email', target: '5% cold · 12% warm', alarm: 'under 3% cold' },
      { metric: 'Visitors who turn the dial', target: '40%', alarm: 'under 25%' },
      { metric: 'Double opt-in', target: '70%', alarm: 'under 55%' },
      { metric: 'Signups by 10.19', target: '4,000', alarm: 'under 2,000' },
    ],
    exit: 'Cold visit → email holds at 5% for seven straight days. If it doesn’t, we rewrite the tease before reveal day, not after.',
  },
  waitlist: {
    id: 'waitlist',
    flipAt: '2026-10-20T16:00:00Z',
    objective:
      'Turn curiosity into a line: 15,000 confirmed waitlisters by 11.09, about a quarter of them brought in by a friend.',
    offer:
      `Free. Every friend who confirms earns you a reward. ${referralSummary()}`,
    audience:
      'Everyone the reveal reaches, routed by the one-tap question “What will you turn?” into editors, producers, designers and developers.',
    channels: [
      'Reveal on 10.20: film, specs and price, then one drop a day to 10.23',
      'Show HN on 10.27: the open SDK and firmware, with a technical write-up',
      'Discord opens to everyone on 10.27, once 200 members are seeded',
      'Message-matched paid social to /for/ pages, $14,000',
      'Creator briefings under a 12.01 embargo',
    ],
    kpis: [
      { metric: 'Signups, all sources', target: '21,500', alarm: 'under 12,000' },
      { metric: 'Confirmed by 11.09', target: '15,000', alarm: 'under 8,000' },
      { metric: 'Signups who refer a friend', target: '15%', alarm: 'under 9%' },
      { metric: 'Discord members', target: '2,000', alarm: 'under 800' },
    ],
    exit: 'Reservations open on 11.10 at 09:00 PT whatever the count. The date has been public since reveal day, and we keep dates.',
  },
  reserve: {
    id: 'reserve',
    flipAt: '2026-11-10T17:00:00Z',
    objective: `Fill Batch 1: ${fmtInt(BATCHES[0].units)} refundable deposits before launch day.`,
    offer: `$${LAUNCH.depositUsd}, fully refundable in one click, locks the $${one.launchPriceUsd} launch price until your batch ships. Founders Edition: $${LAUNCH.foundersDepositUsd} holds a numbered serial. Reservations ship in ${PHASES.reserve.ships}.`,
    audience:
      'Confirmed waitlisters first (the 72-hour Founders window goes to people with three confirmed referrals), then everyone.',
    channels: [
      'Reservation email to every confirmed waitlister, 11.10 at 09:00 PT',
      'Founders priority window 11.10 → 11.13 for three-referral waitlisters',
      '“How it’s made” CNC film; batch meter from real counts (live mode)',
      '60 creator units ship 11.16 under embargo',
      'Retargeting of waitlisters who haven’t reserved, $18,000',
    ],
    kpis: [
      { metric: 'Waitlist → deposit, 14 days', target: '15%', alarm: 'under 8%' },
      { metric: '/l/reserve/ visit → deposit', target: '8%', alarm: 'under 5%' },
      { metric: 'Deposits by 11.30', target: fmtInt(BATCHES[0].units), alarm: 'under 1,200' },
      { metric: 'Deposit refund rate', target: 'under 10%', alarm: 'over 15%' },
    ],
    exit: 'Launch day is fixed. If Batch 1 fills early, Batch 2 opens the same hour with its April date on the button.',
  },
  launch: {
    id: 'launch',
    flipAt: LAUNCH.launchDate,
    objective:
      'Turn launch-week attention into 800 paid orders in 72 hours, with no number on the page that we can’t source.',
    offer: `$${one.launchPriceUsd} for 72 hours, ending ${fmtDot(LAUNCH.launchPriceEnds.slice(0, 10))} at ${fmtPacific(LAUNCH.launchPriceEnds)}. Free shipping, ${PAYMENT.trialDays}-day studio trial. Launch-week orders ship in ${PHASES.launch.ships}.`,
    audience:
      'The whole list, plus everyone the creator embargo lift, the film and Product Hunt bring in.',
    channels: [
      'Embargo lifts 12.01 at 09:00 PT: 60 creator videos, every one disclosed',
      'Launch film and email to the full list',
      'Product Hunt 12.02 at 00:01 PT',
      'Discord AMA 12.03',
      'Launch cut-downs to all four audiences, $12,000',
    ],
    kpis: [
      { metric: 'Paid orders by 12.04', target: '800', alarm: 'under 400' },
      { metric: 'Buy clicks per product view', target: '8%', alarm: 'under 5%' },
      { metric: 'Checkout completion', target: '60%', alarm: 'under 45%' },
      { metric: 'Creator posts with disclosure', target: '100%', alarm: 'any miss' },
    ],
    exit: 'Automatic. Launch pricing ends at 17:00 UTC on 12.04 and the site flips to Live the same minute.',
  },
  live: {
    id: 'live',
    flipAt: LAUNCH.launchPriceEnds,
    objective:
      'Run the store as one product page: 2.5% of sessions become orders, and every week the page gets a little faster and a little clearer.',
    offer: `$${one.priceUsd}, free shipping, ${PAYMENT.trialDays}-day studio trial, ${PAYMENT.warrantyYears}-year warranty. New orders ship in ${PHASES.live.ships}, and the date is on the button.`,
    audience: 'Search, AI assistants, creator affiliate links, the /for/ pages and word of mouth.',
    channels: [
      'Evergreen /for/ pages and search',
      'Creator affiliate codes, disclosed',
      'Feel Friday: one community profile a week',
      'Weekly CRO review (docs/OPERATIONS.md)',
    ],
    kpis: [
      { metric: 'Session → order', target: '2.5%', alarm: 'under 1.5%' },
      { metric: 'Checkout completion', target: '60%', alarm: 'under 45%' },
      { metric: 'Deposit → order at capture', target: '80%', alarm: 'under 70%' },
      { metric: 'AI-referred conversion', target: 'reported weekly', alarm: 'untracked' },
    ],
    exit: 'There isn’t one. The plan hands over to docs/OPERATIONS.md.',
  },
};

/** Last day of a phase (inclusive), or null for Live. */
export function phaseEnds(id: Phase): string | null {
  const i = PHASE_ORDER.indexOf(id);
  const next = PHASE_ORDER[i + 1];
  return next ? addDays(PHASES[next].starts, -1) : null;
}

export function phaseDays(id: Phase): number | null {
  const end = phaseEnds(id);
  return end ? daysBetween(PHASES[id].starts, end) + 1 : null;
}

/* -------------------------------------------------------------------------- */
/* Moments on the scale                                                       */
/* -------------------------------------------------------------------------- */

export type MomentKind = 'site' | 'press' | 'platform' | 'community' | 'creators' | 'price';

export interface Moment {
  date: string;
  /** Pacific time, when the hour matters. */
  time?: string;
  label: string;
  detail: string;
  kind: MomentKind;
}

export const MOMENTS: Moment[] = [
  {
    date: '2026-09-28',
    label: 'Prep week',
    detail: 'Creator shortlist, press kit, private Discord seeding',
    kind: 'community',
  },
  {
    date: PHASES.tease.starts,
    time: '09:00',
    label: 'Silhouette drop',
    detail: 'The knob in shadow and one click of audio. /l/tease/ goes live.',
    kind: 'site',
  },
  {
    date: '2026-10-13',
    label: 'Games go public',
    detail: 'Crack the Safe and Daily Detent, new every day at 00:00 UTC',
    kind: 'site',
  },
  {
    date: PHASES.waitlist.starts,
    time: '09:00',
    label: 'Reveal',
    detail: 'Film, specs, price. Waitlist and referrals open.',
    kind: 'press',
  },
  {
    date: '2026-10-21',
    label: 'Reveal week',
    detail: 'The Feel Engine, The Face, Founders Edition: one a day to 10.23',
    kind: 'site',
  },
  {
    date: '2026-10-27',
    time: '08:30',
    label: 'Show HN',
    detail: 'A technical write-up on the open SDK and firmware. Discord opens.',
    kind: 'platform',
  },
  {
    date: '2026-11-03',
    label: 'Date email',
    detail: `Reservations open 11.10: what ${DEP} does, with a calendar file`,
    kind: 'site',
  },
  {
    date: PHASES.reserve.starts,
    time: '09:00',
    label: 'Reservations open',
    detail: '72-hour Founders window for three-referral waitlisters',
    kind: 'price',
  },
  {
    date: '2026-11-13',
    time: '09:00',
    label: 'Founders for all',
    detail: 'The priority window closes; numbered serials open to everyone',
    kind: 'price',
  },
  {
    date: '2026-11-16',
    label: 'Creator units ship',
    detail: '60 units, embargo until 12.01 at 09:00 PT',
    kind: 'creators',
  },
  {
    date: '2026-11-27',
    label: 'No Black Friday',
    detail: 'Feel Friday instead. The launch price is the only price cut.',
    kind: 'price',
  },
  {
    date: PHASES.launch.starts,
    time: '09:00',
    label: 'Launch',
    detail: 'Embargo lifts. Orders open at the launch price.',
    kind: 'press',
  },
  {
    date: '2026-12-02',
    time: '00:01',
    label: 'Product Hunt',
    detail: 'Maker comment with a feel link',
    kind: 'platform',
  },
  {
    date: '2026-12-03',
    time: '10:00',
    label: 'Discord AMA',
    detail: 'Founders and the firmware lead',
    kind: 'community',
  },
  {
    date: PHASES.live.starts,
    time: '09:00',
    label: 'Launch price ends',
    detail: 'The only countdown on the site, and it is real',
    kind: 'price',
  },
];

/** After the main scale: month precision only, never an invented day. */
export const AFTER: { when: string; label: string; detail: string }[] = [
  {
    when: 'January 2027',
    label: 'Review units',
    detail:
      '30 production units to independent reviewers. Reviews publish while every deposit is still refundable.',
  },
  {
    when: LAUNCH.firstShipBatch,
    label: 'Batch 1 ships',
    detail: `${fmtInt(BATCHES[0].units)} units. Balances are charged as each unit ships, never before.`,
  },
  {
    when: LAUNCH.secondShipBatch,
    label: 'Batch 2 ships',
    detail: `${fmtInt(BATCHES[1].units)} units, including launch-week and December orders.`,
  },
];

/** The main scale runs Monday to Sunday, 13 weeks, so every week tick is a Monday. */
export const SCALE = { start: '2026-09-21', end: '2026-12-20' } as const;

/* -------------------------------------------------------------------------- */
/* Pricing                                                                     */
/* -------------------------------------------------------------------------- */

export interface PricePoint {
  usd: number;
  name: string;
  job: string;
  why: string;
  /** Where the label sits on the price scale (avoids collisions at narrow widths). */
  lane: 'above' | 'below';
}

export const COST_PER_WORKDAY = one.priceUsd / (5 * 250);

export const PRICE_POINTS: PricePoint[] = [
  {
    usd: LAUNCH.depositUsd,
    name: 'Deposit',
    job: 'Filters intent',
    why: `${fmtPct(LAUNCH.depositUsd / one.launchPriceUsd, 1)} of the launch price. Low enough that nobody needs to ask anyone, high enough to separate a buyer from a browser. Credited in full, refundable in one click.`,
    lane: 'below',
  },
  {
    usd: LAUNCH.foundersDepositUsd,
    name: 'Founders deposit',
    job: 'Stops serial squatting',
    why: `A Founders deposit holds one numbered serial out of ${RUN}. A higher bar keeps people from parking on numbers they won’t buy.`,
    lane: 'above',
  },
  {
    usd: one.launchPriceUsd,
    name: 'Launch price',
    job: 'Rewards commitment',
    why: `$${one.priceUsd - one.launchPriceUsd} off, for reservers until their batch ships and for everyone for 72 hours on launch. A dated reward, not a permanent discount.`,
    lane: 'above',
  },
  {
    usd: one.priceUsd,
    name: 'List price',
    job: 'The anchor',
    why: `Shown next to the launch price from reveal day, so $${one.launchPriceUsd} is a real saving and never a fake strikethrough. Priced against the workflow it replaces: a jog wheel, a MIDI encoder and a macro pad.`,
    lane: 'below',
  },
  {
    usd: founders.priceUsd,
    name: 'Founders Edition',
    job: 'A real second product',
    why: `+$${founders.priceUsd - one.priceUsd} buys Tally anodize, a serial from 0001 to ${String(LAUNCH.foundersRun).padStart(4, '0')}, the walnut plinth, the Founders feel pack and early firmware for life. It anchors high because it is worth more, not because it is a decoy.`,
    lane: 'above',
  },
];

export const PRICE_RULES: string[] = [
  'No decoy tier. Two real editions; the Founders run is finite and says so.',
  'No price tests. Everyone sees the same price on the same day.',
  'No Black Friday. The launch price is the only price cut in year one.',
  `Cost per use (about $${COST_PER_WORKDAY.toFixed(2)} a workday over five years) lives in a tooltip, and only if it wins a test.`,
  'Pay-over-time appears in the Live phase only, and only with the provider’s own numbers.',
];

/* -------------------------------------------------------------------------- */
/* Platform decisions                                                         */
/* -------------------------------------------------------------------------- */

export const DECISIONS: { platform: string; verdict: string; when: string | null; why: string }[] =
  [
    {
      platform: 'Kickstarter',
      verdict: 'No.',
      when: null,
      why: 'We take refundable deposits on our own store. We keep the customer list, set our own one-click refund terms, skip the 5% platform fee, and the store is already the demo. Backers aren’t customers; depositors are.',
    },
    {
      platform: 'Hacker News',
      verdict: 'Yes.',
      when: '2026-10-27',
      why: 'Show HN at 08:30 PT on a Tuesday, linking the SDK repository and a technical write-up, not the store. The founder answers every comment for six hours. Nobody asks for votes.',
    },
    {
      platform: 'Product Hunt',
      verdict: 'Yes.',
      when: '2026-12-02',
      why: 'The day after launch, at 00:01 PT, so launch day belongs to customers. Maker comment tells the story and links a feel you can turn. Supporters come from the Discord, never from vote requests.',
    },
  ];

/* -------------------------------------------------------------------------- */
/* Channels: creators, community, paid                                        */
/* -------------------------------------------------------------------------- */

export const CREATORS = {
  total: 60,
  perAudience: 15,
  tiers: '40 mid-tier (100k–1M subscribers) and 20 tool-obsessed micro creators (10k–100k)',
  paid: '20 of the 60 get a flat $2,000–$4,000 for a dedicated video. The rest keep the unit and owe us nothing.',
  rules: [
    'No script approval. Negative reviews are allowed, in writing.',
    'Disclosure in the video and in the first line of the post, never only in a bio.',
    'Every creator gets a ?ref= code, prerelease SDK builds and their own feel profile in /profiles/.',
    'Units ship 11.16. Embargo lifts 12.01 at 09:00 PT, for everyone at once.',
  ],
} as const;

export const COMMUNITY = {
  opens: '2026-10-27',
  seeded: 200,
  question: 'What will you turn?',
  roles: ['Editing', 'Music', 'Design & 3D', 'Code', 'Streaming'],
  channels: [
    '#start-here',
    '#feel-lab',
    '#daily-detent',
    '#crack-the-safe',
    '#show-your-desk',
    '#sdk-dev',
    '#firmware-roadmap',
    '#launch-desk',
  ],
  rituals: [
    'Feel Friday: one community profile featured on the site every week',
    'SDK office hours in #sdk-dev, Wednesdays',
    'AMA with the founders and the firmware lead on 12.03',
  ],
  rules: [
    'It opens only once 200 people are already inside. An empty server is anti-proof.',
    'One invite code per /for/ page, so Discord’s own counts attribute joins.',
    'Someone from the team is in the server 09:00–21:00 PT every day until 12.04.',
  ],
} as const;

export interface PaidAudience {
  audience: AudienceId;
  label: string;
  headline: string;
  landing: string;
  hook: string;
  platforms: string;
  budgetUsd: number;
}

const PAID_DETAIL: Record<AudienceId, { hook: string; platforms: string; share: number }> = {
  editors: {
    hook: 'One take: trimming in Resolve, frame counter on screen, one click per frame',
    platforms: 'YouTube in-stream, Instagram Reels',
    share: 0.35,
  },
  musicians: {
    hook: 'A fader ride that bumps at unity gain, audio on',
    platforms: 'YouTube, Instagram, TikTok',
    share: 0.25,
  },
  designers: {
    hook: 'Rotate an object to exactly 37.5° without typing',
    platforms: 'Instagram, TikTok',
    share: 0.25,
  },
  developers: {
    hook: 'Magnet snapping through a 900-line diff',
    platforms: 'Reddit, X, newsletter sponsorships',
    share: 0.15,
  },
};

export const PAID_TOTAL_USD = 50_000;

export const PAID: PaidAudience[] = AUDIENCES.map((a) => ({
  audience: a.id,
  label: a.label,
  headline: a.headline,
  landing: `/for/${a.id}/`,
  hook: PAID_DETAIL[a.id].hook,
  platforms: PAID_DETAIL[a.id].platforms,
  budgetUsd: PAID_TOTAL_USD * PAID_DETAIL[a.id].share,
}));

export const PAID_RULES: string[] = [
  'The ad headline is the landing page headline, word for word.',
  'The first frame shows the same dial state the page hero shows.',
  'The landing page’s button is PhaseCTA, so the offer in the ad is the offer on the page.',
  'utm_source and utm_campaign=<phase>-<audience> on every link. Creators use ?ref= instead.',
  'Frequency capped at three per person per week. Anyone who converted is excluded.',
];

export const BUDGET: { item: string; usd: number; note: string }[] = [
  {
    item: 'Creator seeding',
    usd: 70_000,
    note: '60 units at landed cost, 20 flat fees, shipping and duties',
  },
  {
    item: 'Paid social',
    usd: PAID_TOTAL_USD,
    note: 'Tease $6k, Waitlist $14k, Reserve $18k, Launch $12k',
  },
  {
    item: 'Film and content',
    usd: 40_000,
    note: 'Reveal film, CNC film, four one-take audience clips',
  },
  { item: 'PR and press kit', usd: 10_000, note: 'B-roll, renders, sound pack, briefings' },
  { item: 'Community', usd: 10_000, note: 'Two part-time moderators through launch, AMA, bots' },
  { item: 'Tools and ops', usd: 10_000, note: 'Email, analytics, waitlist endpoint, support desk' },
  { item: 'Contingency', usd: 10_000, note: 'Held until 12.04, then released to Live' },
];

/* -------------------------------------------------------------------------- */
/* Week-by-week calendar                                                      */
/* -------------------------------------------------------------------------- */

export interface PlanWeek {
  start: string;
  phase: Phase | 'prep';
  site: string;
  community: string;
  creators: string;
  paidUsd: number;
  paid: string;
}

export const WEEKS: PlanWeek[] = [
  {
    start: '2026-09-28',
    phase: 'prep',
    site: 'Tease page and dial toy final. Double opt-in and referral codes tested end to end.',
    community:
      'Private Discord seeded: the team, 100 SDK testers, the creators. Target: 200 people.',
    creators:
      'Shortlist of 60 across four audiences. Press kit v1: B-roll, renders, fact sheet, sound pack.',
    paidUsd: 0,
    paid: 'Four one-take clips shot, one per audience.',
  },
  {
    start: '2026-10-05',
    phase: 'tease',
    site: '10.06 at 09:00 PT: /l/tease/ goes live. One email on reveal day, nothing else.',
    community:
      'Silhouette posted in the SmartKnob and maker communities, inside each one’s self-promotion rules.',
    creators: 'Invitations and NDAs go out. No creator posts yet.',
    paidUsd: 3000,
    paid: 'Cold test to /l/tease/, split across four audiences. Proves or kills the 5% benchmark.',
  },
  {
    start: '2026-10-12',
    phase: 'tease',
    site: '10.13: Crack the Safe and Daily Detent go public. Founder essay: “Why a knob?”',
    community: 'A daily clip: one feel, one sound, name it. Answers in #daily-detent.',
    creators: 'Thirty-minute briefings with the engineer who tuned the feels.',
    paidUsd: 3000,
    paid: 'Keep the two best audiences from week one. Cut the rest.',
  },
  {
    start: '2026-10-19',
    phase: 'waitlist',
    site: '10.20 at 09:00 PT: reveal film, specs, price. Waitlist and referrals open. One drop a day to 10.23.',
    community: 'One thread per drop. The team answers every question the same day.',
    creators: 'Press briefing embargo lifts with the reveal. The press kit goes public on /press/.',
    paidUsd: 5000,
    paid: 'Message-matched ads to the four /for/ pages.',
  },
  {
    start: '2026-10-26',
    phase: 'waitlist',
    site: '10.27: a technical write-up on the open SDK and firmware, on /changelog/.',
    community: '10.27 at 08:30 PT: Show HN. Discord opens to everyone. Feel Friday #1 on 10.30.',
    creators:
      'Creators get beta firmware and prerelease SDK builds. Three commit to publishing a feel profile.',
    paidUsd: 5000,
    paid: 'Developers get budget only if Show HN lands. Otherwise hold it.',
  },
  {
    start: '2026-11-02',
    phase: 'waitlist',
    site: `11.03 email: reservations open 11.10, here’s what ${DEP} does, calendar file attached.`,
    community: 'Referral push: three confirmed friends earn the Founders priority window.',
    creators: 'List locked at 60. Addresses and disclosure terms signed.',
    paidUsd: 4000,
    paid: 'Retarget tease and waitlist visitors who never signed up.',
  },
  {
    start: '2026-11-09',
    phase: 'reserve',
    site: '11.10 at 09:00 PT: reservations open. Founders priority window to 11.13.',
    community: '#launch-desk staffed 09:00–21:00 PT for the first 72 hours.',
    creators: 'Press gets the reservation terms and batch dates in writing.',
    paidUsd: 8000,
    paid: 'Waitlisters who haven’t reserved, plus lookalikes of depositors.',
  },
  {
    start: '2026-11-16',
    phase: 'reserve',
    site: '“How it’s made” CNC film on /story/. Batch meter goes live from real counts (live mode).',
    community: 'Feel Friday #3. SDK office hours.',
    creators: '11.16: 60 creator units ship. Embargo: 12.01 at 09:00 PT.',
    paidUsd: 6000,
    paid: 'Retargeting plus the best-performing /for/ audience.',
  },
  {
    start: '2026-11-23',
    phase: 'reserve',
    site: '11.27: Feel Friday, not Black Friday. The launch price is the only price cut, and everyone gets it.',
    community: 'Quiet week. Moderators on a light rota.',
    creators: 'Creator questions answered within 24 hours. Disclosure checklist resent.',
    paidUsd: 4000,
    paid: 'Warm retargeting only. Cold ads pause while holiday ad prices spike.',
  },
  {
    start: '2026-11-30',
    phase: 'launch',
    site: `12.01 at 09:00 PT: orders open at ${LP} for 72 hours. 12.04 at 09:00 PT: the site flips to Live.`,
    community: '12.03: Discord AMA with the founders and the firmware lead.',
    creators: '12.01 at 09:00 PT: embargo lifts. 12.02 at 00:01 PT: Product Hunt.',
    paidUsd: 12000,
    paid: 'Launch film cut-downs to all four audiences, capped at three views per person.',
  },
  {
    start: '2026-12-07',
    phase: 'live',
    site: 'Weekly CRO review starts. FAQ updated from the first week of tickets.',
    community: 'Public launch retro: what worked, what didn’t, what’s next.',
    creators: 'A roundup of every creator video, each with its disclosure shown.',
    paidUsd: 0,
    paid: 'Launch budget closed. Evergreen spend moves to the operations plan.',
  },
  {
    start: '2026-12-14',
    phase: 'live',
    site: `The product page says it plainly: new orders ship in Batch 2, ${LAUNCH.secondShipBatch}. Not a holiday gift.`,
    community: 'Feel Friday continues every week.',
    creators: 'Affiliate codes stay live for creators who want them, disclosed.',
    paidUsd: 0,
    paid: 'Evergreen only.',
  },
];

/* -------------------------------------------------------------------------- */
/* Experiments                                                                */
/* -------------------------------------------------------------------------- */

/** Visitors per arm for a two-sided test at α = 0.05 and 80% power. */
export function sampleSizePerArm(baseline: number, relativeLift: number): number {
  const p1 = baseline;
  const p2 = baseline * (1 + relativeLift);
  const z = 1.959964 + 0.841621;
  return Math.ceil((z * z * (p1 * (1 - p1) + p2 * (1 - p2))) / ((p2 - p1) * (p2 - p1)));
}

export interface Experiment {
  id: string;
  name: string;
  hypothesis: string;
  metric: string;
  baseline: number;
  lift: number;
  phase: Phase;
  where: string;
}

export const EXPERIMENTS: Experiment[] = [
  {
    id: 'E01',
    name: 'Ask after the dial, not before',
    hypothesis:
      'If the email form appears after a visitor has turned the dial through three feels, more of them sign up, because they have felt the product first.',
    metric: 'Visit → email',
    baseline: 0.07,
    lift: 0.2,
    phase: 'tease',
    where: '/l/tease/',
  },
  {
    id: 'E02',
    name: 'One tap before the email field',
    hypothesis:
      'If step one is a single tap (“What will you turn?”) and step two is the email, completion rises, because the first step costs nothing.',
    metric: 'Form view → lead_submit',
    baseline: 0.3,
    lift: 0.12,
    phase: 'tease',
    where: '/l/tease/, /l/waitlist/',
  },
  {
    id: 'E03',
    name: 'Confirm to get the date',
    hypothesis:
      'If the confirmation email says “Confirm and we’ll send you the date reservations open”, more people confirm than with “Confirm your email”, because confirming earns something concrete.',
    metric: 'Email → confirmed',
    baseline: 0.6,
    lift: 0.1,
    phase: 'tease',
    where: 'Confirmation email',
  },
  {
    id: 'E04',
    name: 'A reward you can feel today',
    hypothesis:
      'If the first referral earns a profile that plays on the site immediately, more people refer than when it earns a display face they see in February.',
    metric: 'Signups who refer',
    baseline: 0.12,
    lift: 0.25,
    phase: 'waitlist',
    where: 'Waitlist success state',
  },
  {
    id: 'E05',
    name: 'Share the feel, not a picture',
    hypothesis:
      'If the share link opens a dial that feels like the sharer’s profile, more friends sign up per share than from a static image card.',
    metric: 'Referred signups per sharer',
    baseline: 0.1,
    lift: 0.3,
    phase: 'waitlist',
    where: 'Referral share sheet',
  },
  {
    id: 'E06',
    name: 'Say how the refund works',
    hypothesis:
      'If the button note reads “Refund in one click, any time before it ships” instead of “Fully refundable”, more visitors reserve and refunds do not rise.',
    metric: 'Reserve page → deposit',
    baseline: 0.08,
    lift: 0.15,
    phase: 'reserve',
    where: '/l/reserve/',
  },
  {
    id: 'E07',
    name: 'Turn to reserve',
    hypothesis:
      'If the reserve button arms after three detents and an end stop, more visitors reserve, because the commitment is physical. The plain button always works too.',
    metric: 'Reserve page → deposit',
    baseline: 0.08,
    lift: 0.15,
    phase: 'reserve',
    where: '/l/reserve/',
  },
  {
    id: 'E08',
    name: 'Audience demo first',
    hypothesis:
      'If /for/ pages open on the app demo (timeline, mixer, canvas, diff) instead of the bare dial, visitors sign up more, because they see their own work.',
    metric: 'Visit → email per audience',
    baseline: 0.07,
    lift: 0.2,
    phase: 'waitlist',
    where: '/for/<audience>/',
  },
  {
    id: 'E09',
    name: 'Hands, not screens',
    hypothesis:
      'If the ad is one take of a hand on the dial with sound, landing visitors sign up more than from a screen recording, because the promise matches the page.',
    metric: 'Paid landing visit → email',
    baseline: 0.05,
    lift: 0.25,
    phase: 'waitlist',
    where: 'Paid social',
  },
  {
    id: 'E10',
    name: 'Cost per workday',
    hypothesis: `If the price block shows “about $${COST_PER_WORKDAY.toFixed(2)} a workday over five years” in a tooltip, buy clicks rise without more returns.`,
    metric: 'Product view → buy click',
    baseline: 0.08,
    lift: 0.12,
    phase: 'live',
    where: '/shop/',
  },
  {
    id: 'E11',
    name: 'Pay over time, quietly',
    hypothesis:
      'If a single line under the price shows four interest-free payments, checkout completion rises and average order value does not fall.',
    metric: 'Checkout completion',
    baseline: 0.55,
    lift: 0.08,
    phase: 'live',
    where: '/shop/ price block',
  },
  {
    id: 'E12',
    name: 'Invite after the value moment',
    hypothesis:
      'If the Discord invite appears on the signup success state instead of the footer, more signups join, because they just got something.',
    metric: 'Signups who join Discord',
    baseline: 0.08,
    lift: 0.3,
    phase: 'waitlist',
    where: 'Waitlist success state',
  },
];

export const EXPERIMENT_RULES: string[] = [
  'Never tested: prices, urgency claims, disclosures, refund terms.',
  'Minimum seven days per test, so every weekday is in both arms.',
  'Ship a winner at 95% confidence with no guardrail breach. Refund rate and support tickets are guardrails on every test.',
  'One test per page at a time. The backlog is ordered; the next test starts when the last one ends.',
];

/* -------------------------------------------------------------------------- */
/* Risks                                                                      */
/* -------------------------------------------------------------------------- */

export interface Risk {
  risk: string;
  signal: string;
  response: string;
  owner: string;
}

export const RISKS: Risk[] = [
  {
    risk: 'Supply chain: the gimbal motor, the encoder or CNC capacity comes up short',
    signal: 'Any long-lead part more than two weeks behind its purchase order',
    response:
      'Two qualified motor suppliers before deposits open. 15% buffer on long-lead parts. Batch sizes come from signed supplier capacity, never from demand.',
    owner: 'Ops lead',
  },
  {
    risk: 'Batch 1 slips past February',
    signal: 'An EVT or DVT milestone more than two weeks late',
    response:
      'A delay notice within 48 hours of knowing, with a new date or an honest “we can’t date it yet”, and a one-click refund. Update launch.ts; the site updates everywhere. Monthly progress log either way.',
    owner: 'Founder',
  },
  {
    risk: 'Fake-urgency temptation on a slow day',
    signal: 'Anyone proposes a timer, a stock counter or “only a few left”',
    response:
      'The only countdown is the real launch price end. Counts come from real data with an as-of time, in live mode only. “Founders sold out” appears when, and only when, it is true. Anyone on the team can veto.',
    owner: 'Everyone',
  },
  {
    risk: 'Refund load: deposit cancellations, then 60-day trial returns',
    signal: 'Deposit refund rate over 10% in any week',
    response:
      'Refunds are self-serve and one click. Budget 10% refunds plus 3–4% card-fee leakage. Read every cancellation reason that week and fix the page that caused it. Returned units are refurbished and sold as such.',
    owner: 'Support lead',
  },
  {
    risk: 'Demand below plan',
    signal: 'Fewer than 8,000 confirmed waitlisters on 11.03',
    response:
      'Drop the Founders priority window rather than invent a queue. Move paid budget to the best audience. Reservations still open on the published date.',
    owner: 'Growth lead',
  },
  {
    risk: 'Demand above plan',
    signal: 'Batch 1 fills before 12.01',
    response:
      'Say “Batch 1 is full” in the banner the same hour and open Batch 2 with its April date. Never sell a unit we can’t date.',
    owner: 'Ops lead',
  },
  {
    risk: 'Reviews say the firmware doesn’t match the demo',
    signal: 'Any reviewer calls a feel on the site “not what it’s like”',
    response:
      'Review units go out in January, before balances are charged, so buyers can cancel after reading. The web demo uses the firmware’s own profile JSON.',
    owner: 'Firmware lead',
  },
  {
    risk: 'A creator leaks before the embargo',
    signal: 'Footage appears before 12.01 at 09:00 PT',
    response:
      'The tease is already a deliberate silhouette leak, so there is little left to spoil. Acknowledge it, move nothing.',
    owner: 'Growth lead',
  },
  {
    risk: 'Launch-day load',
    signal: 'Waitlist or checkout endpoint p95 over 800 ms',
    response:
      'The site is static on GitHub Pages and doesn’t go down. The endpoint is load-tested to 50× the expected peak; checkout is the commerce provider’s hosted page.',
    owner: 'Ops lead',
  },
];

/* -------------------------------------------------------------------------- */
/* The switch: moving the site between phases                                 */
/* -------------------------------------------------------------------------- */

export const RUNBOOK: { step: string; detail: string; code?: string }[] = [
  {
    step: 'Rehearse the day before',
    detail:
      'Open any page with ?phase=<next> and walk the header, the announcement bar, the landing page and /shop/. Then build it for real.',
    code: 'export PUBLIC_LAUNCH_PHASE=<next>\nnpm run check && npm run build && npm run test',
  },
  {
    step: 'Freeze main two hours before',
    detail:
      'No merges until the flip is verified. The deploy that flips the phase should contain nothing else.',
  },
  {
    step: 'Set the repository variable',
    detail:
      'At flip time minus 15 minutes, set LAUNCH_PHASE; the deploy workflow hands it to the build as PUBLIC_LAUNCH_PHASE. Settings → Secrets and variables → Actions → Variables, or from a terminal:',
    code: 'gh variable set LAUNCH_PHASE --body <next>',
  },
  {
    step: 'Redeploy',
    detail:
      'The variable only takes effect on the next build. Run the Pages workflow by hand; a build takes about two minutes.',
    code: 'gh workflow run deploy.yml --ref main && gh run watch',
  },
  {
    step: 'Verify from outside',
    detail: 'A private window (no ?phase= in sessionStorage), then the HTML itself:',
    code: 'curl -s https://alexmorrison12.github.io/detent/ | grep -o \'data-phase="[a-z]*"\'',
  },
  {
    step: 'Then announce',
    detail:
      'The email, the Discord post and the social posts go out after verification, never before.',
  },
  {
    step: 'Roll back if needed',
    detail:
      'Set the variable back and run the workflow again. Nothing else changes, so rollback is the same two commands.',
  },
];

export const PREVIEW_NOTES: string[] = [
  'Append ?phase=<id> to any URL to preview that phase. It persists for the tab (sessionStorage) and never reaches another visitor.',
  '?phase=reset returns the tab to the phase the site was built for.',
  'The phase is applied before first paint, so previews never flash the wrong button.',
];

/* -------------------------------------------------------------------------- */
/* Analytics events the dashboard reads (see docs/OPERATIONS.md)              */
/* -------------------------------------------------------------------------- */

export const EVENTS: {
  name: string;
  when: string;
  props: string;
  status: 'in code' | 'backend' | 'planned';
}[] = [
  {
    name: 'cta_click',
    when: 'Any PhaseCTA button',
    props: 'placement, cta (<phase>:primary|secondary)',
    status: 'in code',
  },
  { name: 'banner_click', when: 'Announcement bar link', props: '(none)', status: 'in code' },
  {
    name: 'lead_submit',
    when: 'Waitlist or tease signup succeeds',
    props: 'source, segment, referred',
    status: 'in code',
  },
  {
    name: 'reserve_submit',
    when: 'A reservation is placed',
    props: 'source, edition, finish',
    status: 'in code',
  },
  {
    name: 'phase_preview',
    when: 'Someone previews a phase on /launch-plan/',
    props: 'phase, via (dial|link|reset)',
    status: 'in code',
  },
  {
    name: 'email_verified',
    when: 'Double opt-in link clicked',
    props: 'segment, referred',
    status: 'backend',
  },
  {
    name: 'balance_paid',
    when: 'A deposit becomes an order at ship time',
    props: 'edition, batch',
    status: 'backend',
  },
  {
    name: 'deposit_refund',
    when: 'A deposit is cancelled',
    props: 'reason, days_held',
    status: 'backend',
  },
  {
    name: 'checkout_complete',
    when: 'The commerce provider confirms payment',
    props: 'edition, finish, value',
    status: 'backend',
  },
];

/** Every payload also carries: channel ('ai', 'direct' or referrer host), phase, path, ts. */
export const EVENT_BASE_FIELDS = ['channel', 'phase', 'path', 'ts'] as const;

/* -------------------------------------------------------------------------- */
/* Positioning                                                                */
/* -------------------------------------------------------------------------- */

export const POSITIONING = {
  statement:
    'For people who make things on a screen for hours, Detent One is an instrument for software: the first input device whose feel changes with what you’re doing. Macro pads and stream controllers give every task the same click. Detent clicks one frame at a time in Resolve, bumps at 0\u00a0dB in Logic, and snaps to every hunk in your diff.',
  refuse: 'A premium customizable controller for creators with beautiful design.',
  order: ['editors', 'musicians', 'developers', 'designers'] as AudienceId[],
  orderWhy: [
    'Editors first: the sharpest pain (overshooting the frame) and a habit of buying $300+ panels.',
    'Producers second: they already think in knobs, and Wall with a bump at unity gain sells itself on audio.',
    'Developers third: fewer buyers, but the open SDK makes them the people who build profiles for everyone else.',
    'Designers and 3D artists fourth: strong fit, longer consideration, reached mostly through the others’ content.',
  ],
  icp: 'Spends four or more hours a day inside one creative or technical app. Owns a keyboard that cost more than $150 and a mouse that cost more than $100, maybe a Stream Deck. Pays for tools that save minutes a day. Trusts specs, demos and other makers; distrusts adjectives.',
  notFor:
    'Gamers shopping for RGB, anyone who wants a $30 volume knob, and procurement departments. We don’t chase them.',
} as const;

/** Convenience: the phase config and plan together, in launch order. */
export const PLAN_PHASES = PHASE_ORDER.map((id) => ({
  ...PHASES[id],
  plan: PHASE_PLANS[id],
  ends: phaseEnds(id),
  days: phaseDays(id),
}));

export { formatUsd };
