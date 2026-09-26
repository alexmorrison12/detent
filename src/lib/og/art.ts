/**
 * Art direction per social card: which finish sits in frame, which feel the
 * display shows, where the indicator points and what the knob's round
 * display reads. Every number comes from @/data or @/config.
 *
 * Unknown slugs (added to OG_PAGES later) fall back to the house card, so a
 * new page never ships without an image.
 */
import { OG_PAGES, type OgSlug } from '@/config/og';
import { LAUNCH, PHASES, PHASE_ORDER } from '@/config/launch';
import {
  AUDIENCES,
  PAYMENT,
  PROFILES,
  SPECS,
  byEdition,
  byFinish,
  byProfile,
  formatUsd,
  type AudienceId,
  type FinishId,
  type ProfileId,
} from '@/data/product';
import { token } from './color';
import type { DialArt } from './dial';

export interface CardArt {
  finish: FinishId;
  /** One feel, or 'all' for the segmented six-feel ring. */
  profile: ProfileId | 'all';
  /** Indicator angle in degrees (0 = noon). Negative points toward the title. */
  angle: number;
  /** What the knob's display reads: a value and a short label. */
  display: { value: string; label: string };
  ticks?: number;
  silhouette?: boolean;
}

const spec = (label: string): string =>
  SPECS.flatMap((g) => g.rows).find((r) => r.label === label)?.value ?? '';

const resolution = spec('Position sensing').match(/[\d.]+°/)?.[0] ?? '';
const weight = spec('Weight').match(/\d+\s?g/)?.[0] ?? '';
const onDevice = spec('Profiles on device').match(/\d+/)?.[0] ?? '';
const one = byEdition('one');
const launchHours = Math.round(
  (Date.parse(LAUNCH.launchPriceEnds) - Date.parse(LAUNCH.launchDate)) / 3_600_000,
);
const mmdd = (iso: string) => iso.slice(5, 10).replace('-', '.');
const buildDay = new Date().toISOString().slice(0, 10);

function audience(
  id: AudienceId,
  finish: FinishId,
  angle: number,
  display: CardArt['display'],
): CardArt {
  const a = AUDIENCES.find((x) => x.id === id)!;
  return { finish, profile: a.profile, angle, display };
}

const upper = (s: string) => s.toUpperCase();

const ART: Partial<Record<OgSlug, CardArt>> = {
  default: {
    finish: 'graphite',
    profile: 'ratchet',
    angle: -38,
    display: { value: String(byProfile('ratchet').physics.detents), label: 'RATCHET' },
  },
  home: {
    finish: 'graphite',
    profile: 'ratchet',
    angle: -38,
    display: { value: String(byProfile('ratchet').physics.detents), label: 'RATCHET' },
  },
  shop: {
    finish: 'raw',
    profile: 'ratchet',
    angle: -30,
    display: { value: formatUsd(one.priceUsd), label: upper(one.name) },
  },
  specs: {
    finish: 'raw',
    profile: 'ratchet',
    angle: -52,
    display: { value: resolution, label: 'RESOLUTION' },
  },
  profiles: {
    finish: 'graphite',
    profile: 'all',
    angle: -60,
    display: { value: String(PROFILES.length), label: 'FEELS' },
  },
  integrations: {
    finish: 'glacier',
    profile: 'clock',
    angle: -30,
    display: { value: onDevice, label: 'PROFILES' },
  },
  story: {
    finish: 'raw',
    profile: 'fluid',
    angle: -24,
    display: { value: weight, label: '6061-T6' },
  },
  support: {
    finish: 'graphite',
    profile: 'wall',
    angle: -44,
    display: { value: String(PAYMENT.trialDays), label: 'DAY TRIAL' },
  },
  press: {
    finish: 'raw',
    profile: 'ratchet',
    angle: -36,
    display: { value: 'PRESS', label: 'ON AIR' },
  },
  changelog: {
    finish: 'graphite',
    profile: 'clock',
    angle: -60,
    display: { value: mmdd(buildDay), label: 'LAST BUILD' },
  },
  crack: {
    finish: 'graphite',
    profile: 'clock',
    angle: -72,
    ticks: 100,
    display: { value: '00', label: 'R · L · R' },
  },
  daily: {
    finish: 'glacier',
    profile: 'fluid',
    angle: -20,
    display: { value: '?', label: 'TODAY' },
  },
  'launch-plan': {
    finish: 'graphite',
    profile: 'ratchet',
    angle: -45,
    display: { value: String(PHASE_ORDER.length), label: 'PHASES' },
  },
  tease: {
    finish: 'graphite',
    profile: 'ratchet',
    angle: -38,
    silhouette: true,
    display: { value: mmdd(PHASES.waitlist.starts), label: '' },
  },
  waitlist: {
    finish: 'graphite',
    profile: 'ratchet',
    angle: -34,
    display: { value: formatUsd(one.launchPriceUsd), label: 'LAUNCH PRICE' },
  },
  reserve: {
    finish: 'raw',
    profile: 'ratchet',
    angle: -40,
    display: { value: formatUsd(LAUNCH.depositUsd), label: 'REFUNDABLE' },
  },
  launch: {
    finish: 'tally',
    profile: 'ratchet',
    angle: -32,
    display: { value: formatUsd(one.launchPriceUsd), label: `${launchHours} HOURS` },
  },
  'for-editors': audience('editors', 'graphite', -40, { value: '0042', label: 'FRAME' }),
  'for-musicians': audience('musicians', 'raw', -44, { value: '0.0 dB', label: 'UNITY' }),
  'for-designers': audience('designers', 'glacier', -28, { value: '37.5°', label: 'ROTATE' }),
  'for-developers': audience('developers', 'graphite', -50, { value: '3/9', label: 'HUNKS' }),
  '404': {
    finish: 'graphite',
    profile: 'wall',
    angle: 163,
    display: { value: '404', label: 'NO DETENT' },
  },
};

export function cardArt(slug: string): CardArt {
  return ART[slug as OgSlug] ?? ART.default!;
}

export function cardCopy(slug: string): { title: string; kicker: string } {
  return (OG_PAGES as Record<string, { title: string; kicker: string }>)[slug] ?? OG_PAGES.default;
}

/** Resolve a card's art into concrete dial colors. */
export function dialArt(art: CardArt): DialArt {
  const finish = byFinish(art.finish);
  const feel = (id: ProfileId) => {
    try {
      return token(`feel-${id}`);
    } catch {
      return byProfile(id).color;
    }
  };
  const ring = art.profile === 'all' ? PROFILES.map((p) => feel(p.id)) : [feel(art.profile)];
  const indicator = finish.id === 'tally' ? finish.accent : token('tally');
  const range = 270;
  const value = Math.min(1, Math.max(0.08, ((art.angle % 360) + 135) / range));
  return {
    body: finish.body,
    indicator,
    ring,
    angle: art.angle,
    ticks: art.ticks ?? 120,
    value: art.silhouette ? 0 : value,
    silhouette: art.silhouette,
  };
}
