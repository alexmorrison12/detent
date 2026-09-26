/**
 * The feel station controller for /profiles/.
 *
 * One state (the feel on the dial), many views: the dial itself (through the
 * <detent-dial> contract only), the engraved ring, the torque curves, the
 * spec sheet, the library selection, the Feel Link anatomy and the address
 * bar. Sources: library rows (?p=<id>), the builder (a custom feel), or a
 * Feel Link (#v1.<payload>).
 *
 * Off the critical path: ./boot.ts fetches this on intent, on idle, or at once
 * for a deep link, and hands over anything pressed before it arrived. The
 * workbench (builder, profile file, export buttons) is a further chunk,
 * station-tools.ts, loaded on the first change of feel or the first touch,
 * focus or sight of one of its controls. The server renders the first state
 * of both, so nothing on screen waits for either.
 */
import { LIBRARY, libraryEntry, type LibraryEntry } from '@/data/community-profiles';
import { PROFILES, type ProfileId } from '@/data/product';
import { clampSpec, decodeFeel, encodeFeel, feelLinkUrl, isFeelFragment, type FeelPhysics, type FeelSpec } from '@/lib/feel-link';
import { track } from '@/lib/analytics';
import { isSoundOn, onSoundChange, setSound } from '@/lib/sound';
import { url } from '@/lib/url';
import type { DetentDialElement } from '@/scripts/dial/types';
import {
  clickTorque,
  curveLayout,
  describeCurve,
  formatRange,
  readouts,
  ringFeelMarkup,
  signed,
  specLine,
  torqueAt,
  torqueCurveMarkup,
  type CurveLayout,
} from './model';
import type { ToolAction } from './station-tools';

export type Source = { kind: 'library'; entry: LibraryEntry } | { kind: 'custom'; from?: string } | { kind: 'link' };
export interface State {
  spec: FeelSpec;
  source: Source;
}
export type Origin = 'init' | 'library' | 'builder' | 'link';

/** What the lazily loaded workbench may see and do. */
export interface Station {
  root: HTMLElement;
  state(): State;
  setState(next: State, origin: Origin): void;
  /** Called after every change of state, with where it came from. */
  onState(fn: (origin: Origin) => void): void;
  /** The shareable link for what's on the dial, brought up to date first. */
  link(): Promise<{ url: string; payload: string }>;
  status(msg: string, near?: Element | null): void;
}

/** What happened before this module arrived (see ./boot.ts): buttons pressed, a builder control changed. */
export interface Handoff {
  clicks: { el: HTMLElement; detail: number }[];
  input: EventTarget | null;
}

const TOOL_ACTIONS = new Set<string>(['copy-link', 'share', 'copy-json', 'download-json']);

