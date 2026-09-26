/**
 * Game audio: synthesized clicks, thuds and grains for the safe and the Daily
 * Detent. Silent unless the visitor turned sound on (@/lib/sound). One
 * AudioContext, created lazily after a gesture; suspended when hidden.
 *
 * Integration note: the dial engine does not ship audio yet. If it starts
 * playing its own detent ticks, set GAME_AUDIO_LAYER to 'contact-only' so the
 * games add only their game-specific layer (the safe's heavier gate, end-stop
 * thuds) instead of doubling every click.
 */
import { isSoundOn, onSoundChange } from '@/lib/sound';

export const GAME_AUDIO_LAYER: 'full' | 'contact-only' = 'full';

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let noise: AudioBuffer | null = null;
let lastVoice = 0;

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !isSoundOn()) return null;
  const Ctor = window.AudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    try {
      ctx = new Ctor({ latencyHint: 'interactive' });
    } catch {
      return null;
    }
    out = ctx.createGain();
    out.gain.value = 0.8;
    out.connect(ctx.destination);
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

if (typeof window !== 'undefined') {
  onSoundChange((on) => {
    if (!on) void ctx?.suspend();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void ctx?.suspend();
  });
  window.addEventListener('pagehide', () => void ctx?.suspend());
}

/** At most one voice per 12 ms, so a fast spin reads as texture, not noise. */
function gate(gapMs = 12): boolean {
  const now = performance.now();
  if (now - lastVoice < gapMs) return false;
  lastVoice = now;
  return true;
}

const jitter = () => 1 + (Math.random() - 0.5) * 0.06;

function env(c: AudioContext, peak: number, decay: number, t = c.currentTime): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.0015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  g.connect(out!);
  return g;
}

function noiseBurst(
  c: AudioContext,
  freq: number,
  q: number,
  peak: number,
  decay: number,
  type: BiquadFilterType = 'bandpass',
) {
  const src = c.createBufferSource();
  src.buffer = noise;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq * jitter();
  f.Q.value = q;
  src.connect(f).connect(env(c, peak, decay));
  src.start();
  src.stop(c.currentTime + decay + 0.02);
}

function sine(c: AudioContext, from: number, to: number, peak: number, decay: number, delay = 0) {
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(from * jitter(), t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + decay);
  o.connect(env(c, peak, decay, t));
  o.start(t);
  o.stop(t + decay + 0.02);
}

/**
 * One detent click. `weight` 0..1 is how heavy this detent is: heavier means
 * lower, longer, with a tumbler thump under it. `strength` 0..1 is the
 * profile's base click strength.
 */
export function click({
  weight = 0,
  strength = 0.6,
}: { weight?: number; strength?: number } = {}): void {
  const c = audio();
  if (!c || !gate()) return;
  if (GAME_AUDIO_LAYER === 'full') {
    noiseBurst(
      c,
      3400 - weight * 1700,
      7,
      0.22 + strength * 0.22 + weight * 0.15,
      0.022 + weight * 0.03,
    );
  }
  if (weight > 0.2) sine(c, 190 - weight * 70, 70, weight * 0.55, 0.07 + weight * 0.06);
}

/** A virtual end stop: 140 Hz, 80 ms. */
export function thud(): void {
  const c = audio();
  if (!c || !gate(40)) return;
  sine(c, 140, 70, 0.6, 0.08);
  noiseBurst(c, 500, 1, 0.12, 0.05, 'lowpass');
}

/** A soft hill in the travel (Wall's center bump). */
export function bump(): void {
  const c = audio();
  if (!c || !gate()) return;
  sine(c, 240, 180, 0.22, 0.05);
}

/** Magnet snap: short, bright, a little metallic. */
export function snap(): void {
  const c = audio();
  if (!c || !gate()) return;
  if (GAME_AUDIO_LAYER === 'full') noiseBurst(c, 5200, 12, 0.3, 0.018);
  sine(c, 1320, 880, 0.08, 0.04);
}

/** Travel texture between events. `level` 0..1. Spring passes `pitch` 0..1 for tension. */
export function grain(level: number, pitch?: number): void {
  const c = audio();
  if (!c || !gate(24) || GAME_AUDIO_LAYER !== 'full') return;
  if (pitch !== undefined) sine(c, 180 + pitch * 520, 180 + pitch * 540, 0.03 + pitch * 0.06, 0.03);
  else noiseBurst(c, 900, 0.7, 0.03 + level * 0.1, 0.03, 'lowpass');
}

/** The safe opens: a bolt clunk, then a clean two-note ring. */
export function opened(): void {
  const c = audio();
  if (!c) return;
  sine(c, 110, 55, 0.7, 0.16);
  noiseBurst(c, 700, 1.2, 0.2, 0.09, 'lowpass');
  sine(c, 660, 655, 0.12, 0.9, 0.12);
  sine(c, 990, 985, 0.08, 1.1, 0.2);
}

/** A right answer in the Daily Detent. */
export function correct(): void {
  const c = audio();
  if (!c) return;
  sine(c, 880, 878, 0.1, 0.5);
  sine(c, 1320, 1318, 0.06, 0.7, 0.08);
}

/** Android only: a short buzz for game-specific moments (never per detent). */
export function buzz(pattern: number | number[]): void {
  try {
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}
