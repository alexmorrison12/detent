/**
 * Physical feedback for launch-page moments that the dial engine doesn't
 * cover (the "armed" end-stop thud, the tease lock-in). Sound respects the
 * global opt-in (@/lib/sound); one AudioContext, created on first use after a
 * user gesture, suspended on pagehide so bfcache keeps working.
 * Vibration is Android-only and never promised elsewhere.
 */
import { isSoundOn } from '@/lib/sound';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!isSoundOn()) return null;
  try {
    ctx ??= new AudioContext({ latencyHint: 'interactive' });
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

addEventListener('pagehide', () => void ctx?.suspend());

/** Virtual end stop: a 140 Hz body falling to 70 Hz over 80 ms, plus a short transient. */
export function thud(gain = 0.55): void {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + 0.005;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(70, t + 0.08);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + 0.12);

  // A 3 kHz click on top so small speakers hear the contact.
  const n = a.createBuffer(1, Math.floor(a.sampleRate * 0.012), a.sampleRate);
  const data = n.getChannelData(0);
  for (let i = 0; i < data.length; i++)
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
  const src = a.createBufferSource();
  const bp = a.createBiquadFilter();
  const cg = a.createGain();
  bp.type = 'bandpass';
  bp.frequency.value = 3000;
  bp.Q.value = 6;
  cg.gain.value = gain * 0.6;
  src.buffer = n;
  src.connect(bp).connect(cg).connect(a.destination);
  src.start(t);
}

/** A rising two-note chime for a solved puzzle. Quiet on purpose. */
export function chime(): void {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + 0.01;
  [880, 1318.5].forEach((f, i) => {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'triangle';
    o.frequency.value = f;
    const s = t + i * 0.11;
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(0.18, s + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, s + 0.5);
    o.connect(g).connect(a.destination);
    o.start(s);
    o.stop(s + 0.55);
  });
}

/** navigator.vibrate where it exists (Android). Silently a no-op elsewhere. */
export function buzz(pattern: number | number[]): void {
  try {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  } catch {
    /* no sticky activation yet, or blocked */
  }
}

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
