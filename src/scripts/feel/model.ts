/**
 * The feel model: a torque curve for any profile, plus the drawings and
 * readouts derived from it. Pure functions, no DOM: Astro calls them at build
 * time (server-rendered curves, sparklines and rings) and the feel station
 * calls them at runtime.
 *
 * Sign convention: angles in degrees, 0 = noon, clockwise positive (the same
 * as <detent-dial>). Positive torque pushes the knob clockwise. A stable rest
 * point is where torque crosses zero going from positive to negative.
 */
import { SPECS, type FeelProfile } from '@/data/product';

export type FeelPhysics = FeelProfile['physics'];

/** Peak motor torque in mN·m, read from the spec table (single source of truth). */
export const PEAK_TORQUE: number = (() => {
  const row = SPECS.flatMap((g) => g.rows).find((r) => /peak torque/i.test(r.label));
  const n = row ? parseFloat(row.value) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 32;
})();

/** Share of peak torque a full-strength detent uses (headroom for accents). */
export const CLICK_SHARE = 0.8;

/** Peak restoring torque of one click, in mN·m. */
export const clickTorque = (p: FeelPhysics) => p.strength * CLICK_SHARE * PEAK_TORQUE;

const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const wrap = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Derivative-of-Gaussian well: restoring torque that peaks at ±w with magnitude A. */
function well(x: number, w: number, a: number): number {
  const u = x / w;
  return -a * u * Math.exp(0.5 * (1 - u * u));
}

export function detentPeriod(p: FeelPhysics): number {
  return p.detents > 0 ? 360 / p.detents : 0;
}

/** Restoring torque (mN·m) the motor produces at an angle, ignoring velocity. */
export function torqueAt(p: FeelPhysics, deg: number): number {
  const T = PEAK_TORQUE;
  if (p.stops) {
    if (deg < p.stops[0]) return T;
    if (deg > p.stops[1]) return -T;
  }
  let t = 0;
  const period = detentPeriod(p);
  if (period) t += -clickTorque(p) * Math.sin((TAU * deg) / period);
  const accentAmp = T * 0.55 * Math.max(0.35, p.strength);
  const accentW = period ? Math.min(period / 2, 10) * 0.6 : 7;
  for (const a of p.accents ?? []) t += well(wrap(deg - a), accentW, accentAmp);
  for (const s of p.snaps ?? []) t += well(wrap(deg - s), 6, T * p.strength * 0.9);
  if (p.spring > 0) t += -p.spring * T * (deg / 120);
  return clamp(t, -T, T);
}

/** Viscous drag at one turn per second, shown as a band around zero. */
export function dragAt1Rps(p: FeelPhysics): number {
  return p.damping * PEAK_TORQUE * 0.6;
}

function sampleStep(p: FeelPhysics, fine: number): number {
  const period = detentPeriod(p);
  return period ? Math.min(fine, period / 12) : fine;
}

/** Angles (degrees) where the knob comes to rest on its own. */
export function restPoints(p: FeelPhysics): number[] {
  const step = sampleStep(p, 0.25);
  const eps = 0.02;
  const out: number[] = [];
  // Endless profiles wrap: sample a little past 180° to catch a rest point there.
  const end = p.stops ? 180 : 180 + 3;
  let sign = 0;
  let posA = 0;
  let posT = 0;
  for (let a = -180; a <= end + 1e-9; a += step) {
    const t = torqueAt(p, a);
    if (t > eps) {
      sign = 1;
      posA = a;
      posT = t;
    } else if (t < -eps) {
      if (sign > 0) {
        const x = wrap(posA + ((a - posA) * posT) / (posT - t));
        const inRange = !p.stops || (x >= p.stops[0] && x <= p.stops[1]);
        if (inRange && !out.some((o) => Math.abs(wrap(o - x)) < 0.5)) out.push(x);
      }
      sign = -1;
    }
  }
  return out.sort((a, b) => a - b);
}

/* -------------------------------------------------------------------------- */
/* Readouts                                                                   */
/* -------------------------------------------------------------------------- */

