/**
 * Turns an angle stream into what a contact microphone on the knob would
 * pick up for a given physics: detent clicks, deep accents, magnet snaps,
 * end-stop walls, a center bump, and travel texture (hiss for free-spinning
 * profiles, rising tension for springs). The Daily Detent feeds these to the
 * audio and to the trace, so the feel reads the same with or without sound,
 * and with any dial renderer.
 */
import type { FeelPhysics } from '@/scripts/dial/types';

export type SenseKind = 'detent' | 'accent' | 'snap' | 'stop' | 'bump' | 'hiss' | 'tension';

export interface Sense {
  kind: SenseKind;
  /** 0..1 bar height. */
  h: number;
  /** For tension: deflection 0..1. */
  level?: number;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;
const near = (a: number, b: number, tol = 0.5) => {
  const d = mod(a - b, 360);
  return d < tol || d > 360 - tol;
};

export class FeelSensor {
  #p: FeelPhysics;
  #travel = 0;
  #atStop = false;

  constructor(physics: FeelPhysics) {
    this.#p = physics;
  }

  feed(a0: number, a1: number, dtMs: number): Sense[] {
    const p = this.#p;
    const out: Sense[] = [];
    const lo = Math.min(a0, a1);
    const hi = Math.max(a0, a1);
    const dir = Math.sign(a1 - a0);
    if (!dir) return out;

    // Detents: a click each time the nearest detent index changes.
    if (p.detents > 0) {
      const step = 360 / p.detents;
      const k0 = Math.round(a0 / step);
      const k1 = Math.round(a1 / step);
      for (let k = k0 + dir, i = 0; dir > 0 ? k <= k1 : k >= k1; k += dir, i++) {
        if (i > 400) break;
        const accent = (p.accents ?? []).some((a) => near(k * step, a, step / 3));
        out.push(
          accent ? { kind: 'accent', h: 1 } : { kind: 'detent', h: 0.3 + 0.42 * p.strength },
        );
      }
    } else if (p.accents?.length) {
      // No detents: accents are soft hills in the travel.
      for (const a of p.accents)
        for (const x of crossings(a, lo, hi)) out.push({ kind: 'bump', h: 0.42, level: x });
    }

    if (p.snaps?.length) {
      for (const s of p.snaps)
        for (const _ of crossings(s, lo, hi))
          out.push({ kind: 'snap', h: 0.55 + 0.4 * p.strength });
    }

    if (p.stops) {
      const hit = a1 <= p.stops[0] + 0.25 || a1 >= p.stops[1] - 0.25;
      if (hit && !this.#atStop) out.push({ kind: 'stop', h: 1 });
      this.#atStop = hit;
    }

    // Travel texture for profiles without detents, every 5 degrees.
    if (p.detents === 0) {
      this.#travel += Math.abs(a1 - a0);
      if (this.#travel >= 5 && !out.some((s) => s.kind !== 'bump')) {
        this.#travel = 0;
        const v = Math.abs(a1 - a0) / Math.max(8, dtMs); // degrees per ms
        if (p.spring > 0 && p.stops) {
          const level = Math.min(
            1,
            Math.abs(a1) / Math.max(Math.abs(p.stops[0]), Math.abs(p.stops[1])),
          );
          out.push({ kind: 'tension', h: 0.08 + 0.6 * level * p.spring, level });
        } else {
          out.push({ kind: 'hiss', h: 0.05 + Math.min(0.16, v * 0.14) * (1 + p.damping * 3) });
        }
      }
    }
    return out;
  }
}

/** Every unwrapped copy of angle `a` (mod 360) that lies in (lo, hi]. */
function* crossings(a: number, lo: number, hi: number): Generator<number> {
  let m = Math.ceil((lo - a) / 360);
  for (let i = 0; i < 12; i++, m++) {
    const x = a + m * 360;
    if (x > hi) return;
    if (x > lo) yield x;
  }
}
