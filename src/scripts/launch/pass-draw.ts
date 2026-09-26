/**
 * Founder Pass renderer. One draw function, two layouts:
 *   landscape 1200×630 (X, LinkedIn, iMessage previews)
 *   story     1080×1920 (Stories, Reels covers)
 * Drawn in logical units; callers scale the context for DPR or export size.
 * Canvas colors are sRGB hex equivalents of the DESIGN.md tokens so the
 * exported PNG matches the page.
 */
import type { Finish, FeelProfile } from '@/data/product';
import { drawSignature, feelSpec } from './signature';

export type PassLayout = 'landscape' | 'story';
export const PASS_SIZE: Record<PassLayout, [number, number]> = {
  landscape: [1200, 630],
  story: [1080, 1920],
};

export interface PassData {
  handle: string;
  finish: Finish;
  profile: FeelProfile;
  /** Referral code (seed for the signature and the pass ID). */
  code: string;
  /** Formatted pass ID, e.g. 7K3Q-9M2X. */
  passId: string;
  /** Referral URL burned into the image, without protocol. */
  url: string;
  /** "Joined 09.26" style line. */
  since: string;
  /** "$299 on the list · reservations 11.10" style line. */
  offer: string;
  /** Sample passes say so on the pass itself. */
  sample?: boolean;
}

const C = {
  bg: '#0b0a0b',
  ticket: '#161314',
  edge: 'rgba(255,255,255,0.11)',
  perf: 'rgba(255,255,255,0.2)',
  ink: '#f4f1f2',
  muted: '#b8b2b5',
  faint: '#8d878a',
  tally: '#e0115f',
  disc: '#0b0a0b',
};

const SANS = '"Archivo Variable", Archivo, system-ui, sans-serif';
const MONO = '"Martian Mono Variable", ui-monospace, Menlo, monospace';

type Ctx = CanvasRenderingContext2D;

function font(
  ctx: Ctx,
  weight: number,
  size: number,
  family: string,
  stretch: 'normal' | 'semi-expanded' | 'expanded' = 'normal',
) {
  ctx.font = `${weight} ${size}px ${family}`;
  if ('fontStretch' in ctx) ctx.fontStretch = stretch;
  if ('letterSpacing' in ctx) ctx.letterSpacing = family === MONO ? '0.04em' : '0px';
}

/** Largest size in [min, max] at which text fits maxWidth. */
function fit(
  ctx: Ctx,
  text: string,
  maxWidth: number,
  max: number,
  min: number,
  weight: number,
  family: string,
  stretch: 'normal' | 'expanded',
) {
  let size = max;
  font(ctx, weight, size, family, stretch);
  while (size > min && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    font(ctx, weight, size, family, stretch);
  }
  return size;
}

function ticket(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  notch: { x?: number; y?: number; r: number },
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = C.ticket;
  ctx.fill();
  ctx.strokeStyle = C.edge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Notches where the stub tears off.
  ctx.fillStyle = C.bg;
  const pts =
    notch.x !== undefined
      ? [
          [notch.x, y],
          [notch.x, y + h],
        ]
      : [
          [x, notch.y!],
          [x + w, notch.y!],
        ];
  for (const [nx, ny] of pts) {
    ctx.beginPath();
    ctx.arc(nx!, ny!, notch.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.edge;
    ctx.stroke();
  }
}

function perforation(ctx: Ctx, x1: number, y1: number, x2: number, y2: number) {
  ctx.save();
  ctx.strokeStyle = C.perf;
  ctx.lineWidth = 2;
  ctx.setLineDash([2, 10]);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function logo(ctx: Ctx, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.arc(x + 14 * s, y, 14 * s, 0, Math.PI * 2);
  ctx.fillStyle = C.ink;
  ctx.fill();
  ctx.save();
  ctx.translate(x + 14 * s, y);
  ctx.rotate((35 * Math.PI) / 180);
  ctx.strokeStyle = C.tally;
  ctx.lineWidth = 3.2 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -10.5 * s);
  ctx.lineTo(0, -4.5 * s);
  ctx.stroke();
  ctx.restore();
  font(ctx, 800, 30 * s, SANS, 'expanded');
  ctx.fillStyle = C.ink;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('detent', x + 38 * s, y + 1 * s);
}

function label(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  size: number,
  align: CanvasTextAlign = 'left',
  color = C.faint,
) {
  font(ctx, 450, size, MONO);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text.toUpperCase(), x, y);
}