const MINUS = '−';
export const signed = (n: number, digits = 0) => {
  const s = Math.abs(n).toFixed(digits);
  return n < 0 && Number(s) !== 0 ? `${MINUS}${s}` : s;
};

export interface Readout {
  key: string;
  label: string;
  value: string;
}

export function formatRange(stops: FeelPhysics['stops']): string {
  if (!stops) return 'Endless';
  if (-stops[0] === stops[1]) return `±${stops[1]}°`;
  return `${signed(stops[0])}° to ${signed(stops[1])}°`;
}

/** Share of the usable range where the motor does nothing (neutral: stays where you leave it). */
function flatShare(p: FeelPhysics): number {
  const lo = p.stops ? p.stops[0] : -180;
  const hi = p.stops ? p.stops[1] : 180;
  let flat = 0;
  let n = 0;
  for (let a = lo; a <= hi; a += 1, n++) if (Math.abs(torqueAt(p, a)) < 0.05) flat++;
  return n ? flat / n : 0;
}

export function formatRest(p: FeelPhysics): string {
  const rests = restPoints(p);
  const free = flatShare(p) > 0.25;
  if (!rests.length) return 'Anywhere';
  const where = rests.length > 3 ? `${rests.length} points` : rests.map((r) => `${signed(r)}°`).join(' ');
  return free ? `${where} or anywhere` : where;
}

export function readouts(p: FeelPhysics): Readout[] {
  const accents = p.accents ?? [];
  const snaps = p.snaps ?? [];
  return [
    { key: 'detents', label: 'Detents', value: p.detents ? `${p.detents} per turn` : 'None' },
    { key: 'strength', label: 'Click torque', value: p.detents || accents.length || snaps.length ? `${clickTorque(p).toFixed(1)} mN·m` : 'None' },
    { key: 'damping', label: 'Damping', value: p.damping.toFixed(2) },
    { key: 'spring', label: 'Spring', value: p.spring ? p.spring.toFixed(2) : 'Off' },
    { key: 'range', label: 'Range', value: formatRange(p.stops) },
    { key: 'accents', label: 'Accents', value: accents.length ? accents.map((a) => `${signed(a)}°`).join(' ') : 'None' },
    { key: 'snaps', label: 'Magnet', value: snaps.length ? `${snaps.length} snap point${snaps.length === 1 ? '' : 's'}` : 'None' },
    { key: 'rest', label: 'Comes to rest', value: formatRest(p) },
  ];
}

/** The one number that best identifies a profile in a list. */
export function keyFigure(p: FeelPhysics): string {
  if (p.detents) return `${p.detents}/turn`;
  if (p.snaps?.length) return `${p.snaps.length} snaps`;
  if (p.spring) return 'spring';
  if (p.stops) return formatRange(p.stops);
  return 'free';
}

/** One mono line for captions and clips: "24 clicks/turn · endless · 20.5 mN·m". */
export function specLine(p: FeelPhysics): string {
  const parts: string[] = [];
  if (p.detents) parts.push(`${p.detents} clicks/turn`);
  if (p.snaps?.length) parts.push(`${p.snaps.length} snap point${p.snaps.length === 1 ? '' : 's'}`);
  if (p.spring) parts.push(`spring ${p.spring.toFixed(2)}`);
  if (!parts.length) parts.push('free');
  parts.push(p.stops ? `stops ${formatRange(p.stops)}` : 'endless');
  if (p.detents || p.snaps?.length || p.accents?.length) parts.push(`${clickTorque(p).toFixed(1)} mN·m`);
  return parts.join(' · ');
}

