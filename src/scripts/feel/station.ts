/**
 * The feel station controller for /profiles/.
 *
 * One state (the feel on the dial), many views: the dial itself (through the
 * <detent-dial> contract only), the engraved ring, the torque curves, the
 * spec sheet + JSON, the library selection, the builder controls, the Feel
 * Link anatomy and the address bar. Sources: library rows (?p=<id>), the
 * builder (a custom feel), or a Feel Link (#v1.<payload>).
 */
import { LIBRARY, libraryEntry, type LibraryEntry } from '@/data/community-profiles';
import { PROFILES, type ProfileId } from '@/data/product';
import {
  clampSpec,
  decodeFeel,
  encodeFeel,
  feelLinkUrl,
  isFeelFragment,
  sanitizeName,
  type FeelPhysics,
  type FeelSpec,
} from '@/lib/feel-link';
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
import { highlightJson, profileFileName, profileJson, type ProfileDoc } from './json';

type Source = { kind: 'library'; entry: LibraryEntry } | { kind: 'custom'; from?: string } | { kind: 'link' };
interface State {
  spec: FeelSpec;
  source: Source;
}
type Origin = 'init' | 'library' | 'builder' | 'link';

const root = document.querySelector<HTMLElement>('[data-feel]');
if (root) void boot(root);

