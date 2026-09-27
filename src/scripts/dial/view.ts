/** Internal contract between <detent-dial> and its renderers (SVG, three.js). */
import type { Finish } from '@/data/product';
import type { ResolvedPhysics } from './physics';
import { MM, partLift, type Rig } from './model';
import type { DialPartAnchor, DialPartId } from './types';

export interface ViewState {
  /** Knob angle, radians, clockwise from 12 o'clock. */
  theta: number;
  explode: number;
  finish: Finish;
  /** Effective feel color (hex): display ring + halo. */
  color: string;
  /** Profile name for the display. */
  name: string;
  p: ResolvedPhysics;
  value: number;
  index: number;
  text: string;
  sub: string;
  /** Final camera (preset + transitions + autorotate + explode framing). */
  rig: Rig;
  /** 0..1 press feedback (knob seats, display ring flashes). */
  press: number;
  /** Magnet: index of the snap the knob sits on, -1 when free. */
  snap: number;
  /**
   * The dial sits in a day world (light color-scheme): the halo's light on the desk
   * stays a faint, tight line instead of a colored haze on a white page.
   */
  day: boolean;
}

export interface KnobCircle {
  x: number;
  y: number;
  r: number;
}

/** An ellipse in host CSS px. */
export interface Ellipse {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

/** Where a pointer lands on the knob, for turning it the way a hand would. */
export interface KnobGrip {
  /** Angle on the knob's top face around its axis (rad, clockwise seen from above). Only differences matter. */
  a: number;
  /** Distance from the axis on the top face, in knob radii (Infinity when the face is edge-on). */
  r: number;
  /** On the front of the knurled band rather than the face: turn it by its side. */
  side: boolean;
  /** The knob's projected radius in CSS px: a sideways push of rpx turns it one radian. */
  rpx: number;
  /** Host px x of the knob's axis (its top face's projected centre): which side a tap is on. */
  cx: number;
}

export interface DialView {
  readonly kind: 'svg' | 'webgl2';
  /** Layer element appended to the host. */
  readonly el: Element;
  resize(w: number, h: number, dpr: number): void;
  draw(s: ViewState): void;
  /** Projected knob circle in host CSS px (for the touch target). */
  knobCircle(): KnobCircle | null;
  /** The knob under a host-relative point, projected onto its top face. */
  grip(x: number, y: number): KnobGrip | null;
  /** The smallest ellipse (host px) around the whole product: the keyboard focus ring. */
  outline(): Ellipse | null;
  anchors(): DialPartAnchor[];
  dispose(): void;
}

/** Circles [radius, height] in mm that bound the product's silhouette; see outline(). */
export function hullRings(explode: number, seat: number): [number, number][] {
  const L = (id: DialPartId) => partLift(id, explode);
  return [
    [MM.footR, L('foot')],
    [MM.baseR, MM.footH],
    [MM.baseR, MM.baseTop],
    [MM.knobR, MM.knobBottom + L('knob') - seat],
    [MM.knobR, MM.knobTop + L('knob') - seat],
    [MM.hubR, MM.glassTop + L('glass') - seat * 0.3],
  ];
}

/** Fit an axis-aligned ellipse around projected points, keeping the bbox's proportions. */
export function enclose(pts: { x: number; y: number }[]): Ellipse | null {
  if (!pts.length) return null;
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x);
    x1 = Math.max(x1, p.x);
    y0 = Math.min(y0, p.y);
    y1 = Math.max(y1, p.y);
  }
  const x = (x0 + x1) / 2;
  const y = (y0 + y1) / 2;
  const hw = Math.max(1, (x1 - x0) / 2);
  const hh = Math.max(1, (y1 - y0) / 2);
  let s = 1;
  for (const p of pts) s = Math.max(s, Math.hypot((p.x - x) / hw, (p.y - y) / hh));
  return { x, y, rx: hw * s, ry: hh * s };
}
