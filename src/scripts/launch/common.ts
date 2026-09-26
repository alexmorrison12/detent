/**
 * Behaviour shared by every launch landing page:
 * - captureRef(): store ?ref= so a friend's pass gets the credit;
 * - same-page CTAs (e.g. the header's "Reserve for $20" while on /l/reserve/)
 *   scroll to this page's form instead of reloading it;
 * - the sticky mobile CTA bar;
 * - a typed helper to wait for an upgraded <detent-dial>.
 */
import { captureRef } from '@/lib/waitlist';
import type { DetentDialElement } from '@/scripts/dial/types';
import { prefersReducedMotion } from './feedback';

export function initLanding(
  opts: { formTarget?: string; doneTarget?: string } = {},
): string | undefined {
  const ref = captureRef();
  if (opts.formTarget) interceptSamePage(opts.formTarget, opts.doneTarget);
  initStickyCta();
  return ref;
}

const isShown = (el: HTMLElement) => !el.closest('[hidden]');

/**
 * Links that resolve to this very page (ignoring hash) go to the form
 * instead; once the form is done (hidden), to the confirmation.
 */
function interceptSamePage(targetSel: string, doneSel?: string) {
  document.addEventListener('click', (e) => {
    const a = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[href]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const to = new URL(a.href, location.href);
    if (to.origin !== location.origin || to.pathname !== location.pathname || to.hash) return;
    const form = document.querySelector<HTMLElement>(targetSel);
    const done = doneSel ? document.querySelector<HTMLElement>(doneSel) : null;
    const target = form && isShown(form) ? form : done && isShown(done) ? done : null;
    if (!target) return;
    e.preventDefault();
    goToForm(target);
  });
}

/** Turn the sticky bar off once its job is done (joined, reserved), or back on. */
export function setStickyEnabled(on: boolean) {
  const bar = document.querySelector<HTMLElement>('[data-sticky-cta]');
  if (!bar) return;
  bar.toggleAttribute('data-off', !on);
  if (!on) bar.removeAttribute('data-visible');
}

export function goToForm(target: HTMLElement) {
  target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
  const field = target.matches('input, button, [tabindex]')
    ? target
    : target.querySelector<HTMLElement>('input:not([type=hidden]), button, [tabindex="-1"]');
  field?.focus({ preventScroll: true });
}

/** An element's own boxes: a display:contents wrapper (the reserve form) has none, its children do. */
const boxes = (el: Element): Element[] =>
  getComputedStyle(el).display === 'contents' ? [...el.children].flatMap(boxes) : [el];

/**
 * <div data-sticky-cta data-watch="#hero-cta" data-hide-over="#join">: visible
 * (mobile only, via CSS) once the watched CTA has scrolled up out of view and
 * while the form it points to isn't on screen. The form holding data-target
 * always counts, whatever data-hide-over lists, while the bar's own button is
 * the one in play: the bar never repeats the form's button or covers its fields.
 */
function initStickyCta() {
  const bar = document.querySelector<HTMLElement>('[data-sticky-cta]');
  if (!bar) return;
  // A selector list may name one CTA per launch phase; watch the one that renders.
  const watch = [...document.querySelectorAll(bar.dataset.watch || '__none__')].find(
    (el) => el.getClientRects().length > 0,
  );
  const over = new Set(document.querySelectorAll(bar.dataset.hideOver || '__none__'));
  const go = bar.querySelector('[data-sticky-go]');
  const target = bar.dataset.target ? document.querySelector(bar.dataset.target) : null;
  const ownForm = target?.closest('form');
  // Phase-gated: in other phases the bar carries a PhaseCTA that goes elsewhere.
  if (go && ownForm && getComputedStyle(go).display !== 'none')
    boxes(ownForm).forEach((el) => over.add(el));
  const state = new Map<Element, boolean>();
  // "Gone" means scrolled past (above the viewport), not "not reached yet": a
  // CTA that starts below the fold must not summon the bar over the hero.
  let watchPassed = !watch;
  const update = () => {
    const overVisible = [...over].some((el) => state.get(el));
    bar.toggleAttribute(
      'data-visible',
      watchPassed && !overVisible && !bar.hasAttribute('data-off'),
    );
  };
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      state.set(en.target, en.isIntersecting);
      if (en.target === watch)
        watchPassed =
          !en.isIntersecting && en.boundingClientRect.bottom <= (en.rootBounds?.top ?? 0);
    }
    update();
  });
  if (watch) io.observe(watch);
  over.forEach((el) => io.observe(el));
  go?.addEventListener('click', (e) => {
    if (!(target instanceof HTMLElement)) return;
    e.preventDefault();
    goToForm(target);
  });
}

export async function whenDial(id: string): Promise<DetentDialElement | null> {
  const el = document.getElementById(id) as DetentDialElement | null;
  if (!el) return null;
  await customElements.whenDefined('detent-dial');
  return el;
}

/** Throttle to animation frames. */
export function rafThrottle<A extends unknown[]>(fn: (...args: A) => void): (...args: A) => void {
  let queued = false;
  let last: A;
  return (...args: A) => {
    last = args;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn(...last);
    });
  };
}