export async function boot(root: HTMLElement, early: Handoff = { clicks: [], input: null }) {
  const $ = <T extends Element = HTMLElement>(sel: string, scope: ParentNode = root) => scope.querySelector<T>(sel);
  const $$ = <T extends Element = HTMLElement>(sel: string, scope: ParentNode = root) =>
    Array.from(scope.querySelectorAll<T>(sel));

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const wide = matchMedia('(min-width: 64rem)');
  const colorOf = (base: ProfileId) => PROFILES.find((p) => p.id === base)?.color ?? PROFILES[0]!.color;
  const specOf = (e: LibraryEntry): FeelSpec => clampSpec({ name: e.name, base: e.base, physics: e.physics });

  /* ---- Elements --------------------------------------------------------- */
  const dial = document.getElementById('feel-dial') as DetentDialElement | null;
  const stage = $('[data-stage]')!;
  const ring = $<SVGSVGElement>('[data-ring]');
  const ringFeel = $<SVGGElement>('[data-ring-feel]');
  const needle = $<SVGSVGElement>('[data-ring-needle]');
  const activeTick = $<SVGSVGElement>('[data-ring-active]');
  const liveAngle = $('[data-live-angle]');
  const liveTorque = $('[data-live-torque]');
  const announcer = $('[data-announce]');
  const soundBtn = $<HTMLButtonElement>('[data-sound]');
  const recordBtn = $<HTMLButtonElement>('[data-record]');
  const form = $<HTMLFormElement>('[data-builder]');

  const sheet = {
    kind: $('[data-sheet-kind-text]'),
    name: $('[data-sheet-name]'),
    feel: $('[data-sheet-feel]'),
    use: $('[data-sheet-use]'),
    readouts: $('[data-readouts]'),
    received: $('[data-received]'),
    error: $('[data-link-error]'),
  };

  const intro = { received: $('[data-intro-received]'), lede: $('[data-intro-lede]') };
  const list = $('[data-list]');
  const rows = $$<HTMLLIElement>('[data-list] > li');
  const chips = $$<HTMLButtonElement>('[data-filter]');
  const search = $<HTMLInputElement>('[data-search]');
  const count = $('[data-count]');
  const countAnnouncer = $('[data-count-announce]');
  const empty = $('[data-empty]');

  const anatomy = {
    ver: document.querySelector<HTMLElement>('[data-anatomy-ver]'),
    body: document.querySelector<HTMLElement>('[data-anatomy-body]'),
    bytes: document.querySelector<HTMLElement>('[data-anatomy-bytes]'),
    mode: document.querySelector<HTMLElement>('[data-anatomy-mode]'),
  };

  /* ---- State ------------------------------------------------------------ */
  let state: State = { spec: specOf(LIBRARY[0]!), source: { kind: 'library', entry: LIBRARY[0]! } };
  let currentPayload = '';
  let currentLink = '';
  let angle = 0;
  let dialReady = false;
  let userTurned = false;
  let addressTouched = false;
  let lastTurn = -1;
  const listeners: ((origin: Origin) => void)[] = [];

  /* ---- Curves ----------------------------------------------------------- */
  interface Curve {
    fig: HTMLElement;
    svg: SVGSVGElement;
    desc: HTMLElement | null;
    compact: boolean;
    layout: CurveLayout | null;
    cursor: HTMLElement | null;
    dot: HTMLElement | null;
    w: number;
    h: number;
  }
  const curves: Curve[] = $$('[data-curve]').map((fig) => ({
    fig,
    svg: fig.querySelector('svg')!,
    desc: fig.querySelector<HTMLElement>('[data-curve-desc]'),
    compact: fig.hasAttribute('data-compact'),
    layout: null,
    cursor: fig.querySelector<HTMLElement>('[data-curve-cursor]'),
    dot: fig.querySelector<HTMLElement>('[data-curve-dot]'),
    w: 0,
    h: 0,
  }));

  function drawCurve(c: Curve, animate = false) {
    const r = c.svg.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    c.w = Math.round(r.width);
    c.h = Math.round(r.height);
    const box = { width: c.w, height: c.h, compact: c.compact || c.w < 480 };
    c.svg.setAttribute('viewBox', `0 0 ${c.w} ${c.h}`);
    c.svg.innerHTML = torqueCurveMarkup(state.spec.physics, box);
    c.layout = curveLayout(box);
    if (c.cursor) {
      c.cursor.hidden = false;
      c.cursor.style.insetBlockStart = `${c.layout.top}px`;
      c.cursor.style.blockSize = `${c.layout.bottom - c.layout.top}px`;
    }
    if (c.desc) c.desc.textContent = describeCurve(state.spec.physics, state.spec.name);
    moveCursor(c);
    // A new profile traces in from -180° to +180°, so you read it left to right.
    if (animate && !reduced.matches) {
      const line = c.svg.querySelector<SVGPathElement>('.tc-line');
      const area = c.svg.querySelector<SVGPathElement>('.tc-area');
      const len = line?.getTotalLength() ?? 0;
      if (line && len) {
        line.animate([{ strokeDasharray: `${len}`, strokeDashoffset: `${len}` }, { strokeDasharray: `${len}`, strokeDashoffset: '0' }], {
          duration: 720,
          easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
        });
      }
      area?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 720, delay: 180, easing: 'ease-out', fill: 'backwards' });
    }
  }
  function moveCursor(c: Curve) {
    if (!c.layout || !c.cursor) return;
    const a = wrap(angle);
    const t = torqueAt(state.spec.physics, a);
    c.cursor.style.transform = `translateX(${c.layout.x(a).toFixed(1)}px)`;
    if (c.dot) c.dot.style.transform = `translateY(${(c.layout.y(t) - c.layout.top).toFixed(1)}px)`;
  }
  const ro = new ResizeObserver((entries) => {
    for (const e of entries) {
      const c = curves.find((x) => x.svg === e.target);
      if (c && (Math.round(e.contentRect.width) !== c.w || Math.round(e.contentRect.height) !== c.h)) drawCurve(c);
    }
  });
  curves.forEach((c) => ro.observe(c.svg));

  /* ---- Painting (batched per frame) ------------------------------------- */
  let paintQueued = false;
  let animateNext = false;
  function schedulePaint(animate = false) {
    animateNext ||= animate;
    if (paintQueued) return;
    paintQueued = true;
    requestAnimationFrame(() => {
      paintQueued = false;
      const anim = animateNext;
      animateNext = false;
      curves.forEach((c) => drawCurve(c, anim));
      if (ringFeel) {
        ringFeel.innerHTML = ringFeelMarkup(state.spec.physics);
        if (anim && !reduced.matches) ringFeel.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' });
      }
      paintLive();
    });
  }

  function paintSheet() {
    const { spec, source } = state;
    const e = source.kind === 'library' ? source.entry : null;
    if (sheet.kind) {
      sheet.kind.textContent = e
        ? e.kind === 'core'
          ? 'Core profile · ships on every Detent'
          : `Community profile · ${e.author}`
        : source.kind === 'link'
          ? 'Feel Link · sent to you'
          : 'Your profile · not saved anywhere but the link';
    }
    if (sheet.name) {
      sheet.name.textContent = spec.name;
      // Long names condense on the width axis instead of wrapping to a third line.
      const len = Array.from(spec.name).length;
      sheet.name.style.setProperty('--fit', `${Math.max(75, Math.min(125, 125 - (len - 9) * 4.5))}%`);
    }
    if (sheet.feel) sheet.feel.textContent = e ? e.feel : summarize(spec.physics);
    if (sheet.use) {
      sheet.use.textContent = e
        ? e.use
          ? `For: ${e.use}`
          : `Tuned for ${e.app}.`
        : source.kind === 'custom' && source.from
          ? `Remixed from ${source.from}.`
          : source.kind === 'link'
            ? 'Opened from a Feel Link. Every value was checked before it reached the dial.'
            : 'Made here, just now.';
    }
    if (sheet.readouts) {
      for (const r of readouts(spec.physics)) {
        const item = sheet.readouts.querySelector<HTMLElement>(`[data-key="${r.key}"]`);
        const dd = item?.querySelector('dd');
        if (dd && dd.textContent !== r.value) dd.textContent = r.value;
      }
    }
    const isLink = source.kind === 'link';
    if (sheet.received) sheet.received.hidden = !isLink;
    if (sheet.use) sheet.use.hidden = isLink;
    if (intro.received && intro.lede) {
      intro.received.hidden = !isLink;
      intro.lede.hidden = isLink;
      if (isLink) {
        intro.received.replaceChildren(
          'Someone sent you ',
          Object.assign(document.createElement('strong'), { textContent: spec.name }),
          '. It’s on the dial, ready to turn.',
        );
      }
    }
  }

  function paintSelection() {
    const id = state.source.kind === 'library' ? state.source.entry.id : null;
    $$<HTMLButtonElement>('[data-select]').forEach((btn) => {
      if (btn.dataset.select === id) btn.setAttribute('aria-current', 'true');
      else btn.removeAttribute('aria-current');
    });
  }

  function paintDial() {
    if (!dial || !dialReady) return;
    const { spec } = state;
    if (dial.profile !== spec.base) dial.profile = spec.base;
    dial.physics = { ...spec.physics, accents: [...(spec.physics.accents ?? [])], snaps: [...(spec.physics.snaps ?? [])] };
    dial.feelColor = colorOf(spec.base);
    // No `display` override: the knob face keeps its live readout (detent, marker,
    // degrees) so turning it reads back what it's doing. The name is on the sheet.
    dial.setAttribute('label', `Feel station dial, playing ${spec.name}`);
    const stops = spec.physics.stops;
    if (stops && (dial.angle < stops[0] || dial.angle > stops[1])) {
      dial.setAngle(Math.min(stops[1], Math.max(stops[0], dial.angle)));
    }
  }

  function paintLive() {
    const a = wrap(angle);
    const t = torqueAt(state.spec.physics, a);
    if (liveAngle) liveAngle.textContent = `${signed(angle, 1)}°`;
    if (liveTorque) liveTorque.textContent = `${signed(t, 1)} mN·m`;
    if (needle) needle.style.transform = `rotate(${angle.toFixed(2)}deg)`;
    if (activeTick) {
      const at = restingOn(state.spec.physics, angle);
      activeTick.style.opacity = at === null ? '0' : '1';
      if (at !== null) activeTick.style.transform = `rotate(${at}deg)`;
    }
    curves.forEach(moveCursor);
    // The name condenses as you turn away from noon (in 2% steps: it re-lays out the heading).
    const turn = Math.round(Math.min(1, Math.abs(a) / 180) * 50) / 50;
    if (sheet.name && turn !== lastTurn) {
      lastTurn = turn;
      sheet.name.style.setProperty('--turn', String(turn));
    }
  }

  /* ---- State changes ---------------------------------------------------- */
  function setState(next: State, origin: Origin) {
    const prevBase = state.spec.base;
    if (origin !== 'init') addressTouched = true;
    state = next;
    if (next.spec.base !== prevBase || origin === 'init') root.style.setProperty('--feel', `var(--feel-${next.spec.base})`);
    paintSheet();
    paintSelection();
    paintDial();
    schedulePaint(origin === 'library' || origin === 'link');
    scheduleLink(origin === 'builder' ? 220 : 0);
    if (next.source.kind !== 'link' && sheet.error && origin !== 'init') sheet.error.hidden = true;
    listeners.forEach((fn) => fn(origin));
    // The server rendered the workbench for the first library profile; anything else needs it live.
    if (!(next.source.kind === 'library' && next.source.entry === LIBRARY[0])) void loadTools();
  }

  function selectEntry(entry: LibraryEntry, origin: Origin, opts: { scroll?: boolean; focus?: boolean } = {}) {
    setState({ spec: specOf(entry), source: { kind: 'library', entry } }, origin);
    announce(`${entry.name} is on the dial. ${readouts(entry.physics)[0]!.value === 'None' ? 'No detents' : readouts(entry.physics)[0]!.value}, range ${formatRange(entry.physics.stops).toLowerCase()}.`);
    if (origin === 'library') track('feel_select', { id: entry.id, kind: entry.kind });
    if (opts.scroll && !wide.matches) {
      stage.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
      // Keyboard users go where the page went: to the dial, ready for the arrow keys
      // (not left on a row that is now a screen or more below).
      if (opts.focus) dial?.focus({ preventScroll: true });
    }
  }

  /* ---- Library: selection, filter, search ------------------------------- */
  root.addEventListener('click', (ev) => {
    const btn = (ev.target as Element).closest<HTMLButtonElement>('[data-select]');
    if (!btn) return;
    const entry = libraryEntry(btn.dataset.select);
    if (!entry) return;
    const inList = !!btn.closest('[data-list]');
    // detail 0: activated with Enter/Space (or assistive tech), not a pointer.
    selectEntry(entry, 'library', { scroll: inList, focus: inList && ev.detail === 0 });
  });

  let filter = 'All';
  let countTimer = 0;
  /**
   * Filter the list now; speak the result after `announceAfter` ms (null: don't).
   * Search waits for a pause in typing so the count isn't read on every keystroke.
   */
  function applyFilter(announceAfter: number | null = null) {
    const q = (search?.value ?? '').trim().toLowerCase();
    let shown = 0;
    for (const li of rows) {
      const ok = (filter === 'All' || li.dataset.category === filter) && (!q || (li.dataset.search ?? '').includes(q));
      li.hidden = !ok;
      if (ok) shown++;
    }
    const text = shown === rows.length ? `${rows.length} profiles` : `${shown} of ${rows.length} profiles`;
    if (count) count.textContent = text;
    if (empty) empty.hidden = shown > 0;
    clearTimeout(countTimer);
    if (announceAfter === null || !countAnnouncer) return;
    const spoken = shown ? text : empty?.textContent?.trim() || 'No profiles match.';
    countTimer = window.setTimeout(() => {
      // Clear first so the same count still speaks after a different filter.
      countAnnouncer.textContent = '';
      requestAnimationFrame(() => (countAnnouncer.textContent = spoken));
    }, announceAfter);
  }
  chips.forEach((chip) =>
    chip.addEventListener('click', () => {
      filter = chip.dataset.filter ?? 'All';
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      applyFilter(0);
      track('feel_filter', { category: filter });
    }),
  );
  search?.addEventListener('input', () => applyFilter(500));
  list?.addEventListener('keydown', (ev) => {
    // Up/down move between visible rows, like a preset browser.
    if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
    const buttons = rows.filter((r) => !r.hidden).map((r) => r.querySelector('button')!);
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    ev.preventDefault();
    buttons[Math.max(0, Math.min(buttons.length - 1, i + (ev.key === 'ArrowDown' ? 1 : -1)))]?.focus();
  });

  /* ---- Feel Links + address bar ----------------------------------------- */
  let linkTimer = 0;
  let linkSeq = 0;
  let linkStale = true;
  function scheduleLink(delay: number) {
    linkStale = true;
    clearTimeout(linkTimer);
    linkTimer = window.setTimeout(refreshLink, delay);
  }
  async function refreshLink() {
    clearTimeout(linkTimer);
    const seq = ++linkSeq;
    const payload = await encodeFeel(state.spec);
    if (seq !== linkSeq) return;
    linkStale = false;
    currentPayload = payload;
    const lib = state.source.kind === 'library' ? state.source.entry : null;
    currentLink = lib ? new URL(`${url('/profiles/')}?p=${lib.id}`, location.origin).toString() : feelLinkUrl(payload);
    const [ver, ...rest] = payload.split('.');
    const body = rest.join('.');
    if (anatomy.ver) anatomy.ver.textContent = `${ver}.`;
    if (anatomy.body) anatomy.body.textContent = body;
    if (anatomy.bytes) anatomy.bytes.textContent = String(body.length - 1);
    if (anatomy.mode)
      anatomy.mode.textContent = body.startsWith('z') ? 'deflated, then base64url-encoded' : 'base64url-encoded (too short to be worth deflating)';
    // Keep the address bar honest: it always opens what's on the dial.
    const u = new URL(location.href);
    if (lib) {
      u.searchParams.set('p', lib.id);
      u.hash = '';
    } else {
      u.searchParams.delete('p');
      u.hash = payload;
    }
    // A clean /profiles/ stays clean until someone picks or builds something.
    if (!addressTouched && !location.search.includes('p=') && !location.hash) return;
    if (u.href !== location.href) history.replaceState(history.state, '', u.href);
  }

  /* ---- Status line (the one nearest the button that spoke) -------------- */
  const statusEls = $$('[data-status]');
  let statusTimer = 0;
  function status(msg: string, near?: Element | null) {
    const target = (near && statusEls.find((s) => s.closest('section') === near.closest('section'))) || statusEls[0];
    statusEls.forEach((s) => s !== target && (s.textContent = ''));
    if (target) target.textContent = msg;
    clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => statusEls.forEach((s) => (s.textContent = '')), 5000);
  }

  /* ---- The workbench (builder, file, export), loaded on demand ---------- */
  const station: Station = {
    root,
    state: () => state,
    setState,
    onState: (fn) => void listeners.push(fn),
    async link() {
      if (linkStale || !currentLink) await refreshLink();
      return { url: currentLink, payload: currentPayload };
    },
    status,
  };
  type Tools = ReturnType<typeof import('./station-tools').attach>;
  let tools: Promise<Tools> | null = null;
  let pendingInput: EventTarget | null = form && early.input instanceof Node && form.contains(early.input) ? early.input : null;
  function loadTools(): Promise<Tools> {
    tools ??= import('./station-tools').then(
      (m) => {
        form?.removeEventListener('input', onEarlyInput);
        return m.attach(station, pendingInput);
      },
      (err: unknown) => {
        tools = null; // let the next intent try again
        throw err;
      },
    );
    return tools;
  }
  // An edit made before the workbench arrives is kept and applied when it does.
  const onEarlyInput = (ev: Event) => {
    pendingInput = ev.target;
    void loadTools().catch(() => undefined);
  };
  form?.addEventListener('input', onEarlyInput);
  // Without this, Enter in the name field would submit the form and reload the page.
  form?.addEventListener('submit', (ev) => ev.preventDefault());
  // Intent: a finger, a pointer press or keyboard focus on any of its controls.
  const toolZone = '[data-builder], [data-action], .file';
  const onIntent = (ev: Event) => {
    if ((ev.target as Element | null)?.closest?.(toolZone)) void loadTools().catch(() => undefined);
  };
  root.addEventListener('pointerdown', onIntent, { passive: true });
  root.addEventListener('focusin', onIntent);
  // Or simply scrolling it into view.
  const near = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      near.disconnect();
      void loadTools().catch(() => undefined);
    }
  });
  $$('[data-builder], [data-file-code]').forEach((el) => near.observe(el));
  if (pendingInput) void loadTools().catch(() => undefined);

  const canShare = typeof navigator.share === 'function';
  $$<HTMLButtonElement>('[data-action="share"]').forEach((btn) => (btn.hidden = !canShare));

  /* ---- Actions ---------------------------------------------------------- */
  root.addEventListener('click', async (ev) => {
    const el = (ev.target as Element).closest<HTMLElement>('[data-action]');
    if (!el) return;
    const action = el.dataset.action ?? '';
    if (TOOL_ACTIONS.has(action)) {
      try {
        await (await loadTools()).act(action as ToolAction, el);
      } catch {
        status('That didn’t load. Check your connection and try again.', el);
      }
      return;
    }
    switch (action) {
      case 'remix': {
        ev.preventDefault();
        const target = document.getElementById('make');
        target?.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
        document.getElementById('b-detents')?.focus({ preventScroll: true });
        track('feel_remix_click', { kind: state.source.kind });
        break;
      }
      case 'play': {
        stopSweep();
        void demoSweep();
        track('feel_play', { kind: state.source.kind });
        break;
      }
      case 'feel-this': {
        if (!dial) break;
        if (!wide.matches) stage.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
        dial.focus({ preventScroll: true });
        if (reduced.matches) announce('The dial has focus. Use the arrow keys or drag to turn it.');
        else void demoSweep();
        track('feel_this', {});
        break;
      }
    }
  });

  /* ---- Demo turn: plays the feel for people who haven't touched it ------ */
  // Out, back past noon, home, driven through the dial's physics like an
  // invisible finger: the knob catches in every detent and snap on the way
  // (so the ring flashes and, with sound on, it clicks), the spring pulls it
  // back, and each leg ends resting where the feel rests. Reduced motion gets a
  // plain eased turn instead: no catching, no spring-back.
  let sweepToken = 0;
  async function demoSweep(loop = false): Promise<void> {
    if (!dial) return;
    const token = ++sweepToken;
    // Pressed before the engine arrived (it loads on its own, the dial being on screen).
    await customElements.whenDefined('detent-dial');
    do {
      const p = state.spec.physics;
      // Endless feels turn around the current revolution instead of unwinding to zero.
      const turn = p.stops ? 0 : Math.round(dial.angle / 360) * 360;
      const keys = sweepKeys(p).map((k) => turn + k);
      if (reduced.matches) await easedTurn(token, keys);
      else {
        for (const key of keys) {
          if (token !== sweepToken) return;
          dial.setAngle(key);
          await rested(token);
        }
      }
    } while (loop && token === sweepToken);
  }
  /** Wait until the knob has come to rest (or give up waiting), then hold a beat. */
  async function rested(token: number) {
    const settle = dial?.whenSettled?.() ?? new Promise<void>((r) => setTimeout(r, 900));
    await Promise.race([settle, new Promise<void>((r) => setTimeout(r, 1800))]);
    if (token === sweepToken) await new Promise<void>((r) => setTimeout(r, 140));
  }
  function easedTurn(token: number, legs: number[]): Promise<void> {
    const keys = [dial!.angle, ...legs];
    const dur = 2400;
    return new Promise((resolve) => {
      const t0 = performance.now();
      const step = (now: number) => {
        if (token !== sweepToken) return resolve();
        const u = Math.min(1, Math.max(0, (now - t0) / dur));
        const seg = Math.min(keys.length - 2, Math.floor(u * (keys.length - 1)));
        const local = u * (keys.length - 1) - seg;
        const e = local < 0.5 ? 4 * local ** 3 : 1 - (-2 * local + 2) ** 3 / 2;
        dial!.setAngle(keys[seg]! + (keys[seg + 1]! - keys[seg]!) * e, { instant: true });
        if (u < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }
  const stopSweep = () => sweepToken++;

  /* ---- Dial events ------------------------------------------------------ */
  let liveQueued = false;
  root.addEventListener('detent:change', (ev) => {
    angle = ev.detail.angle;
    if (liveQueued) return;
    liveQueued = true;
    requestAnimationFrame(() => {
      liveQueued = false;
      paintLive();
    });
  });
  let tickTimer = 0;
  root.addEventListener('detent:tick', () => {
    if (!ring) return;
    ring.setAttribute('data-tick', '');
    clearTimeout(tickTimer);
    tickTimer = window.setTimeout(() => ring.removeAttribute('data-tick'), 70);
  });
  root.addEventListener('detent:grab', () => {
    stopSweep();
    userTurned = true;
  });
  root.addEventListener('keydown', (ev) => {
    if (ev.target === dial) stopSweep();
  });

  /* ---- Sound ------------------------------------------------------------ */
  function paintSound(on: boolean) {
    if (!soundBtn) return;
    soundBtn.setAttribute('aria-pressed', String(on));
    const label = soundBtn.querySelector('[data-sound-label]');
    if (label) label.textContent = on ? 'Sound on' : 'Sound off';
  }
  paintSound(isSoundOn());
  onSoundChange(paintSound);
  soundBtn?.addEventListener('click', () => setSound(!isSoundOn()));

  /* ---- Record a 6-second clip ------------------------------------------- */
  let recording = false;
  function recordSupported(): boolean {
    return (
      !!dial &&
      typeof MediaRecorder === 'function' &&
      typeof HTMLCanvasElement.prototype.captureStream === 'function' &&
      !!dial.getCanvas?.()
    );
  }
  function paintRecord() {
    if (recordBtn) recordBtn.hidden = !recordSupported();
  }
  recordBtn?.addEventListener('click', async () => {
    if (recording || !dial) return;
    recording = true;
    userTurned = false;
    const label = recordBtn.querySelector('[data-record-label]');
    const idle = label?.textContent ?? '';
    const frame = $('[data-stage-frame]');
    frame?.setAttribute('data-recording', '');
    recordBtn.setAttribute('aria-disabled', 'true');
    announce('Recording six seconds. Turn the dial.');
    track('feel_record_start', { kind: state.source.kind });
    // If nobody turns it in the first moment, play the feel so the clip has motion.
    const demoTimer = window.setTimeout(() => {
      if (!userTurned) void demoSweep(true);
    }, 700);
    try {
      const { recordClip, showClip } = await import('./record');
      const clip = await recordClip({
        dial,
        seconds: 6,
        overlay: () => ({
          name: state.spec.name,
          color: colorOf(state.spec.base),
          detail: specLine(state.spec.physics),
          watermark: `detent · feel it at ${location.host}${url('/profiles/')}`,
          physics: state.spec.physics,
          angle: dial.angle,
        }),
        onProgress: (s) => {
          // Whole seconds only: repainting the stage every frame costs frames.
          const left = `Recording · ${Math.max(1, Math.ceil(6 - s))} s`;
          if (label && label.textContent !== left) label.textContent = left;
        },
      });
      const dialog = document.querySelector<HTMLDialogElement>('[data-clip]');
      if (dialog) {
        const { url: link } = await station.link();
        showClip(dialog, clip, { title: `${state.spec.name} · Detent feel`, text: link, onShare: () => track('feel_clip_share', {}) });
      }
      track('feel_record_done', { type: clip.ext, kind: state.source.kind });
    } catch (err) {
      status(`The clip didn’t record (${err instanceof Error ? err.message : 'unknown error'}). Your browser may not support it.`, stage);
    } finally {
      clearTimeout(demoTimer);
      stopSweep();
      recording = false;
      frame?.removeAttribute('data-recording');
      recordBtn.removeAttribute('aria-disabled');
      if (label) label.textContent = idle;
    }
  });

  /* ---- Announcements ---------------------------------------------------- */
  let announceTimer = 0;
  function announce(msg: string) {
    if (!announcer) return;
    clearTimeout(announceTimer);
    announcer.textContent = '';
    announceTimer = window.setTimeout(() => (announcer.textContent = msg), 60);
  }

  /* ---- Boot ------------------------------------------------------------- */
  async function loadFromLocation(origin: Origin) {
    if (isFeelFragment(location.hash)) {
      const spec = await decodeFeel(location.hash);
      if (spec) {
        setState({ spec, source: { kind: 'link' } }, origin === 'init' ? 'init' : 'link');
        if (sheet.error) sheet.error.hidden = true;
        announce(`Feel Link opened: ${spec.name} is on the dial.`);
        track('feel_link_open', { base: spec.base, detents: spec.physics.detents });
        return;
      }
      selectEntry(LIBRARY[0]!, origin);
      if (sheet.error) sheet.error.hidden = false;
      track('feel_link_invalid', {});
      return;
    }
    const entry = libraryEntry(new URLSearchParams(location.search).get('p'));
    if (entry) selectEntry(entry, origin);
    else if (origin === 'init') setState(state, 'init');
  }

  window.addEventListener('hashchange', () => {
    if (isFeelFragment(location.hash) && location.hash.slice(1) !== currentPayload) void loadFromLocation('link');
  });

  applyFilter();
  await loadFromLocation('init');
  // Buttons pressed while this module was on its way.
  for (const { el, detail } of early.clicks) {
    if (el.isConnected) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail }));
  }

  if (dial) {
    await customElements.whenDefined('detent-dial');
    const ready = () => {
      dialReady = true;
      angle = dial.angle;
      paintDial();
      paintLive();
      paintRecord();
    };
    if (dial.renderer && dial.renderer !== 'none') ready();
    dial.addEventListener('detent:ready', ready);
  }
}

