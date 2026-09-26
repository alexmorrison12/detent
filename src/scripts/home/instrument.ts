/**
 * Home night chapter controller. One dial (#home-dial) drives the page:
 *   - hero headline width + weight follow the knob angle (the signature),
 *   - a mono readout and the engraved scale follow every detent,
 *   - the feel picker switches the dial's profile and the chapter's color,
 *   - scroll through the mechanism explodes the dial (static when reduced),
 *   - the app tabs switch the dial's feel the way the real product does.
 *
 * Talks to the dial only through the public contract in ../dial/types.ts.
 * Attributes are used for profile/camera/display so nothing shadows the
 * element's accessors if this module runs before the dial is upgraded.
 */
import type { DetentChangeDetail, DetentDialElement, DetentTickDetail } from '@/scripts/dial/types';
import { byProfile, type ProfileId } from '@/data/product';
import { track } from '@/lib/analytics';
import { isSoundOn, onSoundChange, setSound } from '@/lib/sound';
import { TQ_BOX, plotX, plotY, torque, wrap } from './torque';

type SceneId = 'hero' | 'feel' | 'mech' | 'context';

const root = document.querySelector<HTMLElement>('[data-instrument]');
const dial = document.getElementById('home-dial') as DetentDialElement | null;
if (root && dial) init(root, dial);

