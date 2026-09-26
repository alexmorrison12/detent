/**
 * The feel station's only code on the critical path (under 1 KB gzipped), the
 * same way the dial engine loads (scripts/dial/loader.ts). The server renders
 * the station complete for the first library profile, so nothing here is
 * needed to read the page. The controller (./station) is fetched:
 *   - at once for a link to something else (?p=<id> or a #fragment),
 *   - at once when someone reaches for the station (pointer, touch, focus, key),
 *   - otherwise when the page has loaded and gone idle.
 * A button pressed or a builder control changed before it arrives is handed
 * over and replayed, so no early click is lost.
 */
import type { Handoff } from './station';

const root = document.querySelector<HTMLElement>('[data-feel]');
if (root) watch(root);

function watch(root: HTMLElement) {
  const early: Handoff = { clicks: [], input: null };
  const INTENT = ['pointerover', 'touchstart', 'focusin', 'keydown'] as const;
  let started = false;

  const intent = () => start();
  const click = (e: MouseEvent) => {
    const el = (e.target as Element | null)?.closest<HTMLButtonElement>('button[data-select], button[data-action], button[data-filter], button[data-sound]');
    if (el && !el.disabled) early.clicks.push({ el, detail: e.detail });
    start();
  };
  const input = (e: Event) => {
    early.input = e.target;
    start();
  };

  function start() {
    if (started) return;
    started = true;
    for (const t of INTENT) root.removeEventListener(t, intent, true);
    void import('./station').then((m) => {
      root.removeEventListener('click', click, true);
      root.removeEventListener('input', input, true);
      void m.boot(root, early);
    });
  }

  root.addEventListener('click', click, true);
  root.addEventListener('input', input, true);
  if (location.hash.length > 1 || /[?&]p=/.test(location.search)) return start();
  for (const t of INTENT) root.addEventListener(t, intent, { capture: true, passive: true });
  const idle = () => {
    const ric = (window as Window & { requestIdleCallback?: typeof requestIdleCallback }).requestIdleCallback;
    if (ric) ric(start, { timeout: 2000 });
    else setTimeout(start, 200);
  };
  if (document.readyState === 'complete') idle();
  else window.addEventListener('load', idle, { once: true });
}
