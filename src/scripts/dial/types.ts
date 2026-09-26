/**
 * Public contract for <detent-dial>. Pages depend ONLY on this contract,
 * never on the renderer internals (three.js, SVG fallback, audio engine).
 *
 * Attributes (all optional, all reactive):
 *   finish       FinishId            'raw' | 'graphite' | 'glacier' | 'tally'   (default 'graphite')
 *   profile      ProfileId           'ratchet' | 'fluid' | 'spring' | 'clock' | 'wall' | 'magnet' (default 'ratchet')
 *   interactive  boolean attr        user can turn it (drag, wheel when focused, arrow keys)
 *   camera       CameraPreset        'hero' | 'top' | 'side' | 'front' | 'exploded' | 'config'
 *   autorotate   boolean attr        slow idle motion when not interacted with
 *   label        string              accessible name (default 'Detent dial')
 *   display      string              short text shown on the knob's round display (≤ 10 chars)
 *   quality      'auto'|'low'|'high' renderer tier hint
 *
 * Properties:
 *   angle: number        current knob angle in degrees (get/set; set is animated unless instant)
 *   explode: number      0..1 exploded-view amount (scroll-driven on the home page)
 *   value: number        0..1 normalised position within stops (or angle/360 mod 1 when endless)
 *   renderer: 'webgpu' | 'webgl2' | 'svg' | 'none'  (read-only, after ready)
 *
 * Methods:
 *   setAngle(deg, { instant?: boolean })
 *   nudge(detents: number)           turn by N detents of the current profile (for demos)
 *
 * Events (bubble, composed):
 *   detent:ready   { renderer }
 *   detent:tick    { index, angle, profile, velocity, accent }   fired on every detent crossing / snap / stop hit
 *   detent:change  { angle, value, profile }                     throttled to animation frames
 *   detent:press   { level: 1 | 2 | 3 }                          click/tap on the knob face
 *   detent:grab / detent:release  {}                             pointer engage / disengage
 */
import type { FinishId, ProfileId } from '@/data/product';

export type CameraPreset = 'hero' | 'top' | 'side' | 'front' | 'exploded' | 'config';
export type RendererKind = 'webgpu' | 'webgl2' | 'svg' | 'none';

export interface DetentTickDetail {
  index: number;
  angle: number;
  profile: ProfileId;
  velocity: number;
  accent: boolean;
}
export interface DetentChangeDetail {
  angle: number;
  value: number;
  profile: ProfileId;
}
export interface DetentPressDetail {
  level: 1 | 2 | 3;
}
export interface DetentReadyDetail {
  renderer: RendererKind;
}

export interface DetentDialElement extends HTMLElement {
  angle: number;
  explode: number;
  readonly value: number;
  readonly renderer: RendererKind;
  finish: FinishId;
  profile: ProfileId;
  setAngle(deg: number, opts?: { instant?: boolean }): void;
  nudge(detents: number): void;
}

declare global {
  interface HTMLElementTagNameMap {
    'detent-dial': DetentDialElement;
  }
  interface HTMLElementEventMap {
    'detent:ready': CustomEvent<DetentReadyDetail>;
    'detent:tick': CustomEvent<DetentTickDetail>;
    'detent:change': CustomEvent<DetentChangeDetail>;
    'detent:press': CustomEvent<DetentPressDetail>;
    'detent:grab': CustomEvent<Record<string, never>>;
    'detent:release': CustomEvent<Record<string, never>>;
  }
}
