/**
 * The knob's round AMOLED display, drawn into a 2D canvas. One pure function
 * so the 3D texture, 2D feel cards and generated images all match.
 *
 *   drawDisplay(ctx, 512, { name: 'Clock', color: '#ffb547', text: '12', sub: 'NOON', theta: 0,
 *                           index: 0, p: resolvePhysics(byProfile('clock').physics), snap: -1, press: 0 });
 *
 * Fonts: call `loadDisplayFonts()` once first, or the fallback face gets baked in.
 */
import type { ResolvedPhysics } from './physics';

export interface DisplayModel {
  name: string;
  color: string;
  text: string;
  sub: string;
  /** Knob angle, radians. The display is stationary; only the marker moves. */
  theta: number;
  index: number;
  p: ResolvedPhysics;
  snap: number;
  press: number;
}

const INK = '#f4f1f2';
const MONO = '"Martian Mono Variable", "Martian Mono", ui-monospace, monospace';
const SANS = '"Archivo Variable", "Archivo", system-ui, sans-serif';

let fontsReady: Promise<void> | null = null;
export function loadDisplayFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  fontsReady ??= Promise.all([
    document.fonts.load(`450 24px ${MONO}`),
    document.fonts.load(`640 64px ${SANS}`),
  ])
    .then(() => undefined)
    .catch(() => undefined);
  return fontsReady;
}

/** A cheap key: redraw only when this changes. */
export function displayKey(m: DisplayModel): string {
  return `${m.name}|${m.color}|${m.text}|${m.sub}|${(m.theta * 57.2958).toFixed(1)}|${m.index}|${m.snap}|${m.press.toFixed(2)}|${m.p.detents}|${m.p.stops?.join()}|${m.p.snaps.length}|${m.p.spring}`;
}

export function drawDisplay(ctx: CanvasRenderingContext2D, size: number, m: DisplayModel): void {
  const R = size / 2;
  const u = R / 18.2; // model mm → px (display radius is 18.2 mm)
  const p = m.p;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  ctx.translate(R, R);
  ctx.lineCap = 'round';

  const polar = (deg: number, r: number): [number, number] => {
    const b = (deg * Math.PI) / 180;
    return [r * u * Math.sin(b), -r * u * Math.cos(b)];
  };
  const tick = (deg: number, r0: number, r1: number) => {
    const [x0, y0] = polar(deg, r0);
    const [x1, y1] = polar(deg, r1);
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
  };
  const arcPath = (r: number, a: number, b: number) => {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    if (hi - lo < 0.05) return false;
    ctx.beginPath();
    ctx.arc(0, 0, r * u, ((lo - 90) * Math.PI) / 180, ((hi - 90) * Math.PI) / 180);
    return true;
  };
  const glow = (on: boolean) => {
    ctx.shadowColor = on ? m.color : 'transparent';
    ctx.shadowBlur = on ? 10 * (size / 512) : 0;
  };
  const deg = (m.theta * 180) / Math.PI;

  // Panel edge.
  ctx.beginPath();
  ctx.arc(0, 0, R - 1, 0, Math.PI * 2);
  ctx.strokeStyle = '#161416';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Scale
  if (p.detents) {
    const n = p.detents;
    const shown = Math.min(n, 120);
    ctx.beginPath();
    for (let i = 0; i < shown; i++) {
      const d = (i * 360) / shown;
      const accent = p.accents.some(
        (x) => Math.abs((((x * 180) / Math.PI - d + 540) % 360) - 180) < 0.01,
      );
      tick(d, accent ? 16.9 : 16.5, 14.9);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = (n > 48 ? 0.22 : 0.4) * u;
    ctx.stroke();
    const i = ((m.index % n) + n) % n;
    ctx.beginPath();
    tick((i * 360) / n, 16.9, 14.2);
    ctx.strokeStyle = m.color;
    ctx.lineWidth = Math.min(1.1, (2 * Math.PI * 16 * 0.55) / shown) * u;
    glow(true);
    ctx.stroke();
    glow(false);
  } else if (p.stops) {
    const a = (p.stops[0] * 180) / Math.PI;
    const b = (p.stops[1] * 180) / Math.PI;
    ctx.lineWidth = 1.1 * u;
    if (arcPath(15.6, a, b)) {
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.stroke();
    }
    const from = p.spring ? 0 : a;
    const to = Math.max(a, Math.min(b, deg));
    if (arcPath(15.6, from, to)) {
      ctx.strokeStyle = m.color;
      glow(true);
      ctx.stroke();
      glow(false);
    }
    ctx.beginPath();
    tick(a, 17, 14.2);
    tick(b, 17, 14.2);
    p.accents.forEach((x) => tick((x * 180) / Math.PI, 17, 14.2));
    if (p.spring) tick(0, 17, 14.2);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 0.4 * u;
    ctx.stroke();
  } else {
    ctx.beginPath();
    for (let i = 0; i < 72; i++) tick(i * 5, i % 6 === 0 ? 16.6 : 16.1, 15.2);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 0.25 * u;
    ctx.stroke();
  }

  // Magnet snap points
  p.snaps.forEach((s, i) => {
    const [x, y] = polar((s * 180) / Math.PI, 15.6);
    ctx.beginPath();
    ctx.arc(x, y, (i === m.snap ? 1.05 : 0.75) * u, 0, Math.PI * 2);
    ctx.fillStyle = i === m.snap ? m.color : INK;
    glow(i === m.snap);
    ctx.fill();
    glow(false);
  });

  // Position marker: where the knob is pointing.
  ctx.beginPath();
  tick(deg, 17.2, 14.8);
  ctx.strokeStyle = m.color;
  ctx.lineWidth = 0.9 * u;
  glow(true);
  ctx.stroke();
  glow(false);

  // Text
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string; fontStretch?: string };
  c.fontStretch = 'expanded';
  c.letterSpacing = `${0.3 * u}px`;
  ctx.font = `720 ${1.75 * u}px ${SANS}`;
  ctx.fillStyle = m.color;
  ctx.fillText(m.name.toUpperCase(), 0, -6.6 * u);
  c.fontStretch = 'normal';
  c.letterSpacing = '0px';
  // The big readout is set in expanded Archivo, like an engraved scale.
  const len = m.text.length;
  c.fontStretch = 'expanded';
  ctx.font = `640 ${(len > 4 ? 4.6 : len > 3 ? 5.6 : 7) * u}px ${SANS}`;
  ctx.fillStyle = INK;
  ctx.fillText(m.text, 0, 2.7 * u, 29 * u);
  c.fontStretch = 'normal';
  c.letterSpacing = `${0.18 * u}px`;
  ctx.font = `450 ${1.45 * u}px ${MONO}`;
  ctx.fillStyle = 'rgba(244,241,242,0.55)';
  ctx.fillText(m.sub, 0, 8.2 * u);
  c.letterSpacing = '0px';

  if (m.press > 0.01) {
    ctx.beginPath();
    ctx.arc(0, 0, 17.6 * u, 0, Math.PI * 2);
    ctx.strokeStyle = m.color;
    ctx.globalAlpha = m.press;
    ctx.lineWidth = 0.8 * u;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
