/**
 * The launch film: a 45-second script that drives a live <detent-dial>
 * (camera presets, feel profiles, finishes, the exploded view). No video
 * file. Captions are built from product data so the film can't drift from
 * the spec sheet. Pure data + easing functions: the page renders the
 * chapter list and transcript from it on the server; film.ts plays it.
 */
import {
  EDITIONS,
  FINISHES,
  PROFILES,
  SPECS,
  byProfile,
  formatUsd,
  type FinishId,
  type ProfileId,
} from '@/data/product';
import { LAUNCH } from '@/config/launch';
import type { CameraPreset } from '@/scripts/dial/types';

export interface Shot {
  id: string;
  title: string;
  start: number;
  end: number;
  camera: CameraPreset;
  profile: ProfileId;
  finish: FinishId | ((p: number) => FinishId);
  caption: string;
  angle: (p: number) => number;
  explode?: (p: number) => number;
  display: (p: number) => string;
}

const spec = (label: string) =>
  SPECS.flatMap((g) => g.rows).find((r) => r.label === label)?.value ?? '';
const feel = (id: ProfileId) => byProfile(id).feel;
const easeOut = (x: number) => 1 - (1 - x) ** 3;
const easeInOut = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const pad = (n: number, l = 2) => String(Math.floor(n)).padStart(l, '0');

const one = EDITIONS.find((e) => e.id === 'one')!;
const standard = FINISHES.filter((f) => !f.foundersOnly);
const tally = FINISHES.find((f) => f.foundersOnly)!;
const magnetSnaps = PROFILES.find((p) => p.id === 'magnet')!.physics.snaps ?? [];

export const FILM_LENGTH = 45;

export const SHOTS: Shot[] = [
  {
    id: 'billet',
    title: 'One billet',
    start: 0,
    end: 6,
    camera: 'hero',
    profile: 'ratchet',
    finish: 'raw',
    caption: `One billet of 6061 aluminum. ${spec('Weight')}`,
    angle: (p) => -30 + 55 * easeInOut(p),
    display: () => 'DETENT',
  },
  {
    id: 'ratchet',
    title: 'Ratchet',
    start: 6,
    end: 13,
    camera: 'top',
    profile: 'ratchet',
    finish: 'graphite',
    caption: `${feel('ratchet')} In Resolve, one click is one frame.`,
    // One click every 280 ms: stepped, like a hand on a jog wheel.
    angle: (p) => 25 + Math.floor((p * 7) / 0.28) * 15,
    display: (p) => `FR ${pad(1040 + Math.floor((p * 7) / 0.28), 4)}`,
  },
  {
    id: 'wall',
    title: 'Wall',
    start: 13,
    end: 19,
    camera: 'front',
    profile: 'wall',
    finish: 'graphite',
    caption: `${feel('wall')} Faders finally have ends.`,
    angle: (p) => {
      if (p < 0.4) return -135 + 135 * easeInOut(p / 0.4); // sweep up to the bump at unity
      if (p < 0.55) return 0; // sit on the bump
      return Math.min(135, 0 + 150 * easeOut((p - 0.55) / 0.35)); // into the stop
    },
    display: (p) => {
      const a =
        p < 0.4
          ? -135 + 135 * easeInOut(p / 0.4)
          : p < 0.55
            ? 0
            : Math.min(135, 150 * easeOut((p - 0.55) / 0.35));
      return `VOL ${pad(((a + 135) / 270) * 100, 3)}`;
    },
  },
  {
    id: 'fluid',
    title: 'Fluid',
    start: 19,
    end: 25,
    camera: 'side',
    profile: 'fluid',
    finish: 'glacier',
    caption: `${feel('fluid')} Forty minutes of timeline in one flick.`,
    angle: (p) => 900 * easeOut(clamp01(p / 0.85)),
    display: (p) => {
      const s = 2400 * easeOut(clamp01(p / 0.85));
      return `${pad(s / 3600)}:${pad((s / 60) % 60)}:${pad(s % 60)}`;
    },
  },
  {
    id: 'magnet',
    title: 'Magnet',
    start: 25,
    end: 31,
    camera: 'top',
    profile: 'magnet',
    finish: 'graphite',
    caption: `${feel('magnet')} Every hunk in your diff, one at a time.`,
    angle: (p) => {
      const n = magnetSnaps.length;
      const x = p * n;
      const i = Math.min(n - 1, Math.floor(x));
      const from = i === 0 ? magnetSnaps[0]! - 40 : magnetSnaps[i - 1]!;
      const to = magnetSnaps[i]!;
      const local = x - i;
      // Glide most of the way, then drop into the snap point.
      return local < 0.7 ? from + (to - from) * 0.85 * easeInOut(local / 0.7) : to;
    },
    display: (p) =>
      `HUNK ${Math.min(magnetSnaps.length, Math.floor(p * magnetSnaps.length) + 1)}/${magnetSnaps.length}`,
  },
  {
    id: 'inside',
    title: 'Inside',
    start: 31,
    end: 38,
    camera: 'exploded',
    profile: 'ratchet',
    finish: 'raw',
    caption: `Inside: ${spec('Motor')}. ${spec('Position sensing')}. ${spec('Peak torque')} of peak torque.`,
    angle: (p) => 10 + 30 * p,
    explode: (p) => easeInOut(clamp01(p / 0.45)),
    display: () => '0.022°',
  },
  {
    id: 'yours',
    title: 'Yours',
    start: 38,
    end: 45,
    camera: 'hero',
    profile: 'ratchet',
    finish: (p) => {
      const order = [...standard.map((f) => f.id), tally.id];
      if (p < 0.2) return order[0]!;
      return order[Math.min(order.length - 1, Math.floor(((p - 0.2) / 0.8) * order.length))]!;
    },
    caption: `${standard.map((f) => f.name).join(', ')}. And ${LAUNCH.foundersRun.toLocaleString('en-US')} numbered in ${tally.name}. ${formatUsd(one.launchPriceUsd)} this week.`,
    angle: (p) => 40 - 40 * easeInOut(p),
    explode: (p) => 1 - easeInOut(clamp01(p / 0.2)),
    display: (p) => (p > 0.88 ? formatUsd(one.launchPriceUsd) : 'DETENT'),
  },
];

export const shotAt = (t: number): Shot =>
  SHOTS.find((s) => t >= s.start && t < s.end) ?? SHOTS[SHOTS.length - 1]!;

export const clock = (t: number) => `${pad(t / 60)}:${pad(t % 60)}`;
