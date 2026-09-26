/**
 * <app-demo>: boots a mock-app controller when the demo nears the viewport,
 * wires it to a Detent dial, and switches the dial's feel per mode.
 *
 * - Own dial (default): listens to the <detent-dial> inside the demo.
 * - Linked dial (data-dial-id): listens to an existing dial elsewhere on the
 *   page. Several demos can share one dial; the one most in view claims it.
 *
 * Public: el.setMode(id) (used by "Try it" links on the audience pages).
 */
import type {
  DetentChangeDetail,
  DetentDialElement,
  DetentPressDetail,
  DetentTickDetail,
} from '@/scripts/dial/types';
import { byProfile } from '@/data/product';
import { track } from '@/lib/analytics';
import { DEMO_META, modeById, type DemoApp } from './modes';
import type { DemoContext, DemoController, Mount } from './core';

const loaders: Record<DemoApp, () => Promise<{ default: Mount }>> = {
  edit: () => import('./edit'),
  mix: () => import('./mix'),
  design: () => import('./design'),
  code: () => import('./code'),
};

const CLAIM = 'detent:demo-claim';
interface ClaimDetail {
  dial: string;
  owner: HTMLElement;
}

class AppDemoElement extends HTMLElement {
  #controller?: DemoController;
  #dial?: DetentDialElement;
  #booting = false;
  #active = false;
  #onScreen = false;
  #muted = false;
  #touched = false;
  #live: HTMLElement | null = null;
  #announceTimer = 0;
  #displayRaf = 0;
  #displayText = '';
  #bootIO?: IntersectionObserver;
  #screenIO?: IntersectionObserver;
  #reduced = matchMedia('(prefers-reduced-motion: reduce)');

