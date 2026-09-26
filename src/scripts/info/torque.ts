/**
 * Static torque model for the "fixed vs software-defined" plot on /specs/.
 * Returns the restoring torque (mN·m) the knob applies at angle θ (degrees)
 * for a profile's physics. It is a picture of the feel, not the firmware
 * (no velocity terms), so Fluid reads as flat: it resists speed, not position.
 * Shared by the server-rendered SVG paths and the client playhead.
 */
import type { FeelProfile } from '@/data/product';

type Physics = FeelProfile['physics'];

const rad = (d: number) => (d * Math.PI) / 180;
/** Wrap to (-180, 180]. */
const wrap = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

/** Derivative-of-Gaussian well: pulls toward 0, peaks at ±w with magnitude 1. */
function well(d: number, w: number): number {
  const x = d / w;
  return -x * Math.exp((1 - x * x) / 2);
}

export interface TorqueOptions {
  /** Peak motor torque, mN·m (from SPECS). */
  peak: number;
}

export function torqueAt(theta: number, p: Physics, { peak }: TorqueOptions): number {
  // Hard end stops override everything past the limit.
  if (p.stops) {
    const [lo, hi] = p.stops;
    if (theta >= hi) return -peak;
    if (theta <= lo) return peak;
  }
  let t = 0;
  const detentPeak = 0.6 * peak;

  if (p.detents > 0) {
    const s = Math.sin(rad(theta) * p.detents);
    // Sharpen the sine so detent edges read crisp: a ratchet, not a wobble.
    let a = -Math.sign(s) * Math.abs(s) ** 0.55 * p.strength * detentPeak;
    const half = 180 / p.detents;
    if (p.accents?.some((acc) => Math.abs(wrap(theta - acc)) < half)) a *= 1.5;
    t += a;
  } else if (p.accents?.length) {
    // A single soft bump (Wall's halfway detent).
    for (const acc of p.accents) t += well(wrap(theta - acc), 5) * p.strength * detentPeak;
  }

  if (p.snaps?.length) {
    for (const s of p.snaps) t += well(wrap(theta - s), 7) * p.strength * detentPeak;
  }

  if (p.spring > 0 && p.stops) {
    t += -(theta / p.stops[1]) * p.spring * peak;
  }

  return Math.max(-peak, Math.min(peak, t));
}

/** Mechanical encoder: a plain sine, fixed forever. */
export function mechanicalTorqueAt(theta: number, detents: number, amplitude: number): number {
  return -Math.sin(rad(theta) * detents) * amplitude;
}

/** SVG path for a torque function over [-180, 180] in a w×h box, y centered. */
export function torquePath(fn: (theta: number) => number, w: number, h: number, peak: number, steps = 576): string {
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const theta = -180 + (360 * i) / steps;
    const y = h / 2 - (fn(theta) / peak) * (h / 2);
    d += `${i ? 'L' : 'M'}${((i / steps) * w).toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}
