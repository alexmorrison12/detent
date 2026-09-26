/**
 * A contact-microphone trace: one mirrored bar per event (a detent, a snap, a
 * stop), newest on the right. It is the visual caption for the game audio,
 * so both games are fully playable with sound off. Event-driven, so it only
 * moves when the dial moves (nothing to reduce for reduced-motion).
 *
 * Colors come from CSS custom properties on the canvas:
 *   --trace-ink (ordinary bars), --trace-strong (heavy bars),
 *   --trace-signal (the one bar that matters), --trace-rule (center line).
 */
export type BarKind = 'base' | 'strong' | 'signal' | 'wall';

interface Bar {
  h: number;
  kind: BarKind;
}

export class Trace {
  #canvas: HTMLCanvasElement;
  #ctx: CanvasRenderingContext2D | null;
  #bars: Bar[] = [];
  #capacity: number;
  #colors: Record<BarKind | 'rule', string> = {
    base: '#8a8587',
    strong: '#f4f1f2',
    signal: '#e0115f',
    wall: '#f4f1f2',
    rule: 'rgba(255,255,255,.14)',
  };
  #raf = 0;
  #ro?: ResizeObserver;

  constructor(canvas: HTMLCanvasElement, capacity = 64) {
    this.#canvas = canvas;
    this.#ctx = canvas.getContext('2d');
    this.#capacity = capacity;
    this.#readColors();
    this.#resize();
    if ('ResizeObserver' in window) {
      this.#ro = new ResizeObserver(() => {
        this.#resize();
        this.draw();
      });
      this.#ro.observe(canvas);
    }
    this.draw();
  }

  #readColors() {
    const cs = getComputedStyle(this.#canvas);
    const pick = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
    this.#colors = {
      base: pick('--trace-ink', this.#colors.base),
      strong: pick('--trace-strong', this.#colors.strong),
      signal: pick('--trace-signal', this.#colors.signal),
      wall: pick('--trace-strong', this.#colors.wall),
      rule: pick('--trace-rule', this.#colors.rule),
    };
  }

  #resize() {
    const r = this.#canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (this.#canvas.width !== w || this.#canvas.height !== h) {
      this.#canvas.width = w;
      this.#canvas.height = h;
    }
  }

  push(h: number, kind: BarKind = 'base') {
    this.#bars.push({ h: Math.max(0, Math.min(1, h)), kind });
    if (this.#bars.length > this.#capacity)
      this.#bars.splice(0, this.#bars.length - this.#capacity);
    this.#schedule();
  }

  clear() {
    this.#bars = [];
    this.#schedule();
  }

  /** Re-read colors (after a world or theme change). */
  refresh() {
    this.#readColors();
    this.draw();
  }

  #schedule() {
    if (this.#raf) return;
    this.#raf = requestAnimationFrame(() => {
      this.#raf = 0;
      this.draw();
    });
  }

  draw() {
    const c = this.#ctx;
    if (!c) return;
    const { width: W, height: H } = this.#canvas;
    c.clearRect(0, 0, W, H);
    const cy = H / 2;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.fillStyle = this.#colors.rule;
    c.fillRect(0, Math.round(cy - dpr / 2), W, Math.max(1, dpr));

    const slot = W / this.#capacity;
    const bw = Math.max(dpr * 1.5, slot * 0.42);
    const n = this.#bars.length;
    for (let i = 0; i < n; i++) {
      const bar = this.#bars[i]!;
      const age = (n - 1 - i) / this.#capacity;
      const x = W - (n - i) * slot + (slot - bw) / 2;
      const amp = bar.kind === 'wall' ? H * 0.46 : Math.max(dpr, bar.h * H * 0.46);
      c.globalAlpha = Math.max(0.18, 1 - age * 0.85);
      c.fillStyle = this.#colors[bar.kind];
      const width = bar.kind === 'wall' ? Math.max(bw, slot * 0.9) : bw;
      c.fillRect(x, cy - amp, width, amp * 2);
    }
    c.globalAlpha = 1;
  }

  destroy() {
    cancelAnimationFrame(this.#raf);
    this.#ro?.disconnect();
  }
}