  get app(): DemoApp {
    return (this.dataset.app as DemoApp) ?? 'edit';
  }
  get #linkedId(): string | undefined {
    return this.dataset.dialId || undefined;
  }

  connectedCallback() {
    this.#live = this.querySelector('[data-ref="live"]');
    this.addEventListener('change', this.#onRadio);
    this.#bootIO = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          this.#bootIO?.disconnect();
          void this.#boot();
        }
      },
      { rootMargin: '320px 0px' },
    );
    this.#bootIO.observe(this);
    this.#screenIO = new IntersectionObserver(this.#onScreenChange, { threshold: [0, 0.6] });
    this.#screenIO.observe(this);
    window.addEventListener(CLAIM, this.#onClaim as EventListener);
    document.addEventListener('visibilitychange', this.#onVisibility);
  }

  disconnectedCallback() {
    this.#bootIO?.disconnect();
    this.#screenIO?.disconnect();
    window.removeEventListener(CLAIM, this.#onClaim as EventListener);
    document.removeEventListener('visibilitychange', this.#onVisibility);
    this.#controller?.visibility?.(false);
    this.#unbindDial();
  }

  /** Switch mode programmatically (checks the matching radio too). */
  setMode(id: string): void {
    const radio = this.querySelector<HTMLInputElement>(
      `input[data-mode][value="${CSS.escape(id)}"]`,
    );
    if (radio) radio.checked = true;
    this.#reflect(id);
    if (this.#linkedId) this.#claim();
    if (this.#controller) this.#apply(id, true);
    else void this.#boot();
  }

  /* ---------------------------------------------------------------------- */

  async #boot() {
    if (this.#controller || this.#booting) return;
    const doc = document as Document & { prerendering?: boolean };
    if (doc.prerendering) {
      document.addEventListener('prerenderingchange', () => void this.#boot(), { once: true });
      return;
    }
    this.#booting = true;
    try {
      await customElements.whenDefined('detent-dial');
      const dial = this.#resolveDial();
      if (!dial) return;
      const { default: mount } = await loaders[this.app]();
      this.#dial = dial;
      this.#controller = mount(this.#context(dial));
      dial.addEventListener('detent:change', this.#onChange);
      dial.addEventListener('detent:tick', this.#onTick);
      dial.addEventListener('detent:press', this.#onPress);
      dial.addEventListener('detent:grab', this.#onTouch);
      dial.addEventListener('keydown', this.#onTouch);
      if (!this.#linkedId) this.#active = true;
      if (this.#active) this.#apply(this.#checkedMode(), false);
      this.#controller.visibility?.(this.#onScreen && !document.hidden);
      this.dataset.ready = '';
    } catch (err) {
      // A demo that fails to boot stays a still, readable picture.
      if (import.meta.env.DEV) console.warn('[app-demo]', err);
    } finally {
      this.#booting = false;
    }
  }

  #resolveDial(): DetentDialElement | null {
    const id = this.#linkedId;
    const el = id ? document.getElementById(id) : this.querySelector('detent-dial');
    return el && el.localName === 'detent-dial' ? (el as DetentDialElement) : null;
  }

  #unbindDial() {
    const d = this.#dial;
    if (!d) return;
    d.removeEventListener('detent:change', this.#onChange);
    d.removeEventListener('detent:tick', this.#onTick);
    d.removeEventListener('detent:press', this.#onPress);
    d.removeEventListener('detent:grab', this.#onTouch);
    d.removeEventListener('keydown', this.#onTouch);
  }

  #context(dial: DetentDialElement): DemoContext {
    const q = (name: string) => `[data-ref="${name}"]`;
    return {
      app: this.app,
      root: this,
      dial,
      ref: <T extends HTMLElement | SVGElement>(name: string) => this.querySelector(q(name)) as T,
      refs: <T extends HTMLElement | SVGElement>(name: string) =>
        Array.from(this.querySelectorAll(q(name))) as T[],
      announce: (text) => this.#announce(text),
      display: (text) => this.#display(text),
      setAngle: (deg) => {
        const was = this.#muted;
        this.#muted = true;
        try {
          dial.setAngle(deg, { instant: true });
        } finally {
          this.#muted = was;
        }
      },
      reduced: () => this.#reduced.matches,
      onScreen: () => this.#onScreen && !document.hidden,
    };
  }

  #checkedMode(): string | undefined {
    return (
      this.querySelector<HTMLInputElement>('input[data-mode]:checked')?.value ?? this.dataset.mode
    );
  }

  #reflect(id: string | undefined) {
    const mode = modeById(this.app, id);
    this.dataset.mode = mode.id;
    this.dataset.profile = mode.profile;
    return mode;
  }

  #apply(id: string | undefined, announce: boolean) {
    const dial = this.#dial;
    const ctl = this.#controller;
    if (!dial || !ctl) return;
    const mode = this.#reflect(id);
    const profile = byProfile(mode.profile);
    this.#muted = true;
    try {
      dial.physics = ctl.physics?.(mode.id) ?? null;
      dial.profile = mode.profile;
      dial.setAttribute(
        'label',
        `Detent dial for the ${DEMO_META[this.app].name.toLowerCase()}: ${profile.name}, ${mode.label.toLowerCase()}`,
      );
      ctl.enter(mode.id);
    } finally {
      this.#muted = false;
    }
    this.querySelectorAll('[data-ref="profile-name"]').forEach(
      (el) => (el.textContent = profile.name),
    );
    this.querySelectorAll('[data-ref="mode-label"]').forEach((el) => (el.textContent = mode.label));
    if (announce) this.#announce(mode.spoken, true);
  }

  #announce(text: string, soon = false) {
    if (!this.#live) return;
    clearTimeout(this.#announceTimer);
    // Settle-throttled: a flick across 50 detents produces one summary.
    this.#announceTimer = window.setTimeout(
      () => {
        if (this.#live) this.#live.textContent = text;
      },
      soon ? 60 : 480,
    );
  }

  #display(text: string) {
    if (!this.#active) return;
    this.#displayText = text.slice(0, 10);
    if (this.#displayRaf) return;
    this.#displayRaf = requestAnimationFrame(() => {
      this.#displayRaf = 0;
      this.#dial?.setAttribute('display', this.#displayText);
    });
  }

  #claim() {
    const id = this.#linkedId;
    if (!id) return;
    window.dispatchEvent(
      new CustomEvent<ClaimDetail>(CLAIM, { detail: { dial: id, owner: this } }),
    );
  }

  /* ---- Events ----------------------------------------------------------- */

  #onClaim = (e: CustomEvent<ClaimDetail>) => {
    if (e.detail.dial !== this.#linkedId) return;
    const mine = e.detail.owner === this;
    const was = this.#active;
    this.#active = mine;
    if (mine && !was) this.#apply(this.#checkedMode(), false);
  };

  #onScreenChange = (entries: IntersectionObserverEntry[]) => {
    for (const e of entries) {
      const on = e.isIntersecting;
      if (on !== this.#onScreen) {
        this.#onScreen = on;
        this.#controller?.visibility?.(on && !document.hidden);
      }
      if (this.#linkedId && !this.#active && e.intersectionRatio >= 0.6) this.#claim();
    }
  };

  #onVisibility = () => {
    this.#controller?.visibility?.(this.#onScreen && !document.hidden);
  };

  #onRadio = (e: Event) => {
    const t = e.target as HTMLInputElement | null;
    if (!t?.matches('input[data-mode]')) return;
    this.#touch();
    this.#reflect(t.value);
    if (this.#linkedId) this.#claim();
    if (this.#controller) this.#apply(t.value, true);
    else void this.#boot();
    track('demo_mode', { app: this.app, mode: t.value });
  };

  #onChange = (e: CustomEvent<DetentChangeDetail>) => {
    if (!this.#active || this.#muted) return;
    this.#touch();
    this.#controller?.change(e.detail);
  };

  #onTick = (e: CustomEvent<DetentTickDetail>) => {
    if (!this.#active || this.#muted) return;
    this.#controller?.tick?.(e.detail);
  };

  #onPress = (e: CustomEvent<DetentPressDetail>) => {
    if (!this.#active) return;
    this.#touch();
    this.#controller?.press?.(e.detail);
  };

  #onTouch = () => this.#touch();

  #touch() {
    if (this.#touched) return;
    this.#touched = true;
    this.dataset.touched = '';
    track('demo_interact', { app: this.app });
  }
}

if (!customElements.get('app-demo')) customElements.define('app-demo', AppDemoElement);

declare global {
  interface HTMLElementTagNameMap {
    'app-demo': AppDemoElement;
  }
}

export {};
