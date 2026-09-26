/**
 * Record a short clip of the feel station: the dial's live canvas,
 * composited with the engraved ring, the profile name and a watermark onto a
 * 1080 × 1080 canvas, encoded by MediaRecorder (MP4 when the browser can,
 * WebM otherwise). Loaded only when someone presses Record.
 *
 * Audio: if the dial engine exposes a recording stream from
 * src/scripts/dial/audio(.ts|/index.ts) (getRecordingStream / getAudioStream)
 * or on the element (getAudioStream()), its audio track is mixed in. If not,
 * the clip is video only.
 */
import { SITE } from '@/config/site';
import type { DetentDialElement } from '@/scripts/dial/types';
import { feelGeometry, RING, type FeelPhysics } from './model';
import { profileFileName } from './json';

export interface ClipOverlay {
  name: string;
  /** Feel color (sRGB hex). */
  color: string;
  /** One readout line, e.g. "24 per turn · Endless". */
  detail: string;
  watermark: string;
  physics: FeelPhysics;
  angle: number;
}

export interface Clip {
  blob: Blob;
  url: string;
  file: File;
  mime: string;
  ext: 'mp4' | 'webm';
  width: number;
  height: number;
}

const TYPES_AV = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1,mp4a',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];
const TYPES_V = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];

export function pickType(withAudio: boolean): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return (withAudio ? TYPES_AV : TYPES_V).find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

/* ---- Optional audio from the dial engine -------------------------------- */
const audioModules = import.meta.glob<Record<string, unknown>>(['/src/scripts/dial/audio.ts', '/src/scripts/dial/audio/index.ts']);

async function dialAudio(dial: DetentDialElement): Promise<MediaStream | null> {
  const candidates: unknown[] = [];
  const onElement = (dial as unknown as { getAudioStream?: () => unknown }).getAudioStream;
  if (typeof onElement === 'function') candidates.push(() => onElement.call(dial));
  for (const load of Object.values(audioModules)) {
    try {
      const mod = await load();
      for (const k of ['getRecordingStream', 'getAudioStream', 'createRecordingStream']) {
        if (typeof mod[k] === 'function') candidates.push(mod[k]);
      }
    } catch {
      /* no audio engine: video only */
    }
  }
  for (const fn of candidates) {
    try {
      const s = await (fn as () => unknown)();
      if (typeof MediaStream !== 'undefined' && s instanceof MediaStream && s.getAudioTracks().length) return s;
    } catch {
      /* try the next one */
    }
  }
  return null;
}

/* ---- Drawing ------------------------------------------------------------- */
/** Drawing space. Output is scaled from this (1080² on capable machines, 720² otherwise). */
const SIZE = 1080;
const CX = SIZE / 2;
const CY = 572;
/** Ring scale: viewBox units (±200) to clip pixels. */
const K = 1.95;

const polar = (r: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [CX + r * K * Math.sin(a), CY - r * K * Math.cos(a)];
};

function tickPath(ctx: CanvasRenderingContext2D, r0: number, r1: number, deg: number) {
  const [x0, y0] = polar(r0, deg);
  const [x1, y1] = polar(r1, deg);
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
}

const ALU = '#e9e7e8';
const MUTED = '#a9a5a7';

function drawRing(ctx: CanvasRenderingContext2D, o: ClipOverlay) {
  const g = feelGeometry(o.physics);
  ctx.save();
  ctx.lineCap = 'round';
  // Engraved scale.
  ctx.strokeStyle = MUTED;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 72; i++) if ((i * 5) % 30) tickPath(ctx, RING.scaleMinor, RING.scaleOuter, i * 5);
  ctx.stroke();
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  for (let a = 0; a < 360; a += 30) tickPath(ctx, RING.scaleMajor, RING.scaleOuter, a);
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (g.stops) {
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    const from = ((g.stops[1] - 90) * Math.PI) / 180;
    const to = ((g.stops[0] + 360 - 90) * Math.PI) / 180;
    ctx.arc(CX, CY, (RING.scaleOuter + 1) * K, from, to);
    ctx.arc(CX, CY, (RING.springInner - 2) * K, to, from, true);
    ctx.fill();
    ctx.strokeStyle = ALU;
    ctx.lineWidth = 6;
    ctx.beginPath();
    tickPath(ctx, RING.springInner - 4, RING.scaleOuter + 2, g.stops[0]);
    tickPath(ctx, RING.springInner - 4, RING.scaleOuter + 2, g.stops[1]);
    ctx.stroke();
  }
  ctx.strokeStyle = o.color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (const a of g.detents) tickPath(ctx, RING.detentInner, RING.detentOuter, a);
  ctx.stroke();
  ctx.strokeStyle = ALU;
  ctx.lineWidth = 8;
  ctx.beginPath();
  for (const a of g.accents) tickPath(ctx, RING.accentInner, RING.accentOuter, a);
  ctx.stroke();
  ctx.fillStyle = o.color;
  for (const a of g.snaps) {
    const [x, y] = polar(RING.snap, a);
    const s = 5.5 * K;
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s, y);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x - s, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawNeedle(ctx: CanvasRenderingContext2D, angle: number) {
  ctx.fillStyle = ALU;
  const [tx, ty] = polar(RING.needleTip, angle);
  const [lx, ly] = polar(RING.needleBase, angle - 2);
  const [rx, ry] = polar(RING.needleBase, angle + 2);
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(lx, ly);
  ctx.lineTo(rx, ry);
  ctx.closePath();
  ctx.fill();
}

