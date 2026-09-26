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

/**
 * <div data-sticky-cta data-watch="#hero-cta" data-hide-over="#join">: visible
 * (mobile only, via CSS) once the watched CTA has scrolled away and while the
 * form it points to isn't on screen.
 */
function initStickyCta() {
  const bar = document.querySelector<HTMLElement>('[data-sticky-cta]');
  if (!bar) return;
  const watch = document.querySelector(bar.dataset.watch ?? '');
  const over = [...document.querySelectorAll(bar.dataset.hideOver ?? '__none__')];
  const state = new Map<Element, boolean>();
  const update = () => {
    const watchGone = watch ? state.get(watch) === false : true;
    const overVisible = over.some((el) => state.get(el));
    bar.toggleAttribute('data-visible', watchGone && !overVisible && !bar.hasAttribute('data-off'));
  };
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) state.set(en.target, en.isIntersecting);
    update();
  });
  if (watch) io.observe(watch);
  over.forEach((el) => io.observe(el));
  bar.querySelector('[data-sticky-go]')?.addEventListener('click', (e) => {
    const target = document.querySelector<HTMLElement>(bar.dataset.target ?? '');
    if (!target) return;
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