/* -------------------------------------------------------------------------- */

/** The detent or snap point the knob is sitting in, or null between them / on fluid. */
function restingOn(p: FeelPhysics, deg: number): number | null {
  if (p.detents) {
    const step = 360 / p.detents;
    const at = Math.round(deg / step) * step;
    if (p.stops && (wrap(at) < p.stops[0] - 0.01 || wrap(at) > p.stops[1] + 0.01)) return null;
    return at;
  }
  let best: number | null = null;
  for (const s of p.snaps ?? []) {
    const d = Math.abs(wrap(deg - s));
    if (d < 12 && (best === null || d < Math.abs(wrap(deg - best)))) best = s;
  }
  if (best === null && (p.accents ?? []).some((a) => Math.abs(wrap(deg - a)) < 6)) {
    best = (p.accents ?? []).find((a) => Math.abs(wrap(deg - a)) < 6) ?? null;
  }
  return best;
}

/** The demo turn's legs: out past 90°, back past noon, home, each ending where the feel rests. */
function sweepKeys(p: FeelPhysics): number[] {
  const hi = p.stops ? Math.min(110, p.stops[1] - 4) : 110;
  const lo = p.stops ? Math.max(-70, p.stops[0] + 4) : -70;
  return [restNear(p, hi, 30), restNear(p, lo, 30), restNear(p, 0, 15)];
}