/** Everything that doesn't move: background, ring, name, watermark. (The
 *  halo is the dial's own: its canvas already lights the base's LED ring.) */
function drawStatic(ctx: CanvasRenderingContext2D, o: ClipOverlay) {
  ctx.fillStyle = SITE.themeColor;
  ctx.fillRect(0, 0, SIZE, SIZE);

  drawRing(ctx, o);

  // Name + readout, top left.
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const c = ctx as CanvasRenderingContext2D & { fontStretch?: string };
  if ('fontStretch' in c) c.fontStretch = 'expanded';
  ctx.fillStyle = ALU;
  ctx.font = '780 58px "Archivo Variable", "Archivo", sans-serif';
  ctx.fillText(o.name, 64, 112, SIZE - 128);
  if ('fontStretch' in c) c.fontStretch = 'normal';
  ctx.fillStyle = o.color;
  ctx.font = '450 24px "Martian Mono Variable", ui-monospace, monospace';
  ctx.fillText(o.detail, 66, 156, SIZE - 132);

  // Watermark, bottom.
  ctx.font = '600 24px "Archivo Variable", "Archivo", sans-serif';
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'center';
  ctx.fillText(o.watermark, CX, SIZE - 44, SIZE - 96);
}

/** Per-frame: the cached static layer, the live dial, the needle. */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  scale: number,
  layer: HTMLCanvasElement,
  video: HTMLVideoElement,
  src: HTMLCanvasElement,
  angle: number,
) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(layer, 0, 0);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  // The dial: the same box it has on the page (81.4% of the ring frame).
  const box = 400 * K * 0.814;
  const live = video.readyState >= 2 && video.videoWidth > 0;
  const sw = live ? video.videoWidth : src.width;
  const sh = live ? video.videoHeight : src.height;
  if (sw && sh) {
    const s = Math.min(box / sw, box / sh);
    ctx.drawImage(live ? video : src, CX - (sw * s) / 2, CY - (sh * s) / 2, sw * s, sh * s);
  }
  drawNeedle(ctx, angle);
}

/* ---- Recording ------------------------------------------------------------ */
export async function recordClip(opts: {
  dial: DetentDialElement;
  seconds: number;
  overlay: () => ClipOverlay;
  onProgress?: (elapsedSeconds: number) => void;
  /** Output edge in pixels. Default: 1080 on machines with 8+ cores, else 720. */
  size?: number;
}): Promise<Clip> {
  const out = opts.size ?? ((navigator.hardwareConcurrency ?? 4) >= 8 ? 1080 : 720);
  const scale = out / SIZE;
  const src = opts.dial.getCanvas();
  if (!src || typeof src.captureStream !== 'function') throw new Error('no live canvas');

  await Promise.allSettled([
    document.fonts?.load('780 58px "Archivo Variable"'),
    document.fonts?.load('450 24px "Martian Mono Variable"'),
  ]);

  // Feed the dial canvas through a <video> so we always composite the latest
  // presented frame (works for on-demand WebGL/WebGPU renderers too).
  const srcStream = src.captureStream(60);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = srcStream;
  await video.play().catch(() => undefined);

  const canvas = document.createElement('canvas');
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('no 2D canvas');
  // Push frames explicitly (captureStream(0) + requestFrame) so capture never
  // depends on compositor timing while the rest of the page is repainting.
  const outStream = canvas.captureStream(0);
  const outTrack = outStream.getVideoTracks()[0] as (MediaStreamTrack & { requestFrame?: () => void }) | undefined;

  const audio = await dialAudio(opts.dial);
  audio?.getAudioTracks().forEach((t) => outStream.addTrack(t));
  const mime = pickType(!!audio) ?? pickType(false);
  if (!mime) throw new Error('no supported video format');

  const recorder = new MediaRecorder(outStream, { mimeType: mime, videoBitsPerSecond: out >= 1080 ? 8_000_000 : 5_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise<void>((resolve) => recorder.addEventListener('stop', () => resolve(), { once: true }));

  // Static layer, redrawn only when the feel changes mid-clip.
  const layer = document.createElement('canvas');
  layer.width = out;
  layer.height = out;
  const lctx = layer.getContext('2d', { alpha: false })!;
  lctx.setTransform(scale, 0, 0, scale, 0, 0);
  let layerKey = '';

  let raf = 0;
  const t0 = performance.now();
  const loop = () => {
    const o = opts.overlay();
    const key = JSON.stringify([o.name, o.color, o.detail, o.physics]);
    if (key !== layerKey) {
      layerKey = key;
      drawStatic(lctx, o);
    }
    drawFrame(ctx, scale, layer, video, src, o.angle);
    outTrack?.requestFrame?.();
    opts.onProgress?.((performance.now() - t0) / 1000);
    raf = requestAnimationFrame(loop);
  };
  loop();
  recorder.start(250);

  await new Promise((r) => setTimeout(r, opts.seconds * 1000));
  recorder.stop();
  await stopped;
  cancelAnimationFrame(raf);

  srcStream.getTracks().forEach((t) => t.stop());
  outStream.getVideoTracks().forEach((t) => t.stop());
  video.srcObject = null;

  const type = (recorder.mimeType || mime).split(';')[0]!;
  const ext: Clip['ext'] = type.includes('mp4') ? 'mp4' : 'webm';
  const blob = new Blob(chunks, { type });
  if (!blob.size) throw new Error('the recorder returned an empty clip');
  const name = profileFileName(`detent ${opts.overlay().name}`, ext);
  const file = new File([blob], name, { type });
  return { blob, url: URL.createObjectURL(blob), file, mime: type, ext, width: out, height: out };
}
