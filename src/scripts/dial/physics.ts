/**
 * Detent feel engine. Pure TypeScript, no DOM: the same model drives the SVG
 * fallback, the three.js renderer, audio and haptics, and could run in a
 * worklet or in Node tests.
 *
 * Model (after SmartKnob's firmware): the knob is a rotor with inertia. Torques
 * come from periodic detent wells (a spring to the nearest detent centre with
 * hysteresis, so crossing one "clicks"), accent wells, magnet snap points,
 * spring-return, virtual end stops with a hard bounce, and viscous damping.
 * The pointer never sets the angle directly: it drags a target that pulls the
 * knob through a stiff coupling spring, so the knob visibly lags and catches
 * on every ridge (pseudo-haptics).
 *
 * Internal units: radians, seconds. Integrated at a fixed 1/240 s step with
 * semi-implicit Euler, at most 8 substeps per frame, so it feels identical at
 * 60, 120 and 144 Hz.
 */
import type { FeelPhysics, TickKind } from './types';

export const DT = 1 / 240;
const MAX_SUBSTEPS = 8;
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

/** Stiffness constants (rad/s² per rad). ω_n ≈ √K. */
const K_DETENT = 2600; // ~8 Hz: crisp micro-overshoot
const K_BUMP = 2800; // accent wells without detents (Wall's unity bump)
const K_MAGNET = 700; // peak pull of a snap point
const K_SPRING = 150; // spring-return at strength 1
const K_STOP = 16000; // end stops: 4× detent, a wall
/** Critically damped both ways: the wall absorbs a push instead of storing it (no catapult). */
const C_STOP = 2 * Math.sqrt(K_STOP);
const K_COUPLE = 5200; // pointer → knob coupling
const C_COUPLE = 2 * 0.85 * Math.sqrt(K_COUPLE);
const SNAP_FRACTION = 0.55; // hysteresis: switch detent after 55% of the way
const BUMP_HALF_WIDTH = 7 * DEG;
const MAGNET_RADIUS = 15 * DEG;
const STOP_OVERSHOOT = 4 * DEG; // hard clamp beyond the virtual stop
const STOP_PUSH = 6 * DEG; // how far a finger can drag the target past a stop
const MAX_RELEASE = 25; // rad/s
/** Coulomb (dry) friction for detentless knobs, rad/s²: a flick glides, then stops. */
const DRY_FRICTION = 1.5;
/** A finger-driven move (keys, setAngle) lets go only once the knob is this still. */
const TWEEN_REST = 0.05; // rad/s

export interface PhysicsEvent {
  kind: TickKind;
  index: number;
  /** Radians, unbounded. */
  theta: number;
  /** rad/s */
  omega: number;
  accent: boolean;
}

