/**
 * SVG renderer: Detent One drawn as an oblique projection of the same
 * millimetre model the 3D renderer uses. It follows the camera rig (elevation,
 * azimuth, distance), the explode choreography, the knurl turning with the knob
 * and a live round display. Used before three.js loads, for quality="low",
 * without WebGL2, and after a lost GPU context. No dependencies.
 */
import { MM, FOV, PARTS, partLift, partProgress } from './model';
import { mix, shade } from './color';
import type { DialPartAnchor } from './types';
import type { DialView, KnobCircle, ViewState } from './view';

const NS = 'http://www.w3.org/2000/svg';
const DEG = Math.PI / 180;
const VIEW_K = 2 * Math.tan((FOV / 2) * DEG);
const KNURL_TEETH = 96;
const CHAMFER = '#e4e4e2';
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
  private lift: Record<string, number> = {};
  private geoKey = '';
  private finishKey = '';
  private colorKey = '';
  private scaleKey = '';
  private n: Record<string, SVGElement> = {};
  private stops: Record<string, SVGStopElement[]> = {};
  private seat = 0;

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
    p('baseChamfer', base, { fill: url('chamfer') });
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
    p('knobChamfer', knob, { fill: url('chamfer') });
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
    this.n.indicator = node(
      'line',
      { x1: 0, x2: 0, y1: -25.7, y2: -27.7, 'stroke-width': 1.05, 'stroke-linecap': 'round' },
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
        y: -6.6,
        'text-anchor': 'middle',
        'font-size': 1.75,
        'font-weight': 720,
        'letter-spacing': 0.3,
        style: 'font-family: var(--font-sans); font-stretch: 125%',
      },
      screen,
    );
    this.n.text = node(
      'text',
      {
        y: 2.7,
        'text-anchor': 'middle',
        'font-size': 7,
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
        y: 8.2,
        'text-anchor': 'middle',
        'font-size': 1.45,
        'font-weight': 450,
        fill: '#f4f1f2',
        'fill-opacity': 0.55,
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

  private paintColor(color: string) {
    const list: [number, number][] = [
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

  private Y(y: number) {
    return -y * this.cosE;
  }
  private side(r: number, y0: number, y1: number): string {
    const ry = r * this.sinE;
    const t = this.Y(y1);
    const b = this.Y(y0);
    return `M${f2(-r)} ${f2(t)}L${f2(-r)} ${f2(b)}A${f2(r)} ${f2(ry)} 0 0 0 ${f2(r)} ${f2(b)}L${f2(r)} ${f2(t)}A${f2(r)} ${f2(ry)} 0 0 1 ${f2(-r)} ${f2(t)}Z`;
  }
  private ell(name: string, r: number, y: number) {
    set(this.n[name]!, {
      cx: 0,
      cy: f2(this.Y(y)),
      rx: f2(r),
      ry: f2(Math.max(0.01, r * this.sinE)),
    });
  }
  private faceTransform(y: number, rot: number) {
    return `translate(0 ${f2(this.Y(y))}) scale(1 ${f2(Math.max(0.001, this.sinE))}) rotate(${f2(rot)})`;
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
    if (this.colorKey !== s.color) {
      this.colorKey = s.color;
      this.paintColor(s.color);
    }
    const r = s.rig;
    const geoKey = `${r.az.toFixed(2)}|${r.el.toFixed(2)}|${r.dist.toFixed(1)}|${r.ty.toFixed(2)}|${s.explode.toFixed(4)}|${s.press.toFixed(3)}|${this.w}x${this.h}`;
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
    const size = VIEW_K * r.dist;
    const cy = this.Y(r.ty);
    this.vb = { x: -size / 2, y: cy - size / 2, s: size };
    this.el.setAttribute('viewBox', `${f2(this.vb.x)} ${f2(this.vb.y)} ${f2(size)} ${f2(size)}`);

    for (const part of PARTS) this.lift[part.id] = partLift(part.id, s.explode);
    this.seat = s.press * 0.5;
    const L = this.lift;
    const trans = (name: string, dy: number) =>
      this.n[name]!.setAttribute('transform', `translate(0 ${f2(this.Y(dy))})`);

    // Ground
    this.ell('shadow', 44, 0);
    this.ell('glow', 64, 0);
    set(this.n.shadow!, { ry: f2(44 * this.sinE + 2.2) });
    set(this.n.glow!, { ry: f2(64 * this.sinE + 1.5) });

    // Foot
    trans('foot', L.foot!);
    set(this.n.footSide!, { d: this.side(MM.footR, 0, MM.footH) });

    // Base
    // Paths overlap by a hair so anti-aliased seams never show the glow behind.
    set(this.n.baseSide!, { d: this.side(MM.baseR, MM.footH, MM.baseTop - MM.baseChamfer + 0.3) });
    set(this.n.slotShadow!, {
      d: this.side(MM.baseR - 0.35, MM.slotBottom - 0.35, MM.slotTop + 0.35),
    });
    set(this.n.slot!, { d: this.side(MM.baseR - MM.slotDepth, MM.slotBottom, MM.slotTop) });
    set(this.n.baseChamfer!, {
      d: this.side(MM.baseR, MM.baseTop - MM.baseChamfer, MM.baseTop - 0.2),
    });
    this.ell('baseTop', MM.baseR - MM.baseChamfer, MM.baseTop);
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
      this.n.pcbFace!.setAttribute('transform', this.faceTransform(at(14.8, 'encoder'), this.az));
      set(this.n.statorSide!, { d: this.side(17.5, at(15.5, 'stator'), at(22.5, 'stator')) });
      this.ell('statorTop', 17.5, at(22.5, 'stator'));
      this.n.statorFace!.setAttribute('transform', this.faceTransform(at(22.5, 'stator'), this.az));
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
        const x = 24.2 * Math.sin(b);
        const dz = -24.2 * Math.cos(b) * this.sinE;
        d += `M${f2(x)} ${f2(this.Y(y1) + dz)}L${f2(x)} ${f2(this.Y(y0) + dz)}`;
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
    trans('knob', L.knob! - this.seat);
    const c = MM.knobChamfer;
    set(this.n.knobLower!, { d: this.side(MM.knobR, MM.knobBottom, MM.knurlBottom) });
    set(this.n.knurlSide!, { d: this.side(MM.knobR - 0.2, MM.knurlBottom, MM.knurlTop) });
    set(this.n.knobUpper!, { d: this.side(MM.knobR, MM.knurlTop, MM.knobTop - c + 0.2) });
    set(this.n.knobChamfer!, { d: this.side(MM.knobR, MM.knobTop - c, MM.knobTop - 0.15) });

    // Display hub + glass (stationary; lifts with the display when exploded)
    trans('display', L.display! - this.seat * 0.3);
    set(this.n.hubSide!, { d: this.side(MM.hubR, 41.2, 43.8) });
  }

  private drawKnob(s: ViewState) {
    const rot = s.theta / DEG + this.az + partProgress(2, s.explode) * 40;
    this.n.face!.setAttribute('transform', this.faceTransform(MM.knobTop, rot));
    // Knurl: only the teeth facing the camera, as vertical grooves + highlights.
    let dark = '';
    let light = '';
    const r = MM.knobR - 0.2;
    const top = this.Y(MM.knurlTop);
    const bot = this.Y(MM.knurlBottom);
    const step = 360 / KNURL_TEETH;
    const phase = rot % step;
    for (let i = 0; i < KNURL_TEETH; i++) {
      const b = (i * step + phase) * DEG;
      const cb = Math.cos(b);
      if (cb > -0.04) continue;
      const x = r * Math.sin(b);
      const dz = -r * cb * this.sinE;
      dark += `M${f2(x)} ${f2(top + dz)}L${f2(x)} ${f2(bot + dz)}`;
      const x2 = r * Math.sin(b + step * 0.35 * DEG);
      light += `M${f2(x2)} ${f2(top + dz)}L${f2(x2)} ${f2(bot + dz)}`;
    }
    this.n.knurlDark!.setAttribute('d', dark);
    this.n.knurlLight!.setAttribute('d', light);
  }

  private drawDisplay(s: ViewState) {
    this.n.screen!.setAttribute('transform', this.faceTransform(43.8, this.az));
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
    this.n.text!.textContent = s.text;
    const len = s.text.length;
    this.n.text!.setAttribute('font-size', String(len > 4 ? 4.6 : len > 3 ? 5.6 : 7));
    this.n.sub!.textContent = s.sub;
    this.n.flash!.setAttribute('opacity', f2(s.press));
  }

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
    const lift = (this.lift.knob ?? 0) - this.seat;
    const top = this.Y(MM.knobTop + lift) - MM.knobR * this.sinE;
    const bot = this.Y(MM.knobBottom + lift) + MM.knobR * this.sinE;
    const c = this.toPx(0, (top + bot) / 2);
    const r = Math.max(MM.knobR, (bot - top) / 2) * c.k;
    return { x: c.x, y: c.y, r };
  }

  anchors(): DialPartAnchor[] {
    return PARTS.map((p) => {
      const lift = this.lift[p.id] ?? 0;
      const a = this.toPx(p.r, this.Y(p.y + lift));
      const visible =
        p.lift === 0 || ['knob', 'display', 'glass', 'foot'].includes(p.id) || Math.abs(lift) > 0.5;
      return { id: p.id, x: a.x, y: a.y, visible };
    });
  }

  dispose(): void {
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
