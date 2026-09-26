/**
 * The tease headline's "tuning": 1 when the knob points at the reveal time,
 * falling to 0 at 150° away. Shared by the page (the first paint, computed at
 * build time) and tease.ts (every tick), so the two never disagree and the
 * headline doesn't jump when the script takes over.
 */

/** Shortest distance around the clock face, in degrees (0–180). */
export function clockDist(angle: number, target: number): number {
  const a = ((angle % 360) + 360) % 360;
  const d = Math.abs(a - target) % 360;
  return d > 180 ? 360 - d : d;
}

/** 0 (off station) to 1 (on station) for a dial angle. */
export function tuneAt(angle: number, target: number): number {
  return Math.max(0, 1 - clockDist(angle, target) / 150) ** 1.6;
}
