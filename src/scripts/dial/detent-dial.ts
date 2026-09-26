/**
 * <detent-dial>: Detent One, live. Contract: ./types.ts.
 *
 * This module (element, physics, SVG renderer, audio, haptics) is itself
 * fetched lazily by ./loader.ts. three.js is imported only when a dial nears
 * the viewport and the browser is idle (or on intent: pointerenter, focus,
 * touch; low-end devices wait for intent or a dial half in view), never while
 * the page is being prerendered, and never for quality="low", without WebGL2,
 * or when WebGL is software-rendered (unless quality="high").
 *
 * Visual layers inside the host, bottom to top:
 *   [data-dial-fallback]  server-rendered still (LCP), from <DialStage>
 *   svg.dd-svg            vector renderer: before 3D, fallback, low quality
 *   canvas.dd-canvas      the 3D view, blitted from the page's shared WebGL context
 *   .dd-ring              keyboard focus ring: an ellipse around the whole product
 *   .dd-hit               the knob's projected circle: the only touch-action:none area
 *
 * aria-valuetext/-valuenow/-valuemin/-valuemax/-label: the engine writes them
 * until a page writes one itself; from then on that attribute is the page's.
 * A `valueText` formatter hands aria-valuetext back to the engine.
 */
import {
  FINISHES,
  PROFILES,
  type FeelProfile,
  type Finish,
  type FinishId,
  type ProfileId,
} from '@/data/product';
import { DialPhysics, fitVelocity, type PhysicsEvent } from './physics';
import { nearestSnap, readout } from './readout';
import { PRESETS, easeInOut, explodeRig, lerpRig, type Rig } from './model';
import { SvgView } from './svg';
import { createMotionVoice, playTick, unlockAudio, voiceFor, type MotionVoice } from './audio';
import { haptic, hapticTap } from './haptics';
import { safeHex } from './color';
import type {
  CameraPreset,
  DetentDialElement,
  DialPartAnchor,
  DialValueState,
  FeelPhysics,
  RendererKind,
  TickKind,
} from './types';
import type { DialView, KnobGrip, ViewState } from './view';
import type { ThreeView } from './three-view';

const DEG = Math.PI / 180;
const CAMERA_PRESETS = Object.keys(PRESETS) as CameraPreset[];
const AUTO_SECONDS = 5; // WCAG 2.2.2: autonomous motion stops within 5 s
const AUTO_DEGREES = 16;
/** Within this many knob radii of the axis a face drag has no usable angle. */
const DEAD_ZONE = 0.22;

const CSS = `
:where(detent-dial){display:block;position:relative;touch-action:pan-y;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;outline:none}
:where(detent-dial):focus-visible{outline:none}
:where(detent-dial)>:where(.dd-layer){position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;transition:opacity 240ms cubic-bezier(.16,1,.3,1),visibility 0s linear 0s}
:where(detent-dial)>:where(.dd-svg){opacity:0;overflow:visible}
:where(detent-dial[data-renderer=svg])>:where(.dd-svg){opacity:1}
:where(detent-dial[data-renderer=webgl2])>:where(.dd-svg){opacity:0;visibility:hidden;transition:opacity 240ms,visibility 0s linear 240ms}
:where(detent-dial)>:where(.dd-canvas){opacity:0}
:where(detent-dial[data-renderer=webgl2])>:where(.dd-canvas){opacity:1}
:where(detent-dial)>:where([data-dial-fallback]){transition:opacity 240ms cubic-bezier(.16,1,.3,1),visibility 0s linear 0s}
:where(detent-dial[data-renderer=svg],detent-dial[data-renderer=webgl2])>:where([data-dial-fallback]){opacity:0;visibility:hidden;transition:opacity 240ms,visibility 0s linear 240ms}
:where(detent-dial) :where(.dd-hit){position:absolute;left:0;top:0;border-radius:50%;touch-action:none;cursor:grab;z-index:1}
:where(detent-dial[data-grabbed]) :where(.dd-hit){cursor:grabbing}
:where(detent-dial) :where(.dd-ring){position:absolute;left:0;top:0;border-radius:50%;pointer-events:none;visibility:hidden}
:where(detent-dial:focus-visible:not([data-focus-by=pointer]),detent-dial[data-focus-by=key]:focus) :where(.dd-ring){visibility:visible;outline:2px solid var(--focus,#ff4d8d);outline-offset:3px}
@media (prefers-reduced-motion:reduce){:where(detent-dial)>*{transition:none!important}}
`;

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(CSS);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  } catch {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
  }
}

const reducedMQ =
  typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
const isReduced = () => !!reducedMQ?.matches;

type Mode = 'still' | 'svg' | 'webgl2';

let threeModule: Promise<typeof import('./three-view')> | null = null;
const loadThree = () => (threeModule ??= import('./three-view'));

function whenLoaded(fn: () => void) {
  if (document.readyState === 'complete') fn();
  else window.addEventListener('load', fn, { once: true });
}
function whenIdle(fn: () => void, timeout = 2500) {
  const ric = (
    window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
  ).requestIdleCallback;
  if (ric) ric(fn, { timeout });
  else setTimeout(fn, 200);
}
function whenActivated(fn: () => void) {
  const doc = document as Document & { prerendering?: boolean };
  if (doc.prerendering) document.addEventListener('prerenderingchange', fn, { once: true });
  else fn();
}

/** Renderers that mean "no GPU": 3D would cost seconds of main thread and crawl. */
const SOFTWARE_GL = /SwiftShader|llvmpipe|softpipe|Software|Basic Render|Microsoft Basic/i;
let gpu: boolean | null = null;

/**
 * Once per page, before three.js is fetched: is there a real GPU behind WebGL2?
 * failIfMajorPerformanceCaveat rules out blocklisted GPUs; the renderer string
 * catches software rasterizers that still say yes. QA on a GPU-less machine can
 * force 3D with ?webgl=any (or use quality="high", as the render harness does).
 */
