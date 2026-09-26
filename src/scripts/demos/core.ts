/**
 * Shared plumbing for the app demos: the context each controller gets, a
 * relative "jog" reader for detented profiles, a magnet resolver for snap
 * profiles, and a tiny on-demand animation loop.
 *
 * Controllers read the dial as an instrument: they only depend on the public
 * <detent-dial> contract (angle via detent:change, detent:press), so they work
 * the same on the SVG fallback and on the full haptic renderer.
 */
import type {
  DetentChangeDetail,
  DetentDialElement,
  DetentPressDetail,
  DetentTickDetail,
} from '@/scripts/dial/types';
import type { FeelPhysics } from '@/scripts/dial/types';
import type { DemoApp } from './modes';

export interface DemoContext {
  app: DemoApp;
  root: HTMLElement;
  dial: DetentDialElement;
  /** One element by data-ref inside this demo. */
  ref<T extends HTMLElement | SVGElement = HTMLElement>(name: string): T;
  refs<T extends HTMLElement | SVGElement = HTMLElement>(name: string): T[];
  /** Polite, settle-throttled screen reader summary. */
  announce(text: string): void;
  /** Text on the knob's round display (10 chars max). */
  display(text: string): void;
  /** Move the knob without the change being treated as user input. */
  setAngle(deg: number): void;
  reduced(): boolean;
  /** Whether the demo is on screen (loops pause when it isn't). */
  onScreen(): boolean;
}

export interface DemoController {
  /** Enter a mode. Called after the dial's profile has been switched. */
  enter(mode: string): void;
  change(detail: DetentChangeDetail): void;
  tick?(detail: DetentTickDetail): void;
  press?(detail: DetentPressDetail): void;
  /** Physics override for a mode (null = the named profile's physics). */
  physics?(mode: string): Partial<FeelPhysics> | null;
  /** On/off screen, for pausing loops. */
  visibility?(on: boolean): void;
}

export type Mount = (ctx: DemoContext) => DemoController;

/* -------------------------------------------------------------------------- */

/** Wrap degrees into [-180, 180). */
export function wrap180(deg: number): number {
  return ((((deg + 180) % 360) + 360) % 360) - 180;
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Relative reader for detented feels: returns how many detents the knob
 * moved since the last read. Works on continuous angles (fallback) and on
 * snapped ones (haptic engine) alike.
 */
export class Jog {
  #step: number;
  #last: number;
  constructor(step: number, angle = 0) {
    this.#step = step;
    this.#last = Math.round(angle / step);
  }
  reset(angle: number, step = this.#step): void {
    this.#step = step;
    this.#last = Math.round(angle / step);
  }
  read(angle: number): number {
    const i = Math.round(angle / this.#step);
    const d = i - this.#last;
    this.#last = i;
    return d;
  }
}

export interface MagnetState {
  /** Index (into the sorted snaps) of the nearest snap. */
  nearest: number;
  /** True when the knob is inside a snap's capture zone. */
  snapped: boolean;
  /** Snap before and after the current angle, and progress between them. */
  from: number;
  to: number;
  t: number;
  /** True in the gap that wraps from the last snap back to the first. */
  wrapped: boolean;
}

/**
 * Resolve an angle against magnet snap points (degrees, any order).
 * Smooth between snaps, captured within `capture` degrees of one.
 */
export function magnet(angle: number, snaps: readonly number[], capture = 14): MagnetState {
  const s = [...snaps].map(wrap180).sort((a, b) => a - b);
  const a = wrap180(angle);
  let nearest = 0;
  let best = Infinity;
  s.forEach((p, i) => {
    const d = Math.abs(wrap180(a - p));
    if (d < best) {
      best = d;
      nearest = i;
    }
  });
  let from = s.length - 1;
  for (let i = 0; i < s.length; i++) if (s[i]! <= a) from = i;
  const wrapped = a < s[0]! || from === s.length - 1;
  const to = wrapped ? 0 : from + 1;
  const span = wrap180(s[to]! - s[from]!) || 360;
  const t = clamp(wrap180(a - s[from]!) / (span < 0 ? span + 360 : span), 0, 1);
  return { nearest, snapped: best <= capture, from, to, t, wrapped };
}

/** Sorted snap angles for a physics block (magnet feel). */
export function sortedSnaps(snaps: readonly number[] | undefined): number[] {
  return [...(snaps ?? [])].map(wrap180).sort((a, b) => a - b);
}

/**
 * On-demand rAF loop. `step(dt)` returns true to keep running.
 * Stops itself when idle, so an untouched demo renders zero frames.
 */
export function loop(step: (dtMs: number) => boolean) {
  let raf = 0;
  let last = 0;
  const frame = (t: number) => {
    const dt = last ? Math.min(64, t - last) : 16;
    last = t;
    if (step(dt)) raf = requestAnimationFrame(frame);
    else {
      raf = 0;
      last = 0;
    }
  };
  return {
    start() {
      if (!raf) raf = requestAnimationFrame(frame);
    },
    stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    },
    get running() {
      return raf !== 0;
    },
  };
}

/** Typographic minus for readouts. */
export const minus = (s: string) => s.replace(/^-/, '−');

/** Brief visual pulse: sets data-pulse for one animation, restarting it if needed. */
export function pulse(el: Element, name = 'on'): void {
  el.removeAttribute('data-pulse');
  // Force a style flush so the animation restarts.
  void (el as HTMLElement).offsetWidth;
  el.setAttribute('data-pulse', name);
}
