/**
 * SVG renderer: Detent One drawn from the same millimetre model the 3D
 * renderer uses, with the same camera (elevation, azimuth, distance and its
 * perspective: each level is scaled by its depth, so the knob top reads larger
 * than the base exactly as in 3D and the SVG → 3D crossfade doesn't jump). It
 * follows the explode choreography, the diamond knurl turning with the knob and
 * a live round display. Used before three.js loads, for quality="low", without
 * a GPU, and after a lost GPU context. No dependencies.
 */
import { MM, FOV, PARTS, TYPE, partLift, partProgress, readoutSize } from './model';
import { mix, shade } from './color';
import type { DialPartAnchor } from './types';
import {
  enclose,
  hullRings,
  type DialView,
  type Ellipse,
  type KnobCircle,
  type KnobGrip,
  type ViewState,
} from './view';

const NS = 'http://www.w3.org/2000/svg';
const DEG = Math.PI / 180;
const VIEW_K = 2 * Math.tan((FOV / 2) * DEG);
/** Diamond knurl, as in 3D (MM.knurlTeeth lines, 12 rows); drawn every other tooth. */
const KNURL_TEETH = MM.knurlTeeth;
const KNURL_DRAWN = Math.round(KNURL_TEETH / 2);
const CHAMFER = '#e4e4e2';
/**
 * Radius (mm) of the desk-glow ellipse. The day glow is a small ellipse of its own:
 * perspective shifts a projected circle's centre with its radius, so on the 64 mm one
 * the base's front edge sits at 0.4 of the gradient and its sides at 0.56, and no
 * set of stops can hug the foot all round.
 */
const GLOW_R = { night: 64, day: 43 } as const;
let uid = 0;

type Attrs = Record<string, string | number>;
function node<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  parent?: Element,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  parent?.appendChild(el);
  return el;
}
const set = (el: Element, attrs: Attrs) => {
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
};
const f2 = (n: number) => (Math.round(n * 100) / 100).toString();

export class SvgView implements DialView {
  readonly kind = 'svg' as const;
  readonly el: SVGSVGElement;
  private id = `dd${++uid}`;
  private w = 1;
  private h = 1;
  private vb = { x: -60, y: -60, s: 120 };
  private sinE = 0.5;
  private cosE = 0.86;
  private az = 0;
  /** Camera distance (mm) and target height, for perspective. */
  private D = 236;
  private ty = 21;
  private lift: Record<string, number> = {};
  private geoKey = '';
  private finishKey = '';
  private colorKey = '';
  private scaleKey = '';
  private textKey = '';
  private n: Record<string, SVGElement> = {};
  private stops: Record<string, SVGStopElement[]> = {};
  private seat = 0;
  private explode = 0;