/** Plain-language summary of a curve, for screen readers and captions. */
export function describeCurve(p: FeelPhysics, name: string): string {
  const rests = restPoints(p);
  const parts: string[] = [`Torque curve for ${name}.`];
  if (p.detents) parts.push(`${p.detents} clicks per turn, peaking at ${clickTorque(p).toFixed(1)} mN·m.`);
  else if (p.snaps?.length) parts.push(`${p.snaps.length} magnetic snap points, otherwise free.`);
  else if (p.spring) parts.push(`A spring that pushes back harder the further you turn from noon.`);
  else if (!p.accents?.length) parts.push('Flat: no clicks, it stays wherever you let go.');
  if (p.accents?.length) parts.push(`Heavier detent at ${p.accents.map((a) => `${signed(a)}°`).join(', ')}.`);
  parts.push(p.stops ? `Hard end stops at ${formatRange(p.stops)}.` : 'No end stops.');
  if (rests.length && rests.length <= 12 && !p.detents) parts.push(`Comes to rest at ${rests.map((r) => `${signed(r)}°`).join(', ')}.`);
  parts.push(`Damping ${p.damping.toFixed(2)}.`);
  return parts.join(' ');
}

/* -------------------------------------------------------------------------- */
/* Torque curve (SVG markup)                                                  */
/* -------------------------------------------------------------------------- */

export interface CurveBox {
  width: number;
  height: number;
  /** Tighter labels for small curves. */
  compact?: boolean;
}

