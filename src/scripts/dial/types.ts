/**
 * Public contract for <detent-dial>. Pages depend ONLY on this contract,
 * never on the renderer internals (three.js, SVG fallback, audio engine).
 *
 * Attributes (all optional, all reactive):
 *   finish       FinishId            'raw' | 'graphite' | 'glacier' | 'tally'   (default 'graphite')
 *   profile      ProfileId           'ratchet' | 'fluid' | 'spring' | 'clock' | 'wall' | 'magnet' (default 'ratchet')
 *   interactive  boolean attr        user can turn it (drag the knob, wheel when hovered + focused, arrow keys)
 *   camera       CameraPreset        'hero' | 'top' | 'side' | 'front' | 'exploded' | 'config'
 *   autorotate   boolean attr        one gentle idle look-around (≤ 5 s) each time it scrolls into view
 *   label        string              accessible name (default 'Detent dial')
 *   display      string              short text shown on the knob's round display (≤ 10 chars)
 *   quality      'auto'|'low'|'high' renderer tier hint ('low' = SVG only, never loads three.js)
 *   muted        boolean attr        (extension) no sound and no vibration from this dial
 *   loading      'lazy'|'eager'      (extension) 'eager' boots 3D immediately (render harness, above-the-fold toys)
 *
 * Properties:
 *   angle: number        current knob angle in degrees (get/set; set is animated unless instant)
 *   explode: number      0..1 exploded-view amount (scroll-driven on the home page)
 *   value: number        0..1 normalised position within stops (or angle/360 mod 1 when endless)
 *   renderer: 'webgpu' | 'webgl2' | 'svg' | 'none'  (read-only; 'none' while only the server still shows)
 *
 *   physics: Partial<FeelPhysics> | null   custom physics override (profile builder, feel
 *                        links, games). null = use the named profile's physics. The profile
 *                        attribute still sets name/color unless feelColor is given.
 *   feelColor: string | null   override the display/halo color (hex)
 *   valueText: ((s: DialValueState) => string) | null   (extension) custom aria-valuetext,
 *                        e.g. s => `Frame ${s.index} of 240`. null = plain-words default.
 *                        Prefer this to writing aria-valuetext yourself: the engine calls it
 *                        with the destination the moment a key is pressed. (A page that does
 *                        write aria-valuetext/-valuenow/-valuemin/-valuemax/-label directly
 *                        owns that attribute from then on; the engine stops writing it.)
 *
 * Methods:
 *   setAngle(deg, { instant?: boolean })
 *   nudge(detents: number)           turn by N detents of the current profile (for demos)
 *   getCanvas(): HTMLCanvasElement | null   the live 3D canvas (for MediaRecorder clips), null on SVG
 *   whenSettled(): Promise<void>     (extension) resolves once motion, camera and explode transitions
 *                                    have come to rest and the final frame is drawn
 *   partAnchors(): DialPartAnchor[]  (extension) host-relative CSS px anchor per part, for
 *                                    labelling the exploded view (right edge of each part)
 *   refreshAria(): void              (extension) re-run valueText now, when the page's state
 *                                    changed without the knob moving (e.g. "Armed")
 *
 * Events (bubble, composed):
 *   detent:ready   { renderer }      fired whenever the live renderer changes (svg, then webgl2;
 *                                    back to svg on WebGL context loss)
 *   detent:tick    { index, angle, profile, velocity, accent, kind }   every detent crossing / snap / stop hit
 *   detent:change  { angle, value, profile, velocity, index }          once per animation frame of movement
 *   detent:press   { level: 1 | 2 | 3 }                                click/tap on the knob face (level by hold time)
 *   detent:grab / detent:release  {}                                   pointer engage / disengage
 *   detent:settle  { angle, value, profile }                           (extension) motion came to rest
 *
 * Units: angles in degrees, clockwise positive seen from above, 0 = the tally
 * line at 12 o'clock. velocity in degrees per second.
 *
 * CSS hooks on the host (read-only, for page reactions without JS listeners):
 *   --dial-value (0..1), --dial-turn (angle / 360, unbounded), [data-renderer], [data-grabbed]
 */
import type { FeelProfile, FinishId, ProfileId } from '@/data/product';

export type FeelPhysics = FeelProfile['physics'];

export type CameraPreset = 'hero' | 'top' | 'side' | 'front' | 'exploded' | 'config';
export type RendererKind = 'webgpu' | 'webgl2' | 'svg' | 'none';

/** What kind of haptic event a tick is. 'accent' = a heavier detent (Clock noon, Wall's bump). */
export type TickKind = 'detent' | 'accent' | 'stop' | 'snap';

export interface DetentTickDetail {
  /** Detent index for detent/accent ticks; snap point index for 'snap'; 0 = lower, 1 = upper for 'stop'. */
  index: number;
  angle: number;
  profile: ProfileId;
  velocity: number;
  accent: boolean;
  kind?: TickKind;
}
export interface DetentChangeDetail {
  angle: number;
  value: number;
  profile: ProfileId;
  velocity?: number;
  /** Current detent index (0 when the profile has no detents). */
  index?: number;
}
export interface DetentPressDetail {
  level: 1 | 2 | 3;
}
export interface DetentReadyDetail {
  renderer: RendererKind;
}
export interface DetentSettleDetail {
  angle: number;
  value: number;
  profile: ProfileId;
}

/** Snapshot passed to a custom valueText formatter. */
export interface DialValueState {
  angle: number;
  value: number;
  index: number;
  profile: ProfileId;
  physics: FeelPhysics;
  atStop: 'min' | 'max' | null;
}

export type DialPartId =
  'glass' | 'display' | 'knob' | 'rotor' | 'stator' | 'encoder' | 'battery' | 'base' | 'foot';
export interface DialPartAnchor {
  id: DialPartId;
  /** Host-relative CSS pixels. */
  x: number;
  y: number;
  /** false when the part is hidden (e.g. internals while assembled). */
  visible: boolean;
}

export interface DetentDialElement extends HTMLElement {
  angle: number;
  explode: number;
  readonly value: number;
  readonly renderer: RendererKind;
  finish: FinishId;
  profile: ProfileId;
  physics: Partial<FeelPhysics> | null;
  feelColor: string | null;
  valueText?: ((s: DialValueState) => string) | null;
  setAngle(deg: number, opts?: { instant?: boolean }): void;
  nudge(detents: number): void;
  getCanvas(): HTMLCanvasElement | null;
  whenSettled?(): Promise<void>;
  partAnchors?(): DialPartAnchor[];
  refreshAria?(): void;
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
    'detent:settle': CustomEvent<DetentSettleDetail>;
  }
}