  constructor() {
    const svg = node('svg', {
      class: 'dd-layer dd-svg',
      'aria-hidden': 'true',
      focusable: 'false',
      preserveAspectRatio: 'xMidYMid meet',
    });
    this.el = svg;
    const defs = node('defs', {}, svg);
    const grad = (
      name: string,
      kind: 'linearGradient' | 'radialGradient',
      attrs: Attrs,
      count: number,
    ) => {
      const g = node(kind, { id: `${this.id}-${name}`, ...attrs }, defs);
      this.stops[name] = Array.from({ length: count }, () => node('stop', {}, g));
    };
    grad('side', 'linearGradient', { x1: 0, x2: 1, y1: 0, y2: 0 }, 7);
    grad('knurl', 'linearGradient', { x1: 0, x2: 1, y1: 0, y2: 0 }, 5);
    grad('chamfer', 'linearGradient', { x1: 0, x2: 1, y1: 0, y2: 0 }, 4);
    grad('top', 'radialGradient', { cx: 0.36, cy: 0.28, r: 0.85 }, 3);
    grad('glow', 'radialGradient', { cx: 0.5, cy: 0.5, r: 0.5 }, 4);
    grad('shadow', 'radialGradient', { cx: 0.5, cy: 0.5, r: 0.5 }, 3);
    grad('copper', 'linearGradient', { x1: 0, x2: 1, y1: 0, y2: 0 }, 3);
    grad('batt', 'linearGradient', { x1: 0, x2: 1, y1: 0, y2: 0 }, 3);
    this.paintStatic();

    const g = (name: string, parent: Element = svg) =>
      (this.n[name] = node('g', { class: name }, parent));
    const p = (name: string, parent: Element, attrs: Attrs = {}) =>
      (this.n[name] = node('path', attrs, parent));
    const e = (name: string, parent: Element, attrs: Attrs = {}) =>
      (this.n[name] = node('ellipse', attrs, parent));
    const url = (name: string) => `url(#${this.id}-${name})`;

    // Ground: contact shadow and the halo's light on the desk.
    const ground = g('ground');
    e('shadow', ground, { fill: url('shadow') });
    e('glow', ground, { fill: url('glow') });

    const foot = g('foot');
    p('footSide', foot, { fill: '#141214' });

    const base = g('base');
    p('baseSide', base, { fill: url('side') });
    p('slotShadow', base, { fill: '#0b0a0b' });
    p('slot', base, {});
    p('baseChamfer', base, { fill: url('chamfer'), 'fill-rule': 'evenodd' });
    e('baseTop', base, { fill: url('side') });
    e('baseWell', base, { fill: '#0c0b0c' });

    // Internals, only visible while exploded.
    const inner = g('inner');
    p('battSide', inner, { fill: url('batt') });
    e('battTop', inner, { fill: '#aab4be' });
    e('battLabel', inner, { fill: 'none', stroke: '#5b6672', 'stroke-width': 0.5 });
    p('pcbSide', inner, { fill: '#0e1511' });
    e('pcbTop', inner, { fill: '#18221c' });
    const pcbFace = g('pcbFace', inner);
    for (let i = 0; i < 24; i++)
      node(
        'rect',
        {
          x: -0.9,
          y: -25.2,
          width: 1.8,
          height: 1.3,
          rx: 0.2,
          fill: '#f2efe6',
          transform: `rotate(${i * 15})`,
        },
        pcbFace,
      );
    node('rect', { x: -3, y: -3, width: 6, height: 6, rx: 0.4, fill: '#050505' }, pcbFace);
    node('rect', { x: -4.6, y: 21, width: 9.2, height: 4, rx: 1.2, fill: '#b9bcc0' }, pcbFace);
    p('statorSide', inner, { fill: url('copper') });
    e('statorTop', inner, { fill: '#2b2b2f' });
    const statorFace = g('statorFace', inner);
    for (let i = 0; i < 12; i++)
      node(
        'path',
        {
          d: 'M-2.6 -16.8 L2.6 -16.8 L1.7 -7.2 L-1.7 -7.2 Z',
          fill: '#c9773f',
          transform: `rotate(${i * 30})`,
        },
        statorFace,
      );
    node('circle', { r: 5.2, fill: '#6e6f74' }, statorFace);
    p('rotorSide', inner, { fill: '#232225' });
    p('rotorStripes', inner, { fill: 'none', stroke: '#8d8f96', 'stroke-width': 0.9 });
    e('rotorTop', inner, { fill: '#303034' });
    e('rotorHole', inner, { fill: '#0b0b0c' });

    const knob = g('knob');
    p('knobLower', knob, { fill: url('side') });
    p('knurlSide', knob, { fill: url('knurl') });
    p('knurlDark', knob, { fill: 'none', 'stroke-width': 0.42, 'stroke-linecap': 'butt' });
    p('knurlLight', knob, { fill: 'none', 'stroke-width': 0.28, 'stroke-linecap': 'butt' });
    p('knobUpper', knob, { fill: url('side') });
    p('knobChamfer', knob, { fill: url('chamfer'), 'fill-rule': 'evenodd' });
    const face = g('face', knob);
    node('circle', { r: MM.knobR - MM.knobChamfer, fill: url('top') }, face);
    for (const [r, o, c] of [
      [27.1, 0.18, '#fff'],
      [25.2, 0.28, '#000'],
      [24.9, 0.22, '#fff'],
      [23.2, 0.12, '#000'],
      [21.4, 0.16, '#fff'],
    ] as const)
      node(
        'circle',
        { r, fill: 'none', stroke: c, 'stroke-opacity': o, 'stroke-width': 0.3 },
        face,
      );
    node(
      'circle',
      { r: 20.6, fill: 'none', stroke: CHAMFER, 'stroke-opacity': 0.8, 'stroke-width': 0.9 },
      face,
    );
    node('circle', { r: MM.boreR, fill: '#050405' }, face);
    // The tally line in its dark engraved groove (matches the 3D inlay).
    node(
      'line',
      {
        x1: 0,
        x2: 0,
        y1: -26.1,
        y2: -27.3,
        'stroke-width': 1.85,
        'stroke-linecap': 'round',
        stroke: '#030303',
      },
      face,
    );
    this.n.indicator = node(
      'line',
      { x1: 0, x2: 0, y1: -26.1, y2: -27.3, 'stroke-width': 1.25, 'stroke-linecap': 'round' },
      face,
    );

    const disp = g('display');
    p('hubSide', disp, { fill: '#0a0909' });
    const screen = g('screen', disp);
    node('circle', { r: MM.hubR, fill: '#0d0c0d' }, screen);
    node('circle', { r: MM.displayR, fill: '#020202' }, screen);
    this.n.scale = node('path', { fill: 'none', 'stroke-linecap': 'round' }, screen);
    this.n.lit = node(
      'path',
      { d: 'M0 -16.9 L0 -14.2', fill: 'none', 'stroke-linecap': 'round' },
      screen,
    );
    this.n.track = node(
      'path',
      {
        fill: 'none',
        'stroke-linecap': 'round',
        'stroke-width': 1.1,
        stroke: '#fff',
        'stroke-opacity': 0.14,
      },
      screen,
    );
    this.n.fill = node(
      'path',
      { fill: 'none', 'stroke-linecap': 'round', 'stroke-width': 1.1 },
      screen,
    );
    this.n.snaps = node('g', {}, screen);
    this.n.marker = node(
      'line',
      { x1: 0, x2: 0, y1: -17, y2: -14.8, 'stroke-width': 0.9, 'stroke-linecap': 'round' },
      screen,
    );
    this.n.name = node(
      'text',
      {
        y: TYPE.nameY,
        'text-anchor': 'middle',
        'font-size': TYPE.name,
        'font-weight': 720,
        'letter-spacing': 0.3,
        style: 'font-family: var(--font-sans); font-stretch: 125%',
      },
      screen,
    );
    this.n.text = node(
      'text',
      {
        y: TYPE.textY,
        'text-anchor': 'middle',
        'font-size': TYPE.text,
        'font-weight': 640,
        fill: '#f4f1f2',
        style:
          'font-family: var(--font-sans); font-stretch: 125%; font-variant-numeric: tabular-nums',
      },
      screen,
    );
    this.n.sub = node(
      'text',
      {
        y: TYPE.subY,
        'text-anchor': 'middle',
        'font-size': TYPE.sub,
        'font-weight': 450,
        fill: '#f4f1f2',
        'fill-opacity': 0.6,
        'letter-spacing': 0.18,
        style: 'font-family: var(--font-mono)',
      },
      screen,
    );
    this.n.flash = node(
      'circle',
      { r: 17.6, fill: 'none', 'stroke-width': 0.8, opacity: 0 },
      screen,
    );
    // Glass reflection: a soft crescent, upper left.
    node(
      'path',
      {
        d: 'M -15.5 -7 A 17 17 0 0 1 4 -16.8 A 19 19 0 0 0 -15.5 -7 Z',
        fill: '#fff',
        'fill-opacity': 0.09,
      },
      screen,
    );
    document.fonts?.addEventListener?.('loadingdone', this.fitText);
  }

