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
  /** Status line for the announcement bar. */
  banner: string;
}

export const PHASES: Record<Phase, PhaseConfig> = {
  tease: {
    id: 'tease',
    name: 'Tease',
    starts: '2026-10-06',
    landing: '/l/tease/',
    primary: { label: 'Get the first look', href: '/l/tease/#signal', note: 'One email on reveal day. Nothing else.' },
    secondary: { label: 'Turn the dial', href: '/l/tease/', note: '' },
    banner: 'Something you can feel. Revealed 10.20.',
  },
  waitlist: {
    id: 'waitlist',
    name: 'Waitlist',
    starts: '2026-10-20',
    landing: '/l/waitlist/',
    primary: { label: 'Join the waitlist', href: '/l/waitlist/', note: 'Free. Every friend who confirms earns you a reward.' },
    secondary: { label: 'Crack the safe', href: '/crack/', note: '' },
    banner: 'The waitlist is open. Early spots get the $299 launch price.',
  },
  reserve: {
    id: 'reserve',
    name: 'Reserve',
    starts: '2026-11-10',
    landing: '/l/reserve/',
    primary: { label: 'Reserve for $20', href: '/l/reserve/', note: 'Fully refundable. Locks the $299 launch price.' },
    secondary: { label: 'Configure yours', href: '/shop/', note: '' },
    banner: 'Reservations are open. Batch 1 ships February 2027.',
  },
  launch: {
    id: 'launch',
    name: 'Launch day',
    starts: '2026-12-01',
    landing: '/l/launch/',
    primary: { label: 'Order Detent One', href: '/shop/', note: '$299 launch price for 72 hours. Free shipping.' },
    secondary: { label: 'Watch the film', href: '/l/launch/#film', note: '' },
    banner: 'Detent One is here. Launch pricing ends in 72 hours.',
  },
  live: {
    id: 'live',
    name: 'Live',
    starts: '2026-12-04',
    landing: '/',
    primary: { label: 'Buy Detent One', href: '/shop/', note: 'Free shipping. 60-day studio trial.' },
    secondary: { label: 'Compare finishes', href: '/shop/#finishes', note: '' },
    banner: 'Free shipping and a 60-day studio trial on every Detent.',
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

export const LAUNCH = {
  /** Launch day (orders open). */
  launchDate: '2026-12-01T17:00:00Z',
  /** Launch pricing window closes. */
  launchPriceEnds: '2026-12-04T17:00:00Z',
  firstShipBatch: 'February 2027',
  secondShipBatch: 'April 2027',
  /** Numbered Founders Edition run. */
  foundersRun: 2000,
  depositUsd: 20,
  foundersDepositUsd: 50,
} as const;

export function phaseIndex(p: Phase): number {
  return PHASE_ORDER.indexOf(p);
}
