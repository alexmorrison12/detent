/**
 * /shop/ configurator. The form is the source of input; `state` is the
 * source of truth. Every change: normalize → write back to the form →
 * redraw stage and price panel → mirror to the URL (replaceState) and
 * localStorage → track config_change.
 */
import { PHASES } from '@/config/launch';
import { PAYMENT, byEdition, byFinish, byProfile, formatUsd, type FinishId } from '@/data/product';
import { ENGRAVING, sanitizeEngraving } from '@/data/shop';
import { addLine } from '@/lib/cart';
import { track } from '@/lib/analytics';
import { read, write } from '@/lib/storage';
import { url } from '@/lib/url';
import { captureRef, getReservation } from '@/lib/waitlist';
import type { DetentDialElement } from '@/scripts/dial/types';
import {
  DEFAULT_BUILD,
  MAX_QTY,
  buildTitle,
  cartLinesFor,
  currentPhase,
  depositFor,
  hasBuildParams,
  includedAccessories,
  normalize,
  parseBuild,
  quote,
  serializeBuild,
  type Build,
} from './build';
import { feelRingMarkup, feelSummary } from './feel-ring';
import { quoteLinesHtml } from './render';
import { shareOrCopy } from './share';

const BUILD_KEYS = ['edition', 'finish', 'feel', 'engrave', 'acc', 'qty'];
const STORE_KEY = 'shop:build';

const form = document.querySelector<HTMLFormElement>('[data-configurator]');
if (form) init(form);

