/**
 * Detent sound: every click is synthesized, nothing is downloaded.
 *
 *   import { playTick, unlockAudio, getRecordingStream } from '@/scripts/dial/audio';
 *
 *   button.addEventListener('pointerdown', unlockAudio);     // inside a user gesture
 *   playTick('clock', { kind: 'accent', velocity: 400 });    // noon on the Clock profile
 *   playTick({ detents: 100, strength: 1 }, { kind: 'detent' }); // custom physics → nearest voice
 *
 * Rules this module keeps for everyone:
 * - Sound is opt-in. Nothing plays unless `isSoundOn()` from @/lib/sound is true.
 * - One AudioContext({ latencyHint: 'interactive' }) for the page, created on the
 *   first user gesture after sound is on. We never touch navigator.audioSession,
 *   so iOS keeps the "ambient" session: your music keeps playing and the silent
 *   switch is respected.
 * - Clicks are pre-rendered once with OfflineAudioContext (after the gesture that
 *   created the context has painted, never inside it), then each tick is a
 *   one-shot AudioBufferSourceNode with ±3% pitch jitter so repeats don't sound
 *   robotic. At most one voice per 12 ms: fast spins thin out instead of buzzing.
 * - The context is suspended on pagehide (bfcache-safe, no unload handlers).
 */
import { isSoundOn, onSoundChange } from '@/lib/sound';
import type { FeelProfile, ProfileId } from '@/data/product';
import type { FeelPhysics, TickKind } from './types';

export type Voice = ProfileId;
export type ProfileLike = ProfileId | FeelProfile | Partial<FeelPhysics> | null | undefined;

export interface TickOptions {
  kind?: TickKind;
  /** Degrees per second; faster turns click a little louder. */
  velocity?: number;
  /** 0..1 extra gain (e.g. the profile's detent strength). Default 1. */
  gain?: number;
}

type BufferKey =
  | 'ratchet'
  | 'ratchet-accent'
  | 'clock'
  | 'clock-accent'
  | 'bump'
  | 'stop'
  | 'stop-spring'
  | 'snap'
  | 'noise';

type AudioCtor = typeof AudioContext;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let recorder: MediaStreamAudioDestinationNode | null = null;
const buffers = new Map<BufferKey, AudioBuffer>();
let rendering: Promise<void> | null = null;
let lastVoiceAt = -1;

const PROFILE_IDS: ProfileId[] = ['ratchet', 'fluid', 'spring', 'clock', 'wall', 'magnet'];

/** Pick the synth voice for a profile id, a profile, or a raw physics object. */
export function voiceFor(p: ProfileLike): Voice {
  if (!p) return 'ratchet';
  if (typeof p === 'string') return PROFILE_IDS.includes(p) ? p : 'ratchet';
  if ('id' in p && 'physics' in p) return p.id;
  const ph = p as Partial<FeelPhysics>;
  if (ph.snaps && ph.snaps.length) return 'magnet';
  if (ph.detents && ph.detents >= 16) return 'ratchet';
  if (ph.detents && ph.detents > 0) return 'clock';
  if (ph.spring && ph.spring > 0) return 'spring';
  if (ph.stops) return 'wall';
  return 'fluid';
}

function keyFor(voice: Voice, kind: TickKind): BufferKey {
  if (kind === 'snap') return 'snap';
  if (kind === 'stop') return voice === 'spring' ? 'stop-spring' : 'stop';
  if (voice === 'ratchet') return kind === 'accent' ? 'ratchet-accent' : 'ratchet';
  if (voice === 'clock') return kind === 'accent' ? 'clock-accent' : 'clock';
  if (voice === 'magnet') return 'snap';
  return 'bump';
}

function Ctor(): AudioCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & { webkitAudioContext?: AudioCtor };
  return window.AudioContext ?? w.webkitAudioContext ?? null;
}

function ensureContext(): AudioContext | null {
  if (ctx) {
    if (ctx.state === 'suspended' && document.visibilityState === 'visible')
      void ctx.resume().catch(() => {});
    return ctx;
  }
  const AC = Ctor();
  if (!AC) return null;
  try {
    ctx = new AC({ latencyHint: 'interactive' });
  } catch {
    return null;
  }
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.knee.value = 8;
  comp.ratio.value = 4;
  comp.attack.value = 0.001;
  comp.release.value = 0.08;
  master = ctx.createGain();
  master.gain.value = 0.85;
  master.connect(comp).connect(ctx.destination);
  if (recorder) master.connect(recorder);
  // Synthesizing the voices takes tens of ms on a slow phone: never inside the click
  // that turned sound on (that click must paint at once). Start after the next frame.
  const sampleRate = ctx.sampleRate;
  rendering = afterNextPaint()
    .then(() => prerender(sampleRate))
    .catch(() => {});
  return ctx;
}

function afterNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    const next = () => setTimeout(resolve, 0);
    if (typeof requestAnimationFrame === 'function' && document.visibilityState === 'visible')
      requestAnimationFrame(next);
    else next();
  });
}

/**
 * Call from a user gesture (pointerdown/keydown/click). Creates or resumes the
 * AudioContext when sound is on. Cheap to call on every gesture.
 */
export function unlockAudio(): void {
  if (!isSoundOn()) return;
  ensureContext();
}

/** True once click buffers are rendered and sound is on. */
export function audioReady(): boolean {
  return !!ctx && buffers.size > 0 && isSoundOn();
}

/** Output latency in seconds (Bluetooth earbuds are often > 0.08). */
export function audioLatency(): number {
  if (!ctx) return 0;
  const c = ctx as AudioContext & { outputLatency?: number };
  return (c.outputLatency || 0) + (c.baseLatency || 0);
}

/**
 * Play one detent click in a profile's voice. Silently does nothing when sound
 * is off, before the first gesture, or when rate-limited.
 */
export function playTick(profile: ProfileLike, opts: TickOptions = {}): void {
  if (!ctx || !master || !isSoundOn() || ctx.state !== 'running') return;
  const kind = opts.kind ?? 'detent';
  const buf = buffers.get(keyFor(voiceFor(profile), kind));
  if (!buf) return;
  const now = ctx.currentTime;
  if (now - lastVoiceAt < 0.012 && kind !== 'stop') return;
  lastVoiceAt = now;
  const v = Math.min(1, Math.abs(opts.velocity ?? 0) / 720);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = 1 + (Math.random() * 2 - 1) * 0.03;
  const g = ctx.createGain();
  g.gain.value = Math.max(0, Math.min(1.4, (opts.gain ?? 1) * (0.55 + 0.45 * v)));
  src.connect(g).connect(master);
  src.start(now);
  src.onended = () => g.disconnect();
}

/**
 * A short sine/triangle tone (UI confirmations, the safe's final clunk).
 * Respects the sound preference like playTick.
 */
export function playTone(
  freq: number,
  {
    duration = 0.12,
    gain = 0.25,
    type = 'sine',
    glideTo,
  }: { duration?: number; gain?: number; type?: OscillatorType; glideTo?: number } = {},
): void {
  if (!ctx || !master || !isSoundOn() || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + duration);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + duration + 0.02);
  o.onended = () => g.disconnect();
}

/**
 * A MediaStream carrying everything the dials play, for MediaRecorder clips.
 * Call inside the gesture that starts recording. Null without Web Audio.
 */
export function getRecordingStream(): MediaStream | null {
  const c = ensureContext();
  if (!c || !master) return null;
  if (!recorder) {
    recorder = c.createMediaStreamDestination();
    master.connect(recorder);
  }
  return recorder.stream;
}

/* ------------------------------------------------------------------------ */
/* Continuous voices: Fluid's swish and Spring's tension tone.               */
/* ------------------------------------------------------------------------ */

export interface MotionVoice {
  /** speed in rad/s, deflection 0..1 (spring: distance from centre). */
  update(speed: number, deflection: number): void;
  stop(): void;
}

