/**
 * The Crack the Safe share card, drawn in the browser at 1200×630 (the OG
 * size, so it unfurls cleanly when posted). Spoiler-free: the engraved scale
 * carries no marks for today's numbers. Loaded lazily after a crack.
 * Colors are raster exports of the tokens (graphite-950, alu-100, tally).
 */
export interface SafeCardData {
  number: number;
  time: string;
  wheels: boolean[]; // true = clean (first set)
  sets: number;
  streak: number;
  url: string;
}

const C = {
  bg: '#0c0a0b',
  raised: '#1a1718',
  band: '#231f21',
  ink: '#ece9ea',
  muted: '#b4afb1',
  faint: '#6f6a6c',
  line: 'rgba(255,255,255,0.12)',
  tally: '#e0115f',
  tallyHot: '#f25d8f',
};

const SANS = '"Archivo Variable", Archivo, system-ui, sans-serif';
const MONO = '"Martian Mono Variable", ui-monospace, Menlo, monospace';

function font(
  ctx: CanvasRenderingContext2D,
  weight: number,
  size: number,
  family: string,
  stretch?: CanvasFontStretch,
) {
  ctx.font = `${weight} ${size}px ${family}`;
  if ('fontStretch' in ctx) ctx.fontStretch = stretch ?? 'normal';
}

export async function drawSafeCard(d: SafeCardData): Promise<HTMLCanvasElement> {
  try {
    await Promise.all([
      document.fonts.load(`800 120px "Archivo Variable"`),
      document.fonts.load(`400 24px "Martian Mono Variable"`),
    ]);
  } catch {
    /* system fallbacks are fine */
  }
  const W = 1200;
  const H = 630;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  // --- The dial, bleeding off the left edge ---------------------------------
  const cx = 250;
  const cy = 315;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1;
  for (const r of [300, 286]) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = C.band;
  ctx.beginPath();
  ctx.arc(0, 0, 270, 0, Math.PI * 2);
  ctx.arc(0, 0, 186, 0, Math.PI * 2, true);
  ctx.fill();
  for (let k = 0; k < 100; k++) {
    const a = (-k * 3.6 * Math.PI) / 180 - Math.PI / 2;
    const long = k % 10 === 0;
    const mid = k % 5 === 0;
    const r1 = 266;
    const r0 = long ? 238 : mid ? 248 : 256;
    ctx.strokeStyle = long ? C.ink : C.muted;
    ctx.globalAlpha = long ? 0.9 : 0.55;
    ctx.lineWidth = long ? 3 : 1.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  font(ctx, 720, 24, SANS, 'expanded');
  ctx.fillStyle = C.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let k = 0; k < 100; k += 10) {
    ctx.save();
    ctx.rotate((-k * 3.6 * Math.PI) / 180);
    ctx.fillText(String(k), 0, -214);
    ctx.restore();
  }
  // Knob with its tally indicator.
  ctx.fillStyle = C.raised;
  ctx.beginPath();
  ctx.arc(0, 0, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#050405';
  ctx.beginPath();
  ctx.arc(0, 0, 104, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = C.tally;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 94, 0, Math.PI * 2);
  ctx.stroke();
  font(ctx, 800, 40, SANS, 'expanded');
  ctx.fillStyle = C.ink;
  ctx.fillText('OPEN', 0, 2);
  // Index wedge at noon.
  ctx.fillStyle = C.tally;
  ctx.beginPath();
  ctx.moveTo(0, -274);
  ctx.lineTo(-11, -298);
  ctx.lineTo(11, -298);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // --- Result -------------------------------------------------------------
  const x = 640;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  font(ctx, 600, 30, SANS, 'semi-expanded');
  ctx.fillStyle = C.muted;
  ctx.fillText('Detent Safe', x, 128);
  font(ctx, 800, 150, SANS, 'expanded');
  ctx.fillStyle = C.ink;
  ctx.fillText(`#${d.number}`, x - 6, 262);

  font(ctx, 400, 38, MONO);
  ctx.fillStyle = C.ink;
  ctx.fillText(`Open in ${d.time}`, x, 340);

  // Wheels: filled = first set, ring = found after a miss.
  const labels = ['R', 'L', 'R'];
  d.wheels.forEach((clean, i) => {
    const wx = x + 22 + i * 86;
    const wy = 396;
    ctx.beginPath();
    ctx.arc(wx, wy, 20, 0, Math.PI * 2);
    if (clean) {
      ctx.fillStyle = C.tally;
      ctx.fill();
    } else {
      ctx.strokeStyle = C.tally;
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    font(ctx, 400, 18, MONO);
    ctx.fillStyle = C.muted;
    ctx.textAlign = 'center';
    ctx.fillText(labels[i]!, wx, wy + 52);
    ctx.textAlign = 'left';
  });
  font(ctx, 400, 22, MONO);
  ctx.fillStyle = C.muted;
  const clean = d.wheels.filter(Boolean).length;
  const meta = [`${clean}/3 clean`, `${d.sets} sets`];
  if (d.streak > 1) meta.push(`streak ${d.streak}`);
  ctx.fillText(meta.join('  ·  '), x, 500);

  // Footer: wordmark and URL.
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, 530);
  ctx.lineTo(W - 60, 530);
  ctx.stroke();
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.arc(x + 14, 562, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(x + 14, 562);
  ctx.rotate((35 * Math.PI) / 180);
  ctx.strokeStyle = C.tally;
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(0, -4);
  ctx.stroke();
  ctx.restore();
  font(ctx, 800, 26, SANS, 'expanded');
  ctx.fillStyle = C.ink;
  ctx.fillText('detent', x + 38, 571);
  font(ctx, 400, 18, MONO);
  ctx.fillStyle = C.muted;
  ctx.textAlign = 'right';
  ctx.fillText(d.url.replace(/^https?:\/\//, ''), W - 60, 569);
  return canvas;
}
