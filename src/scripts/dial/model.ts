/**
 * Detent One in millimetres. Both renderers (SVG and three.js) build from
 * these numbers so the fallback, the 3D model and the stills agree.
 * y = 0 is the desk. Knob angle 0 puts the tally line at 12 o'clock
 * (world -Z), positive angles turn clockwise seen from above.
 */
import type { CameraPreset, DialPartId } from './types';

export const MM = {
  footR: 33.6,
  footH: 1.5,
  baseR: 36, // Ø72
  baseTop: 20,
  baseChamfer: 1.2,
  slotBottom: 3.1,
  slotTop: 4.5,
  slotDepth: 1.1,
  knobR: 29, // Ø58
  knobBottom: 20.35,
  knobTop: 43,
  knobChamfer: 0.8,
  knurlBottom: 24.6,
  knurlTop: 37.4,
  boreR: 20,
  hubR: 19.35,
  displayR: 18.2, // 1.43" AMOLED
  glassTop: 44, // total height 44
  knurlTeeth: 150,
} as const;

/** Explode choreography: how far each part lifts (mm) and when it starts moving. */
export const PARTS: { id: DialPartId; lift: number; order: number; y: number; r: number }[] = [
  { id: 'glass', lift: 118, order: 0, y: 43.8, r: 19.4 },
  { id: 'display', lift: 106, order: 1, y: 43.2, r: 18.6 },
  { id: 'knob', lift: 83, order: 2, y: 31.5, r: 29 },
  { id: 'rotor', lift: 64, order: 3, y: 20, r: 24.2 },
  { id: 'stator', lift: 48, order: 4, y: 19.5, r: 18.4 },
  { id: 'encoder', lift: 33, order: 5, y: 14, r: 26.5 },
  { id: 'battery', lift: 17, order: 6, y: 9.5, r: 23 },
  { id: 'base', lift: 0, order: 0, y: 10.5, r: 36 },
  { id: 'foot', lift: -14, order: 7, y: 0.75, r: 33.6 },
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

/** Eased 0..1 progress of one part for a global explode amount. */
export function partProgress(order: number, explode: number): number {
  return easeInOut(clamp01((explode - order * 0.05) / 0.65));
}

export function partLift(id: DialPartId, explode: number): number {
  const p = PARTS.find((x) => x.id === id)!;
  return p.lift * partProgress(p.order, explode);
}

/* ------------------------------------------------------------------------ */
/* Camera rig: spherical orbit around the dial.                              */
/* ------------------------------------------------------------------------ */

export interface Rig {
  /** Azimuth, degrees from +Z (front) toward +X. */
  az: number;
  /** Elevation above the desk, degrees. */
  el: number;
  /** Distance to target, mm (at a 28° vertical field of view). */
  dist: number;
  /** Target height, mm. */
  ty: number;
}

export const FOV = 28;

export const PRESETS: Record<CameraPreset, Rig> = {
  hero: { az: -32, el: 27, dist: 236, ty: 21 },
  top: { az: 0, el: 89.5, dist: 228, ty: 22 },
  side: { az: 90, el: 1.5, dist: 238, ty: 21 },
  front: { az: 0, el: 13, dist: 240, ty: 21 },
  exploded: { az: -32, el: 22, dist: 236, ty: 21 },
  config: { az: 30, el: 36, dist: 222, ty: 19 },
};

/** Blend a rig toward the framing that fits the fully exploded stack. */
export function explodeRig(r: Rig, explode: number): Rig {
  const e = easeInOut(clamp01(explode));
  const vertical = r.el > 80;
  return {
    az: r.az,
    el: vertical ? r.el : r.el - 5 * e,
    dist: r.dist * (1 + (vertical ? 0.5 : 0.84) * e),
    ty: r.ty + (vertical ? 18 : 55) * e,
  };
}

export function lerpRig(a: Rig, b: Rig, t: number): Rig {
  let d = b.az - a.az;
  d -= 360 * Math.round(d / 360);
  return {
    az: a.az + d * t,
    el: a.el + (b.el - a.el) * t,
    dist: a.dist + (b.dist - a.dist) * t,
    ty: a.ty + (b.ty - a.ty) * t,
  };
}