export interface ResolvedPhysics {
  detents: number;
  strength: number;
  damping: number;
  spring: number;
  stops: [number, number] | null; // radians
  accents: number[]; // radians
  snaps: number[]; // radians
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
/** Wrap to (-π, π]. */
export const wrapPi = (a: number) => a - TAU * Math.round(a / TAU);

/** Validate and clamp a physics object from anywhere (profile data, feel links, builders). */
export function resolvePhysics(p: Partial<FeelPhysics> | FeelPhysics): ResolvedPhysics {
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const detents = Math.round(clamp(num(p.detents, 0), 0, 360));
  let stops: [number, number] | null = null;
  if (Array.isArray(p.stops) && p.stops.length === 2) {
    const a = clamp(num(p.stops[0], -135), -1800, 1800);
    const b = clamp(num(p.stops[1], 135), -1800, 1800);
    if (b - a >= 5) stops = [a * DEG, b * DEG];
  }
  const list = (v: unknown, max: number) =>
    Array.isArray(v)
      ? v
          .filter((x) => typeof x === 'number' && Number.isFinite(x))
          .slice(0, max)
          .map((x) => x * DEG)
      : [];
  return {
    detents,
    strength: clamp01(num(p.strength, 0.6)),
    damping: clamp01(num(p.damping, 0.15)),
    spring: clamp01(num(p.spring, 0)),
    stops,
    accents: list(p.accents, 32),
    snaps: list(p.snaps, 32),
  };
}

/**
 * Viscous damping coefficient (1/s) for a 0..1 damping value. Detentless knobs add
 * dry friction on top, so Fluid (0.05) glides about 1.6 turns and 2.7 s after a
 * 600°/s flick instead of creeping for 10 s.
 */
const viscous = (d: number) => 0.45 + 22 * Math.pow(d, 1.6);

const sameAngles = (a: readonly number[] | null, b: readonly number[] | null) =>
  a === b || (!!a && !!b && a.length === b.length && a.every((x, i) => Math.abs(x - b[i]!) < 1e-9));

interface Tween {
  from: number;
  to: number;
  t: number;
  dur: number;
}

export class DialPhysics {
  theta = 0;
  omega = 0;
  p: ResolvedPhysics;
  /** Current detent centre (rad) and its index. */
  center = 0;
  index = 0;
  grabbed = false;
  /** Pointer-driven target (rad) and its smoothed velocity. */
  target = 0;
  targetOmega = 0;
  /** Reduced motion: no inertia after release. */
  reduced = false;
  private tween: Tween | null = null;
  private acc = 0;
  private events: PhysicsEvent[] = [];
  private stopLatch: -1 | 0 | 1 = 0;
  private snapLatch = -1;
  private bumpSide = new Map<number, number>();
  private lastAccel = 0;

  constructor(p: Partial<FeelPhysics> | FeelPhysics) {
    this.p = resolvePhysics(p);
  }

  /**
   * Swap the physics. Tuning (strength, damping, spring, accents) keeps whatever
   * move is under way; returns true only when the grid itself (detents, stops,
   * snap points) changed, so the caller can decide where the knob should land.
   */
  setParams(p: Partial<FeelPhysics> | FeelPhysics): boolean {
    const prev = this.p;
    const next = resolvePhysics(p);
    this.p = next;
    if (!sameAngles(prev.accents, next.accents)) this.bumpSide.clear();
    const regrid =
      prev.detents !== next.detents ||
      !sameAngles(prev.stops, next.stops) ||
      !sameAngles(prev.snaps, next.snaps);
    if (!regrid) return false;
    this.recenter();
    this.stopLatch = 0;
    this.snapLatch = -1;
    this.bumpSide.clear();
    return true;
  }

  /** Where a finger-driven move (keys, setAngle, nudge) is heading, or null when none is. */
  get goal(): number | null {
    return this.tween ? this.tween.to : null;
  }

  /** The detent index, value and stop state the knob will have when it rests at theta. */
  describe(theta: number): { index: number; value: number; atStop: 'min' | 'max' | null } {
    const w = this.width;
    const s = this.p.stops;
    let value: number;
    let atStop: 'min' | 'max' | null = null;
    if (s) {
      value = clamp01((theta - s[0]) / (s[1] - s[0]));
      if (theta <= s[0] + 0.5 * DEG) atStop = 'min';
      else if (theta >= s[1] - 0.5 * DEG) atStop = 'max';
    } else {
      const t = theta / TAU;
      value = t - Math.floor(t);
    }
    return { index: w ? Math.round(theta / w) : 0, value, atStop };
  }

  /** Detent width (rad), or 0 when the profile has none. */
  get width(): number {
    return this.p.detents ? TAU / this.p.detents : 0;
  }

  /** Step used by keyboard/nudge when the profile has no detents. */
  get stepSize(): number {
    if (this.p.detents) return this.width;
    if (this.p.stops) return (this.p.stops[1] - this.p.stops[0]) / 20;
    return 15 * DEG;
  }

  recenter(): void {
    const w = this.width;
    if (w) {
      this.index = Math.round(this.theta / w);
      this.center = this.index * w;
    } else {
      this.index = 0;
      this.center = 0;
    }
  }