function init(form: HTMLFormElement) {
  const $ = <T extends Element>(sel: string, root: ParentNode = document) =>
    root.querySelector<T>(sel);
  const $$ = <T extends Element>(sel: string, root: ParentNode = document) => [
    ...root.querySelectorAll<T>(sel),
  ];

  const stage = $<HTMLElement>('[data-stage]')!;
  const dial = $<DetentDialElement>('#config-dial');
  const engraveInput = $<HTMLInputElement>('[data-engrave]', form)!;
  const qtyInput = $<HTMLInputElement>('[data-qty]', form)!;
  const live = document.createElement('p');
  live.className = 'visually-hidden';
  live.setAttribute('role', 'status');
  form.append(live);

  /* ---------------------------------------------------------------- state */
  const params = new URLSearchParams(location.search);
  const saved = read<Partial<Build> | null>(STORE_KEY, null);
  let state: Build = hasBuildParams(params)
    ? parseBuild(params)
    : saved
      ? parseBuild(new URLSearchParams(serializeBuild({ ...DEFAULT_BUILD, ...saved } as Build)))
      : { ...DEFAULT_BUILD };
  let accChoice = new Set(state.acc);
  let lastOneFinish: FinishId = byEdition('one').finishes.includes(state.finish)
    ? state.finish
    : 'graphite';
  let prevFeel = '';

  /* --------------------------------------------------------------- render */
  function writeForm(b: Build) {
    const check = (name: string, value: string) => {
      const el = form.querySelector<HTMLInputElement>(`input[name="${name}"][value="${value}"]`);
      if (el && !el.checked) el.checked = true;
    };
    check('edition', b.edition);
    check('finish', b.finish);
    check('feel', b.feel);
    if (engraveInput.value.trimEnd() !== b.engrave) engraveInput.value = b.engrave;
    qtyInput.value = String(b.qty);
    const included = includedAccessories(b.edition);
    for (const box of $$<HTMLInputElement>('input[name="acc"]', form)) {
      const inc = included.includes(box.value);
      box.disabled = inc;
      box.checked = inc || b.acc.includes(box.value);
      const label = box.closest('label')!;
      $<HTMLElement>('[data-acc-price]', label)!.hidden = inc;
      $<HTMLElement>('[data-acc-included]', label)!.hidden = !inc;
    }
    for (const btn of $$<HTMLButtonElement>('[data-qty-step]', form)) {
      const dir = Number(btn.dataset.qtyStep);
      const atEdge = (dir < 0 && b.qty <= 1) || (dir > 0 && b.qty >= MAX_QTY);
      btn.setAttribute('aria-disabled', String(atEdge));
    }
  }

  function renderStage(b: Build) {
    const profile = byProfile(b.feel);
    const finish = byFinish(b.finish);
    const edition = byEdition(b.edition);
    if (dial) {
      if (dial.getAttribute('finish') !== b.finish) dial.setAttribute('finish', b.finish);
      if (dial.getAttribute('profile') !== b.feel) dial.setAttribute('profile', b.feel);
    }
    stage.dataset.feel = profile.id;
    $('[data-feel-name]', stage)!.textContent = profile.name;
    $('[data-feel-summary]', stage)!.textContent = feelSummary(profile);
    $('[data-stage-sku]', stage)!.textContent = `${edition.sku} · ${finish.name}`;
    const ring = $<SVGGElement>('[data-feel-ring]', stage)!;
    if (prevFeel !== profile.id) {
      ring.innerHTML = feelRingMarkup(profile);
      prevFeel = profile.id;
      sweep();
    }
    const text = $<SVGElement>('[data-engrave-text]', stage)!;
    const engraveEl = text.parentElement!;
    text.textContent = b.engrave || `Engraving, up to ${ENGRAVING.maxLength} characters`;
    engraveEl.toggleAttribute('data-empty', !b.engrave);
    $<SVGElement>('[data-serial]', stage)!.setAttribute(
      'visibility',
      b.edition === 'founders' ? 'visible' : 'hidden',
    );

    $('[data-value="finish"]', form)!.textContent = finish.name;
    $('[data-finish-line]', form)!.textContent = finish.line;
    $('[data-value="feel"]', form)!.textContent = profile.name;
    $('[data-feel-line]', form)!.textContent = profile.feel;
    const count = $<HTMLElement>('[data-engrave-count]', form)!;
    count.textContent = `${b.engrave.length}/${ENGRAVING.maxLength}`;
    count.toggleAttribute('data-full', b.engrave.length >= ENGRAVING.maxLength);
  }

  function sweep() {
    delete stage.dataset.sweep;
    void stage.offsetWidth; // restart the animation
    stage.dataset.sweep = '';
  }

  function burn() {
    const el = $<SVGElement>('.stage__engrave', stage);
    if (!el) return;
    el.setAttribute('data-burning', '');
    requestAnimationFrame(() => requestAnimationFrame(() => el.removeAttribute('data-burning')));
  }

  function renderPanel(b: Build) {
    const q = quote(b, currentPhase());
    const set = (sel: string, text: string) => $$(sel).forEach((el) => (el.textContent = text));
    $$('[data-build-lines]').forEach((el) => (el.innerHTML = quoteLinesHtml(q.lines)));
    set('[data-build-title]', buildTitle(b));
    set('[data-build-total]', formatUsd(q.total));
    set('[data-build-regular-value]', formatUsd(q.regularTotal));
    $$<HTMLElement>('[data-build-regular]').forEach(
      (el) => (el.hidden = q.regularTotal <= q.total),
    );
    set('[data-build-installments]', `${PAYMENT.installmentLabel(q.total)}.`);
    set('[data-build-deposit]', formatUsd(q.deposit));
    set('[data-build-balance]', formatUsd(q.total - q.deposit));
    set('[data-deposit]', formatUsd(depositFor(b.edition)));
  }

  let urlTimer = 0;
  function persist(b: Build, immediate = false) {
    clearTimeout(urlTimer);
    const run = () => {
      const p = new URLSearchParams(location.search);
      BUILD_KEYS.forEach((k) => p.delete(k));
      p.delete('phase');
      const own = serializeBuild(b);
      const rest = p.toString();
      const next = `${location.pathname}?${own}${rest ? `&${rest}` : ''}${location.hash}`;
      history.replaceState(history.state, '', next);
      write(STORE_KEY, b);
    };
    if (immediate) run();
    else urlTimer = window.setTimeout(run, 250);
  }

  function apply(next: Build, opts: { persist?: boolean; immediate?: boolean } = {}) {
    state = next;
    writeForm(state);
    renderStage(state);
    renderPanel(state);
    if (opts.persist !== false) persist(state, opts.immediate);
  }

  function announce(msg: string) {
    live.textContent = '';
    requestAnimationFrame(() => (live.textContent = msg));
  }

  function click() {
    // The dial turns one detent: the page answers in the product's own voice.
    if (dial && typeof dial.nudge === 'function') dial.nudge(1);
  }

  /* --------------------------------------------------------------- events */
  form.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    const before = state;
    let draft: Build = { ...state, acc: [...accChoice] };
    let changed: 'edition' | 'finish' = 'finish';
    switch (t.name) {
      case 'edition':
        draft.edition = t.value as Build['edition'];
        changed = 'edition';
        break;
      case 'finish':
        draft.finish = t.value as FinishId;
        if (byEdition('one').finishes.includes(draft.finish)) lastOneFinish = draft.finish;
        break;
      case 'feel':
        draft.feel = t.value as Build['feel'];
        break;
      case 'acc':
        if (t.checked) accChoice.add(t.value);
        else accChoice.delete(t.value);
        draft.acc = [...accChoice];
        break;
      case 'qty':
        draft.qty = Number(t.value);
        break;
      case 'engrave':
        draft.engrave = t.value.trim();
        break;
      default:
        return;
    }
    draft = normalize(draft, changed, lastOneFinish);
    apply(draft, { immediate: true });

    if (t.name === 'finish' && before.edition !== draft.edition) {
      announce(
        draft.edition === 'founders'
          ? `${byFinish(draft.finish).name} is Founders only, so the edition is now ${byEdition('founders').name}.`
          : `Switched to ${byEdition(draft.edition).name}.`,
      );
    } else if (t.name === 'edition' && before.finish !== draft.finish) {
      announce(`${byEdition(draft.edition).name} in ${byFinish(draft.finish).name}.`);
    }
    if (['edition', 'finish', 'feel'].includes(t.name)) click();

    const value =
      t.name === 'engrave'
        ? draft.engrave
          ? `set:${draft.engrave.length}`
          : 'cleared'
        : t.name === 'acc'
          ? `${t.value}:${t.checked}`
          : String(draft[t.name as keyof Build]);
    track('config_change', { field: t.name, value });
  });

  // Engraving: sanitize as you type, keep the caret where it was.
  engraveInput.addEventListener('input', () => {
    const raw = engraveInput.value;
    const clean = sanitizeEngraving(raw);
    const status = $<HTMLElement>('[data-engrave-status]', form)!;
    const dropped = [...raw.normalize('NFKD').replace(/[̀-ͯ]/g, '').toUpperCase()].filter(
      (ch) => !ENGRAVING.allowed.test(ch) && !/\s/.test(ch),
    );
    status.textContent = dropped.length
      ? `We can’t engrave “${[...new Set(dropped)].join(' ')}”. Letters, numbers and basic punctuation only.`
      : '';
    if (clean !== raw) {
      const pos = engraveInput.selectionStart ?? clean.length;
      const lost = raw.length - clean.length;
      engraveInput.value = clean;
      const caret = Math.max(0, Math.min(clean.length, pos - lost));
      engraveInput.setSelectionRange(caret, caret);
    }
    const grew = clean.trimEnd().length > state.engrave.length;
    state = { ...state, engrave: clean.trimEnd() };
    renderStage(state);
    if (grew) burn();
    renderPanel(state);
    persist(state);
  });
  engraveInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      engraveInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  form.addEventListener('click', (e) => {
    const t = e.target as Element;
    const preset = t.closest<HTMLButtonElement>('[data-engrave-preset]');
    if (preset) {
      engraveInput.value = preset.dataset.engravePreset!;
      engraveInput.dispatchEvent(new Event('change', { bubbles: true }));
      burn();
      announce(`Engraving set to ${preset.dataset.engravePreset}.`);
      return;
    }
    const step = t.closest<HTMLButtonElement>('[data-qty-step]');
    if (step) {
      const next = Math.min(MAX_QTY, Math.max(1, state.qty + Number(step.dataset.qtyStep)));
      if (next === state.qty) return;
      qtyInput.value = String(next);
      qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
      announce(`Quantity ${next}.`);
    }
  });

  // Primary action. The phase decides what it does (the buttons are
  // phase-gated too; this also covers implicit submission).
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const phase = currentPhase();
    const submitter = (e as SubmitEvent).submitter as HTMLElement | null;
    const placement = submitter?.closest('.build-action--bar') ? 'bar' : 'panel';
    const lines = cartLinesFor(state, phase);
    if (!lines.length) {
      // Nothing is on sale yet: go where this phase's primary action goes.
      location.href = url(PHASES[phase].primary.href);
      return;
    }
    lines.forEach((l) => addLine(l));
    const q = quote(state, phase);
    const kind = phase === 'reserve' ? 'reservation' : 'device';
    const props = {
      kind,
      placement,
      edition: state.edition,
      finish: state.finish,
      feel: state.feel,
      qty: state.qty,
      engraved: !!state.engrave,
      accessories: state.acc.join(',') || undefined,
      value: kind === 'reservation' ? q.deposit : q.total,
    };
    if (kind === 'reservation') track('reserve_click', props);
    track('add_to_cart', props);
    window.dispatchEvent(
      new CustomEvent('detent:cart-open', {
        detail: {
          message:
            kind === 'reservation'
              ? `Reserved: ${buildTitle(state)}`
              : `Added ${buildTitle(state)}`,
        },
      }),
    );
  });

  // Share / copy the build link.
  const copyBtn = $<HTMLButtonElement>('[data-copy-build]');
  const shareBtn = $<HTMLButtonElement>('[data-share-build]');
  const shareStatus = $<HTMLElement>('[data-share-status]');
  const buildUrl = () =>
    new URL(`${url('/shop/')}?${serializeBuild(state)}`, location.origin).toString();
  if (copyBtn) {
    copyBtn.hidden = false;
    copyBtn.addEventListener('click', async () => {
      const result = await shareOrCopy({ url: buildUrl() }, 'copy');
      if (shareStatus)
        shareStatus.textContent =
          result === 'copied'
            ? 'Link copied. Whoever opens it gets this exact build.'
            : `Copy this link: ${buildUrl()}`;
      track('build_share', { method: 'copy' });
    });
  }
  if (shareBtn && typeof navigator.share === 'function') {
    shareBtn.hidden = false;
    shareBtn.addEventListener('click', async () => {
      const result = await shareOrCopy(
        {
          title: `My ${buildTitle(state)}`,
          text: `My Detent build: ${buildTitle(state)}, first feel ${byProfile(state.feel).name}.`,
          url: buildUrl(),
        },
        'share',
      );
      if (shareStatus && result === 'copied') shareStatus.textContent = 'Link copied.';
      track('build_share', { method: result });
    });
  }

  // Links elsewhere on the page that preset part of a build (finish panels,
  // the compare table): apply in place instead of reloading.
  document.addEventListener('click', (e) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('a[data-build-link]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    const p = new URL(a.href).searchParams;
    const merged = new URLSearchParams(serializeBuild(state));
    p.forEach((v, k) => merged.set(k, v));
    if (p.has('finish') && !p.has('edition')) merged.delete('edition');
    const next = parseBuild(merged);
    accChoice = new Set(next.acc);
    if (byEdition('one').finishes.includes(next.finish)) lastOneFinish = next.finish;
    apply(next, { immediate: true });
    click();
    track('config_change', { field: 'link', value: p.toString() });
    const target = document.getElementById('configure');
    target?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    form
      .querySelector<HTMLInputElement>('input[name="finish"]:checked')
      ?.focus({ preventScroll: true });
  });

  /* ----------------------------------------------------------- dial link */
  const marker = $<SVGGElement>('[data-marker]', stage);
  const angleOut = $<HTMLElement>('[data-angle]', stage);
  const title = document.querySelector<HTMLElement>('[data-knob-type]');
  dial?.addEventListener('detent:change', (e) => {
    const a = e.detail.angle;
    marker?.setAttribute('transform', `rotate(${a.toFixed(2)})`);
    const signed = ((((a + 180) % 360) + 360) % 360) - 180;
    if (angleOut)
      angleOut.textContent = `${signed < 0 ? '−' : '+'}${Math.abs(signed).toFixed(1).padStart(5, '0')}`;
    // Signature: the headline's width axis follows the knob (125% at noon, 100% at six).
    if (title) {
      const turn = ((a % 360) + 360) % 360;
      const tri = Math.abs((turn / 360) * 2 - 1);
      title.style.fontStretch = `${(100 + 25 * tri).toFixed(1)}%`;
    }
  });

  /* ------------------------------------------------------- summary bar */
  // Docked to the bottom on small screens. It earns its place once the
  // headline and the dial have scrolled away (a sticky dial never leaves, so
  // beside one only the headline counts), and it gets out of the way while
  // the panel's own action is on screen: never two buy buttons at once.
  const bar = $<HTMLElement>('[data-summary-bar]');
  const toggle = $<HTMLButtonElement>('[data-summary-toggle]');
  const sheet = $<HTMLElement>('[data-summary-sheet]');
  const section = document.getElementById('configure');
  const head = $<HTMLElement>('[data-configure-head]');
  const stageBox = $<HTMLElement>('[data-configure-stage]');
  const panelAction = $<HTMLElement>('[data-panel] .build-action');
  if (bar && section && head && stageBox && panelAction && 'IntersectionObserver' in window) {
    const onScreen = new Map<Element, boolean>([[head, true]]);
    const sync = () => {
      const stageSticky = getComputedStyle(stageBox).position === 'sticky';
      const intro = onScreen.get(head) || (!stageSticky && onScreen.get(stageBox));
      const show = !!onScreen.get(section) && !intro && !onScreen.get(panelAction);
      bar.toggleAttribute('data-visible', show);
      if (!show && toggle?.getAttribute('aria-expanded') === 'true') setSheet(false);
    };
    const watch = (els: Element[], options?: IntersectionObserverInit) => {
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) onScreen.set(e.target, e.isIntersecting);
        sync();
      }, options);
      els.forEach((el) => io.observe(el));
    };
    watch([section, head, stageBox]);
    // The panel's action counts as on screen the moment it clears the bar.
    watch([panelAction], { rootMargin: `0px 0px -${bar.offsetHeight || 64}px 0px` });
    // Crossing a layout breakpoint can make the dial sticky (or not) without
    // any intersection changing.
    addEventListener('resize', sync, { passive: true });
  }
  function setSheet(open: boolean) {
    if (!toggle || !sheet) return;
    toggle.setAttribute('aria-expanded', String(open));
    sheet.hidden = !open;
  }
  toggle?.addEventListener('click', () =>
    setSheet(toggle.getAttribute('aria-expanded') !== 'true'),
  );

  /* ------------------------------------------ referral + held reservation */
  // A friend's build link carries ?ref=CODE: keep it (checkout credits it on
  // the order) and say what it means. The reward is a feel, never money.
  const ref = $<HTMLElement>('[data-ref-note]');
  if (ref) ref.hidden = !captureRef();
  // One reservation system: a deposit made on /l/reserve/ shows up here too.
  const held = getReservation();
  const heldNote = $<HTMLElement>('[data-held]');
  if (held && heldNote) {
    $('[data-held-id]', heldNote)!.textContent = held.id;
    $('[data-held-build]', heldNote)!.textContent = buildTitle(held);
    heldNote.hidden = false;
  }

  /* ----------------------------------------------------------------- go */
  apply(state, { persist: hasBuildParams(params), immediate: true });
}

function reducedMotion(): boolean {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}
