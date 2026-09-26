/**
 * Mix demo model: six channels, a console-style fader law with unity at 75%
 * of travel, and a synthetic 120 BPM arrangement that drives the meters.
 * Wall's travel is ±135°, so unity sits at +67.5° on the knob; the demo moves
 * the Wall accent (the bump) there, which is the point of software detents.
 */
export interface Channel {
  id: string;
  name: string;
  /** Starting fader gain in dB. */
  db: number;
  /** Nominal pre-fader level (dBFS) used when meters are paused. */
  rms: number;
  /** Only shown when the mixer is wide enough. */
  extra?: boolean;
}

export const CHANNELS: Channel[] = [
  { id: 'kick', name: 'Kick', db: -3, rms: -9 },
  { id: 'snare', name: 'Snare', db: -5.5, rms: -12 },
  { id: 'hats', name: 'Hats', db: -11, rms: -16, extra: true },
  { id: 'bass', name: 'Bass', db: -4, rms: -11 },
  { id: 'keys', name: 'Keys', db: -9, rms: -14 },
  { id: 'pad', name: 'Pad', db: -13.5, rms: -17, extra: true },
  { id: 'gtr', name: 'Guitar', db: -7.5, rms: -14, extra: true },
  { id: 'vox', name: 'Vox', db: -2.4, rms: -10 },
  { id: 'bvs', name: 'BVs', db: -10, rms: -15, extra: true },
  { id: 'room', name: 'Room', db: -16, rms: -20 },
];
export const START_CHANNEL = CHANNELS.findIndex((c) => c.id === 'vox');
export const BPM = 120;
export const START_BAR = 17;

export const STOPS = 135;
/** Fader travel 0..1 → knob angle. */
export const pToAngle = (p: number) => p * 2 * STOPS - STOPS;
export const angleToP = (a: number) => Math.min(1, Math.max(0, (a + STOPS) / (2 * STOPS)));
export const UNITY_P = 0.75;
export const UNITY_ANGLE = pToAngle(UNITY_P);

const LAW: [number, number][] = [
  [0.01, -90],
  [0.03, -60],
  [0.12, -40],
  [0.25, -30],
  [0.375, -20],
  [0.55, -10],
  [0.65, -5],
  [0.75, 0],
  [0.875, 3],
  [1, 6],
];

export function pToDb(p: number): number {
  if (p < LAW[0]![0]) return -Infinity;
  for (let i = 1; i < LAW.length; i++) {
    const [p1, d1] = LAW[i]!;
    const [p0, d0] = LAW[i - 1]!;
    if (p <= p1) return d0 + ((p - p0) / (p1 - p0)) * (d1 - d0);
  }
  return 6;
}

export function dbToP(db: number): number {
  if (db === -Infinity || db <= LAW[0]![1]) return 0;
  for (let i = 1; i < LAW.length; i++) {
    const [p1, d1] = LAW[i]!;
    const [p0, d0] = LAW[i - 1]!;
    if (db <= d1) return p0 + ((db - d0) / (d1 - d0)) * (p1 - p0);
  }
  return 1;
}

/** Scale marks drawn beside the faders. */
export const SCALE: { db: number; label: string }[] = [
  { db: 6, label: '+6' },
  { db: 0, label: '0' },
  { db: -5, label: '−5' },
  { db: -10, label: '−10' },
  { db: -20, label: '−20' },
  { db: -40, label: '−40' },
  { db: -Infinity, label: '−∞' },
];

export function formatDb(db: number): string {
  if (db === -Infinity) return '−∞';
  const v = Math.abs(db) < 0.05 ? 0 : db;
  const s = v.toFixed(1);
  return v > 0 ? `+${s}` : s.replace('-', '−');
}

export function spokenDb(db: number): string {
  if (db === -Infinity) return 'minus infinity, fully down';
  if (Math.abs(db) < 0.05) return 'unity, 0 dB';
  return `${db < 0 ? 'minus ' : 'plus '}${Math.abs(db).toFixed(1)} dB`;
}

/** Meter range. */
export const METER_MIN = -60;
export const METER_MAX = 6;
export const meterPos = (dbfs: number) =>
  Math.min(1, Math.max(0, (dbfs - METER_MIN) / (METER_MAX - METER_MIN)));

/** Pre-fader level (dBFS) of a channel at time t (seconds). */
export function signal(id: string, t: number): number {
  const beat = 60 / BPM;
  const bar = beat * 4;
  const env = (phase: number, decay: number) => Math.exp(-phase * decay);
  const toDb = (x: number) => 20 * Math.log10(Math.max(1e-4, x));
  const wobble = (f: number) => 0.5 + 0.5 * Math.sin(t * f);
  switch (id) {
    case 'kick':
      return -3 + toDb(env(t % beat, 9));
    case 'snare': {
      const p = (t + beat) % (beat * 2);
      return -5 + toDb(env(p, 7));
    }
    case 'bass':
      return -9 + 3 * Math.sin(t * Math.PI * 4) * env(t % (beat / 2), 3);
    case 'keys':
      return -11 + toDb(0.25 + 0.75 * env(t % (beat * 2), 1.4));
    case 'vox': {
      const inPhrase = t % bar < bar * 0.8;
      return inPhrase ? -8 + 5 * (wobble(13) * wobble(3.1) - 0.5) : -48;
    }
    case 'bvs': {
      const inPhrase = (t + bar / 2) % (bar * 2) < bar * 0.9;
      return inPhrase ? -13 + 4 * (wobble(9) - 0.5) : -52;
    }
    case 'hats':
      return -12 + toDb(env(t % (beat / 4), 22));
    case 'pad':
      return -15 + 2.5 * (wobble(0.9) - 0.5);
    case 'gtr':
      return -12 + toDb(0.3 + 0.7 * env((t + beat / 2) % beat, 3.5));
    default:
      return -21 + 2 * wobble(1.7);
  }
}
