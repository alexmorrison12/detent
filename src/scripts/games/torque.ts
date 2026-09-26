/**
 * Torque curves: what the motor pushes back with at each knob angle, for a
 * given physics. Used for the Daily Detent hints. Normalized to -1..1;
 * negative pulls the knob back toward lower angles.
 */
import type { FeelPhysics } from '@/scripts/dial/types';

const wrap = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

export function torqueAt(p: FeelPhysics, deg: number): number {
  let t = 0;
  if (p.detents > 0) {
    const step = 360 / p.detents;
    const k = Math.round(deg / step);
    const accent = (p.accents ?? []).some((a) => Math.abs(wrap(k * step - a)) < step / 3);
    const amp = (0.22 + 0.45 * p.strength) * (accent ? 1.55 : 1);
    t += -amp * Math.sin((2 * Math.PI * deg) / step);
  } else if (p.accents?.length) {
    for (const a of p.accents) {
      const d = wrap(deg - a) / 7;
      t += 0.5 * d * Math.exp(-d * d) * 2.33;
    }
  }
  if (p.snaps?.length) {
    for (const s of p.snaps) {
      const d = wrap(deg - s) / 6;
      t += -p.strength * d * Math.exp(-d * d) * 1.6;
    }
  }
  if (p.spring > 0) t += (-p.spring * deg) / 180;
  if (p.stops) {
    if (deg >= p.stops[1]) return -1;
    if (deg <= p.stops[0]) return 1;
  }
  return Math.max(-0.95, Math.min(0.95, t));
}

/** SVG path for the curve over [from, to] degrees, in a w×h box (y down). */
export function torquePath(
  p: FeelPhysics,
  from: number,
  to: number,
  w: number,
  h: number,
  samples = 540,
): string {
  const pts: string[] = [];
  const mid = h / 2;
  for (let i = 0; i <= samples; i++) {
    const deg = from + ((to - from) * i) / samples;
    const x = (i / samples) * w;
    const y = mid - torqueAt(p, deg) * mid * 0.92;
    pts.push(`${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return pts.join('');
}

/** Plain-language readings of the curve, for the last hint and the reveal. */
export function describe(p: FeelPhysics): string[] {
  const lines: string[] = [];
  if (p.detents > 0) {
    const heavy = p.accents?.length ?? 0;
    lines.push(`${p.detents} detents per turn${heavy ? `, ${heavy} of them deeper` : ''}`);
  } else if (p.snaps?.length) {
    const s = [...p.snaps].sort((a, b) => a - b);
    const gaps = s.map((a, i) => (i ? a - s[i - 1]! : a + 360 - s[s.length - 1]!));
    const even = Math.max(...gaps) - Math.min(...gaps) < 4;
    lines.push(`No detents. ${s.length} snap points, ${even ? 'evenly' : 'unevenly'} spaced`);
  } else if (p.accents?.length) lines.push('No detents. One soft bump at center');
  else lines.push('No detents at all');
  if (p.stops)
    lines.push(`Hard stops at ±${Math.max(Math.abs(p.stops[0]), Math.abs(p.stops[1]))}°`);
  else lines.push('Turns forever, no stops');
  lines.push(p.spring > 0 ? 'Pulls back to center when you let go' : 'Stays where you leave it');
  return lines;
}