/** One per dial. Starts lazily on the first audible update, idles to silence. */
export function createMotionVoice(kind: 'fluid' | 'spring'): MotionVoice {
  let nodes: {
    src: AudioScheduledSourceNode;
    gain: GainNode;
    filter: BiquadFilterNode;
    osc?: OscillatorNode;
  } | null = null;
  let idleTimer = 0;

  const start = () => {
    if (!ctx || !master) return null;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    let src: AudioScheduledSourceNode;
    let osc: OscillatorNode | undefined;
    if (kind === 'fluid') {
      const noise = buffers.get('noise');
      if (!noise) return null;
      const s = ctx.createBufferSource();
      s.buffer = noise;
      s.loop = true;
      filter.type = 'lowpass';
      filter.Q.value = 0.7;
      filter.frequency.value = 400;
      src = s;
    } else {
      osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 180;
      filter.type = 'lowpass';
      filter.frequency.value = 1400;
      src = osc;
    }
    src.connect(filter).connect(gain).connect(master);
    src.start();
    return { src, gain, filter, osc };
  };

  const stop = () => {
    if (!nodes || !ctx) return;
    const n = nodes;
    nodes = null;
    n.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
    window.setTimeout(() => {
      try {
        n.src.stop();
      } catch {
        /* already stopped */
      }
      n.gain.disconnect();
    }, 200);
  };

  return {
    update(speed, deflection) {
      if (!ctx || !master || !isSoundOn() || ctx.state !== 'running') {
        stop();
        return;
      }
      const s = Math.min(1, Math.abs(speed) / 14);
      let level: number;
      if (kind === 'fluid') level = 0.2 * Math.pow(s, 1.3);
      else
        level = 0.07 * Math.min(1, deflection) * (0.25 + 0.75 * Math.min(1, Math.abs(speed) / 3));
      if (level < 0.002 && !nodes) return;
      nodes ??= start();
      if (!nodes) return;
      const t = ctx.currentTime;
      nodes.gain.gain.setTargetAtTime(level, t, 0.025);
      if (kind === 'fluid') nodes.filter.frequency.setTargetAtTime(260 + 2600 * s * s, t, 0.03);
      else nodes.osc?.frequency.setTargetAtTime(170 + 460 * Math.min(1, deflection), t, 0.02);
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(stop, 260);
    },
    stop,
  };
}

/* ------------------------------------------------------------------------ */
/* Offline pre-render                                                        */
/* ------------------------------------------------------------------------ */

type Recipe = (c: OfflineAudioContext, noise: AudioBuffer) => void;

function env(
  c: BaseAudioContext,
  t0: number,
  attack: number,
  decay: number,
  peak: number,
): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  g.connect(c.destination);
  return g;
}

function tone(
  c: BaseAudioContext,
  type: OscillatorType,
  f0: number,
  f1: number,
  glide: number,
  t0: number,
  a: number,
  d: number,
  peak: number,
) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + glide);
  o.connect(env(c, t0, a, d, peak));
  o.start(t0);
  o.stop(t0 + a + d + 0.01);
}

function burst(
  c: BaseAudioContext,
  noise: AudioBuffer,
  type: BiquadFilterType,
  f: number,
  q: number,
  t0: number,
  a: number,
  d: number,
  peak: number,
) {
  const s = c.createBufferSource();
  s.buffer = noise;
  const bq = c.createBiquadFilter();
  bq.type = type;
  bq.frequency.value = f;
  bq.Q.value = q;
  s.connect(bq).connect(env(c, t0, a, d, peak));
  s.start(t0, Math.random() * 0.2);
  s.stop(t0 + a + d + 0.01);
}

