/**
 * What the builder's sliders read out: the text of each <output> (and the
 * slider's aria-valuetext), plus how far along its track the feel color fills.
 * Pure, so the server renders the first state and the station keeps it live.
 */
import { clickTorque, formatRange, type FeelPhysics } from './model';

export type BuilderKey = 'detents' | 'strength' | 'damping' | 'spring' | 'stops' | 'snaps';

export function builderText(p: FeelPhysics): Record<BuilderKey, string> {
  const n = (p.snaps ?? []).length;
  return {
    detents: p.detents ? `${p.detents} per turn` : 'None',
    strength: `${clickTorque(p).toFixed(1)} mN·m`,
    damping: p.damping.toFixed(2),
    spring: p.spring ? p.spring.toFixed(2) : 'Off',
    stops: p.stops ? formatRange(p.stops) : 'Off',
    snaps: n ? `${n} point${n === 1 ? '' : 's'}` : 'None',
  };
}

/** The filled share of a range track, as a CSS length for `--fill`. */
export const trackFill = (value: number, min: number, max: number) => `${((value - min) / (max - min || 1)) * 100}%`;