  /** Jump without motion or ticks. */
  setInstant(theta: number): void {
    this.theta = this.clampToStops(theta);
    this.omega = 0;
    this.tween = null;
    this.target = this.theta;
    this.recenter();
    this.stopLatch = 0;
    this.snapLatch = -1;
    this.bumpSide.clear();
  }

  /** Animate to an angle through the coupling spring (like an invisible finger). */
  moveTo(theta: number, durationMs?: number): void {
    if (this.grabbed) return;
    const to = this.clampToStops(theta);
    const dist = Math.abs(to - this.theta);
    const dur = durationMs ?? clamp(70 + (dist / DEG) * 3.2, 90, 720);
    // Chained key presses continue from the moving target instead of restarting from θ.
    this.tween = { from: this.tween ? this.targetNow() : this.theta, to, t: 0, dur: dur / 1000 };
  }

  moveBy(delta: number, durationMs?: number): void {
    const base = this.tween ? this.tween.to : this.p.detents ? this.center : this.theta;
    this.moveTo(base + delta, durationMs);
  }

  /** Add angular velocity (wheel flicks on endless profiles). */
  impulse(domega: number): void {
    if (this.reduced) {
      this.moveBy(domega * 0.08);
      return;
    }
    this.omega = clamp(this.omega + domega, -MAX_RELEASE, MAX_RELEASE);
  }

  grab(): void {
    this.grabbed = true;
    this.tween = null;
    this.target = this.theta;
    this.targetOmega = 0;
  }

  /** Pointer moved: add an (unwrapped) angle delta to the target. */
  drag(delta: number, dt: number): void {
    let t = this.target + delta;
    // Never let the target run deep into an end stop: a push you can feel, not a loaded spring.
    if (this.p.stops) t = clamp(t, this.p.stops[0] - STOP_PUSH, this.p.stops[1] + STOP_PUSH);
    const v = dt > 0 ? (t - this.target) / dt : 0;
    this.targetOmega += (clamp(v, -60, 60) - this.targetOmega) * 0.35;
    this.target = t;
  }

  release(omega: number): void {
    this.grabbed = false;
    this.targetOmega = 0;
    this.omega = this.reduced ? 0 : clamp(omega, -MAX_RELEASE, MAX_RELEASE);
    // Let go while pressed into a stop: the knob eases back onto the wall (critically
    // damped, ~30 ms) and rests there. It is never fired off it.
    const s = this.p.stops;
    if (s && this.theta > s[1]) this.omega = Math.min(this.omega, 0);
    else if (s && this.theta < s[0]) this.omega = Math.max(this.omega, 0);
  }

  /** True while anything is still moving. */
  get active(): boolean {
    if (this.grabbed || this.tween) return true;
    if (Math.abs(this.omega) > 0.02) return true;
    if (Math.abs(this.lastAccel) > 0.6) return true;
    if (this.p.detents && Math.abs(this.theta - this.center) > 0.0015) return true;
    if (this.p.spring && Math.abs(this.theta) > 0.0015) return true;
    return false;
  }

  /** Where the knob sits relative to its stops. */
  get atStop(): 'min' | 'max' | null {
    const s = this.p.stops;
    if (!s) return null;
    if (this.theta <= s[0] + 0.5 * DEG) return 'min';
    if (this.theta >= s[1] - 0.5 * DEG) return 'max';
    return null;
  }

  /** 0..1 within stops, or the fraction of a turn when endless. */
  get value(): number {
    const s = this.p.stops;
    if (s) return clamp01((this.theta - s[0]) / (s[1] - s[0]));
    const t = this.theta / TAU;
    return t - Math.floor(t);
  }

  /** Advance by a frame's worth of time. Returns the events that happened. */
  advance(frameDt: number): PhysicsEvent[] {
    this.events = [];
    this.acc = Math.min(this.acc + Math.max(0, frameDt), DT * MAX_SUBSTEPS);
    while (this.acc >= DT) {
      this.step(DT);
      this.acc -= DT;
    }
    if (!this.active) {
      // Settle exactly on the detent so idle frames are pixel-stable.
      if (this.p.detents) this.theta = this.center;
      else if (this.p.spring) this.theta = 0;
      this.omega = 0;
      this.acc = 0;
    }
    return this.events;
  }

