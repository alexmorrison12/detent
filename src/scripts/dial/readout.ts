/**
 * What the knob's display says, and what a screen reader hears. Derived from
 * the effective physics (not the profile id) so custom feels read sensibly.
 */
import { wrapPi, type ResolvedPhysics } from './physics';

export interface ReadoutInput {
  theta: number; // rad
  value: number;
  index: number;
  p: ResolvedPhysics;
  atStop: 'min' | 'max' | null;
}

export interface Readout {
  /** Big centre text on the display (≤ 5 chars). */
  text: string;
  /** Small line under it. */
  sub: string;
  /** aria-valuetext in plain words. */
  words: string;
}

const DEG = 180 / Math.PI;
const pad2 = (n: number) => String(n).padStart(2, '0');
const mod = (a: number, n: number) => ((a % n) + n) % n;

export function nearestSnap(theta: number, p: ResolvedPhysics): { i: number; d: number } | null {
  if (!p.snaps.length) return null;
  let best = { i: 0, d: Infinity };
  p.snaps.forEach((s, i) => {
    const d = Math.abs(p.stops ? theta - s : wrapPi(theta - s));
    if (d < best.d) best = { i, d };
  });
  return best;
}

export function readout({ theta, value, index, p, atStop }: ReadoutInput): Readout {
  const deg = theta * DEG;
  const n = p.detents;

  if (n > 0) {
    const i = mod(index, n);
    const accent = p.accents.some((a) => Math.abs(wrapPi(i * ((2 * Math.PI) / n) - a)) < 1e-3);
    if (n === 12) {
      const hour = i === 0 ? 12 : i;
      return {
        text: String(hour),
        sub: accent ? 'NOON' : `${pad2(hour)} / 12`,
        words: `${hour} o'clock${accent ? ', the heavy detent' : ''}`,
      };
    }
    const stop = atStop ? `, ${atStop === 'min' ? 'first' : 'last'} stop` : '';
    return {
      text: pad2(i),
      sub: `/ ${n}`,
      words: `Detent ${i} of ${n}${accent ? ', accent' : ''}${stop}`,
    };
  }

  const snap = nearestSnap(theta, p);
  if (snap) {
    const on = snap.d < 2.5 / DEG;
    const shown = Math.round(mod(deg, 360));
    return on
      ? {
          text: `M${snap.i + 1}`,
          sub: `${snap.i + 1} OF ${p.snaps.length}`,
          words: `On marker ${snap.i + 1} of ${p.snaps.length}`,
        }
      : { text: `${shown}°`, sub: 'SEEKING', words: `Between markers, ${shown} degrees` };
  }

  if (p.spring > 0) {
    const a = Math.round(deg);
    if (a === 0) return { text: '0°', sub: 'CENTER', words: 'Centered' };
    const edge = atStop ? ', at the limit' : '';
    return {
      text: `${a > 0 ? '+' : '−'}${Math.abs(a)}°`,
      sub: a > 0 ? 'FORWARD' : 'REVERSE',
      words: `${Math.abs(a)} degrees ${a > 0 ? 'right' : 'left'} of center${edge}, springs back`,
    };
  }

  if (p.stops) {
    const pct = Math.round(value * 100);
    const onAccent = p.accents.some((a) => Math.abs(theta - a) < 1.5 / DEG);
    const sub = atStop ? (atStop === 'min' ? 'MIN' : 'MAX') : onAccent ? 'DETENT' : '%';
    const words = `${pct} percent${atStop ? ', end stop' : ''}${onAccent ? ', center detent' : ''}`;
    return { text: String(pct), sub, words };
  }

  const shown = Math.round(mod(deg, 360));
  const turns = deg / 360;
  return {
    text: `${shown}°`,
    sub: `${turns >= 0 ? '' : '−'}${Math.abs(turns).toFixed(2)} REV`,
    words: `${shown} degrees${Math.abs(turns) >= 1 ? `, ${Math.floor(Math.abs(turns))} full turns ${turns > 0 ? 'clockwise' : 'counterclockwise'}` : ''}`,
  };
}
