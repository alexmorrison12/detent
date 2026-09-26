/** Internal contract between <detent-dial> and its renderers (SVG, three.js). */
import type { Finish } from '@/data/product';
import type { ResolvedPhysics } from './physics';
import type { Rig } from './model';
import type { DialPartAnchor } from './types';

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
}

export interface KnobCircle {
  x: number;
  y: number;
  r: number;
}

export interface DialView {
  readonly kind: 'svg' | 'webgl2';
  /** Layer element appended to the host. */
  readonly el: Element;
  resize(w: number, h: number, dpr: number): void;
  draw(s: ViewState): void;
  /** Projected knob circle in host CSS px (for the touch target). */
  knobCircle(): KnobCircle | null;
  anchors(): DialPartAnchor[];
  dispose(): void;
}
