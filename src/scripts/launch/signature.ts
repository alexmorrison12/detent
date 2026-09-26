/**
 * The "feel signature": a profile's torque curve around one turn, drawn in
 * polar form and repeated as a guilloché (like an engraved watch dial).
 * The shape comes from the real physics in src/data/product.ts; the
 * person's pass code seeds the twist and two fine harmonics, so every pass
 * is unique but every Ratchet pass still reads as Ratchet.
 */
import type { FeelProfile } from '@/data/product';

type Physics = FeelProfile['physics'];

/** FNV-1a, 32-bit. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32: tiny deterministic PRNG. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const wrap = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;
const angDist = (a: number, b: number) => Math.abs(wrap(a - b));

/** Normalised torque-like value at `deg` (0 = 12 o'clock), roughly -1..1.5. */
export function feelAt(ph: Physics, deg: number): number {
  const d = wrap(deg);
  let v = 0;
  if (ph.detents > 0) {
    const step = 360 / ph.detents;
    const x = (((d % step) + step) % step) / step;
    const s = Math.sin(2 * Math.PI * x);
    const tooth = Math.sign(s) * Math.abs(s) ** 0.55;
    const accent = (ph.accents ?? []).some((a) => angDist(d, a) < step / 2) ? 1.9 : 1;
    v += tooth * ph.strength * accent;
  } else if (ph.accents?.length) {
    for (const a of ph.accents)
      v += ph.strength * 1.6 * Math.exp(-(angDist(d, a) ** 2) / (2 * 7 ** 2));
  }
  if (ph.snaps?.length) {
    for (const s of ph.snaps)
      v -= ph.strength * 1.3 * Math.exp(-(angDist(d, s) ** 2) / (2 * 5 ** 2));
  }
  if (ph.spring > 0) {
    const lim = ph.stops ? Math.max(Math.abs(ph.stops[0]), Math.abs(ph.stops[1])) : 180;
    v += ph.spring * (Math.abs(d) / lim) ** 1.3 * 1.2 - 0.4;
  }
  if (ph.stops) {
    const [lo, hi] = ph.stops;
    const over = d < lo ? lo - d : d > hi ? d - hi : 0;
    if (over > 0) v = 1.5 - 0.3 * Math.exp(-over / 4);
  }
  if (!ph.detents && !ph.snaps?.length && !ph.spring && !ph.stops) {
    // Fluid: no structure, only a slow swell from viscous drag.
    v += Math.sin((d * Math.PI) / 90) * 0.12;
  }
  return v;
}

/** One-line physical summary for the pass: "24 detents", "stops ±135°"... */
export function feelSpec(ph: Physics): string {
  if (ph.detents > 0) return `${ph.detents} detents`;
  if (ph.snaps?.length) return `${ph.snaps.length} snap points`;
  if (ph.spring > 0) return 'returns to zero';
  if (ph.stops) return `stops ±${Math.abs(ph.stops[1])}°`;
  return 'free spin';
}

export interface SignatureOptions {
  rings?: number;
  color: string;
  /** Line width in the canvas's logical units. */
  width?: number;
}

/** Draw the guilloché signature centred at (cx, cy) with outer radius R. */
export function drawSignature(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  R: number,
  ph: Physics,
  seedText: string,
  opts: SignatureOptions,
): void {
  const r = rng(hash(seedText));
  const rings = opts.rings ?? 28;
  const twist = 1.2 + r() * 3.2; // degrees per ring
  const h1 = 2 + Math.floor(r() * 5);
  const h2 = 7 + Math.floor(r() * 11);
  const p1 = r() * Math.PI * 2;
  const p2 = r() * Math.PI * 2;
  const a1 = 0.1 + r() * 0.14;
  const a2 = 0.03 + r() * 0.05;
  const lw = opts.width ?? 1;
  const SAMPLES = 720;

  ctx.save();
  ctx.lineJoin = 'round';
  for (let i = 0; i < rings; i++) {
    const t = i / (rings - 1);
    const base = R * (0.5 + 0.47 * t);
    const amp = R * 0.06 * (0.3 + 0.7 * t);
    const rot = i * twist;
    ctx.beginPath();
    for (let k = 0; k <= SAMPLES; k++) {
      const deg = (k / SAMPLES) * 360;
      const th = (deg * Math.PI) / 180;
      const v =
        feelAt(ph, deg - rot) +
        a1 * Math.sin(h1 * th + p1 + i * 0.13) +
        a2 * Math.sin(h2 * th + p2 - i * 0.09);
      const rad = base + amp * v;
      const x = cx + Math.sin(th) * rad;
      const y = cy - Math.cos(th) * rad;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    const outer = i === rings - 1;
    ctx.globalAlpha = outer ? 1 : 0.14 + 0.5 * t ** 1.5;
    ctx.strokeStyle = opts.color;
    ctx.lineWidth = outer ? lw * 2.2 : lw;
    ctx.stroke();
  }
  ctx.restore();
}