function init(root: HTMLElement, dial: DetentDialElement) {
  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel);
  const $$ = <T extends Element = HTMLElement>(sel: string) =>
    Array.from(root.querySelectorAll<T>(sel));

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia('(min-width: 64rem)');

  const stage = $('[data-stage]')!;
  const headline = $('[data-headline]')!;
  const marker = $<SVGGElement>('[data-marker]');
  const ro = {
    angle: $('[data-ro-angle]'),
    detent: $('[data-ro-detent]'),
    detentLabel: $('[data-ro-detent-label]'),
    profile: $('[data-ro-profile]'),
    width: $('[data-ro-width]'),
  };
  const announce = $('[data-announce]');
  const plotCursor = $('[data-plot-cursor]');
  const plotDot = $('[data-plot-dot]');
  const radios = $$<HTMLInputElement>('input[name="home-profile"]');
  const parts = $$('[data-part]');
  const tabs = $$<HTMLButtonElement>('[role="tab"]');
  const panels = $$('[role="tabpanel"]');
  const sceneEls = $$('[data-scene-id]').map((el) => ({ el, id: el.dataset.sceneId as SceneId }));
  const mechEl = sceneEls.find((s) => s.id === 'mech')?.el;

  const state = {
    scene: 'hero' as SceneId,
    userProfile: (radios.find((r) => r.checked)?.value as ProfileId) || 'ratchet',
    dialProfile: 'ratchet' as ProfileId,
    tab: tabs[0],
    part: '' as string,
    angle: 0,
    tickIndex: 0,
    changes: 0,
    touched: false,
    explode: -1,
  };

  /* ---------------------------------------------------------------- dial */
  let defined = false;
  customElements.whenDefined('detent-dial').then(() => {
    defined = true;
    applyExplode(state.explode < 0 ? 0 : state.explode, true);
  });

  function setDialProfile(id: ProfileId) {
    if (state.dialProfile === id && dial.getAttribute('profile') === id) return;
    state.dialProfile = id;
    dial.setAttribute('profile', id);
    stage.dataset.profile = id;
    paintReadout();
    paintPlot();
  }

  function setDisplay(text: string | null) {
    if (text) dial.setAttribute('display', text);
    else dial.removeAttribute('display');
  }

  function applyExplode(v: number, force = false) {
    if (!force && Math.abs(v - state.explode) < 0.002) return;
    state.explode = v;
    if (defined) dial.explode = v;
  }

  /* ------------------------------------------------------ headline + readout */
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  let frame = 0;
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(flush);
  };

  function flush() {
    frame = 0;
    const a = state.angle;
    // 0° = rest (125% wide, 780): half a turn squeezes it to 62%.
    const t = (1 + Math.cos((a * Math.PI) / 180)) / 2;
    const wdth = 62 + 63 * t;
    const wght = 900 - 120 * t;
    headline.style.setProperty('--wdth', wdth.toFixed(1));
    headline.style.setProperty('--wght', wght.toFixed(0));
    if (ro.width) ro.width.textContent = `${Math.round(wdth)}%`;
    if (ro.angle) {
      const w = wrap(a);
      const sign = w < -0.05 ? '−' : '+';
      ro.angle.textContent = `${sign}${Math.abs(w).toFixed(1).padStart(5, '0')}°`;
    }
    marker?.setAttribute('transform', `rotate(${a.toFixed(2)})`);
    paintDetent();
    paintPlot();
  }

  function paintDetent() {
    const ph = byProfile(state.dialProfile).physics;
    let label = 'Detent';
    let value = '';
    if (ph.detents > 0) {
      const n = ph.detents;
      const step = 360 / n;
      const idx = (((Math.round(state.angle / step) % n) + n) % n) as number;
      value = `${pad(idx)} / ${n}`;
    } else if (ph.snaps?.length) {
      label = 'Snap';
      const w = wrap(state.angle);
      let best = -1;
      let dist = Infinity;
      ph.snaps.forEach((s, i) => {
        const d = Math.abs(wrap(w - s));
        if (d < dist) {
          dist = d;
          best = i;
        }
      });
      value = dist < 10 ? `${best + 1} / ${ph.snaps.length}` : `– / ${ph.snaps.length}`;
    } else if (ph.stops) {
      label = 'Position';
      const [lo, hi] = ph.stops;
      const v = Math.min(1, Math.max(0, (state.angle - lo) / (hi - lo)));
      value = `${pad(Math.round(v * 100), 3)}%`;
    } else {
      label = 'Detents';
      value = 'none';
    }
    if (ro.detentLabel && ro.detentLabel.textContent !== label) ro.detentLabel.textContent = label;
    if (ro.detent) ro.detent.textContent = value;
  }

  function paintReadout() {
    if (ro.profile) ro.profile.textContent = byProfile(state.dialProfile).name;
    paintDetent();
  }

  function paintPlot() {
    if (!plotCursor || !plotDot) return;
    const ph = byProfile(state.userProfile).physics;
    const a = ph.stops
      ? Math.min(ph.stops[1], Math.max(ph.stops[0], state.angle))
      : wrap(state.angle);
    const x = `${((plotX(Math.max(-180, Math.min(180, a)), TQ_BOX) / TQ_BOX.width) * 100).toFixed(2)}%`;
    const y = `${((plotY(torque(ph, a), TQ_BOX) / TQ_BOX.height) * 100).toFixed(2)}%`;
    plotCursor.style.left = x;
    plotDot.style.left = x;
    plotDot.style.top = y;
  }

  function markTouched() {
    if (state.touched) return;
    state.touched = true;
    root.dataset.touched = '';
    headline.getAnimations().forEach((an) => an.cancel());
    track('dial_turn', { placement: 'home', scene: state.scene });
  }

  dial.addEventListener('detent:change', (e: CustomEvent<DetentChangeDetail>) => {
    state.angle = e.detail.angle;
    schedule();
  });
  let tickTimer = 0;
  dial.addEventListener('detent:tick', (e: CustomEvent<DetentTickDetail>) => {
    state.tickIndex = e.detail.index;
    if (reduced.matches) return;
    stage.dataset.ticked = '';
    clearTimeout(tickTimer);
    tickTimer = window.setTimeout(() => delete stage.dataset.ticked, 70);
  });
  dial.addEventListener('detent:grab', markTouched);
  dial.addEventListener('keydown', (e) => {
    if (e.key.startsWith('Arrow') || e.key.startsWith('Page')) markTouched();
  });
  dial.addEventListener('wheel', markTouched, { passive: true });

  /* --------------------------------------------------------------- feel */
  radios.forEach((r) =>
    r.addEventListener('change', () => {
      if (!r.checked) return;
      const id = r.value as ProfileId;
      state.userProfile = id;
      state.changes += 1;
      if (state.scene !== 'context') setDialProfile(id);
      paintPlot();
      const p = byProfile(id);
      if (announce) announce.textContent = `${p.name}. ${p.feel}`;
      track('profile_try', { profile: id, n: state.changes, placement: 'home' });
      if (state.changes === 3) {
        import('./capture').then((m) => m.reveal(root)).catch(() => {});
      }
    }),
  );

  /* ------------------------------------------------------------ context */
  function selectTab(tab: HTMLButtonElement, focus = false) {
    state.tab = tab;
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach((p) => {
      const on = p.id === tab.getAttribute('aria-controls');
      if (on) p.dataset.active = '';
      else delete p.dataset.active;
      p.hidden = !on;
    });
    if (focus) tab.focus();
    if (state.scene === 'context') applyScene('context', true);
  }
  panels.forEach((p) => (p.hidden = p.dataset.active === undefined));
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => {
      selectTab(tab);
      track('context_tab', { app: tab.dataset.app, placement: 'home' });
    });
    tab.addEventListener('keydown', (e) => {
      const map: Record<string, number> = {
        ArrowRight: 1,
        ArrowLeft: -1,
        Home: -i,
        End: tabs.length - 1 - i,
      };
      if (!(e.key in map)) return;
      e.preventDefault();
      const next = tabs[(i + map[e.key]! + tabs.length) % tabs.length]!;
      selectTab(next, true);
    });
  });

  /* ------------------------------------------------------------- scenes */
  function applyScene(id: SceneId, force = false) {
    if (id === state.scene && !force) return;
    state.scene = id;
    root.dataset.scene = id;
    dial.setAttribute('camera', id === 'mech' ? 'exploded' : 'hero');
    if (id === 'context' && state.tab) {
      setDialProfile((state.tab.dataset.profile as ProfileId) || state.userProfile);
      setDisplay(state.tab.dataset.display ?? null);
    } else {
      setDialProfile(state.userProfile);
      setDisplay(id === 'mech' && state.part ? partDisplay(state.part) : null);
    }
    if (id !== 'mech') applyExplode(0);
  }

  const partDisplay = (id: string) =>
    parts.find((p) => p.dataset.part === id)?.dataset.display ?? null;

  function setPart(id: string) {
    if (id === state.part) return;
    state.part = id;
    parts.forEach((p) => {
      if (p.dataset.part === id) p.dataset.active = '';
      else delete p.dataset.active;
    });
    if (state.scene === 'mech') setDisplay(partDisplay(id));
  }

  const smooth = (e0: number, e1: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };

  let scrollFrame = 0;
  function measure() {
    scrollFrame = 0;
    const vh = innerHeight;
    // The line where a scene becomes "current": mid-screen on desktop,
    // lower on mobile because the docked stage owns the top of the screen.
    const line = vh * (desktop.matches ? 0.5 : 0.7);
    let current: SceneId = state.scene;
    for (const s of sceneEls) {
      const r = s.el.getBoundingClientRect();
      if (r.top <= line && r.bottom > line) {
        current = s.id;
        break;
      }
    }
    applyScene(current);

    if (mechEl && current === 'mech') {
      const r = mechEl.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (line - r.top) / r.height));
      const e = reduced.matches ? 1 : smooth(0.04, 0.3, p) * (1 - smooth(0.86, 0.98, p));
      applyExplode(e);
      let active = parts[0]?.dataset.part ?? '';
      for (const el of parts)
        if (el.getBoundingClientRect().top <= line) active = el.dataset.part ?? active;
      setPart(active);
    }
  }
  const onScroll = () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(measure);
  };

  // Only listen while the chapter is anywhere near the viewport.
  let listening = false;
  new IntersectionObserver(
    ([entry]) => {
      if (!entry) return;
      if (entry.isIntersecting && !listening) {
        listening = true;
        addEventListener('scroll', onScroll, { passive: true });
        addEventListener('resize', onScroll, { passive: true });
        onScroll();
      } else if (!entry.isIntersecting && listening) {
        listening = false;
        removeEventListener('scroll', onScroll);
        removeEventListener('resize', onScroll);
      }
    },
    { rootMargin: '200px 0px' },
  ).observe(root);
  reduced.addEventListener('change', onScroll);

  /* -------------------------------------------------------------- sound */
  const chips = $$<HTMLButtonElement>('[data-sound-chip]');
  const paintSound = (on: boolean) =>
    chips.forEach((c) => c.setAttribute('aria-pressed', String(on)));
  paintSound(isSoundOn());
  onSoundChange(paintSound);
  chips.forEach((c) =>
    c.addEventListener('click', () => {
      const next = !isSoundOn();
      setSound(next);
      track('sound_toggle', { on: next, placement: 'home-stage' });
    }),
  );

  /* ---------------------------------------------------------------- go */
  setDialProfile(state.userProfile);
  if (state.userProfile !== 'ratchet') paintPlot();
  schedule();
}