async function boot(root: HTMLElement) {
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

  const sheet = {
    kind: $('[data-sheet-kind-text]'),
    name: $('[data-sheet-name]'),
    feel: $('[data-sheet-feel]'),
    use: $('[data-sheet-use]'),
    readouts: $('[data-readouts]'),
    received: $('[data-received]'),
    error: $('[data-link-error]'),
    fileName: $('[data-file-name]'),
    fileCode: $('[data-file-code]'),
  };

  const intro = { received: $('[data-intro-received]'), lede: $('[data-intro-lede]') };
  const list = $('[data-list]');
  const rows = $$<HTMLLIElement>('[data-list] > li');
  const chips = $$<HTMLButtonElement>('[data-filter]');
  const search = $<HTMLInputElement>('[data-search]');
  const count = $('[data-count]');
  const empty = $('[data-empty]');

  const form = $<HTMLFormElement>('[data-builder]');
  const ctl = <T extends HTMLInputElement>(key: string) => form?.querySelector<T>(`[data-b="${key}"]`) ?? null;
  const b = {
    name: ctl('name'),
    detents: ctl('detents'),
    strength: ctl('strength'),
    accent: ctl('accent'),
    damping: ctl('damping'),
    spring: ctl('spring'),
    stopsOn: ctl('stopsOn'),
    stops: ctl('stops'),
    snaps: ctl('snaps'),
  };
  const outs = (key: string) => form?.querySelector<HTMLOutputElement>(`[data-out="${key}"]`) ?? null;

  const anatomy = {
    ver: document.querySelector<HTMLElement>('[data-anatomy-ver]'),
    body: document.querySelector<HTMLElement>('[data-anatomy-body]'),
    bytes: document.querySelector<HTMLElement>('[data-anatomy-bytes]'),
    mode: document.querySelector<HTMLElement>('[data-anatomy-mode]'),
  };

  /* ---- State ------------------------------------------------------------ */
  let state: State = { spec: specOf(LIBRARY[0]!), source: { kind: 'library', entry: LIBRARY[0]! } };
  let nameEdited = false;
  let builderTouched = false;
  let currentPayload = '';
  let currentLink = '';
  let angle = 0;
  let dialReady = false;
  let userTurned = false;
  let addressTouched = false;
  let lastTurn = -1;

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

  function docFor(s: State): ProfileDoc {
    const base = { name: s.spec.name, base: s.spec.base, color: colorOf(s.spec.base), physics: s.spec.physics };
    if (s.source.kind === 'library') {
      const e = s.source.entry;
      return { ...base, id: e.id, author: e.author, app: e.kind === 'community' ? e.app : undefined };
    }
    return base;
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
    const doc = docFor(state);
    if (sheet.fileName) sheet.fileName.textContent = e ? `${e.id}.detent.json` : profileFileName(spec.name);
    if (sheet.fileCode) sheet.fileCode.innerHTML = highlightJson(profileJson(doc));
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
    dial.setAttribute('display', shortLabel(spec.name));
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
    if (origin !== 'builder') syncBuilder();
    paintOutputs();
    schedulePaint(origin === 'library' || origin === 'link');
    scheduleLink(origin === 'builder' ? 220 : 0);
    if (next.source.kind !== 'link' && sheet.error && origin !== 'init') sheet.error.hidden = true;
  }

  function selectEntry(entry: LibraryEntry, origin: Origin, opts: { scroll?: boolean } = {}) {
    nameEdited = false;
    setState({ spec: specOf(entry), source: { kind: 'library', entry } }, origin);
    announce(`${entry.name} is on the dial. ${readouts(entry.physics)[0]!.value === 'None' ? 'No detents' : readouts(entry.physics)[0]!.value}, range ${formatRange(entry.physics.stops).toLowerCase()}.`);
    if (origin === 'library') track('feel_select', { id: entry.id, kind: entry.kind });
    if (opts.scroll && !wide.matches) {
      stage.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
    }
  }

  /* ---- Library: selection, filter, search ------------------------------- */
  root.addEventListener('click', (ev) => {
    const btn = (ev.target as Element).closest<HTMLButtonElement>('[data-select]');
    if (!btn) return;
    const entry = libraryEntry(btn.dataset.select);
    if (!entry) return;
    selectEntry(entry, 'library', { scroll: !!btn.closest('[data-list]') });
  });

  let filter = 'All';
  function applyFilter() {
    const q = (search?.value ?? '').trim().toLowerCase();
    let shown = 0;
    for (const li of rows) {
      const ok = (filter === 'All' || li.dataset.category === filter) && (!q || (li.dataset.search ?? '').includes(q));
      li.hidden = !ok;
      if (ok) shown++;
    }
    if (count) count.textContent = shown === rows.length ? `${rows.length} profiles` : `${shown} of ${rows.length} profiles`;
    if (empty) empty.hidden = shown > 0;
  }
  chips.forEach((chip) =>
    chip.addEventListener('click', () => {
      filter = chip.dataset.filter ?? 'All';
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      applyFilter();
      track('feel_filter', { category: filter });
    }),
  );
  search?.addEventListener('input', applyFilter);
  list?.addEventListener('keydown', (ev) => {
    // Up/down move between visible rows, like a preset browser.
    if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
    const buttons = rows.filter((r) => !r.hidden).map((r) => r.querySelector('button')!);
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    ev.preventDefault();
    buttons[Math.max(0, Math.min(buttons.length - 1, i + (ev.key === 'ArrowDown' ? 1 : -1)))]?.focus();
  });

  /* ---- Builder ---------------------------------------------------------- */
  const pct = (el: HTMLInputElement | null) => (el ? Number(el.value) / 100 : 0);

  function evenSnaps(n: number, stops: [number, number] | null): number[] {
    if (n <= 0) return [];
    if (stops) {
      const span = stops[1] - stops[0];
      return Array.from({ length: n }, (_, i) => Math.round(stops[0] + ((i + 0.5) * span) / n));
    }
    return Array.from({ length: n }, (_, i) => Math.round(wrap((i * 360) / n)));
  }

  function readBuilder(): FeelSpec {
    const prev = state.spec.physics;
    const stops: [number, number] | null = b.stopsOn?.checked ? [-Number(b.stops?.value ?? 135), Number(b.stops?.value ?? 135)] : null;
    const snapCount = Number(b.snaps?.value ?? 0);
    let snaps = prev.snaps ?? [];
    const outside = stops && snaps.some((s) => s < stops[0] || s > stops[1]);
    if (snapCount !== snaps.length || outside) snaps = evenSnaps(snapCount, stops);
    let accents = (prev.accents ?? []).filter((a) => a !== 0);
    if (b.accent?.checked) accents = [0, ...accents];
    const base = (form?.querySelector<HTMLInputElement>('[data-b="base"]:checked')?.value as ProfileId) ?? state.spec.base;
    const physics: FeelPhysics = {
      detents: Number(b.detents?.value ?? 0),
      strength: pct(b.strength),
      damping: pct(b.damping),
      spring: pct(b.spring),
      stops,
      accents,
      snaps,
    };
    return clampSpec({ name: b.name?.value ?? '', base, physics });
  }

  function syncBuilder() {
    if (!form) return;
    const p = state.spec.physics;
    if (b.name) b.name.value = state.spec.name;
    form.querySelectorAll<HTMLInputElement>('[data-b="base"]').forEach((r) => (r.checked = r.value === state.spec.base));
    if (b.detents) b.detents.value = String(p.detents);
    if (b.strength) b.strength.value = String(Math.round(p.strength * 100));
    if (b.accent) b.accent.checked = (p.accents ?? []).includes(0);
    if (b.damping) b.damping.value = String(Math.round(p.damping * 100));
    if (b.spring) b.spring.value = String(Math.round(p.spring * 100));
    if (b.stopsOn) b.stopsOn.checked = !!p.stops;
    if (b.stops) {
      b.stops.disabled = !p.stops;
      if (p.stops) b.stops.value = String(Math.max(-p.stops[0], p.stops[1]));
    }
    if (b.snaps) b.snaps.value = String((p.snaps ?? []).length);
  }

  function paintOutputs() {
    if (!form) return;
    const p = state.spec.physics;
    const set = (key: string, input: HTMLInputElement | null, text: string) => {
      const o = outs(key);
      if (o) o.textContent = text;
      if (input) {
        input.setAttribute('aria-valuetext', text);
        const min = Number(input.min || 0);
        const max = Number(input.max || 100);
        input.style.setProperty('--fill', `${((Number(input.value) - min) / (max - min || 1)) * 100}%`);
      }
    };
    set('detents', b.detents, p.detents ? `${p.detents} per turn` : 'None');
    set('strength', b.strength, `${clickTorque(p).toFixed(1)} mN·m`);
    set('damping', b.damping, p.damping.toFixed(2));
    set('spring', b.spring, p.spring ? p.spring.toFixed(2) : 'Off');
    set('stops', b.stops, p.stops ? formatRange(p.stops) : 'Off');
    const n = (p.snaps ?? []).length;
    set('snaps', b.snaps, n ? `${n} point${n === 1 ? '' : 's'}` : 'None');
  }

  function builderChanged(ev: Event) {
    const target = ev.target as HTMLInputElement;
    if (target === b.stopsOn && b.stops) b.stops.disabled = !b.stopsOn.checked;
    const src = state.source;
    const from =
      src.kind === 'library' ? src.entry.name : src.kind === 'custom' ? src.from : state.spec.name;
    if (target === b.name) nameEdited = true;
    else if (!nameEdited && src.kind !== 'custom' && b.name) b.name.value = sanitizeName(`${from ?? 'Ratchet'} remix`);
    const spec = readBuilder();
    setState({ spec, source: { kind: 'custom', from } }, 'builder');
    if (target !== b.name && target.type !== 'radio') flashReadout(target.dataset.b);
    if (!builderTouched) {
      builderTouched = true;
      track('feel_builder_edit', { from: from ?? '' });
    }
  }
  form?.addEventListener('input', builderChanged);
  form?.addEventListener('submit', (ev) => ev.preventDefault());

  let flashTimer = 0;
  function flashReadout(key: string | undefined) {
    const map: Record<string, string> = { stopsOn: 'range', stops: 'range', accent: 'accents' };
    const k = key ? (map[key] ?? key) : '';
    sheet.readouts?.querySelectorAll('[data-changed]').forEach((n) => n.removeAttribute('data-changed'));
    sheet.readouts?.querySelector(`[data-key="${k}"]`)?.setAttribute('data-changed', '');
    clearTimeout(flashTimer);
    flashTimer = window.setTimeout(
      () => sheet.readouts?.querySelectorAll('[data-changed]').forEach((n) => n.removeAttribute('data-changed')),
      900,
    );
  }

  /* ---- Feel Links + address bar ----------------------------------------- */
  let linkTimer = 0;
  let linkSeq = 0;
  function scheduleLink(delay: number) {
    clearTimeout(linkTimer);
    linkTimer = window.setTimeout(refreshLink, delay);
  }
  async function refreshLink() {
    const seq = ++linkSeq;
    const payload = await encodeFeel(state.spec);
    if (seq !== linkSeq) return;
    currentPayload = payload;
    const lib = state.source.kind === 'library' ? state.source.entry : null;
    currentLink = lib ? new URL(`${url('/profiles/')}?p=${lib.id}`, location.origin).toString() : feelLinkUrl(payload);
    const [ver, ...rest] = payload.split('.');
    if (anatomy.ver) anatomy.ver.textContent = `${ver}.`;
    if (anatomy.body) anatomy.body.textContent = rest.join('.');
    const body = rest.join('.');
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

  /* ---- Actions ---------------------------------------------------------- */
  const statusEls = $$('[data-status]');
  let statusTimer = 0;
  function status(msg: string, near?: Element | null) {
    const target = (near && statusEls.find((s) => s.closest('section') === near.closest('section'))) || statusEls[0];
    statusEls.forEach((s) => s !== target && (s.textContent = ''));
    if (target) target.textContent = msg;
    clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => statusEls.forEach((s) => (s.textContent = '')), 5000);
  }

  async function copyText(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;inset-block-start:-100px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      ta.remove();
      return ok;
    }
  }

  function download(text: string, name: string, type = 'application/json') {
    const blob = new Blob([text], { type });
    const href = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  const canShare = typeof navigator.share === 'function';
  $$<HTMLButtonElement>('[data-action="share"]').forEach((btn) => (btn.hidden = !canShare));

  root.addEventListener('click', async (ev) => {
    const el = (ev.target as Element).closest<HTMLElement>('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    const fileName = state.source.kind === 'library' ? `${state.source.entry.id}.detent.json` : profileFileName(state.spec.name);
    switch (action) {
      case 'copy-link': {
        if (!currentLink) await refreshLink();
        const ok = await copyText(currentLink);
        status(
          ok
            ? state.source.kind === 'library'
              ? `Link copied. It opens ${state.spec.name} on the dial.`
              : `Feel Link copied. ${currentPayload.length} characters, and the whole feel is in them.`
            : `Couldn’t reach the clipboard. The address bar has the same link.`,
          el,
        );
        track('feel_link_copy', { kind: state.source.kind });
        break;
      }
      case 'share': {
        if (!currentLink) await refreshLink();
        try {
          await navigator.share({
            title: `${state.spec.name} · Detent feel`,
            text: `Turn this: ${state.spec.name}, a Detent feel.`,
            url: currentLink,
          });
          track('feel_share', { kind: state.source.kind });
        } catch {
          /* dismissed */
        }
        break;
      }
      case 'copy-json': {
        const ok = await copyText(profileJson(docFor(state)));
        status(ok ? `${fileName} copied.` : `Couldn’t reach the clipboard. Try Download instead.`, el);
        track('feel_export', { how: 'copy' });
        break;
      }
      case 'download-json': {
        download(profileJson(docFor(state)) + '\n', fileName);
        status(`Saved ${fileName}.`, el);
        track('feel_export', { how: 'download' });
        break;
      }
      case 'remix': {
        ev.preventDefault();
        const target = document.getElementById('make');
        target?.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
        b.detents?.focus({ preventScroll: true });
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

  /* ---- Demo sweep: plays the feel for people who haven't touched it ----- */
  let sweepToken = 0;
  function demoSweep(loop = false): Promise<void> {
    if (!dial) return Promise.resolve();
    const token = ++sweepToken;
    const p = state.spec.physics;
    const reach = p.stops ? Math.min(110, p.stops[1] - 4) : 110;
    const back = p.stops ? Math.max(-70, p.stops[0] + 4) : -70;
    const start = dial.angle;
    const keys = [start, reach, back, 0];
    const dur = 2400;
    return new Promise((resolve) => {
      const t0 = performance.now();
      const step = (now: number) => {
        if (token !== sweepToken) return resolve();
        const u = Math.min(1, Math.max(0, (now - t0) / dur));
        const seg = Math.min(keys.length - 2, Math.floor(u * (keys.length - 1)));
        const local = u * (keys.length - 1) - seg;
        const e = local < 0.5 ? 4 * local ** 3 : 1 - (-2 * local + 2) ** 3 / 2;
        dial.setAngle(keys[seg]! + (keys[seg + 1]! - keys[seg]!) * e, { instant: true });
        if (u < 1) requestAnimationFrame(step);
        else if (loop) requestAnimationFrame(() => demoSweep(true).then(resolve));
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
      const { recordClip } = await import('./record');
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
      openClip(clip);
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

  const clipDialog = document.querySelector<HTMLDialogElement>('[data-clip]');
  let clipUrl = '';
  function openClip(clip: import('./record').Clip) {
    if (!clipDialog) return;
    const video = clipDialog.querySelector<HTMLVideoElement>('[data-clip-video]');
    const dl = clipDialog.querySelector<HTMLAnchorElement>('[data-clip-download]');
    const share = clipDialog.querySelector<HTMLButtonElement>('[data-clip-share]');
    const meta = clipDialog.querySelector<HTMLElement>('[data-clip-meta]');
    if (clipUrl) URL.revokeObjectURL(clipUrl);
    clipUrl = clip.url;
    if (video) {
      video.src = clip.url;
      void video.play().catch(() => undefined);
    }
    if (dl) {
      dl.href = clip.url;
      dl.download = clip.file.name;
    }
    if (meta) meta.textContent = `${clip.ext.toUpperCase()} · ${clip.width} × ${clip.height} · ${(clip.blob.size / 1e6).toFixed(1)} MB`;
    if (share) {
      share.hidden = !(navigator.canShare?.({ files: [clip.file] }) ?? false);
      share.onclick = async () => {
        try {
          await navigator.share({ files: [clip.file], title: `${state.spec.name} · Detent feel`, text: currentLink });
          track('feel_clip_share', {});
        } catch {
          /* dismissed */
        }
      };
    }
    clipDialog.showModal();
  }
  clipDialog?.addEventListener('click', (ev) => {
    if (ev.target === clipDialog || (ev.target as Element).closest('[data-clip-close]')) clipDialog.close();
  });
  clipDialog?.addEventListener('close', () => {
    clipDialog.querySelector<HTMLVideoElement>('[data-clip-video]')?.pause();
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
        nameEdited = false;
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

function wrap(deg: number): number {
  return ((((deg + 180) % 360) + 360) % 360) - 180;
}

/** A short label for the knob's round display (the contract allows 10; 8 reads better). */
function shortLabel(name: string): string {
  const up = name.toUpperCase();
  if (up.length <= 8) return up;
  const first = up.split(' ')[0] ?? up;
  return first.length <= 10 ? first : up.slice(0, 8);
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