/** The nearest detent (inside the stops), or a snap point within `reach` degrees, else `deg` itself. */
function restNear(p: FeelPhysics, deg: number, reach: number): number {
  const inside = (a: number) => !p.stops || (a >= p.stops[0] && a <= p.stops[1]);
  if (p.detents) {
    const step = 360 / p.detents;
    const at = Math.round(deg / step) * step;
    if (inside(at)) return at;
    const back = at - Math.sign(at) * step;
    return inside(back) ? back : deg;
  }
  let best = deg;
  let gap = reach;
  for (const s of p.snaps ?? []) {
    const d = Math.abs(s - deg);
    if (inside(s) && d <= gap) [best, gap] = [s, d];
  }
  return best;
}

function wrap(deg: number): number {
  return ((((deg + 180) % 360) + 360) % 360) - 180;
}

/** One sentence in the house voice for feels that don't come with one. */
function summarize(p: FeelPhysics): string {
  const bits: string[] = [];
  const snaps = p.snaps?.length ?? 0;
  const snapText = `${snaps} magnetic snap point${snaps === 1 ? '' : 's'}`;
  if (p.detents) bits.push(`${p.detents} click${p.detents === 1 ? '' : 's'} a turn at ${clickTorque(p).toFixed(1)} mN·m`);
  else if (snaps) bits.push(`smooth, with ${snapText}`);
  else bits.push('no clicks at all');
  if (p.detents && snaps) bits.push(snapText);
  if (p.accents?.includes(0)) bits.push('a heavier one at noon');
  if (p.spring) bits.push(`a spring that pulls back to noon at ${p.spring.toFixed(2)}`);
  bits.push(p.stops ? `hard stops at ${formatRange(p.stops)}` : 'no end stops');
  const s = bits.join(', ');
  const weight = p.damping >= 0.4 ? ' Heavy.' : p.damping <= 0.06 ? ' Almost weightless.' : '';
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}.${weight}`;
}