export interface CurveLayout {
  x: (deg: number) => number;
  y: (torque: number) => number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function curveLayout({ width, height, compact }: CurveBox): CurveLayout {
  const left = compact ? 30 : 44;
  const right = width - (compact ? 6 : 10);
  const top = compact ? 8 : 12;
  const bottom = height - (compact ? 18 : 24);
  const mid = (top + bottom) / 2;
  const half = (bottom - top) / 2;
  return {
    left,
    right,
    top,
    bottom,
    x: (deg) => left + ((deg + 180) / 360) * (right - left),
    y: (t) => mid - (t / PEAK_TORQUE) * half,
  };
}

function curvePoints(p: FeelPhysics, L: CurveLayout, step: number): string {
  let d = '';
  for (let a = -180; a <= 180 + 1e-9; a += step) {
    const deg = Math.min(180, a);
    d += `${d ? 'L' : 'M'}${r1(L.x(deg))} ${r1(L.y(torqueAt(p, deg)))}`;
  }
  return d;
}

/**
 * Inner markup for the torque-curve <svg>. Everything is classed so colors
 * come from CSS (feel color, ink, lines). The cursor group is positioned at
 * runtime with a transform.
 */
export function torqueCurveMarkup(p: FeelPhysics, box: CurveBox): string {
  const L = curveLayout(box);
  const T = PEAK_TORQUE;
  const zero = L.y(0);
  const parts: string[] = [];

  // Out-of-range regions behind end stops.
  if (p.stops) {
    const a = L.x(p.stops[0]);
    const b = L.x(p.stops[1]);
    if (a > L.left) parts.push(`<rect class="tc-stop" x="${L.left}" y="${L.top}" width="${r1(a - L.left)}" height="${r1(L.bottom - L.top)}"/>`);
    if (b < L.right) parts.push(`<rect class="tc-stop" x="${r1(b)}" y="${L.top}" width="${r1(L.right - b)}" height="${r1(L.bottom - L.top)}"/>`);
  }

  // Grid: ±peak, zero, and angle marks.
  const gridAngles = box.compact ? [-180, -90, 0, 90, 180] : [-180, -135, -90, -45, 0, 45, 90, 135, 180];
  let grid = '';
  for (const g of gridAngles) grid += `M${r1(L.x(g))} ${L.top}V${L.bottom}`;
  grid += `M${L.left} ${r1(L.y(T))}H${L.right}M${L.left} ${r1(L.y(-T))}H${L.right}`;
  parts.push(`<path class="tc-grid" d="${grid}"/>`);

  // Damping band: the drag you feel at one turn per second.
  const drag = dragAt1Rps(p);
  if (drag > 0.05) {
    const x0 = p.stops ? L.x(p.stops[0]) : L.left;
    const x1 = p.stops ? L.x(p.stops[1]) : L.right;
    parts.push(`<rect class="tc-drag" x="${r1(x0)}" y="${r1(L.y(drag))}" width="${r1(x1 - x0)}" height="${r1(L.y(-drag) - L.y(drag))}"/>`);
  }

  parts.push(`<path class="tc-zero" d="M${L.left} ${r1(zero)}H${L.right}"/>`);

  const step = sampleStep(p, box.width > 500 ? 0.5 : 1);
  const line = curvePoints(p, L, step);
  parts.push(`<path class="tc-area" d="${line}L${r1(L.right)} ${r1(zero)}L${L.left} ${r1(zero)}Z"/>`);
  parts.push(`<path class="tc-line" d="${line}"/>`);

  // Rest points: where it settles on its own.
  const rests = restPoints(p);
  if (rests.length && rests.length <= 72) {
    const rad = rests.length > 36 ? 1.6 : 2.6;
    parts.push(
      `<g class="tc-rest">${rests.map((a) => `<circle cx="${r1(L.x(a))}" cy="${r1(zero)}" r="${rad}"/>`).join('')}</g>`,
    );
  }

  // Labels.
  const fs = box.compact ? 9 : 10;
  const labels: string[] = [
    `<text x="${L.left - 6}" y="${r1(L.y(T)) + 3.5}" text-anchor="end">+${T}</text>`,
    `<text x="${L.left - 6}" y="${r1(zero) + 3.5}" text-anchor="end">0</text>`,
    `<text x="${L.left - 6}" y="${r1(L.y(-T)) + 3.5}" text-anchor="end">${signed(-T)}</text>`,
  ];
  for (const g of [-180, -90, 0, 90, 180]) {
    const anchor = g === -180 ? 'start' : g === 180 ? 'end' : 'middle';
    labels.push(`<text x="${r1(L.x(g))}" y="${L.bottom + fs + 5}" text-anchor="${anchor}">${signed(g)}°</text>`);
  }
  parts.push(`<g class="tc-label" font-size="${fs}">${labels.join('')}</g>`);
  return parts.join('');
}

/** A tiny, label-free curve for library rows. */
export function sparkPath(p: FeelPhysics, width = 96, height = 28): string {
  const pad = 2;
  const x = (deg: number) => pad + ((deg + 180) / 360) * (width - pad * 2);
  const y = (t: number) => height / 2 - (t / PEAK_TORQUE) * (height / 2 - pad);
  const period = detentPeriod(p);
  const step = period ? clamp(period / 4, 0.75, 1.5) : 1.5;
  let d = '';
  for (let a = -180; a <= 180 + 1e-9; a += step) {
    const deg = Math.min(180, a);
    d += `${d ? 'L' : 'M'}${r1(x(deg))} ${r1(y(torqueAt(p, deg)))}`;
  }
  return d;
}

/* -------------------------------------------------------------------------- */
/* Feel map: the engraved ring around the dial (SVG, viewBox -200 -200 400 400) */
/* -------------------------------------------------------------------------- */

const polar = (r: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [r1(r * Math.sin(a)), r1(-r * Math.cos(a))];
};
const tick = (r0: number, r1_: number, deg: number) => {
  const [x0, y0] = polar(r0, deg);
  const [x1, y1] = polar(r1_, deg);
  return `M${x0} ${y0}L${x1} ${y1}`;
};

export interface FeelGeometry {
  detents: number[];
  accents: number[];
  snaps: number[];
  stops: [number, number] | null;
  spring: number;
}

export function feelGeometry(p: FeelPhysics): FeelGeometry {
  const period = detentPeriod(p);
  const inRange = (a: number) => !p.stops || (a >= p.stops[0] - 1e-6 && a <= p.stops[1] + 1e-6);
  const detents: number[] = [];
  if (period) for (let i = 0; i < p.detents; i++) {
    const a = wrap(i * period);
    if (inRange(a)) detents.push(a);
  }
  return {
    detents,
    accents: (p.accents ?? []).filter(inRange),
    snaps: (p.snaps ?? []).filter(inRange),
    stops: p.stops,
    spring: p.spring,
  };
}

/** Radii of the ring (viewBox units). The dial itself sits inside r = 150. */
export const RING = {
  scaleOuter: 197,
  scaleMinor: 192,
  scaleMajor: 186,
  detentOuter: 179,
  detentInner: 168,
  accentOuter: 184,
  accentInner: 162,
  snap: 173,
  springInner: 158,
  springMax: 16,
  needleTip: 160,
  needleBase: 151,
} as const;

function arcPath(rOuter: number, rInner: number, from: number, to: number): string {
  // Clockwise from `from` to `to` (degrees), as an annulus sector.
  let sweep = to - from;
  while (sweep <= 0) sweep += 360;
  const large = sweep > 180 ? 1 : 0;
  const [ox0, oy0] = polar(rOuter, from);
  const [ox1, oy1] = polar(rOuter, from + sweep);
  const [ix1, iy1] = polar(rInner, from + sweep);
  const [ix0, iy0] = polar(rInner, from);
  return `M${ox0} ${oy0}A${rOuter} ${rOuter} 0 ${large} 1 ${ox1} ${oy1}L${ix1} ${iy1}A${rInner} ${rInner} 0 ${large} 0 ${ix0} ${iy0}Z`;
}

/** Static engraved scale: 72 minor marks, 12 majors. Profile-independent. */
export function ringScaleMarkup(): string {
  let minor = '';
  let major = '';
  for (let i = 0; i < 72; i++) {
    const a = i * 5;
    if (a % 30 === 0) major += tick(RING.scaleMajor, RING.scaleOuter, a);
    else minor += tick(RING.scaleMinor, RING.scaleOuter, a);
  }
  return `<path class="fm-minor" d="${minor}"/><path class="fm-major" d="${major}"/>`;
}

/** Profile-dependent layer: stops, spring, detents, accents, snaps. */
export function ringFeelMarkup(p: FeelPhysics): string {
  const g = feelGeometry(p);
  const parts: string[] = [];
  if (g.stops) {
    parts.push(`<path class="fm-stop" d="${arcPath(RING.scaleOuter + 1, RING.springInner - 2, g.stops[1], g.stops[0] + 360)}"/>`);
    parts.push(`<path class="fm-wall" d="${tick(RING.springInner - 4, RING.scaleOuter + 2, g.stops[0])}${tick(RING.springInner - 4, RING.scaleOuter + 2, g.stops[1])}"/>`);
  }
  if (g.spring > 0) {
    const lo = g.stops ? g.stops[0] : -180;
    const hi = g.stops ? g.stops[1] : 180;
    const outer: string[] = [];
    const inner: string[] = [];
    for (let a = lo; a <= hi + 1e-9; a += 3) {
      const deg = Math.min(hi, a);
      const thick = 1 + RING.springMax * g.spring * Math.min(1, Math.abs(deg) / 120);
      const [ox, oy] = polar(RING.springInner + thick, deg);
      const [ix, iy] = polar(RING.springInner, deg);
      outer.push(`${ox} ${oy}`);
      inner.unshift(`${ix} ${iy}`);
    }
    parts.push(`<path class="fm-spring" d="M${outer.join('L')}L${inner.join('L')}Z"/>`);
  }
  if (g.detents.length) parts.push(`<path class="fm-detent" d="${g.detents.map((a) => tick(RING.detentInner, RING.detentOuter, a)).join('')}"/>`);
  if (g.accents.length) parts.push(`<path class="fm-accent" d="${g.accents.map((a) => tick(RING.accentInner, RING.accentOuter, a)).join('')}"/>`);
  if (g.snaps.length) {
    const s = 5.5;
    parts.push(
      `<path class="fm-snap" d="${g.snaps
        .map((a) => {
          const [cx, cy] = polar(RING.snap, a);
          return `M${cx} ${r1(cy - s)}L${r1(cx + s)} ${cy}L${cx} ${r1(cy + s)}L${r1(cx - s)} ${cy}Z`;
        })
        .join('')}"/>`,
    );
  }
  return parts.join('');
}

export const needleMarkup = () =>
  `<path d="M0 ${-RING.needleTip}L${-5} ${-RING.needleBase}L5 ${-RING.needleBase}Z"/>`;