  private targetNow(): number {
    const tw = this.tween!;
    const k = clamp01(tw.t / tw.dur);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    return tw.from + (tw.to - tw.from) * e;
  }

  private clampToStops(theta: number): number {
    const s = this.p.stops;
    return s ? clamp(theta, s[0], s[1]) : theta;
  }

  private emit(kind: TickKind, index: number, accent: boolean) {
    this.events.push({ kind, index, theta: this.theta, omega: this.omega, accent });
  }

  private isAccentAngle(a: number): boolean {
    for (const x of this.p.accents) if (Math.abs(wrapPi(a - x)) < 1e-4) return true;
    return false;
  }

  private step(dt: number): void {
    const p = this.p;
    let a = 0;
    const w = this.width;
    const speed = Math.abs(this.omega);

    // Coupling: pointer target, or a tween acting like an invisible finger.
    if (this.grabbed) {
      a += K_COUPLE * (this.target - this.theta) - C_COUPLE * (this.omega - this.targetOmega);
    } else if (this.tween) {
      const tw = this.tween;
      tw.t += dt;
      const tgt = this.targetNow();
      a += K_COUPLE * (tgt - this.theta) - C_COUPLE * this.omega;
      // Let go once the finger has arrived and the knob has caught up and stopped, or
      // shortly after (a spring or magnet may hold the knob a few degrees off forever).
      const caught = Math.abs(tgt - this.theta) < 0.2 * DEG && Math.abs(this.omega) < TWEEN_REST;
      if (tw.t >= tw.dur && (caught || tw.t > tw.dur + 0.25)) {
        this.tween = null;
        // A finger that places a knob doesn't flick it: nothing coasts past the step
        // (arrow keys on a slider land on the step, even on low-friction feels).
        this.omega = 0;
        if (!p.detents && !p.spring && Math.abs(tw.to - this.theta) < 0.3 * DEG) this.theta = tw.to;
      }
    }

    // Periodic detent wells with hysteresis.
    if (w) {
      const snap = w * SNAP_FRACTION;
      let guard = 0;
      while (this.theta - this.center > snap && guard++ < 64) {
        this.center += w;
        this.index++;
        const acc = this.isAccentAngle(this.center);
        this.emit(acc ? 'accent' : 'detent', this.index, acc);
      }
      while (this.theta - this.center < -snap && guard++ < 64) {
        this.center -= w;
        this.index--;
        const acc = this.isAccentAngle(this.center);
        this.emit(acc ? 'accent' : 'detent', this.index, acc);
      }
      const heavy = this.isAccentAngle(this.center) ? 1.9 : 1;
      const k = K_DETENT * (0.25 + 0.75 * p.strength) * heavy;
      a += -k * (this.theta - this.center);
      // Crisp settle near a centre, but let flicks carry through.
      const f = speed < 4 ? 1 : speed > 14 ? 0.1 : 1 - ((speed - 4) / 10) * 0.9;
      a += -2 * 0.5 * Math.sqrt(k) * f * this.omega;
    } else if (p.accents.length) {
      // Accent wells on a detentless profile: a soft bump you feel pass.
      const k = K_BUMP * (0.3 + p.strength);
      p.accents.forEach((acc, i) => {
        const d = p.stops ? this.theta - acc : wrapPi(this.theta - acc);
        const side = Math.sign(d) || 1;
        if (Math.abs(d) < BUMP_HALF_WIDTH) {
          a += -k * d - 2 * 0.45 * Math.sqrt(k) * this.omega;
          const prev = this.bumpSide.get(i);
          if (prev !== undefined && prev !== side) this.emit('accent', i, true);
        }
        this.bumpSide.set(i, side);
      });
    }

    // Magnet snap points: smooth outside, a pull that peaks halfway in.
    if (p.snaps.length) {
      const peak = K_MAGNET * (0.35 + p.strength);
      let inside = -1;
      p.snaps.forEach((s, i) => {
        const d = p.stops ? this.theta - s : wrapPi(this.theta - s);
        const ad = Math.abs(d);
        if (ad < MAGNET_RADIUS) {
          const x = ad / MAGNET_RADIUS;
          a += -Math.sign(d) * peak * 4 * x * (1 - x);
          const kLocal = (peak * 4) / MAGNET_RADIUS;
          a += -2 * 0.75 * Math.sqrt(kLocal) * (1 - x) * this.omega;
          if (ad < MAGNET_RADIUS * 0.4) inside = i;
        }
      });
      if (inside >= 0 && inside !== this.snapLatch) {
        this.snapLatch = inside;
        this.emit('snap', inside, false);
      } else if (inside < 0 && this.snapLatch >= 0) {
        const s = p.snaps[this.snapLatch]!;
        const d = p.stops ? this.theta - s : wrapPi(this.theta - s);
        if (Math.abs(d) > MAGNET_RADIUS * 0.85) this.snapLatch = -1;
      }
    }

    // Spring return to centre; a touch stiffer the further you push.
    if (p.spring) {
      const k = K_SPRING * p.spring;
      a += -k * (this.theta + 0.35 * this.theta * this.theta * this.theta);
      a += -2 * 0.8 * Math.sqrt(k) * this.omega;
    }

    // Viscous damping.
    a += -viscous(p.damping) * this.omega;

    // Virtual end stops: a very stiff, dead wall. Damped in both directions, so what
    // goes in comes out at rest instead of springing the knob back across the range.
    if (p.stops) {
      const [lo, hi] = p.stops;
      if (this.theta > hi) {
        a += -K_STOP * (this.theta - hi) - C_STOP * this.omega;
        if (this.stopLatch !== 1) {
          this.stopLatch = 1;
          this.emit('stop', 1, true);
        }
      } else if (this.theta < lo) {
        a += -K_STOP * (this.theta - lo) - C_STOP * this.omega;
        if (this.stopLatch !== -1) {
          this.stopLatch = -1;
          this.emit('stop', 0, true);
        }
      } else if (this.stopLatch && this.theta < hi - DEG && this.theta > lo + DEG) {
        this.stopLatch = 0;
      }
    }

    // Semi-implicit Euler.
    this.lastAccel = a;
    this.omega += a * dt;
    if (!Number.isFinite(this.omega)) this.omega = 0;
    // Dry friction on a free, detentless knob: it takes speed off without reversing it,
    // so a flick ends in a stop rather than an imperceptible, endless creep. (Not on a
    // spring return: stiction would park the knob a hair off centre.)
    if (!w && !p.spring && !this.grabbed && !this.tween) {
      const f = DRY_FRICTION * dt;
      this.omega = Math.abs(this.omega) <= f ? 0 : this.omega - Math.sign(this.omega) * f;
    }
    this.theta += this.omega * dt;

    // Hard stop: bounce off the wall instead of sinking into it.
    if (p.stops) {
      const [lo, hi] = p.stops;
      if (this.theta > hi + STOP_OVERSHOOT) {
        this.theta = hi + STOP_OVERSHOOT;
        if (this.omega > 0) this.omega *= -0.3;
      } else if (this.theta < lo - STOP_OVERSHOOT) {
        this.theta = lo - STOP_OVERSHOOT;
        if (this.omega < 0) this.omega *= -0.3;
      }
    }
  }
}

/** Least-squares angular velocity (rad/s) over recent (t ms, theta rad) samples. */
export function fitVelocity(
  samples: { t: number; a: number }[],
  now: number,
  windowMs = 80,
): number {
  const s = samples.filter((x) => now - x.t <= windowMs);
  if (s.length < 2) return 0;
  const n = s.length;
  let st = 0,
    sa = 0,
    stt = 0,
    sta = 0;
  for (const { t, a } of s) {
    const tt = (t - now) / 1000;
    st += tt;
    sa += a;
    stt += tt * tt;
    sta += tt * a;
  }
  const den = n * stt - st * st;
  if (Math.abs(den) < 1e-9) return 0;
  return (n * sta - st * sa) / den;
}
