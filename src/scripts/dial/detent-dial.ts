/**
 * <detent-dial>: SCAFFOLD IMPLEMENTATION (2D SVG).
 * Implements the full public contract in ./types.ts with a flat SVG knob so
 * pages can be built against it. The dial feature replaces the internals with
 * the three.js renderer + haptic/audio engine and keeps this as the fallback.
 */
import { FINISHES, PROFILES, type FinishId, type ProfileId } from '@/data/product';
import type { DetentDialElement, RendererKind } from './types';

const SVG_NS = 'http://www.w3.org/2000/svg';

class DetentDial extends HTMLElement implements DetentDialElement {
  static observedAttributes = ['finish', 'profile', 'interactive', 'label', 'display'];

  #angle = 0;
  #explode = 0;
  #lastDetent = 0;
  #renderer: RendererKind = 'none';
  #svg?: SVGSVGElement;
  #knob?: SVGGElement;
  #drag: { id: number; startAngle: number; startPointer: number } | null = null;

  get finish(): FinishId {
    return (this.getAttribute('finish') as FinishId) || 'graphite';
  }
  set finish(v: FinishId) {
    this.setAttribute('finish', v);
  }
  get profile(): ProfileId {
    return (this.getAttribute('profile') as ProfileId) || 'ratchet';
  }
  set profile(v: ProfileId) {
    this.setAttribute('profile', v);
  }
  get angle() {
    return this.#angle;
  }
  set angle(v: number) {
    this.setAngle(v);
  }
  get explode() {
    return this.#explode;
  }
  set explode(v: number) {
    this.#explode = Math.min(1, Math.max(0, v));
  }
  get value() {
    const stops = this.#physics().stops;
    if (stops) return (this.#angle - stops[0]) / (stops[1] - stops[0]);
    return (((this.#angle % 360) + 360) % 360) / 360;
  }
  get renderer() {
    return this.#renderer;
  }

  #physics() {
    return (PROFILES.find((p) => p.id === this.profile) ?? PROFILES[0]).physics;
  }

  connectedCallback() {
    if (!this.#svg) this.#build();
    this.#applyAttrs();
    this.#renderer = 'svg';
    this.dispatchEvent(new CustomEvent('detent:ready', { bubbles: true, composed: true, detail: { renderer: 'svg' } }));
  }

  attributeChangedCallback() {
    if (this.#svg) this.#applyAttrs();
  }

  setAngle(deg: number, _opts: { instant?: boolean } = {}) {
    const stops = this.#physics().stops;
    const next = stops ? Math.min(stops[1], Math.max(stops[0], deg)) : deg;
    const velocity = next - this.#angle;
    this.#angle = next;
    this.#paint();
    this.#emitTicks(velocity);
    this.dispatchEvent(
      new CustomEvent('detent:change', {
        bubbles: true,
        composed: true,
        detail: { angle: this.#angle, value: this.value, profile: this.profile },
      }),
    );
  }

  nudge(detents: number) {
    const n = this.#physics().detents || 24;
    this.setAngle(this.#angle + (360 / n) * detents);
  }

  #emitTicks(velocity: number) {
    const n = this.#physics().detents;
    if (!n) return;
    const step = 360 / n;
    const idx = Math.round(this.#angle / step);
    if (idx !== this.#lastDetent) {
      this.#lastDetent = idx;
      const accent = (this.#physics().accents ?? []).some((a) => Math.abs(((idx * step - a) % 360 + 360) % 360) < 0.001);
      this.dispatchEvent(
        new CustomEvent('detent:tick', {
          bubbles: true,
          composed: true,
          detail: { index: idx, angle: this.#angle, profile: this.profile, velocity, accent },
        }),
      );
    }
  }

  #build() {
    this.style.display ||= 'block';
    this.style.position ||= 'relative';
    this.style.touchAction = 'none';
    // Remove server-rendered fallback content once we can draw.
    this.querySelectorAll('[data-dial-fallback]').forEach((n) => n.remove());

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '-110 -110 220 220');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'width:100%;height:100%;display:block;overflow:visible';
    svg.innerHTML = `
      <g class="dd-scale"></g>
      <circle r="92" class="dd-base"></circle>
      <g class="dd-knob">
        <circle r="74" class="dd-body"></circle>
        <circle r="52" class="dd-face" fill="#0b0a0b"></circle>
        <circle r="46" class="dd-ring" fill="none" stroke-width="3"></circle>
        <line class="dd-indicator" x1="0" y1="-70" x2="0" y2="-58" stroke-width="5" stroke-linecap="round"></line>
      </g>
      <text class="dd-display" y="5" text-anchor="middle" font-size="13" fill="#f4f1f2" font-family="Martian Mono Variable, monospace"></text>`;
    const scale = svg.querySelector('.dd-scale') as SVGGElement;
    for (let i = 0; i < 48; i++) {
      const t = document.createElementNS(SVG_NS, 'line');
      const long = i % 4 === 0;
      t.setAttribute('x1', '0');
      t.setAttribute('y1', String(-100));
      t.setAttribute('x2', '0');
      t.setAttribute('y2', String(long ? -94 : -97));
      t.setAttribute('stroke', 'currentColor');
      t.setAttribute('stroke-opacity', long ? '0.55' : '0.25');
      t.setAttribute('transform', `rotate(${i * 7.5})`);
      scale.appendChild(t);
    }
    this.appendChild(svg);
    this.#svg = svg;
    this.#knob = svg.querySelector('.dd-knob') as SVGGElement;

    this.addEventListener('pointerdown', this.#onDown);
    this.addEventListener('pointermove', this.#onMove);
    this.addEventListener('pointerup', this.#onUp);
    this.addEventListener('pointercancel', this.#onUp);
    this.addEventListener('keydown', this.#onKey);
    this.addEventListener('wheel', this.#onWheel, { passive: false });
  }

  #applyAttrs() {
    const finish = FINISHES.find((f) => f.id === this.finish) ?? FINISHES[1];
    const profile = PROFILES.find((p) => p.id === this.profile) ?? PROFILES[0];
    const svg = this.#svg!;
    (svg.querySelector('.dd-base') as SVGElement).setAttribute('fill', shade(finish.body, -0.18));
    (svg.querySelector('.dd-body') as SVGElement).setAttribute('fill', finish.body);
    (svg.querySelector('.dd-ring') as SVGElement).setAttribute('stroke', profile.color);
    (svg.querySelector('.dd-indicator') as SVGElement).setAttribute('stroke', finish.accent);
    (svg.querySelector('.dd-display') as SVGElement).textContent =
      this.getAttribute('display') ?? profile.name.toUpperCase();

    const interactive = this.hasAttribute('interactive');
    if (interactive) {
      this.tabIndex = 0;
      this.setAttribute('role', 'slider');
      this.setAttribute('aria-label', this.getAttribute('label') ?? 'Detent dial');
      this.setAttribute('aria-valuemin', '0');
      this.setAttribute('aria-valuemax', '100');
      this.style.cursor = 'grab';
    } else {
      this.removeAttribute('tabindex');
      this.setAttribute('role', 'img');
      this.setAttribute('aria-label', this.getAttribute('label') ?? `Detent One in ${finish.name}`);
    }
    this.#paint();
  }

  #paint() {
    this.#knob?.setAttribute('transform', `rotate(${this.#angle})`);
    if (this.hasAttribute('interactive')) {
      const pct = Math.round(this.value * 100);
      this.setAttribute('aria-valuenow', String(pct));
      this.setAttribute('aria-valuetext', `${Math.round(this.#angle)} degrees, ${this.profile}`);
    }
  }

  #pointerAngle(e: PointerEvent) {
    const r = this.getBoundingClientRect();
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  }

  #onDown = (e: PointerEvent) => {
    if (!this.hasAttribute('interactive')) return;
    this.setPointerCapture(e.pointerId);
    this.#drag = { id: e.pointerId, startAngle: this.#angle, startPointer: this.#pointerAngle(e) };
    this.style.cursor = 'grabbing';
    this.dispatchEvent(new CustomEvent('detent:grab', { bubbles: true, composed: true, detail: {} }));
  };
  #onMove = (e: PointerEvent) => {
    if (!this.#drag || e.pointerId !== this.#drag.id) return;
    let delta = this.#pointerAngle(e) - this.#drag.startPointer;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    this.setAngle(this.#drag.startAngle + delta);
    this.#drag.startAngle = this.#angle;
    this.#drag.startPointer = this.#pointerAngle(e);
  };
  #onUp = (e: PointerEvent) => {
    if (!this.#drag || e.pointerId !== this.#drag.id) return;
    this.#drag = null;
    this.style.cursor = 'grab';
    this.dispatchEvent(new CustomEvent('detent:release', { bubbles: true, composed: true, detail: {} }));
  };
  #onKey = (e: KeyboardEvent) => {
    if (!this.hasAttribute('interactive')) return;
    const map: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 4, PageDown: -4 };
    if (e.key in map) {
      e.preventDefault();
      this.nudge(map[e.key]!);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.dispatchEvent(new CustomEvent('detent:press', { bubbles: true, composed: true, detail: { level: 1 } }));
    }
  };
  #onWheel = (e: WheelEvent) => {
    if (!this.hasAttribute('interactive') || document.activeElement !== this) return;
    e.preventDefault();
    this.setAngle(this.#angle + e.deltaY * 0.25);
  };
}

/** Lighten/darken a hex color by amount (-1..1) in sRGB. Good enough for 2D. */
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.round(Math.min(255, Math.max(0, amt < 0 ? v * (1 + amt) : v + (255 - v) * amt))),
  );
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

if (!customElements.get('detent-dial')) customElements.define('detent-dial', DetentDial);

export {};
