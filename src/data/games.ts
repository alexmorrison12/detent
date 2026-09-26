/**
 * Games: Crack the Safe (/crack/) and Daily Detent (/daily/).
 *
 * SERVER-ONLY for DAILY_VARIANTS: pages read this in frontmatter and ship the
 * client an opaque, shuffled list of { physics, hash } with no family names.
 * Client scripts must never import this module, or today's answer leaks.
 */
import { byProfile, type FeelProfile, type ProfileId } from './product';

type Physics = FeelProfile['physics'];

export const GAMES = {
  /** Puzzle #1 for both daily games (UTC). Numbers count up from here. */
  epoch: '2026-09-01',
  safe: {
    /** Numbers on the safe dial, one detent each. */
    numbers: 100,
    /** Numbers in the combination: right, left, right. */
    wheels: 3,
    /** Detent strength far from the gate; the gate adds up to (1 - base). */
    baseStrength: 0.35,
  },
  daily: {
    tries: 5,
    /** Try number at which each torque-curve hint appears. */
    hintsAt: [3, 4, 5],
  },
} as const;

export interface DailyVariant {
  family: ProfileId;
  physics: Physics;
}

const stock = (id: ProfileId): Physics => ({ ...byProfile(id).physics });

/**
 * Three cuts per family: stock, plus two tunings a Detent owner might
 * actually run. The game asks for the family, so the vocabulary transfers.
 */
export const DAILY_VARIANTS: DailyVariant[] = [
  { family: 'ratchet', physics: stock('ratchet') }, // Stock: 24 detents.
  { family: 'ratchet', physics: { ...stock('ratchet'), detents: 32, strength: 0.6 } }, // Fine cut: 32 lighter detents.
  { family: 'ratchet', physics: { ...stock('ratchet'), detents: 18, strength: 0.95 } }, // Coarse cut: 18 heavy detents.

  { family: 'fluid', physics: stock('fluid') }, // Stock: almost no drag.
  { family: 'fluid', physics: { ...stock('fluid'), damping: 0.14 } }, // Thick oil: more drag at speed.
  { family: 'fluid', physics: { ...stock('fluid'), damping: 0.02 } }, // Ice: barely any drag.

  { family: 'spring', physics: stock('spring') }, // Stock: stops at ±120°.
  { family: 'spring', physics: { ...stock('spring'), spring: 0.6, stops: [-90, 90] } }, // Short throw: stops at ±90°, softer pull.
  { family: 'spring', physics: { ...stock('spring'), spring: 1, stops: [-150, 150] } }, // Long throw: stops at ±150°, full pull.

  { family: 'clock', physics: stock('clock') }, // Stock: 12 detents, deep one at noon.
  { family: 'clock', physics: { ...stock('clock'), detents: 8 } }, // Eight hours: 8 detents, deep one at noon.
  { family: 'clock', physics: { ...stock('clock'), strength: 0.85, accents: [0, 180] } }, // Noon and six: two deep detents.

  { family: 'wall', physics: stock('wall') }, // Stock: stops at ±135°, bump at center.
  { family: 'wall', physics: { ...stock('wall'), stops: [-90, 90] } }, // Narrow range: stops at ±90°.
  { family: 'wall', physics: { ...stock('wall'), stops: [-160, 160], strength: 0.3 } }, // Wide range: stops at ±160°.

  { family: 'magnet', physics: stock('magnet') }, // Stock: six markers.
  { family: 'magnet', physics: { ...stock('magnet'), snaps: [-135, -45, 45, 135] } }, // Four even markers.
  {
    family: 'magnet',
    physics: {
      ...stock('magnet'),
      strength: 0.75,
      snaps: [-170, -120, -100, -30, 10, 25, 70, 140, 155],
    },
  }, // Nine markers, bunched like a busy timeline.
];
