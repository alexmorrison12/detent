/**
 * A detent click for the info-page instruments (torque scrubber, mechanical
 * encoder). Silent unless the visitor turned sound on in the header; one
 * AudioContext, created lazily on the first click after a user gesture.
 * On Android, a 10 ms vibration rides along, at most one per 40 ms.
 */
import { isSoundOn } from '@/lib/sound';

let ctx: AudioContext | null = null;
let lastAudio = 0;
let lastBuzz = 0;

function audio(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext({ latencyHint: 'interactive' });
  } catch {
    ctx = null;
  }
  return ctx;
}

/** freq: body of the click in Hz; gain 0..1. */
export function click(freq = 3200, gain = 0.5): void {
  const now = performance.now();
  if (now - lastBuzz > 40 && 'vibrate' in navigator) {
    try {
      navigator.vibrate(10);
    } catch {
      /* not allowed before a gesture */
    }
    lastBuzz = now;
  }
  if (!isSoundOn() || now - lastAudio < 12) return;
  lastAudio = now;
  const ac = audio();
  if (!ac) return;
  if (ac.state === 'suspended') void ac.resume();
  const t = ac.currentTime;
  const len = Math.floor(ac.sampleRate * 0.03);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 6;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = freq * (0.97 + Math.random() * 0.06);
  band.Q.value = 8;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  src.connect(band).connect(g).connect(ac.destination);
  src.start(t);
}

addEventListener('pagehide', () => {
  void ctx?.suspend();
});