  /** Colors that never change (chamfer, shadow, internals). */
  private paintStatic() {
    const stop = (name: string, list: [number, string, number?][]) =>
      list.forEach(([o, c, a], i) =>
        set(this.stops[name]![i]!, { offset: o, 'stop-color': c, 'stop-opacity': a ?? 1 }),
      );
    stop('chamfer', [
      [0, '#8d8d8b'],
      [0.3, '#fbfbf9'],
      [0.7, '#b9b9b6'],
      [1, '#6d6d6b'],
    ]);
    stop('shadow', [
      [0, '#000', 0.62],
      [0.62, '#000', 0.34],
      [1, '#000', 0],
    ]);
    stop('copper', [
      [0, '#6a3518'],
      [0.35, '#e0975e'],
      [1, '#5a2c14'],
    ]);
    stop('batt', [
      [0, '#4c5660'],
      [0.35, '#c3ccd5'],
      [1, '#3b444d'],
    ]);
  }

  private paintFinish(s: ViewState) {
    const b = s.finish.body;
    const stop = (name: string, list: [number, string][]) =>
      list.forEach(([o, c], i) => set(this.stops[name]![i]!, { offset: o, 'stop-color': c }));
    stop('side', [
      [0, shade(b, -0.62)],
      [0.1, shade(b, -0.25)],
      [0.3, shade(b, 0.36)],
      [0.42, shade(b, 0.06)],
      [0.66, shade(b, -0.32)],
      [0.88, shade(b, 0.14)],
      [1, shade(b, -0.55)],
    ]);
    stop('knurl', [
      [0, shade(b, -0.7)],
      [0.3, shade(b, 0.1)],
      [0.5, shade(b, -0.2)],
      [0.86, shade(b, -0.05)],
      [1, shade(b, -0.66)],
    ]);
    stop('top', [
      [0, shade(b, 0.34)],
      [0.55, b],
      [1, shade(b, -0.28)],
    ]);
    set(this.n.knurlDark!, { stroke: shade(b, -0.72), 'stroke-opacity': 0.75 });
    set(this.n.knurlLight!, { stroke: shade(b, 0.45), 'stroke-opacity': 0.5 });
    set(this.n.indicator!, { stroke: s.finish.accent });
  }

