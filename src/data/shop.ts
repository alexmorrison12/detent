/**
 * Shop feature data that client scripts may import: engraving rules,
 * shipping estimates, the referral concept. Kept free of computed content so
 * bundles stay small; server-only shop copy lives in ./shop-content.ts.
 * Product facts (prices, specs, finishes) live in @/data/product.
 */
import type { FinishId } from './product';

/* -------------------------------------------------------------------------- */
/* Engraving                                                                  */
/* -------------------------------------------------------------------------- */

export const ENGRAVING = {
  maxLength: 24,
  /** Characters the laser file supports. Everything else is dropped. */
  allowed: /[A-Z0-9 .,'&!?#/+:()@-]/,
  /** One per audience, offered as quick fills. */
  presets: ['ONE MORE TAKE', 'UNITY GAIN', 'SHIP IT', 'KEYFRAME 01'],
} as const;

/** Uppercase, strip unsupported characters, collapse spaces, clamp length. */
export function sanitizeEngraving(raw: string): string {
  const upper = raw.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[‘’]/g, "'").toUpperCase();
  let out = '';
  for (const ch of upper) if (ENGRAVING.allowed.test(ch)) out += ch;
  return out.replace(/\s+/g, ' ').replace(/^\s+/, '').slice(0, ENGRAVING.maxLength);
}

/**
 * Laser-engraving anodized aluminum removes the dye and shows bright metal;
 * on raw aluminum the mark reads darker. Used by the underside preview.
 */
export const ENGRAVE_INK: Record<FinishId, string> = {
  raw: 'oklch(0.38 0.006 355)',
  graphite: 'oklch(0.9 0.003 355)',
  glacier: 'oklch(0.4 0.03 240)',
  tally: 'oklch(0.96 0.01 355)',
};

/* -------------------------------------------------------------------------- */
/* Shipping                                                                   */
/* -------------------------------------------------------------------------- */

export interface ShipRegion {
  code: string;
  name: string;
  /** Business days in transit after the batch leaves us. */
  transit: [number, number];
  /** What the postal code is called there, a valid example, and a loose check. */
  postal: { label: string; example: string; pattern: string };
}

const POSTAL_EU = { label: 'Postal code', example: '10115', pattern: '^\\d{4,5}$' };

/** Where we ship at launch (see FAQ "Where do you ship?"). */
export const SHIP_REGIONS: ShipRegion[] = [
  {
    code: 'US',
    name: 'United States',
    transit: [2, 4],
    postal: { label: 'ZIP code', example: '94107', pattern: '^\\d{5}(-\\d{4})?$' },
  },
  {
    code: 'CA',
    name: 'Canada',
    transit: [3, 5],
    postal: {
      label: 'Postal code',
      example: 'M5V 2T6',
      pattern: '^[A-Za-z]\\d[A-Za-z] ?\\d[A-Za-z]\\d$',
    },
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    transit: [3, 5],
    postal: {
      label: 'Postcode',
      example: 'EC1V 9HX',
      pattern: '^[A-Za-z]{1,2}\\d[A-Za-z\\d]? ?\\d[A-Za-z]{2}$',
    },
  },
  {
    code: 'DE',
    name: 'Germany',
    transit: [3, 6],
    postal: { ...POSTAL_EU, example: '10115', pattern: '^\\d{5}$' },
  },
  {
    code: 'FR',
    name: 'France',
    transit: [3, 6],
    postal: { ...POSTAL_EU, example: '75011', pattern: '^\\d{5}$' },
  },
  {
    code: 'NL',
    name: 'Netherlands',
    transit: [3, 6],
    postal: { label: 'Postcode', example: '1012 AB', pattern: '^\\d{4} ?[A-Za-z]{2}$' },
  },
  {
    code: 'SE',
    name: 'Sweden',
    transit: [4, 6],
    postal: { ...POSTAL_EU, example: '114 55', pattern: '^\\d{3} ?\\d{2}$' },
  },
  {
    code: 'ES',
    name: 'Spain',
    transit: [4, 6],
    postal: { ...POSTAL_EU, example: '28013', pattern: '^\\d{5}$' },
  },
  {
    code: 'IT',
    name: 'Italy',
    transit: [4, 6],
    postal: { label: 'CAP', example: '20121', pattern: '^\\d{5}$' },
  },
  {
    code: 'AU',
    name: 'Australia',
    transit: [4, 7],
    postal: { label: 'Postcode', example: '2000', pattern: '^\\d{4}$' },
  },
  {
    code: 'NZ',
    name: 'New Zealand',
    transit: [5, 8],
    postal: { label: 'Postcode', example: '6011', pattern: '^\\d{4}$' },
  },
  {
    code: 'JP',
    name: 'Japan',
    transit: [3, 5],
    postal: { label: 'Postal code', example: '150-0001', pattern: '^\\d{3}-?\\d{4}$' },
  },
  {
    code: 'KR',
    name: 'South Korea',
    transit: [3, 5],
    postal: { label: 'Postal code', example: '04524', pattern: '^\\d{5}$' },
  },
];

export const shipRegion = (code: string) => SHIP_REGIONS.find((r) => r.code === code);

/* -------------------------------------------------------------------------- */
/* Referral (concept)                                                          */
/* -------------------------------------------------------------------------- */

export const REFERRAL = { giveUsd: 30, getUsd: 30 } as const;