/** The ring: signature, engraved minute track, and the knob's display disc. */
function ring(ctx: Ctx, cx: number, cy: number, R: number, d: PassData) {
  drawSignature(ctx, cx, cy, R, d.profile.physics, d.code, {
    color: d.profile.color,
    width: R / 240,
    rings: 28,
  });

  // Engraved track: 72 marks, heavier every hour.
  ctx.save();
  ctx.strokeStyle = C.muted;
  for (let i = 0; i < 72; i++) {
    const th = (i / 72) * Math.PI * 2;
    const long = i % 6 === 0;
    const r1 = R * 1.06;
    const r2 = R * (long ? 1.13 : 1.09);
    ctx.globalAlpha = long ? 0.7 : 0.32;
    ctx.lineWidth = long ? R / 110 : R / 220;
    ctx.beginPath();
    ctx.moveTo(cx + Math.sin(th) * r1, cy - Math.cos(th) * r1);
    ctx.lineTo(cx + Math.sin(th) * r2, cy - Math.cos(th) * r2);
    ctx.stroke();
  }
  ctx.restore();

  // Display disc, like the knob face.
  const dr = R * 0.36;
  ctx.beginPath();
  ctx.arc(cx, cy, dr, 0, Math.PI * 2);
  ctx.fillStyle = C.disc;
  ctx.fill();
  ctx.lineWidth = R / 80;
  ctx.strokeStyle = d.profile.color;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.ink;
  font(ctx, 500, R * 0.095, MONO);
  ctx.fillText(d.profile.name.toUpperCase(), cx, cy - R * 0.04);
  font(ctx, 400, R * 0.052, MONO);
  ctx.fillStyle = C.muted;
  ctx.fillText(feelSpec(d.profile.physics).toUpperCase(), cx, cy + R * 0.09);
}

function swatch(ctx: Ctx, x: number, y: number, r: number, color: string) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.stroke();
}

function rows(
  ctx: Ctx,
  d: PassData,
  x: number,
  valueX: number,
  y0: number,
  gap: number,
  s: number,
  right: number,
) {
  const items: [string, () => void][] = [
    [
      'Finish',
      () => {
        swatch(ctx, valueX + 11 * s, y0 - 9 * s, 11 * s, d.finish.body);
        font(ctx, 640, 27 * s, SANS, 'semi-expanded');
        ctx.fillStyle = C.ink;
        ctx.textAlign = 'left';
        ctx.fillText(d.finish.name, valueX + 32 * s, y0);
      },
    ],
    [
      'Feel',
      () => {
        swatch(ctx, valueX + 11 * s, y0 + gap - 9 * s, 7 * s, d.profile.color);
        font(ctx, 640, 27 * s, SANS, 'semi-expanded');
        ctx.fillStyle = C.ink;
        ctx.textAlign = 'left';
        ctx.fillText(d.profile.name, valueX + 32 * s, y0 + gap);
      },
    ],
    [
      'Pass ID',
      () => {
        font(ctx, 450, 25 * s, MONO);
        ctx.fillStyle = C.ink;
        ctx.textAlign = 'left';
        ctx.fillText(d.passId, valueX, y0 + gap * 2);
      },
    ],
  ];
  items.forEach(([name, draw], i) => {
    const y = y0 + gap * i;
    ctx.strokeStyle = C.edge;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y - gap * 0.62);
    ctx.lineTo(right, y - gap * 0.62);
    ctx.stroke();
    label(ctx, name, x, y - 2 * s, 14 * s);
    draw();
  });
}