  private paintColor(color: string, day: boolean) {
    // The halo's light on the desk, in glow radii (see GLOW_R). Night: a soft pool out
    // to ~47 mm. Day: a faint line hugging the foot, since the same pool on a white page
    // reads as a colored stain, not light.
    const list: [number, number][] = day
      ? [
          [0.8, 0.28],
          [0.87, 0.11],
          [0.94, 0.025],
          [1, 0],
        ]
      : [
          [0.52, 0.5],
          [0.6, 0.22],
          [0.74, 0.06],
          [1, 0],
        ];
    list.forEach(([o, a], i) =>
      set(this.stops.glow![i]!, { offset: o, 'stop-color': color, 'stop-opacity': a }),
    );
    set(this.n.slot!, { fill: mix(color, '#ffffff', 0.25) });
    set(this.n.name!, { fill: color });
    set(this.n.fill!, { stroke: color });
    set(this.n.marker!, { stroke: color });
    set(this.n.flash!, { stroke: color });
  }

  resize(w: number, h: number): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
  }

  /* -------------------------------- projection -------------------------------- */

  /**
   * Perspective projection of a model point, as the 3D camera sees it: x to the
   * right, height y, z toward the viewer (mm) → drawing units (the viewBox is
   * centred on the camera target, one unit = one mm at the target's depth).
   */
  private proj(x: number, y: number, z: number) {
    const up = (y - this.ty) * this.cosE - z * this.sinE;
    const k = this.D / Math.max(1, this.D - (y - this.ty) * this.sinE - z * this.cosE);
    return { x: x * k, y: -this.ty * this.cosE - up * k };
  }
  /** Drawing y of the axis at height y. */
  private Y(y: number) {
    return this.proj(0, y, 0).y;
  }
  /**
   * The projected ellipse of a horizontal circle (off-centre: its back half is
   * smaller). ry is signed: negative when the camera is below that level (a side
   * view looks up at the knob's top), where the circle's front arc is its upper one.
   */
  private circ(r: number, y: number) {
    const back = this.proj(0, y, -r).y;
    const front = this.proj(0, y, r).y;
    return { cy: (back + front) / 2, rx: this.proj(r, y, 0).x, ry: (front - back) / 2 };
  }
  /** The visible band of a cylinder (or a chamfer's cone when rTop differs). */
  private side(r: number, y0: number, y1: number, rTop = r): string {
    const b = this.circ(r, y0);
    const t = this.circ(rTop, y1);
    // Each edge follows its circle's front arc: the lower one seen from above, the upper from below.
    const ry = (c: { ry: number }) => f2(Math.max(0.01, Math.abs(c.ry)));
    return `M${f2(-t.rx)} ${f2(t.cy)}L${f2(-b.rx)} ${f2(b.cy)}A${f2(b.rx)} ${ry(b)} 0 0 ${b.ry >= 0 ? 0 : 1} ${f2(b.rx)} ${f2(b.cy)}L${f2(t.rx)} ${f2(t.cy)}A${f2(t.rx)} ${ry(t)} 0 0 ${t.ry >= 0 ? 1 : 0} ${f2(-t.rx)} ${f2(t.cy)}Z`;
  }
  /**
   * A 45° chamfer from radius r at y0 up to rTop at y1. Seen from above its normal (the
   * camera higher than 45°) it faces the camera all the way round: a full ring (drawn
   * with fill-rule evenodd), not the front band a lower camera sees.
   */
  private chamfer(r: number, y0: number, y1: number, rTop: number): string {
    if (this.sinE <= Math.SQRT1_2) return this.side(r, y0, y1, rTop);
    const loop = (c: { cy: number; rx: number; ry: number }) => {
      const a = `A${f2(c.rx)} ${f2(Math.max(0.01, Math.abs(c.ry)))} 0 0 1`;
      return `M${f2(-c.rx)} ${f2(c.cy)}${a} ${f2(c.rx)} ${f2(c.cy)}${a} ${f2(-c.rx)} ${f2(c.cy)}Z`;
    };
    return loop(this.circ(r, y0)) + loop(this.circ(rTop, y1));
  }
  /** A top face (ellipse element); hidden when the camera is below it. */
  private ell(name: string, r: number, y: number, pad = 0) {
    const c = this.circ(r, y);
    const el = this.n[name]!;
    el.style.visibility = c.ry > 0 ? '' : 'hidden';
    set(el, { cx: 0, cy: f2(c.cy), rx: f2(c.rx), ry: f2(Math.max(0.01, c.ry) + pad) });
  }
  /** Place a flat, round group (drawn in mm around its centre, outer radius R) on its level. */
  private placeFace(el: SVGElement, y: number, rot: number, R: number) {
    const c = this.circ(R, y);
    el.style.visibility = c.ry > 0 ? '' : 'hidden';
    el.setAttribute(
      'transform',
      `translate(0 ${f2(c.cy)}) scale(${f2(c.rx / R)} ${f2(Math.max(0.001, c.ry) / R)}) rotate(${f2(rot)})`,
    );
  }
  /** A point on a circle of radius r at height y, angle b (rad, 0 = away from the viewer). */
  private rim(r: number, y: number, b: number) {
    return this.proj(r * Math.sin(b), y, -r * Math.cos(b));
  }
  private show(name: string, on: boolean) {
    this.n[name]!.style.display = on ? '' : 'none';
  }

  /* ---------------------------------- draw ---------------------------------- */

  draw(s: ViewState): void {
    if (this.finishKey !== s.finish.id) {
      this.finishKey = s.finish.id;
      this.paintFinish(s);
    }
    const colorKey = `${s.color}|${s.day}`;
    if (this.colorKey !== colorKey) {
      this.colorKey = colorKey;
      this.paintColor(s.color, s.day);
    }
    const r = s.rig;
    const geoKey = `${r.az.toFixed(2)}|${r.el.toFixed(2)}|${r.dist.toFixed(1)}|${r.ty.toFixed(2)}|${s.explode.toFixed(4)}|${s.press.toFixed(3)}|${this.w}x${this.h}|${s.day}`;
    if (geoKey !== this.geoKey) {
      this.geoKey = geoKey;
      this.layout(s);
    }
    this.drawKnob(s);
    this.drawDisplay(s);
  }

  private layout(s: ViewState) {
    const r = s.rig;
    const el = Math.min(89.9, Math.max(0, r.el)) * DEG;
    this.sinE = Math.sin(el);
    this.cosE = Math.cos(el);
    this.az = r.az;
    // The 3D camera backs off for tall hosts so the width still fits; match its distance.
    const aspect = this.w / this.h;
    this.D = r.dist * (aspect < 1 ? 1 / aspect : 1);
    this.ty = r.ty;
    const size = VIEW_K * r.dist;
    const cy = this.Y(r.ty);
    this.vb = { x: -size / 2, y: cy - size / 2, s: size };
    this.el.setAttribute('viewBox', `${f2(this.vb.x)} ${f2(this.vb.y)} ${f2(size)} ${f2(size)}`);

    for (const part of PARTS) this.lift[part.id] = partLift(part.id, s.explode);
    this.explode = s.explode;
    this.seat = s.press * 0.5;
    const L = this.lift;

    // Ground (moves with the foot, as in 3D)
    this.ell('shadow', 44, L.foot!, 2.2);
    this.ell('glow', GLOW_R[s.day ? 'day' : 'night'], L.foot!, s.day ? 0.6 : 1.5);

    // Foot
    set(this.n.footSide!, { d: this.side(MM.footR, L.foot!, L.foot! + MM.footH) });

    // Base
    // Paths overlap by a hair so anti-aliased seams never show the glow behind.
    set(this.n.baseSide!, { d: this.side(MM.baseR, MM.footH, MM.baseTop - MM.baseChamfer + 0.3) });
    set(this.n.slotShadow!, {
      d: this.side(MM.baseR - 0.35, MM.slotBottom - 0.35, MM.slotTop + 0.35),
    });
    set(this.n.slot!, { d: this.side(MM.baseR - MM.slotDepth, MM.slotBottom, MM.slotTop) });
    // The chamfer is a cone that meets the top face exactly (a straight band left a
    // sliver open, and the halo showed through as a maroon seam).
    const bc = MM.baseChamfer;
    set(this.n.baseChamfer!, {
      d: this.chamfer(MM.baseR, MM.baseTop - bc, MM.baseTop, MM.baseR - bc + 0.15),
    });
    this.ell('baseTop', MM.baseR - bc + 0.2, MM.baseTop);
    this.ell('baseWell', MM.knobR + 0.6, MM.baseTop);

    // Internals
    const ex = s.explode > 0.001;
    this.show('inner', ex);
    if (ex) {
      const at = (y: number, id: string) => y + L[id]!;
      set(this.n.battSide!, { d: this.side(23, at(6.5, 'battery'), at(12.5, 'battery')) });
      this.ell('battTop', 23, at(12.5, 'battery'));
      this.ell('battLabel', 17, at(12.5, 'battery'));
      set(this.n.pcbSide!, { d: this.side(26.5, at(13.2, 'encoder'), at(14.8, 'encoder')) });
      this.ell('pcbTop', 26.5, at(14.8, 'encoder'));
      this.placeFace(this.n.pcbFace!, at(14.8, 'encoder'), this.az, 26.5);
      set(this.n.statorSide!, { d: this.side(17.5, at(15.5, 'stator'), at(22.5, 'stator')) });
      this.ell('statorTop', 17.5, at(22.5, 'stator'));
      this.placeFace(this.n.statorFace!, at(22.5, 'stator'), this.az, 17.5);
      const rotorLift = partProgress(3, s.explode);
      set(this.n.rotorSide!, { d: this.side(24.2, at(15.5, 'rotor'), at(24.5, 'rotor')) });
      this.ell('rotorTop', 24.2, at(24.5, 'rotor'));
      this.ell('rotorHole', 20.4, at(24.5, 'rotor'));
      // Magnet segments on the rotor band.
      let d = '';
      const y0 = at(15.5, 'rotor');
      const y1 = at(24.5, 'rotor');
      for (let i = 0; i < 14; i++) {
        const b = ((i * 360) / 14 + this.az + rotorLift * 60) * DEG;
        if (Math.cos(b) > -0.05) continue;
        const p0 = this.rim(24.2, y1, b);
        const p1 = this.rim(24.2, y0, b);
        d += `M${f2(p0.x)} ${f2(p0.y)}L${f2(p1.x)} ${f2(p1.y)}`;
      }
      set(this.n.rotorStripes!, { d });
      const vis = (name: string, order: number) =>
        this.show(name, partProgress(order, s.explode) > 0.001);
      ['battSide', 'battTop', 'battLabel'].forEach((n) => vis(n, 6));
      ['pcbSide', 'pcbTop', 'pcbFace'].forEach((n) => vis(n, 5));
      ['statorSide', 'statorTop', 'statorFace'].forEach((n) => vis(n, 4));
      ['rotorSide', 'rotorTop', 'rotorHole', 'rotorStripes'].forEach((n) => vis(n, 3));
    }

    // Knob (lifted when exploded, seated a hair when pressed)
    const kl = this.knobLift();
    const c = MM.knobChamfer;
    set(this.n.knobLower!, { d: this.side(MM.knobR, MM.knobBottom + kl, MM.knurlBottom + kl) });
    set(this.n.knurlSide!, {
      d: this.side(MM.knobR - 0.2, MM.knurlBottom + kl, MM.knurlTop + kl),
    });
    set(this.n.knobUpper!, {
      d: this.side(MM.knobR, MM.knurlTop + kl, MM.knobTop - c + 0.2 + kl),
    });
    set(this.n.knobChamfer!, {
      d: this.chamfer(MM.knobR, MM.knobTop - c + kl, MM.knobTop + kl, MM.knobR - c + 0.1),
    });

    // Display hub + glass (stationary; lifts with the display when exploded)
    const dl = this.displayLift();
    set(this.n.hubSide!, { d: this.side(MM.hubR, 41.2 + dl, 43.8 + dl) });
  }

  private knobLift() {
    return (this.lift.knob ?? 0) - this.seat;
  }
  private displayLift() {
    return (this.lift.display ?? 0) - this.seat * 0.3;
  }

  private drawKnob(s: ViewState) {
    const rot = s.theta / DEG + this.az + partProgress(2, s.explode) * 40;
    const kl = this.knobLift();
    this.placeFace(this.n.face!, MM.knobTop + kl, rot, MM.knobR);
    // Diamond knurl: two families of helical grooves crossing, as machined (one tooth
    // per row, like the 3D normal map), only on the side facing the camera.
    const r = MM.knobR - 0.2;
    const y0 = MM.knurlBottom + kl;
    const y1 = MM.knurlTop + kl;
    const step = (2 * Math.PI) / KNURL_DRAWN;
    const twist = (12 * 2 * Math.PI) / KNURL_TEETH; // 12 rows, one tooth each
    const phase = (((rot * DEG) % step) + step) % step;
    const helix = (b0: number, dir: number) => {
      let d = '';
      let pen = false;
      for (let j = 0; j <= 3; j++) {
        const f = j / 3;
        const b = b0 + dir * twist * (f - 0.5);
        if (Math.cos(b) > -0.02) {
          pen = false;
          continue;
        }
        const p = this.rim(r, y0 + (y1 - y0) * f, b);
        d += `${pen ? 'L' : 'M'}${f2(p.x)} ${f2(p.y)}`;
        pen = true;
      }
      return d;
    };
    let dark = '';
    let light = '';
    for (let i = 0; i < KNURL_DRAWN; i++) {
      const b = i * step + phase;
      dark += helix(b, 1);
      light += helix(b + step / 2, -1);
    }
    this.n.knurlDark!.setAttribute('d', dark);
    this.n.knurlLight!.setAttribute('d', light);
  }

  private drawDisplay(s: ViewState) {
    this.placeFace(this.n.screen!, 43.8 + this.displayLift(), this.az, MM.hubR);
    const p = s.p;
    const scaleKey = `${p.detents}|${p.stops?.join(',')}|${p.snaps.join(',')}|${p.accents.join(',')}|${p.spring}`;
    if (scaleKey !== this.scaleKey) {
      this.scaleKey = scaleKey;
      this.buildScale(s);
    }
    const a = s.theta / DEG;
    // Position marker (stationary display, moving value).
    this.n.marker!.setAttribute('transform', `rotate(${f2(a)})`);
    // Bounded fill arc.
    if (p.stops) {
      const from = p.spring ? 0 : p.stops[0] / DEG;
      this.n.fill!.setAttribute(
        'd',
        arc(15.6, from, Math.max(p.stops[0] / DEG, Math.min(p.stops[1] / DEG, a))),
      );
    } else {
      this.n.fill!.setAttribute('d', '');
    }
    // Detent scale: light the current tick.
    const lit = this.n.lit!;
    if (p.detents) {
      const n = p.detents;
      const i = ((s.index % n) + n) % n;
      const w = 360 / Math.min(n, 120);
      set(lit, {
        stroke: s.color,
        'stroke-width': f2(Math.min(1.1, (w / 360) * 2 * Math.PI * 16 * 0.55)),
        transform: `rotate(${f2((i * 360) / n)})`,
      });
      lit.style.display = '';
    } else {
      lit.style.display = 'none';
    }
    // Magnet: highlight the captured snap.
    Array.from(this.n.snaps!.children).forEach((c, i) =>
      c.setAttribute('fill', i === s.snap ? s.color : '#ffffff'),
    );
    this.n.name!.textContent = s.name.toUpperCase();
    const size = readoutSize(s.text);
    const textKey = `${s.text}|${size}`;
    if (textKey !== this.textKey) {
      this.textKey = textKey;
      this.n.text!.textContent = s.text;
      this.n.text!.setAttribute('font-size', String(size));
      this.fitText();
    }
    this.n.sub!.textContent = s.sub;
    this.n.flash!.setAttribute('opacity', f2(s.press));
  }

  /**
   * Squeeze a readout wider than the tick ring allows, as the canvas renderer does
   * (fillText's maxWidth), so 'FINE PRINT' never runs onto the bezel. Measured in the
   * face on screen: again when a web font arrives, and on the next draw while the dial
   * isn't laid out (a hidden host measures 0).
   */
  private fitText = () => {
    const t = this.n.text as SVGTextElement;
    t.removeAttribute('textLength');
    t.removeAttribute('lengthAdjust');
    if (!t.textContent) return;
    let w = 0;
    try {
      w = t.getComputedTextLength();
    } catch {
      w = 0;
    }
    if (!w) this.textKey = '';
    else if (w > TYPE.textW) set(t, { textLength: TYPE.textW, lengthAdjust: 'spacingAndGlyphs' });
  };

  private buildScale(s: ViewState) {
    const p = s.p;
    let d = '';
    const tick = (deg: number, r0: number, r1: number) => {
      const b = deg * DEG;
      d += `M${f2(r0 * Math.sin(b))} ${f2(-r0 * Math.cos(b))}L${f2(r1 * Math.sin(b))} ${f2(-r1 * Math.cos(b))}`;
    };
    const scale = this.n.scale!;
    if (p.detents) {
      const n = p.detents;
      const shown = Math.min(n, 120);
      for (let i = 0; i < shown; i++) {
        const deg = (i * 360) / shown;
        const accent = p.accents.some((x) => Math.abs(((x / DEG - deg + 540) % 360) - 180) < 0.01);
        tick(deg, accent ? 16.9 : 16.5, 14.9);
      }
      set(scale, { stroke: '#fff', 'stroke-opacity': 0.3, 'stroke-width': n > 48 ? 0.22 : 0.4 });
      this.n.track!.setAttribute('d', '');
    } else if (p.stops) {
      const [a, b] = p.stops.map((x) => x / DEG) as [number, number];
      this.n.track!.setAttribute('d', arc(15.6, a, b));
      tick(a, 17, 14.2);
      tick(b, 17, 14.2);
      p.accents.forEach((x) => tick(x / DEG, 17, 14.2));
      if (p.spring) tick(0, 17, 14.2);
      set(scale, { stroke: '#fff', 'stroke-opacity': 0.55, 'stroke-width': 0.4 });
    } else {
      for (let i = 0; i < 72; i++) tick(i * 5, i % 6 === 0 ? 16.6 : 16.1, 15.2);
      set(scale, { stroke: '#fff', 'stroke-opacity': 0.18, 'stroke-width': 0.25 });
      this.n.track!.setAttribute('d', '');
    }
    scale.setAttribute('d', d);
    const snaps = this.n.snaps!;
    snaps.replaceChildren();
    p.snaps.forEach((x) => {
      const b = x;
      node(
        'circle',
        { cx: f2(15.6 * Math.sin(b)), cy: f2(-15.6 * Math.cos(b)), r: 0.75, fill: '#fff' },
        snaps,
      );
    });
  }

  /* ------------------------------ hit + anchors ------------------------------ */

  private toPx(x: number, y: number) {
    const k = Math.min(this.w, this.h) / this.vb.s;
    return {
      x: (this.w - this.vb.s * k) / 2 + (x - this.vb.x) * k,
      y: (this.h - this.vb.s * k) / 2 + (y - this.vb.y) * k,
      k,
    };
  }

  knobCircle(): KnobCircle | null {
    const lift = this.knobLift();
    const yt = MM.knobTop + lift;
    const yb = MM.knobBottom + lift;
    const t = this.circ(MM.knobR, yt);
    const b = this.circ(MM.knobR, yb);
    const top = t.cy - Math.abs(t.ry);
    const bot = b.cy + Math.abs(b.ry);
    const c = this.toPx(0, (top + bot) / 2);
    const r = Math.max(t.rx, (bot - top) / 2) * c.k;
    return { x: c.x, y: c.y, r };
  }

  grip(px: number, py: number): KnobGrip | null {
    const k = Math.min(this.w, this.h) / this.vb.s;
    // Host px → drawing mm, relative to the centre of the knob's top face.
    const x = (px - (this.w - this.vb.s * k) / 2) / k + this.vb.x;
    const dy = (py - (this.h - this.vb.s * k) / 2) / k + this.vb.y;
    const yt = MM.knobTop + this.knobLift();
    const rpx = this.circ(MM.knobR, yt).rx * k;
    // Camera at or below the face (side view): the knob can only be turned by its side.
    if (this.ty + this.D * this.sinE < yt + 1) return { a: 0, r: Infinity, side: true, rpx };
    // Invert the projection onto the plane of the top face (z toward the viewer).
    const u = (-this.ty * this.cosE - dy) / this.D;
    const up0 = (yt - this.ty) * this.cosE;
    const d0 = this.D - (yt - this.ty) * this.sinE;
    const den = this.sinE - u * this.cosE;
    if (den < 1e-4) return { a: 0, r: Infinity, side: false, rpx };
    const z = (up0 - u * d0) / den;
    const fx = (x * (d0 - z * this.cosE)) / this.D;
    const r = Math.hypot(fx, z) / MM.knobR;
    return { a: Math.atan2(fx, -z), r, side: r > 1 && z > 0, rpx };
  }

  outline(): Ellipse | null {
    const pts: { x: number; y: number }[] = [];
    for (const [r, y] of hullRings(this.explode, this.seat)) {
      for (let i = 0; i < 24; i++) {
        const p = this.rim(r, y, (i / 24) * Math.PI * 2);
        pts.push(this.toPx(p.x, p.y));
      }
    }
    return enclose(pts);
  }

  anchors(): DialPartAnchor[] {
    return PARTS.map((p) => {
      const lift = this.lift[p.id] ?? 0;
      const a = this.toPx(this.circ(p.r, p.y + lift).rx, this.Y(p.y + lift));
      const visible =
        p.lift === 0 || ['knob', 'display', 'glass', 'foot'].includes(p.id) || Math.abs(lift) > 0.5;
      return { id: p.id, x: a.x, y: a.y, visible };
    });
  }

  dispose(): void {
    document.fonts?.removeEventListener?.('loadingdone', this.fitText);
    this.el.remove();
  }
}

/** SVG arc path on a circle of radius r from angle a to b (degrees, 0 = up, clockwise). */
function arc(r: number, a: number, b: number): string {
  if (Math.abs(b - a) < 0.05) return '';
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const p = (deg: number) => `${f2(r * Math.sin(deg * DEG))} ${f2(-r * Math.cos(deg * DEG))}`;
  const large = hi - lo > 180 ? 1 : 0;
  return `M${p(lo)}A${r} ${r} 0 ${large} 1 ${p(hi)}`;
}
