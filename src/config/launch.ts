/**
 * Launch phases. One value (`BUILD_PHASE`) moves the whole site through the
 * launch: every CTA, offer line and phase-gated block reads from here.
 *
 * Build-time:  PUBLIC_LAUNCH_PHASE=live npm run build
 * Preview:     append ?phase=waitlist to any URL (persists for the tab session;
 *              ?phase=reset clears it). The inline script in BaseLayout sets
 *              <html data-phase="..."> before first paint, and CSS hides any
 *              element whose data-phase-only list doesn't include it.
 */
import { PAYMENT, byEdition, formatUsd } from '@/data/product';
import { LAUNCH } from './launch-terms';

export { LAUNCH };

export const PHASE_ORDER = ['tease', 'waitlist', 'reserve', 'launch', 'live'] as const;
export type Phase = (typeof PHASE_ORDER)[number];

export interface PhaseCta {
  label: string;
  /** Path relative to the site root (no base). */
  href: string;
  /** One short line under/next to the CTA: the offer or the risk reversal. */
  note: string;
}

export interface PhaseConfig {
  id: Phase;
  name: string;
  /** ISO date the phase begins (inclusive). */
  starts: string;
  /** The landing page that owns this phase. */
  landing: string;
  primary: PhaseCta;
  /** Quieter secondary action shown beside the primary one. */
  secondary: PhaseCta;
  /**
   * What the header and menu CTA become once this visitor has already taken
   * the phase's action (joined the list, reserved): the next useful place.
   */
  returning?: Omit<PhaseCta, 'note'>;
  /** Status line for the announcement bar. */
  banner: string;
  /** The same status in a few words, for phone-width announcement bars. */
  bannerShort: string;
  /**
   * When an order or reservation placed in this phase ships. Batch 1 is
   * filled by deposits; orders from launch day on go to Batch 2
   * (docs/LAUNCH_PLAN.md). Update here if a batch fills or slips.
   */
  ships: string;
}

const STARTS: Record<Phase, string> = {
  tease: '2026-10-06',
  waitlist: '2026-10-20',
  reserve: '2026-11-10',
  launch: '2026-12-01',
  live: '2026-12-04',
};

/** '2026-10-20' -> '10.20', the site's date shorthand. */
const dot = (iso: string) => `${iso.slice(5, 7)}.${iso.slice(8, 10)}`;
/** When the launch price ends, in the launch team's time zone: "Friday, Dec 4, 09:00 PT". */
const priceEndsPT = `${new Date(LAUNCH.launchPriceEnds).toLocaleString('en-US', {
  timeZone: 'America/Los_Angeles',
  weekday: 'long',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})} PT`;
const BATCH_1 = `Batch 1, ${LAUNCH.firstShipBatch}`;
const BATCH_2 = `Batch 2, ${LAUNCH.secondShipBatch}`;
/** Prices the phase copy quotes, from @/data/product (Detent One: the edition every CTA names). */
const ONE = byEdition('one');
const LAUNCH_PRICE = formatUsd(ONE.launchPriceUsd);
const LIST_PRICE = formatUsd(ONE.priceUsd);
const TRIAL = `${PAYMENT.trialDays}-day`;

export const PHASES: Record<Phase, PhaseConfig> = {
  tease: {
    id: 'tease',
    name: 'Tease',
    starts: STARTS.tease,
    landing: '/l/tease/',
    // Works on every page, including the ones that already show the product.
    primary: { label: 'Get launch news', href: '/l/tease/#signal', note: `One email when the list opens ${dot(STARTS.waitlist)}. Nothing else.` },
    secondary: { label: 'Crack the safe', href: '/crack/', note: '' },
    banner: `The waitlist opens ${dot(STARTS.waitlist)}.`,
    bannerShort: `The waitlist opens ${dot(STARTS.waitlist)}.`,
    ships: BATCH_1,
  },
  waitlist: {
    id: 'waitlist',
    name: 'Waitlist',
    starts: STARTS.waitlist,
    landing: '/l/waitlist/',
    primary: { label: 'Join the waitlist', href: '/l/waitlist/', note: 'Free. Every friend who confirms earns you a reward.' },
    secondary: { label: 'Crack the safe', href: '/crack/', note: '' },
    returning: { label: 'Your pass', href: '/l/waitlist/#pass' },
    banner: `The waitlist is open. Every reservation locks the ${LAUNCH_PRICE} launch price.`,
    bannerShort: 'The waitlist is open.',
    ships: BATCH_1,
  },
  reserve: {
    id: 'reserve',
    name: 'Reserve',
    starts: STARTS.reserve,
    landing: '/l/reserve/',
    primary: { label: `Reserve for $${LAUNCH.depositUsd}`, href: '/l/reserve/', note: `Fully refundable. Locks the ${LAUNCH_PRICE} launch price.` },
    secondary: { label: 'Configure yours', href: '/shop/', note: '' },
    returning: { label: 'Your reservation', href: '/l/reserve/' },
    banner: `Reservations are open. Batch 1 ships ${LAUNCH.firstShipBatch}.`,
    bannerShort: `Reservations open. Ships ${LAUNCH.firstShipBatch}.`,
    ships: BATCH_1,
  },
  launch: {
    id: 'launch',
    name: 'Launch day',
    starts: STARTS.launch,
    landing: '/l/launch/',
    // A dated deadline, never a relative one: the build is static for all three days.
    primary: { label: 'Order Detent One', href: '/shop/', note: `${LAUNCH_PRICE} until ${dot(LAUNCH.launchPriceEnds)}. Free shipping.` },
    secondary: { label: 'Watch the film', href: '/l/launch/#film', note: '' },
    banner: `Detent One is here. ${LAUNCH_PRICE} until ${priceEndsPT}.`,
    bannerShort: `${LAUNCH_PRICE} until ${priceEndsPT.replace(/^\w+, /, '')}.`,
    ships: BATCH_2,
  },
  live: {
    id: 'live',
    name: 'Live',
    starts: STARTS.live,
    landing: '/',
    // The longest phase: the price leads, since the first screen shows no other.
    primary: { label: 'Buy Detent One', href: '/shop/', note: `${LIST_PRICE}. Free shipping, ${TRIAL} studio trial.` },
    secondary: { label: 'Compare finishes', href: '/shop/#finishes', note: '' },
    banner: `Detent One is ${LIST_PRICE}, with free shipping and a ${TRIAL} studio trial.`,
    bannerShort: `${LIST_PRICE}. Free shipping, ${TRIAL} trial.`,
    ships: BATCH_2,
  },
};

const envPhase = import.meta.env.PUBLIC_LAUNCH_PHASE as string | undefined;

/**
 * 'demo' (default): Detent is a concept. Forms stay in the browser, checkout
 * is a demo, and structured data omits Offer objects so nothing claims a real
 * sale. 'live': real endpoints are configured (PUBLIC_WAITLIST_ENDPOINT etc.)
 * and offers/feeds are emitted.
 */
export type SiteMode = 'demo' | 'live';
export const MODE: SiteMode = import.meta.env.PUBLIC_SITE_MODE === 'live' ? 'live' : 'demo';

/** The phase the static HTML is built for. */
export const BUILD_PHASE: Phase = PHASE_ORDER.includes(envPhase as Phase)
  ? (envPhase as Phase)
  : 'reserve';

export function phaseIndex(p: Phase): number {
  return PHASE_ORDER.indexOf(p);
}