const RECIPES: Record<Exclude<BufferKey, 'noise'>, [number, Recipe]> = {
  // Crisp, high, short: a good camera dial.
  ratchet: [
    0.045,
    (c, n) => {
      burst(c, n, 'bandpass', 4300, 5, 0, 0.0006, 0.011, 1.1);
      tone(c, 'sine', 5800, 5200, 0.006, 0, 0.0003, 0.006, 0.22);
      tone(c, 'sine', 1900, 1700, 0.01, 0, 0.0005, 0.016, 0.14);
    },
  ],
  'ratchet-accent': [
    0.06,
    (c, n) => {
      burst(c, n, 'bandpass', 3100, 4, 0, 0.0006, 0.016, 1.3);
      tone(c, 'sine', 1500, 1200, 0.02, 0, 0.0006, 0.03, 0.3);
    },
  ],
  // Deeper wooden thunk.
  clock: [
    0.1,
    (c, n) => {
      burst(c, n, 'lowpass', 2600, 0.8, 0, 0.0005, 0.006, 0.55);
      tone(c, 'triangle', 540, 310, 0.025, 0, 0.001, 0.05, 0.75);
      tone(c, 'sine', 1260, 1150, 0.02, 0, 0.0005, 0.02, 0.18);
    },
  ],
  // Noon: heavier, lower, with a second catch.
  'clock-accent': [
    0.14,
    (c, n) => {
      burst(c, n, 'lowpass', 1900, 0.8, 0, 0.0005, 0.01, 0.8);
      tone(c, 'triangle', 380, 205, 0.04, 0, 0.001, 0.085, 1);
      tone(c, 'sine', 900, 820, 0.03, 0, 0.0006, 0.03, 0.2);
      burst(c, n, 'bandpass', 2400, 2, 0.011, 0.0005, 0.008, 0.45);
    },
  ],
  // Soft bump (Wall's unity detent, generic soft ticks).
  bump: [
    0.08,
    (c, n) => {
      tone(c, 'sine', 200, 150, 0.03, 0, 0.004, 0.035, 0.55);
      burst(c, n, 'lowpass', 800, 0.7, 0, 0.002, 0.014, 0.2);
    },
  ],
  // Solid clack at an end stop.
  stop: [
    0.13,
    (c, n) => {
      tone(c, 'sine', 140, 88, 0.06, 0, 0.001, 0.085, 1);
      burst(c, n, 'bandpass', 1700, 1.2, 0, 0.0005, 0.014, 0.85);
      burst(c, n, 'lowpass', 500, 0.7, 0, 0.001, 0.03, 0.4);
    },
  ],
  // Spring hitting its limit: a thud with a little boing.
  'stop-spring': [
    0.16,
    (c, n) => {
      tone(c, 'sine', 150, 95, 0.06, 0, 0.001, 0.08, 0.9);
      tone(c, 'sine', 330, 390, 0.1, 0.01, 0.004, 0.11, 0.18);
      burst(c, n, 'bandpass', 1400, 1.2, 0, 0.0005, 0.012, 0.6);
    },
  ],
  // Magnetic "tock": a falling pitch and a faint metallic ring.
  snap: [
    0.09,
    (c, n) => {
      tone(c, 'sine', 1180, 700, 0.012, 0, 0.0005, 0.045, 0.75);
      tone(c, 'sine', 2950, 2900, 0.03, 0, 0.0005, 0.032, 0.16);
      burst(c, n, 'highpass', 3200, 0.7, 0, 0.0003, 0.004, 0.35);
    },
  ],
};

function makeNoise(c: BaseAudioContext, seconds: number, pink = false): AudioBuffer {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0,
    b1 = 0,
    b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (!pink) {
      d[i] = w;
      continue;
    }
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
  }
  return buf;
}

async function prerender(sampleRate: number): Promise<void> {
  const OAC =
    window.OfflineAudioContext ??
    (window as Window & { webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  if (!OAC || !ctx) return;
  // One short burst of white noise serves every recipe (an AudioBuffer isn't tied to
  // the context that made it), instead of a fresh 0.4 s buffer per click voice.
  const grain = makeNoise(ctx, 0.4);
  const jobs = (Object.keys(RECIPES) as (keyof typeof RECIPES)[]).map(async (key) => {
    const [dur, recipe] = RECIPES[key];
    const off = new OAC(1, Math.ceil(sampleRate * dur), sampleRate);
    recipe(off, grain);
    buffers.set(key, await off.startRendering());
  });
  await Promise.all(jobs);
  // The looping swish for Fluid is plain pink noise; last, in a task of its own.
  await new Promise((r) => setTimeout(r, 0));
  if (ctx) buffers.set('noise', makeNoise(ctx, 2, true));
}

/** Resolves when click buffers exist (or immediately if audio never started). */
export function audioRendered(): Promise<void> {
  return rendering ?? Promise.resolve();
}

if (typeof window !== 'undefined') {
  onSoundChange((on) => {
    // setSound() is called from a click, so this runs inside a user gesture.
    if (on) ensureContext();
    else if (ctx && ctx.state === 'running') void ctx.suspend().catch(() => {});
  });
  // Any gesture on a page with a dial can start (or resume) audio once sound is on.
  // pointerup/keydown count as user activation on touch devices where pointerdown doesn't.
  for (const type of ['pointerdown', 'pointerup', 'keydown'] as const) {
    document.addEventListener(type, unlockAudio, { capture: true, passive: true });
  }
  window.addEventListener('pagehide', () => {
    if (ctx && ctx.state === 'running') void ctx.suspend().catch(() => {});
  });
  window.addEventListener('pageshow', (e) => {
    if (e.persisted && ctx && isSoundOn()) void ctx.resume().catch(() => {});
  });
}
