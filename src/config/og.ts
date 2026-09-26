/**
 * Social card registry. Each page passes ogImage={`/og/${slug}.png`} to
 * BaseLayout; src/pages/og/[slug].png.ts renders one 1200×630 PNG per entry.
 * Prices and dates come from @/data/product and @/config/launch.
 */
import { EDITIONS, formatUsd } from '@/data/product';
import { LAUNCH, PHASES } from '@/config/launch';

/** '2026-12-04T17:00:00Z' -> '12.04', the site's date shorthand. */
const mmdd = (iso: string) => iso.slice(5, 10).replace('-', '.');
const fromPrice = formatUsd(Math.min(...EDITIONS.map((e) => e.priceUsd)));

export const OG_PAGES = {
  default: { title: 'Software you can feel.', kicker: 'Detent One' },
  home: { title: 'Software you can feel.', kicker: 'Detent One' },
  shop: { title: 'Build yours.', kicker: `Detent One · from ${fromPrice}` },
  specs: { title: '0.022° of resolution.', kicker: 'Tech specs' },
  profiles: { title: 'Every feel has a name.', kicker: 'Feel library' },
  integrations: { title: 'It knows which app you’re in.', kicker: 'Integrations' },
  story: { title: 'Why a knob?', kicker: 'Our story' },
  support: { title: 'Answers, not adjectives.', kicker: 'Support' },
  press: { title: 'Press kit.', kicker: 'Detent Labs' },
  changelog: { title: 'What changed.', kicker: 'Changelog' },
  crack: { title: 'Crack the safe.', kicker: 'A daily challenge by feel' },
  daily: { title: 'Name that feel.', kicker: 'Daily Detent' },
  'launch-plan': { title: 'The launch plan.', kicker: 'Detent One' },
  tease: { title: 'Something you can feel.', kicker: mmdd(PHASES.waitlist.starts) },
  waitlist: { title: 'Get in line. Move up.', kicker: 'Detent One waitlist' },
  reserve: { title: `Reserve yours for ${formatUsd(LAUNCH.depositUsd)}.`, kicker: 'Fully refundable' },
  launch: { title: 'Detent One is here.', kicker: `Launch price until ${mmdd(LAUNCH.launchPriceEnds)}` },
  'for-editors': { title: 'Cut on the frame, not near it.', kicker: 'Detent for video editors' },
  'for-musicians': { title: 'A real knob for every fake one.', kicker: 'Detent for producers' },
  'for-designers': { title: 'Rotate it by feel.', kicker: 'Detent for designers' },
  'for-developers': { title: 'Feel the diff.', kicker: 'Detent for developers' },
  '404': { title: 'Lost the detent.', kicker: '404' },
} as const;

export type OgSlug = keyof typeof OG_PAGES;
export const ogPath = (slug: OgSlug) => `/og/${slug}.png`;