function passKind(ctx: Ctx, d: PassData, x: number, y: number, s: number) {
  const text = d.sample ? 'Sample pass' : 'Founder pass';
  font(ctx, 450, 15 * s, MONO);
  ctx.textAlign = 'right';
  const w = ctx.measureText(text.toUpperCase()).width;
  ctx.beginPath();
  ctx.arc(x - w - 16 * s, y - 5 * s, 5 * s, 0, Math.PI * 2);
  ctx.fillStyle = C.tally;
  ctx.fill();
  label(ctx, text, x, y, 15 * s, 'right', C.muted);
}

export function drawPass(ctx: Ctx, layout: PassLayout, d: PassData): void {
  const [W, H] = PASS_SIZE[layout];
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  const handle = `@${d.handle || 'founder'}`;

  if (layout === 'landscape') {
    const stub = 630;
    ticket(ctx, 32, 32, W - 64, H - 64, 22, { x: stub, r: 18 });
    perforation(ctx, stub, 62, stub, H - 62);
    ring(ctx, 331, 315, 226, d);

    const x = 674;
    const right = W - 74;
    logo(ctx, x, 94, 1);
    passKind(ctx, d, right, 100, 1);

    fit(ctx, handle, right - x, 80, 34, 800, SANS, 'expanded');
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(handle, x, 226);
    font(ctx, 450, 21, SANS);
    ctx.fillStyle = C.muted;
    ctx.fillText(`Detent One waitlist · ${d.since}`, x, 266);

    rows(ctx, d, x, x + 150, 350, 56, 1, right);

    label(ctx, d.offer, x, 522, 13, 'left', C.muted);
    font(ctx, 400, 13, MONO);
    ctx.fillStyle = C.faint;
    ctx.textAlign = 'left';
    const url = fitUrl(ctx, d.url, right - x);
    ctx.fillText(url, x, 556);
    return;
  }

  // Story
  const s = 1.45;
  const perfY = 1190;
  ticket(ctx, 54, 54, W - 108, H - 108, 30, { y: perfY, r: 26 });
  perforation(ctx, 84, perfY, W - 84, perfY);
  const x = 118;
  const right = W - 118;
  logo(ctx, x, 158, s);
  passKind(ctx, d, right, 166, s);
  ring(ctx, W / 2, 670, 380, d);

  fit(ctx, handle, right - x, 124, 48, 800, SANS, 'expanded');
  ctx.fillStyle = C.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(handle, x, 1352);
  font(ctx, 450, 30, SANS);
  ctx.fillStyle = C.muted;
  ctx.fillText(`Detent One waitlist · ${d.since}`, x, 1408);

  rows(ctx, d, x, x + 230, 1520, 82, s, right);

  label(ctx, d.offer, x, 1748, 19, 'left', C.muted);
  font(ctx, 400, 19, MONO);
  ctx.fillStyle = C.faint;
  ctx.textAlign = 'left';
  ctx.fillText(fitUrl(ctx, d.url, right - x), x, 1794);
}

/** Shorten the middle of a URL until it fits. */
function fitUrl(ctx: Ctx, url: string, max: number): string {
  if (ctx.measureText(url).width <= max) return url;
  let head = url.slice(0, Math.ceil(url.length / 2));
  let tail = url.slice(Math.ceil(url.length / 2));
  while (head.length > 8 && ctx.measureText(`${head}…${tail}`).width > max) {
    head = head.slice(0, -1);
    tail = tail.length > 14 ? tail.slice(1) : tail;
  }
  return `${head}…${tail}`;
}

/** Wait for the two faces before drawing, so the first frame is right. */
export async function passFontsReady(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load(`800 80px ${SANS}`),
      document.fonts.load(`640 27px ${SANS}`),
      document.fonts.load(`450 20px ${MONO}`),
    ]);
  } catch {
    /* draw with fallbacks */
  }
}

/** Render a layout at its native size and return a PNG blob. */
export async function renderPng(layout: PassLayout, d: PassData): Promise<Blob | null> {
  const [W, H] = PASS_SIZE[layout];
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  drawPass(ctx, layout, d);
  return new Promise((res) => canvas.toBlob((b) => res(b), 'image/png'));
}