function hardwareGL(): boolean {
  if (gpu !== null) return gpu;
  gpu = false;
  try {
    if (new URLSearchParams(location.search).get('webgl') === 'any') return (gpu = true);
    const gl = document
      .createElement('canvas')
      .getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    if (gl) {
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
      gpu = !SOFTWARE_GL.test(name);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    gpu = false;
  }
  return gpu;
}

function lowTier(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return (
    (!!nav.deviceMemory && nav.deviceMemory <= 4) ||
    (!!nav.hardwareConcurrency && nav.hardwareConcurrency <= 4)
  );
}

interface PointerState {
  id: number;
  /** 'face': turn around the axis, like a finger on the top; 'side': push the knurl sideways. */
  mode: 'face' | 'side';
  /** Last angle on the face (rad), or NaN while the finger crosses the axis. */
  a: number;
  /** Last clientX, for side pushes. */
  x: number;
  t0: number;
  x0: number;
  y0: number;
  moved: boolean;
  start: number;
  samples: { t: number; a: number }[];
  lastT: number;
}

class DetentDial extends HTMLElement implements DetentDialElement {
  static observedAttributes = [
    'finish',
    'profile',
    'interactive',
    'label',
    'display',
    'camera',
    'autorotate',
    'quality',
    'muted',
    'loading',
  ];

  #valueText: ((s: DialValueState) => string) | null = null;
  get valueText(): ((s: DialValueState) => string) | null {
    return this.#valueText;
  }
  set valueText(fn: ((s: DialValueState) => string) | null) {
    this.#valueText = typeof fn === 'function' ? fn : null;
    // A formatter means the page wants the engine to speak for it again.
    if (this.#valueText) this.#ariaPage.delete('aria-valuetext');
    if (this.#init) this.#updateAria(true);
  }

  #init = false;
  #phys = new DialPhysics(PROFILES[0]!.physics);
  #physicsOverride: Partial<FeelPhysics> | null = null;
  #feelColor: string | null = null;
  #mode: Mode = 'svg';
  #kind: RendererKind = 'none';
  #svg: SvgView | null = null;
  #three: ThreeView | null = null;
  /** 3D is ready but the knob is in someone's hand: switch renderers on release. */
  #threeWaiting = false;
  #hit: HTMLDivElement | null = null;
  #ring: HTMLDivElement | null = null;
  #lastRing = '';
  #w = 0;
  #h = 0;
  #raf = 0;
  #lastT = 0;
  #dirty = true;
  #inView = false;
  #io: IntersectionObserver | null = null;
  #ro: ResizeObserver | null = null;
  #half: IntersectionObserver | null = null;
  #bootState: 'idle' | 'waiting' | 'loading' | 'done' | 'failed' = 'idle';
  #govScale = 1;
  #frames: number[] = [];

  // camera + explode
  #rig: Rig = { ...PRESETS.hero };
  #rigFrom: Rig = { ...PRESETS.hero };
  #rigTo: Rig = { ...PRESETS.hero };
  #rigT = 1;
  #explode = 0;
  #explodeFrom = 0;
  #explodeTo = 0;
  #explodeT = 1;
  #explodeSet = false;
  /** Seconds into the current autorotate look-around (-1 = none), from wall-clock time. */
  #autoT = -1;
  #autoStart = 0;
  #autoDir = 1;
  #press = 0;
  #pressTarget = 0;

  // input
  #pointer: PointerState | null = null;
  #hover = false;
  #wheelAcc = 0;
  #keyDownAt = 0;
  #userDriven = false;

  // output
  #lastEmit = NaN;
  #lastAriaAt = 0;
  #ariaTimer = 0;
  /** What the engine last wrote per aria attribute, and the ones a page has taken over. */
  #ariaMine = new Map<string, string>();
  #ariaPage = new Set<string>();
  /** A key/wheel step already announced its destination: stay quiet until it settles. */
  #ariaGoal: number | null = null;
  #movedSinceSettle = false;
  #motion: MotionVoice | null = null;
  #motionKind: 'fluid' | 'spring' | null = null;
  #settleWaiters: (() => void)[] = [];
  #lastHit = '';

  /* ------------------------------- properties ------------------------------- */

  get finish(): FinishId {
    const v = this.getAttribute('finish') as FinishId | null;
    return v && FINISHES.some((f) => f.id === v) ? v : 'graphite';
  }
  set finish(v: FinishId) {
    this.setAttribute('finish', v);
  }
  get profile(): ProfileId {
    const v = this.getAttribute('profile') as ProfileId | null;
    return v && PROFILES.some((p) => p.id === v) ? v : 'ratchet';
  }
  set profile(v: ProfileId) {
    this.setAttribute('profile', v);
  }
  get angle(): number {
    return this.#phys.theta / DEG;
  }
  set angle(v: number) {
    this.setAngle(v);
  }
  get explode(): number {
    return this.#explode;
  }
  set explode(v: number) {
    const n = Number(v);
    this.#explodeSet = true;
    this.#explodeT = 1;
    this.#explode = Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
    this.#invalidate();
  }
  get value(): number {
    return this.#phys.value;
  }
  get renderer(): RendererKind {
    return this.#kind;
  }
  get physics(): Partial<FeelPhysics> | null {
    return this.#physicsOverride;
  }
  set physics(v: Partial<FeelPhysics> | null) {
    this.#physicsOverride = v && typeof v === 'object' ? { ...v } : null;
    this.#applyPhysics();
  }
  get feelColor(): string | null {
    return this.#feelColor;
  }
  set feelColor(v: string | null) {
    this.#feelColor = safeHex(v);
    this.#invalidate();
  }

  /* --------------------------------- methods -------------------------------- */

  setAngle(deg: number, opts: { instant?: boolean } = {}): void {
    const rad = Number(deg) * DEG;
    if (!Number.isFinite(rad)) return;
    this.#userDriven = false;
    this.#ariaGoal = null;
    if (opts.instant || !this.#init) {
      this.#phys.setInstant(rad);
      this.#lastEmit = NaN;
    } else {
      this.#phys.moveTo(rad);
    }
    this.#invalidate();
  }

  nudge(detents: number): void {
    this.#userDriven = false;
    this.#step(Math.round(Number(detents) || 0), false);
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.#mode === 'webgl2' && this.#three ? this.#three.el : null;
  }

  whenSettled(): Promise<void> {
    if (!this.#raf && !this.#isAnimating()) return Promise.resolve();
    return new Promise((r) => this.#settleWaiters.push(r));
  }

  partAnchors(): DialPartAnchor[] {
    return (this.#activeView() ?? this.#svg)?.anchors() ?? [];
  }

  refreshAria(): void {
    if (this.#init) this.#updateAria(true);
  }

  /* -------------------------------- lifecycle ------------------------------- */

  connectedCallback() {
    injectStyles();
    if (!this.#init) this.#setup();
    this.#observe();
    whenActivated(() => this.#scheduleBoot());
    this.#invalidate();
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.#raf);
    this.#raf = 0;
    this.#io?.disconnect();
    this.#ro?.disconnect();
    this.#half?.disconnect();
    this.#half = null;
    this.#motion?.stop();
    // Moved in the DOM? Keep everything. Removed for good? Free the GPU view.
    setTimeout(() => {
      if (this.isConnected) return;
      this.#three?.dispose();
      this.#three = null;
      if (this.#bootState === 'done') this.#bootState = 'idle';
      // If it comes back, it shows the SVG until 3D boots again.
      if (this.#mode === 'webgl2') this.#setMode('svg');
    }, 0);
  }

  attributeChangedCallback(name: string, old: string | null, val: string | null) {
    if (!this.#init || old === val) return;
    switch (name) {
      case 'finish':
        this.#applyA11y();
        this.#invalidate();
        break;
      case 'display':
        this.#invalidate();
        break;
      case 'profile':
        this.#applyPhysics();
        this.#applyA11y();
        break;
      case 'label':
        // A new label attribute is the page speaking through the contract: it wins.
        this.#ariaPage.delete('aria-label');
        this.#ariaMine.set('aria-label', this.getAttribute('aria-label') ?? '');
        this.#applyA11y();
        break;
      case 'interactive':
        this.#applyA11y();
        break;
      case 'camera':
        this.#pendingCamera = null;
        this.#setCamera(this.#cameraAttr(), isReduced());
        break;
      case 'autorotate':
        if (val === null) this.#autoT = -1;
        else this.#startAuto();
        break;
      case 'quality':
        if (val === 'low') this.#fallbackToSvg(false);
        else this.#scheduleBoot();
        break;
      case 'loading':
        if (val === 'eager') this.#scheduleBoot();
        break;
    }
  }

  #setup() {
    // Properties set before this element was upgraded (the engine loads lazily) shadow
    // the accessors; re-apply them, finish and profile first so physics lands on top.
    const pending: Record<string, unknown> = {};
    for (const prop of [
      'finish',
      'profile',
      'physics',
      'feelColor',
      'valueText',
      'explode',
      'angle',
    ] as const) {
      if (Object.prototype.hasOwnProperty.call(this, prop)) {
        pending[prop] = (this as unknown as Record<string, unknown>)[prop];
        delete (this as unknown as Record<string, unknown>)[prop];
      }
    }
    this.#init = true;
    this.#phys.reduced = isReduced();
    reducedMQ?.addEventListener?.('change', () => {
      this.#phys.reduced = isReduced();
      if (isReduced()) this.#autoT = -1;
    });
    this.#applyPhysics(true);
    const fallback = this.querySelector(':scope > [data-dial-fallback]') as HTMLElement | null;
    const preset = this.#cameraAttr();
    // Start framed exactly like the server still; glide to our own camera once live.
    const stillCam = fallback?.dataset.camera as CameraPreset | undefined;
    const start = stillCam && CAMERA_PRESETS.includes(stillCam) ? stillCam : preset;
    this.#rig = this.#rigFrom = this.#rigTo = { ...PRESETS[start] };
    if (start !== preset) this.#pendingCamera = preset;
    if (start === 'exploded') this.#explode = this.#explodeTo = 1;

    this.#svg = new SvgView();
    if (fallback) fallback.setAttribute('aria-hidden', 'true');
    this.insertBefore(this.#svg.el, fallback ? fallback.nextSibling : this.firstChild);
    const hasStill = !!fallback;
    // With a server still on screen, keep it until 3D is ready or the user moves the dial.
    this.#setMode(hasStill && this.#wants3D() ? 'still' : 'svg');

    this.#applyA11y();
    this.#lastEmit = this.#phys.theta;
    if (typeof pending.finish === 'string') this.finish = pending.finish as FinishId;
    if (typeof pending.profile === 'string') this.profile = pending.profile as ProfileId;
    if ('physics' in pending) this.physics = pending.physics as Partial<FeelPhysics> | null;
    if ('feelColor' in pending) this.feelColor = pending.feelColor as string | null;
    if ('valueText' in pending) this.valueText = pending.valueText as DetentDial['valueText'];
    if ('explode' in pending) this.explode = pending.explode as number;
    if ('angle' in pending) this.setAngle(pending.angle as number, { instant: true });
    this.addEventListener('keydown', this.#onKey);
    this.addEventListener('keyup', this.#onKeyUp);
    this.addEventListener('wheel', this.#onWheel, { passive: false });
    this.addEventListener('pointerenter', this.#onEnter);
    this.addEventListener('pointerleave', () => (this.#hover = false));
    this.addEventListener('focusin', () => {
      this.#intent();
      this.#lastRing = '';
      this.#invalidate();
    });
    this.addEventListener('focusout', () => this.removeAttribute('data-focus-by'));
    this.addEventListener('touchstart', this.#intent, { passive: true });
    window.addEventListener('pagehide', () => {
      cancelAnimationFrame(this.#raf);
      this.#raf = 0;
      this.#motion?.stop();
    });
    window.addEventListener('pageshow', (e) => {
      if (e.persisted) this.#invalidate();
    });
  }

  #observe() {
    this.#ro ??= new ResizeObserver((entries) => {
      const box = entries[entries.length - 1]!.contentRect;
      this.#resize(box.width, box.height);
    });
    this.#ro.observe(this);
    this.#io ??= new IntersectionObserver(
      (entries) => {
        const vis = entries[entries.length - 1]!.isIntersecting;
        const was = this.#inView;
        this.#inView = vis;
        if (vis && !was) {
          if (this.#bootState === 'waiting') this.#bootWhenIdle();
          if (this.#mode !== 'still') this.#startAuto();
          this.#invalidate();
        }
      },
      { rootMargin: '200px 0px' },
    );
    this.#io.observe(this);
  }

  #resize(w: number, h: number) {
    if (w < 1 || h < 1) return;
    this.#w = w;
    this.#h = h;
    this.#svg?.resize(w, h);
    this.#three?.resize(w, h, this.#dpr());
    this.#dirty = true;
    this.#invalidate();
  }

  #dpr() {
    const cap = this.getAttribute('quality') === 'high' ? 2 : lowTier() ? 1.5 : 2;
    return Math.max(0.75, Math.min(window.devicePixelRatio || 1, cap) * this.#govScale);
  }

  /* ------------------------------- physics/profile ------------------------------- */

  #profileData(): FeelProfile {
    return PROFILES.find((p) => p.id === this.profile) ?? PROFILES[0]!;
  }
  #finishData(): Finish {
    return FINISHES.find((f) => f.id === this.finish) ?? FINISHES[1]!;
  }
  #effectivePhysics(): FeelPhysics {
    const base = this.#profileData().physics;
    return this.#physicsOverride ? { ...base, ...this.#physicsOverride } : base;
  }
  #applyPhysics(initial = false) {
    const ph = this.#phys;
    const theta = ph.theta;
    // Tuning (strength, damping, accents) leaves a move in flight alone: a keypress or
    // setAngle() that is under way still lands. Only a new grid moves the knob.
    const regrid = ph.setParams(this.#effectivePhysics());
    const s = ph.p.stops;
    const w = ph.width;
    if (s && (theta < s[0] || theta > s[1])) {
      if (initial) ph.setInstant(Math.min(s[1], Math.max(s[0], theta)));
      else ph.moveTo(Math.min(s[1], Math.max(s[0], theta)));
    } else if (!initial && regrid && w) {
      // Land on the new grid: where the knob was heading, or where it is.
      ph.moveTo(w * Math.round((ph.goal ?? theta) / w));
    }
    const v = voiceFor(this.#voiceSource());
    if (this.#motionKind && this.#motionKind !== v) {
      this.#motion?.stop();
      this.#motion = null;
      this.#motionKind = null;
    }
    this.#applyA11y();
    this.#invalidate();
  }

  #cameraAttr(): CameraPreset {
    const v = this.getAttribute('camera') as CameraPreset | null;
    return v && CAMERA_PRESETS.includes(v) ? v : 'hero';
  }

  #setCamera(preset: CameraPreset, instant: boolean) {
    this.#rigFrom = { ...this.#rig };
    this.#rigTo = { ...PRESETS[preset] };
    this.#rigT = instant ? 1 : 0;
    if (instant) this.#rig = { ...this.#rigTo };
    if (!this.#explodeSet) {
      const to = preset === 'exploded' ? 1 : 0;
      if (to !== this.#explodeTo || this.#explode !== to) {
        this.#explodeFrom = this.#explode;
        this.#explodeTo = to;
        this.#explodeT = instant ? 1 : 0;
        if (instant) this.#explode = to;
      }
    }
    this.#invalidate();
  }

  /* ----------------------------------- a11y ----------------------------------- */

  /**
   * Write an aria attribute the engine owns, unless a page has written it itself
   * (its value is no longer the one we last set): then it is the page's for good,
   * and a delayed engine update never overwrites the page's words.
   */
  #aria(name: string, value: string) {
    const cur = this.getAttribute(name);
    const mine = this.#ariaMine.get(name);
    if (cur !== null && cur !== mine) this.#ariaPage.add(name);
    if (this.#ariaPage.has(name)) return;
    if (cur !== value) this.setAttribute(name, value);
    this.#ariaMine.set(name, value);
  }

  #applyA11y() {
    const interactive = this.hasAttribute('interactive');
    const label = this.getAttribute('label');
    if (interactive) {
      this.tabIndex = 0;
      this.setAttribute('role', 'slider');
      this.#aria('aria-label', label ?? `Detent dial, ${this.#profileData().name} feel`);
      if (!this.#ring) {
        this.#ring = document.createElement('div');
        this.#ring.className = 'dd-ring';
        this.#ring.setAttribute('aria-hidden', 'true');
        this.insertBefore(this.#ring, this.#hit);
        this.#lastRing = '';
      }
      if (!this.#hit) {
        this.#hit = document.createElement('div');
        this.#hit.className = 'dd-hit';
        this.#hit.setAttribute('aria-hidden', 'true');
        this.#hit.addEventListener('pointerdown', this.#onDown);
        this.#hit.addEventListener('pointermove', this.#onMove);
        this.#hit.addEventListener('pointerup', this.#onUp);
        this.#hit.addEventListener('pointercancel', this.#onCancel);
        this.#hit.addEventListener('lostpointercapture', this.#onCancel);
        this.appendChild(this.#hit);
        this.#lastHit = '';
      }
      this.#updateAria(true);
    } else {
      this.removeAttribute('tabindex');
      this.setAttribute('role', 'img');
      for (const a of ['aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext']) {
        this.removeAttribute(a);
        this.#ariaMine.delete(a);
        this.#ariaPage.delete(a);
      }
      this.#aria(
        'aria-label',
        label ?? `Detent One in ${this.#finishData().name}, ${this.#profileData().name} feel`,
      );
      this.#hit?.remove();
      this.#hit = null;
      this.#ring?.remove();
      this.#ring = null;
    }
  }

  /** The value a screen reader gets, at the knob's angle or at a destination it is heading to. */
  #valueState(theta = this.#phys.theta): DialValueState {
    const at = theta === this.#phys.theta ? this.#phys : this.#phys.describe(theta);
    return {
      angle: theta / DEG,
      value: at.value,
      index: at.index,
      profile: this.profile,
      physics: this.#effectivePhysics(),
      atStop: at.atStop,
    };
  }

  /**
   * aria-valuenow in the dial's own units, always inside min..max: the detent
   * (0..n-1, or the reachable range between stops), percent for a detentless
   * range, degrees for a free spin. Never a percentage that wraps at a detent.
   */
  #ariaRange(s: DialValueState): [number, number, number] {
    const p = this.#phys.p;
    const n = p.detents;
    if (n && p.stops) {
      const w = this.#phys.width;
      const lo = Math.ceil(p.stops[0] / w - 1e-6);
      const hi = Math.floor(p.stops[1] / w + 1e-6);
      return [lo, hi, Math.min(hi, Math.max(lo, s.index))];
    }
    if (n) return [0, n - 1, ((s.index % n) + n) % n];
    if (p.stops) return [0, 100, Math.round(s.value * 100)];
    return [0, 359, Math.round(s.value * 360) % 360];
  }

  #updateAria(force = false) {
    if (!this.hasAttribute('interactive')) return;
    const now = performance.now();
    clearTimeout(this.#ariaTimer);
    // A step announced its destination already: skip the frames in between.
    if (!force && this.#ariaGoal !== null) return;
    if (!force && now - this.#lastAriaAt < 250) {
      // ≤ 4 Hz while flicking; a trailing update lands the final value.
      this.#ariaTimer = window.setTimeout(() => this.#updateAria(true), 260);
      return;
    }
    this.#lastAriaAt = now;
    const s = this.#valueState(this.#ariaGoal ?? this.#phys.theta);
    const p = this.#phys;
    let words: string | undefined;
    try {
      words = this.#valueText?.(s);
    } catch {
      words = undefined;
    }
    words ??= readout({
      theta: s.angle * DEG,
      value: s.value,
      index: s.index,
      p: p.p,
      atStop: s.atStop,
    }).words;
    const [min, max, v] = this.#ariaRange(s);
    this.#aria('aria-valuemin', String(min));
    this.#aria('aria-valuemax', String(max));
    this.#aria('aria-valuenow', String(v));
    this.#aria('aria-valuetext', words);
  }

  /** Keys and wheel steps: say where the knob is going now, not ~0.3–1 s later. */
  #announceGoal() {
    const goal = this.#phys.goal;
    if (goal === null) return;
    this.#ariaGoal = goal;
    this.#updateAria(true);
  }

  /* --------------------------------- input --------------------------------- */

  #intent = () => {
    if (this.#bootState === 'waiting' || this.#bootState === 'idle') this.#boot();
  };

  #onEnter = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') this.#hover = true;
    this.#intent();
  };

  /** The knob under a pointer, in the renderer that is on screen (the SVG while the still shows). */
  #grip(e: PointerEvent): KnobGrip | null {
    const r = this.getBoundingClientRect();
    return (this.#activeView() ?? this.#svg)?.grip(e.clientX - r.left, e.clientY - r.top) ?? null;
  }

  #onDown = (e: PointerEvent) => {
    if (!this.hasAttribute('interactive') || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    // Focus for the keyboard, without the keyboard's focus ring: a hand on the knob
    // doesn't need a ring drawn around it (the flag covers browsers without the option).
    this.dataset.focusBy = 'pointer';
    this.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
    try {
      this.#hit!.setPointerCapture(e.pointerId);
    } catch {
      /* capture can fail on synthetic events; dragging still works while over the knob */
    }
    unlockAudio();
    this.#userDriven = true;
    this.#ariaGoal = null;
    this.#phys.grab();
    this.#autoT = -1;
    const now = e.timeStamp || performance.now();
    const g = this.#grip(e);
    // Grabbed below the top face: push the knurl sideways, the way a hand turns a knob
    // by its side. On the face: turn around the axis, like a fingertip on top.
    const mode = g?.side ? 'side' : 'face';
    this.#pointer = {
      id: e.pointerId,
      mode,
      a: g && mode === 'face' && g.r >= DEAD_ZONE && Number.isFinite(g.r) ? g.a : NaN,
      x: e.clientX,
      t0: now,
      x0: e.clientX,
      y0: e.clientY,
      moved: false,
      start: this.#phys.theta,
      samples: [{ t: now, a: this.#phys.theta }],
      lastT: now,
    };
    this.#pressTarget = 1;
    this.toggleAttribute('data-grabbed', true);
    this.#emit('detent:grab', {});
    this.#ensureLive();
    this.#invalidate();
  };

  /** How far a pointer sample turns the knob (rad); 0 while it crosses the axis. */
  #dragDelta(ptr: PointerState, ev: PointerEvent): number {
    const g = this.#grip(ev);
    if (!g) return 0;
    if (ptr.mode === 'side') {
      // Pushing the front of the knurl to the right turns the knob counterclockwise.
      const d = -(ev.clientX - ptr.x) / g.rpx;
      ptr.x = ev.clientX;
      return d;
    }
    // Near the axis the angle is meaningless (it flips by up to 180° as a thumb crosses
    // the display): hold still, then pick up again from wherever the finger leaves it.
    if (!Number.isFinite(g.r) || g.r < DEAD_ZONE) {
      ptr.a = NaN;
      return 0;
    }
    if (Number.isNaN(ptr.a)) {
      ptr.a = g.a;
      return 0;
    }
    let d = g.a - ptr.a;
    d -= Math.PI * 2 * Math.round(d / (Math.PI * 2));
    ptr.a = g.a;
    return d;
  }

  #onMove = (e: PointerEvent) => {
    const ptr = this.#pointer;
    if (!ptr || e.pointerId !== ptr.id) return;
    const list = e.getCoalescedEvents?.() ?? [];
    for (const ev of list.length ? list : [e]) {
      const d = this.#dragDelta(ptr, ev);
      const t = ev.timeStamp || performance.now();
      this.#phys.drag(d, Math.max(0.001, (t - ptr.lastT) / 1000));
      ptr.lastT = t;
      ptr.samples.push({ t, a: this.#phys.target });
    }
    const now = ptr.lastT;
    while (ptr.samples.length > 2 && now - ptr.samples[0]!.t > 140) ptr.samples.shift();
    if (
      !ptr.moved &&
      (Math.abs(this.#phys.target - ptr.start) > 3 * DEG ||
        Math.hypot(e.clientX - ptr.x0, e.clientY - ptr.y0) > 8)
    ) {
      ptr.moved = true;
      this.#pressTarget = 0;
    }
    this.#invalidate();
  };

  #onUp = (e: PointerEvent) => {
    const ptr = this.#pointer;
    if (!ptr || e.pointerId !== ptr.id) return;
    this.#pointer = null;
    const now = e.timeStamp || performance.now();
    this.#phys.release(ptr.moved ? fitVelocity(ptr.samples, now) : 0);
    this.#pressTarget = 0;
    this.removeAttribute('data-grabbed');
    if (!ptr.moved) {
      const held = now - ptr.t0;
      this.#pressFeedback(held < 350 ? 1 : held < 900 ? 2 : 3);
      if (e.pointerType !== 'mouse') hapticTap('accent');
    }
    this.#emit('detent:release', {});
    this.#afterRelease();
  };

  #onCancel = (e: PointerEvent) => {
    const ptr = this.#pointer;
    if (!ptr || e.pointerId !== ptr.id) return;
    this.#pointer = null;
    this.#phys.release(0);
    this.#pressTarget = 0;
    this.removeAttribute('data-grabbed');
    this.#emit('detent:release', {});
    this.#afterRelease();
  };

  #afterRelease() {
    // 3D finished loading mid-drag: swap renderers now that the knob is out of the hand.
    if (this.#threeWaiting) this.#useThree();
    this.#invalidate();
  }

  #pressFeedback(level: 1 | 2 | 3) {
    this.#press = Math.max(this.#press, 1);
    this.#pressTarget = 0;
    this.#emit('detent:press', { level });
    if (!this.hasAttribute('muted'))
      playTick(this.#voiceSource(), {
        kind: level > 1 ? 'accent' : 'detent',
        velocity: 200,
        gain: 0.8,
      });
    this.#invalidate();
  }

  #onKey = (e: KeyboardEvent) => {
    // The keyboard is in use: from here on focus shows its ring.
    if (document.activeElement === this) this.dataset.focusBy = 'key';
    if (!this.hasAttribute('interactive') || e.altKey || e.ctrlKey || e.metaKey) return;
    const steps: Record<string, number> = {
      ArrowRight: 1,
      ArrowUp: 1,
      ArrowLeft: -1,
      ArrowDown: -1,
      PageUp: 4,
      PageDown: -4,
    };
    const p = this.#phys.p;
    if (e.key in steps) {
      e.preventDefault();
      unlockAudio();
      this.#userDriven = true;
      this.#step(steps[e.key]!, true);
    } else if (e.key === 'Home' || e.key === 'End') {
      if (!p.stops && e.key === 'End') return;
      e.preventDefault();
      this.#userDriven = true;
      const turn = Math.PI * 2;
      const to = p.stops
        ? e.key === 'Home'
          ? p.stops[0]
          : p.stops[1]
        : turn * Math.round(this.#phys.theta / turn);
      this.#ensureLive();
      this.#phys.moveTo(to);
      this.#announceGoal();
      this.#invalidate();
    } else if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
      e.preventDefault();
      unlockAudio();
      this.#keyDownAt = performance.now();
      this.#pressTarget = 1;
      this.#invalidate();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
    }
  };

  #onKeyUp = (e: KeyboardEvent) => {
    if (!this.#keyDownAt || (e.key !== 'Enter' && e.key !== ' ')) return;
    const held = performance.now() - this.#keyDownAt;
    this.#keyDownAt = 0;
    this.#pressFeedback(held < 350 ? 1 : held < 900 ? 2 : 3);
  };

  #onWheel = (e: WheelEvent) => {
    if (!this.hasAttribute('interactive')) return;
    const engaged = this.#hover && (document.activeElement === this || this.#phys.grabbed);
    if (!engaged) return;
    const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const d = (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * scale;
    if (!d) return;
    const p = this.#phys.p;
    const at = this.#phys.atStop;
    // At an end stop, let the page scroll on instead of trapping the wheel.
    if ((d > 0 && at === 'max') || (d < 0 && at === 'min')) return;
    e.preventDefault();
    unlockAudio();
    this.#userDriven = true;
    this.#ensureLive();
    if (!p.detents && !p.stops && !p.snaps.length && !p.spring) {
      this.#phys.impulse(d * 0.035);
    } else if (!p.detents && !p.snaps.length) {
      this.#phys.moveBy(d * 0.12 * DEG, 90);
    } else {
      this.#wheelAcc += d;
      const unit = p.snaps.length ? 70 : 42;
      while (Math.abs(this.#wheelAcc) >= unit) {
        const s = Math.sign(this.#wheelAcc);
        this.#wheelAcc -= s * unit;
        this.#step(s, true);
      }
    }
    this.#invalidate();
  };

  /** Turn by n steps: detents, snap points, or a 5% slice of a bounded range. */
  #step(n: number, user: boolean) {
    if (!n) return;
    this.#userDriven = user;
    this.#ensureLive();
    const ph = this.#phys;
    const p = ph.p;
    if (p.snaps.length && !p.detents) {
      // Chained presses continue from where the last one is heading.
      let theta = ph.goal ?? ph.theta;
      const dir = Math.sign(n);
      for (let k = 0; k < Math.abs(n); k++) {
        let best = Infinity;
        for (const s of p.snaps) {
          const base = p.stops ? s : s + Math.PI * 2 * Math.round((theta - s) / (Math.PI * 2));
          for (const c of p.stops ? [base] : [base - Math.PI * 2, base, base + Math.PI * 2]) {
            const d = (c - theta) * dir;
            if (d > 1.5 * DEG && d < best) best = d;
          }
        }
        if (best === Infinity) break;
        theta += best * dir;
      }
      ph.moveTo(theta);
    } else {
      const at = ph.atStop;
      if (p.stops && ((n > 0 && at === 'max') || (n < 0 && at === 'min'))) {
        // Already against the wall: say so.
        this.#tick({ kind: 'stop', index: n > 0 ? 1 : 0, theta: ph.theta, omega: 0, accent: true });
      } else {
        ph.moveBy(n * ph.stepSize);
      }
    }
    this.#announceGoal();
    this.#invalidate();
  }

  /* --------------------------------- output --------------------------------- */

  #emit<T>(type: string, detail: T) {
    this.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
  }

  #voiceSource() {
    return this.#physicsOverride ? this.#effectivePhysics() : this.profile;
  }

  #tick(ev: PhysicsEvent) {
    const kind: TickKind = ev.kind;
    this.#emit('detent:tick', {
      index: ev.index,
      angle: ev.theta / DEG,
      profile: this.profile,
      velocity: ev.omega / DEG,
      accent: ev.accent,
      kind,
    });
    if (this.hasAttribute('muted')) return;
    const strength = this.#phys.p.strength;
    playTick(this.#voiceSource(), {
      kind,
      velocity: ev.omega / DEG,
      gain: kind === 'detent' ? 0.55 + 0.45 * strength : 1,
    });
    if (this.#userDriven) haptic(kind, strength);
  }

  #updateMotionVoice() {
    if (this.hasAttribute('muted')) return;
    const v = voiceFor(this.#voiceSource());
    const kind = v === 'fluid' || v === 'spring' ? v : null;
    if (!kind) return;
    if (this.#motionKind !== kind) {
      this.#motion?.stop();
      this.#motion = createMotionVoice(kind);
      this.#motionKind = kind;
    }
    const p = this.#phys;
    const lim = p.p.stops ? Math.max(Math.abs(p.p.stops[0]), Math.abs(p.p.stops[1])) : Math.PI;
    this.#motion!.update(p.omega, Math.min(1, Math.abs(p.theta) / lim));
  }

  /* ---------------------------------- loop ---------------------------------- */

  #isAnimating(): boolean {
    return (
      this.#phys.active ||
      this.#rigT < 1 ||
      this.#explodeT < 1 ||
      this.#autoT >= 0 ||
      Math.abs(this.#press - this.#pressTarget) > 0.004
    );
  }

  #invalidate() {
    this.#dirty = true;
    if (!this.#raf && this.isConnected && this.#init) {
      this.#lastT = performance.now();
      this.#raf = requestAnimationFrame(this.#frame);
    }
  }

  #frame = (now: number) => {
    this.#raf = 0;
    const dt = Math.min(0.05, Math.max(0, (now - this.#lastT) / 1000));
    this.#lastT = now;
    const reduced = isReduced();

    const events = this.#phys.advance(dt);

    if (this.#rigT < 1) {
      this.#rigT = reduced ? 1 : Math.min(1, this.#rigT + dt / 0.9);
      this.#rig = lerpRig(this.#rigFrom, this.#rigTo, easeInOut(this.#rigT));
    }
    if (this.#explodeT < 1) {
      this.#explodeT = reduced ? 1 : Math.min(1, this.#explodeT + dt / 1.4);
      this.#explode = this.#explodeFrom + (this.#explodeTo - this.#explodeFrom) * this.#explodeT;
    }
    if (this.#autoT >= 0) {
      if (reduced || this.#phys.grabbed) this.#autoT = -1;
      else {
        // Wall-clock, not frame time: the 5 s limit holds even on slow devices.
        this.#autoT = (now - this.#autoStart) / 1000;
        if (this.#autoT >= AUTO_SECONDS) this.#autoT = -1;
      }
    }
    const k = reduced ? 1 : Math.min(1, dt * (this.#pressTarget > this.#press ? 28 : 9));
    this.#press += (this.#pressTarget - this.#press) * k;
    if (Math.abs(this.#press - this.#pressTarget) < 0.004) this.#press = this.#pressTarget;

    for (const ev of events) this.#tick(ev);

    const theta = this.#phys.theta;
    const moved = theta !== this.#lastEmit;
    if (moved) {
      this.#lastEmit = theta;
      this.#movedSinceSettle = true;
      const value = this.#phys.value;
      this.style.setProperty('--dial-value', value.toFixed(4));
      this.style.setProperty('--dial-turn', (theta / (Math.PI * 2)).toFixed(4));
      this.#emit('detent:change', {
        angle: theta / DEG,
        value,
        profile: this.profile,
        velocity: this.#phys.omega / DEG,
        index: this.#phys.index,
      });
      this.#updateAria();
      this.#updateMotionVoice();
    }

    const animating = this.#isAnimating();
    if (this.#mode === 'still' && (moved || this.#rigT < 1 || this.#explodeT < 1))
      this.#setMode('svg');
    if (this.#dirty || moved || animating) {
      if (this.#inView || this.#phys.grabbed) {
        this.#draw();
        this.#dirty = false;
        this.#govern(dt);
      }
    }

    if (animating && (this.#inView || this.#phys.grabbed)) {
      this.#raf = requestAnimationFrame(this.#frame);
    } else if (!animating) {
      this.#settle();
    }
  };

  #settle() {
    this.#frames.length = 0;
    this.#motion?.update(0, 0);
    const announced = this.#ariaGoal !== null;
    this.#ariaGoal = null;
    if (announced && !this.#movedSinceSettle) this.#updateAria(true);
    if (this.#movedSinceSettle) {
      this.#movedSinceSettle = false;
      this.#updateAria(true);
      this.#emit('detent:settle', {
        angle: this.#phys.theta / DEG,
        value: this.#phys.value,
        profile: this.profile,
      });
    }
    const w = this.#settleWaiters;
    this.#settleWaiters = [];
    w.forEach((r) => r());
  }

  #state(): ViewState {
    const ph = this.#phys;
    const prof = this.#profileData();
    const r = readout({
      theta: ph.theta,
      value: ph.value,
      index: ph.index,
      p: ph.p,
      atStop: ph.atStop,
    });
    const disp = this.getAttribute('display');
    const snap = nearestSnap(ph.theta, ph.p);
    let rig = this.#rig;
    if (this.#autoT >= 0) {
      const t = this.#autoT / AUTO_SECONDS;
      rig = {
        ...rig,
        az: rig.az + this.#autoDir * AUTO_DEGREES * 0.5 * (1 - Math.cos(t * Math.PI * 2)),
      };
    }
    return {
      theta: ph.theta,
      explode: this.#explode,
      finish: this.#finishData(),
      color: this.#feelColor ?? prof.color,
      name: prof.name,
      p: ph.p,
      value: ph.value,
      index: ph.index,
      text: disp ? disp.slice(0, 10) : r.text,
      sub: r.sub,
      rig: explodeRig(rig, this.#explode),
      press: this.#press,
      snap: snap && snap.d < 2.5 * DEG ? snap.i : -1,
    };
  }

  #activeView(): DialView | null {
    return this.#mode === 'webgl2' ? this.#three : this.#svg;
  }

  #draw() {
    if (this.#w < 1) return;
    const s = this.#state();
    const view = this.#activeView();
    // In 'still' mode the (invisible) SVG still runs: it supplies the hit circle.
    view?.draw(s);
    this.#placeHit();
  }

  #placeHit() {
    if (!this.#hit) return;
    const view = this.#mode === 'webgl2' ? this.#three : this.#svg;
    const c = view?.knobCircle();
    if (!c) return;
    const r = Math.max(22, c.r * 1.02); // ≥ 44 px target
    const key = `${Math.round(c.x * 2)}|${Math.round(c.y * 2)}|${Math.round(r * 2)}`;
    if (key !== this.#lastHit) {
      this.#lastHit = key;
      const st = this.#hit.style;
      st.width = st.height = `${(2 * r).toFixed(1)}px`;
      st.transform = `translate(${(c.x - r).toFixed(1)}px, ${(c.y - r).toFixed(1)}px)`;
    }
    // The focus ring hugs the whole product (base to glass), so it never cuts across it.
    if (!this.#ring || document.activeElement !== this) return;
    const o = view?.outline();
    if (!o) return;
    const ring = `${Math.round(o.x)}|${Math.round(o.y)}|${Math.round(o.rx)}|${Math.round(o.ry)}`;
    if (ring === this.#lastRing) return;
    this.#lastRing = ring;
    const st = this.#ring.style;
    st.width = `${(2 * o.rx).toFixed(1)}px`;
    st.height = `${(2 * o.ry).toFixed(1)}px`;
    st.transform = `translate(${(o.x - o.rx).toFixed(1)}px, ${(o.y - o.ry).toFixed(1)}px)`;
  }

  #pendingCamera: CameraPreset | null = null;

  #setMode(mode: Mode) {
    this.#mode = mode;
    if (mode !== 'still' && this.#pendingCamera) {
      const cam = this.#pendingCamera;
      this.#pendingCamera = null;
      this.#setCamera(cam, isReduced());
    }
    const kind: RendererKind = mode === 'still' ? 'none' : mode;
    this.dataset.renderer = kind;
    this.#lastHit = '';
    this.#lastRing = '';
    if (kind !== this.#kind) {
      this.#kind = kind;
      if (kind !== 'none') this.#emit('detent:ready', { renderer: kind });
    }
  }

  /** The user (or page) is moving the dial while the still shows: go live in SVG now. */
  #ensureLive() {
    if (this.#mode === 'still') this.#setMode('svg');
    this.#intent();
  }

  /** Performance governor: step DPR down on slow frames, give up on 3D if hopeless. */
  #govern(dt: number) {
    if (this.#mode !== 'webgl2' || this.getAttribute('quality') === 'high') return;
    this.#frames.push(dt);
    if (this.#frames.length < 30) return;
    const sorted = [...this.#frames].sort((a, b) => a - b);
    const median = sorted[15]!;
    this.#frames.length = 0;
    if (median > 0.05 && this.#govScale > 0.6) {
      this.#govScale -= 0.2;
      this.#three?.resize(this.#w, this.#h, this.#dpr());
    } else if (median > 0.1) {
      this.#fallbackToSvg(false);
    }
  }

  /* ----------------------------------- 3D ----------------------------------- */

  #wants3D(): boolean {
    const q = this.getAttribute('quality');
    if (q === 'low') return false;
    if (typeof WebGL2RenderingContext === 'undefined') return false;
    if (q !== 'high') {
      const nav = navigator as Navigator & {
        connection?: { saveData?: boolean };
        deviceMemory?: number;
      };
      if (nav.connection?.saveData) return false;
      if (nav.deviceMemory && nav.deviceMemory < 2) return false;
      // No GPU (WebGL off, blocklisted, or drawn in software): the SVG is the better dial,
      // and three.js is never downloaded.
      if (!hardwareGL()) return false;
    }
    return true;
  }

  /** Low-end devices boot 3D only when someone reaches for the dial or it is half in view. */
  #patient(): boolean {
    return lowTier() && this.getAttribute('quality') !== 'high';
  }

  #watchHalf() {
    if (this.#half) return;
    this.#half = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.intersectionRatio >= 0.5)) return;
        this.#half?.disconnect();
        this.#half = null;
        whenIdle(() => this.#boot());
      },
      { threshold: 0.5 },
    );
    this.#half.observe(this);
  }

  #scheduleBoot() {
    if (!this.#wants3D()) {
      if (this.#mode === 'still') this.#setMode('svg');
      return;
    }
    if (this.#bootState !== 'idle' && this.#bootState !== 'waiting') {
      if (this.#bootState === 'done' && this.#three && this.#mode !== 'webgl2') this.#useThree();
      return;
    }
    if (this.getAttribute('loading') === 'eager') {
      this.#boot();
      return;
    }
    this.#bootState = 'waiting';
    if (this.#patient()) this.#watchHalf();
    else if (this.#inView) this.#bootWhenIdle();
  }

  #bootWhenIdle() {
    if (this.#patient()) return;
    whenLoaded(() => whenIdle(() => this.#boot()));
  }

  #boot = async () => {
    if (this.#bootState === 'loading' || this.#bootState === 'done' || this.#bootState === 'failed')
      return;
    const doc = document as Document & { prerendering?: boolean };
    if (doc.prerendering || !this.#wants3D()) return;
    this.#half?.disconnect();
    this.#half = null;
    this.#bootState = 'loading';
    try {
      const mod = await loadThree();
      if (!this.isConnected || !this.#wants3D()) {
        this.#bootState = 'idle';
        return;
      }
      if (mod.contextLosses() > 2) throw new Error('gpu unstable');
      const view = await mod.createThreeView({ antialias: !lowTier() }, this.#state());
      if (!view) throw new Error('no webgl2');
      this.#three = view;
      view.onLost = () => this.#fallbackToSvg(true);
      view.onRestored = () => {
        if (mod.contextLosses() <= 2 && this.#wants3D()) this.#useThree();
      };
      this.#bootState = 'done';
      this.#useThree();
    } catch {
      this.#bootState = 'failed';
      if (this.#mode === 'still' && this.hasAttribute('interactive')) this.#setMode('svg');
    }
  };

  #useThree() {
    const v = this.#three;
    if (!v) return;
    // Never swap models under a finger mid-drag: the SVG and 3D grip geometry differ.
    this.#threeWaiting = this.#phys.grabbed;
    if (this.#threeWaiting) return;
    if (!v.el.isConnected) this.insertBefore(v.el, this.#ring ?? this.#hit);
    v.resize(this.#w || this.clientWidth, this.#h || this.clientHeight, this.#dpr());
    v.draw(this.#state());
    // Let the first 3D frame reach the screen at opacity 0, then crossfade.
    requestAnimationFrame(() => {
      if (!this.#three || !this.isConnected) return;
      if (this.#phys.grabbed) {
        this.#threeWaiting = true;
        return;
      }
      this.#setMode('webgl2');
      this.#startAuto();
      this.#invalidate();
    });
  }

  #fallbackToSvg(recoverable: boolean) {
    if (!recoverable) {
      this.#three?.dispose();
      this.#three = null;
      this.#bootState = this.getAttribute('quality') === 'low' ? 'idle' : 'failed';
    }
    if (this.#mode !== 'svg') this.#setMode('svg');
    this.#invalidate();
  }

  #startAuto() {
    if (!this.hasAttribute('autorotate') || isReduced() || !this.#inView || this.#autoT >= 0)
      return;
    if (this.#phys.grabbed || document.activeElement === this) return;
    this.#autoDir = -this.#autoDir;
    this.#autoT = 0;
    this.#autoStart = performance.now();
    this.#invalidate();
  }
}

if (typeof window !== 'undefined' && !customElements.get('detent-dial'))
  customElements.define('detent-dial', DetentDial);

export {};
