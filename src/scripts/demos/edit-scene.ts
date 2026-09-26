/**
 * The edit demo's sequence: an 18-second reel at 24 fps. A SMPTE-style
 * countdown leader (its sweep hand turns 15° per frame, exactly one Ratchet
 * detent), a title card, then a bouncing-ball shot whose ground contacts are
 * marked. Pure math, shared by the server render and the client controller.
 */
export const FPS = 24;
export const TOTAL = 432; // frames: 18 s
export const START_HOUR = 1; // timecode starts at 01:00:00:00
/** Where the playhead sits on first paint: mid-countdown, the sweep at 60°. */
export const START_FRAME = 100;

export const LEADER_END = 192; // leader 0–191 (8 s)
export const POP = 144; // the "2" frame and its 1 kHz pop
export const TITLE_END = 264; // title card 192–263
export const BOUNCE_START = TITLE_END;

/* Bouncing ball: dropped from rest, restitution E, first contact after DROP frames. */
const DROP = 26;
const E = 0.78;

/** Frames (absolute) where the ball touches the ground. */
export const CONTACTS: number[] = (() => {
  const out: number[] = [];
  let t = DROP;
  let k = 0;
  while (BOUNCE_START + t < TOTAL) {
    out.push(Math.round(BOUNCE_START + t));
    k += 1;
    t += 2 * DROP * Math.pow(E, k);
  }
  return out;
})();

export interface Clip {
  name: string;
  from: number;
  to: number; // exclusive
  kind: 'leader' | 'title' | 'shot' | 'pop' | 'tone';
}

export const VIDEO: Clip[] = [
  { name: 'Leader', from: 0, to: LEADER_END, kind: 'leader' },
  { name: 'Title', from: LEADER_END, to: TITLE_END, kind: 'title' },
  { name: 'A012 · Bounce', from: TITLE_END, to: TOTAL, kind: 'shot' },
];

export const AUDIO: Clip[] = [
  { name: 'Pop', from: POP, to: POP + 1, kind: 'pop' },
  { name: 'Room tone', from: LEADER_END, to: TOTAL, kind: 'tone' },
];

export interface Marker {
  frame: number;
  label: string;
}

/** Six markers, one per Magnet snap point on the knob. */
export const MARKERS: Marker[] = [
  { frame: POP, label: '2-pop' },
  { frame: LEADER_END, label: 'First frame' },
  { frame: TITLE_END, label: 'Cut' },
  { frame: CONTACTS[0]!, label: 'Contact 1' },
  { frame: CONTACTS[1]!, label: 'Contact 2' },
  { frame: CONTACTS[2]!, label: 'Contact 3' },
];

const pad = (n: number) => String(n).padStart(2, '0');

/** HH:MM:SS:FF, starting at 01:00:00:00. */
export function timecode(frame: number): string {
  const f = Math.max(0, Math.round(frame));
  const ff = f % FPS;
  const total = Math.floor(f / FPS);
  const ss = total % 60;
  const mm = Math.floor(total / 60) % 60;
  const hh = START_HOUR + Math.floor(total / 3600);
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(ff)}`;
}

/** Duration as a timecode without the hour offset. */
export function duration(frames: number): string {
  const f = Math.max(0, Math.round(frames));
  const s = Math.floor(f / FPS);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(f % FPS)}`;
}

export type SceneState =
  | { kind: 'leader'; count: number; sweep: number }
  | { kind: 'pop' }
  | { kind: 'black' }
  | { kind: 'title'; opacity: number }
  | { kind: 'bounce'; x: number; y: number; squash: number; shadow: number };

/** Ground line and geometry of the 320×180 viewer. */
export const GROUND_Y = 150;
const BALL_R = 11;
const DROP_H = 104; // px above the ground at release

export function scene(frame: number): SceneState {
  const f = Math.max(0, Math.min(TOTAL - 1, Math.round(frame)));
  if (f < POP) return { kind: 'leader', count: 8 - Math.floor(f / FPS), sweep: (f % FPS) * 15 };
  if (f === POP) return { kind: 'pop' };
  if (f < LEADER_END) return { kind: 'black' };
  if (f < TITLE_END) return { kind: 'title', opacity: Math.min(1, (f - LEADER_END + 1) / 10) };

  const t = f - BOUNCE_START;
  let h: number;
  if (t <= DROP) {
    h = DROP_H * (1 - (t / DROP) ** 2);
  } else {
    let start = DROP;
    let k = 1;
    let len = 2 * DROP * E;
    while (t > start + len && len > 0.5) {
      start += len;
      k += 1;
      len = 2 * DROP * Math.pow(E, k);
    }
    const u = Math.min(1, (t - start) / len);
    h = DROP_H * Math.pow(E, 2 * k) * 4 * u * (1 - u);
  }
  const contact = CONTACTS.includes(f);
  const x = 46 + (t / (TOTAL - BOUNCE_START)) * 232;
  return {
    kind: 'bounce',
    x,
    y: GROUND_Y - BALL_R - h,
    squash: contact ? 0.72 : 1,
    shadow: 1 - Math.min(1, h / DROP_H) * 0.7,
  };
}

export const BALL_RADIUS = BALL_R;

/** SVG path for the leader's sweep wedge, clockwise from 12 o'clock. */
export function sweepPath(deg: number, r = 150): string {
  if (deg <= 0) return '';
  const a = ((deg - 90) * Math.PI) / 180;
  const x = 160 + r * Math.cos(a);
  const y = 90 + r * Math.sin(a);
  const large = deg > 180 ? 1 : 0;
  return `M160 90 L160 ${90 - r} A${r} ${r} 0 ${large} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`;
}

/** Nearest marker index to a frame. */
export function nearestMarker(frame: number): number {
  let best = 0;
  MARKERS.forEach((m, i) => {
    if (Math.abs(m.frame - frame) < Math.abs(MARKERS[best]!.frame - frame)) best = i;
  });
  return best;
}

/** A deterministic waveform for the room-tone clip (0..1 amplitudes). */
export function waveform(n: number, seed = 7): number[] {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: n }, (_, i) => {
    const phrase = 0.35 + 0.35 * Math.abs(Math.sin(i / 9)) + 0.18 * Math.sin(i / 3.3);
    return Math.max(0.08, Math.min(1, phrase * (0.55 + rnd() * 0.6)));
  });
}
