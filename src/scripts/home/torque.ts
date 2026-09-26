/**
 * A readable model of what each feel profile does to your finger: restoring
 * torque (normalised -1..1) as a function of knob angle. It is not the
 * firmware's control loop; it is the shape of it, drawn from the same physics
 * parameters in @/data/product, so the curve on the page and the knob you
 * turn can never disagree.
 *
 * Shared by the build (SVG paths, scale rings) and the client (plot marker).
 */
import type { FeelPhysics } from '@/scripts/dial/types';

/** Wrap any angle into [-180, 180). */
export function wrap(deg: number): number {
  return ((((deg + 180) % 360) + 360) % 360) - 180;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Restoring torque at `deg` (degrees, 0 = 12 o'clock, clockwise positive). */
export function torque(p: FeelPhysics, deg: number): number {
  const a = p.stops ? deg : wrap(deg);
  if (p.stops) {
    if (a <= p.stops[0]) return 1;
    if (a >= p.stops[1]) return -1;
  }
  let t = 0;

  if (p.detents > 0) {
    const period = 360 / p.detents;
    const near = (p.accents ?? []).some((acc) => Math.abs(wrap(a - acc)) < period / 2);
    const amp = clamp(p.strength * 0.7 * (near ? 1.45 : 1), 0, 1);
    t += -amp * Math.sin((a / period) * 2 * Math.PI);
  } else if (p.accents?.length) {
    // A single soft bump (e.g. Wall's halfway detent).
    for (const acc of p.accents) {
      const d = wrap(a - acc);
      if (Math.abs(d) < 12) t += -p.strength * 0.8 * Math.sin((d / 12) * Math.PI);
    }
  }

  if (p.spring > 0) {
    const reach = p.stops ? Math.max(Math.abs(p.stops[0]), Math.abs(p.stops[1])) : 180;
    t += -p.spring * 0.85 * clamp(a / reach, -1, 1);
  }

  if (p.snaps?.length) {
    const w = 9;
    for (const s of p.snaps) {
      const x = wrap(a - s) / w;
      // Derivative of a gaussian, peak-normalised: pulls toward each snap.
      t += -p.strength * x * Math.exp(0.5 - 0.5 * x * x);
    }
  }

  return clamp(t, -1, 1);
}

/** Shared coordinate box for every torque curve on the home page. */
export const TQ_BOX = { width: 720, height: 220 } as const;

export interface PlotBox {
  width: number;
  height: number;
  /** Degrees per sample. */
  step?: number;
  /** Angle window, default [-180, 180]. */
  from?: number;
  to?: number;
}

/** x position (in plot units) of an angle. */
export function plotX(deg: number, box: PlotBox): number {
  const from = box.from ?? -180;
  const to = box.to ?? 180;
  return ((deg - from) / (to - from)) * box.width;
}

/** y position (in plot units) of a torque value. */
export function plotY(t: number, box: PlotBox): number {
  return box.height / 2 - t * (box.height / 2) * 0.86;
}

/** SVG path data for a profile's torque curve. */
export function torquePath(p: FeelPhysics, box: PlotBox): string {
  const from = box.from ?? -180;
  const to = box.to ?? 180;
  const step = box.step ?? 1;
  const r = (n: number) => Math.round(n * 10) / 10;
  let d = '';
  for (let deg = from; deg <= to + 1e-9; deg += step) {
    const x = r(plotX(deg, box));
    const y = r(plotY(torque(p, deg), box));
    d += `${d ? 'L' : 'M'}${x} ${y}`;
  }
  return d;
}
