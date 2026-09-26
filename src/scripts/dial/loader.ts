/**
 * The only dial code on a page's critical path (well under 1 KB). The engine
 * (./stage: <detent-dial>, physics, SVG renderer, audio, haptics) is fetched
 * when a dial nears the viewport and the page has loaded and gone idle, or at
 * once when someone reaches for a dial (pointer, touch, focus, a stepper).
 * Until then the server-rendered still IS the dial; the element upgrades in
 * place when it is defined, and pages wait with customElements.whenDefined().
 */
type Stage = typeof import('./stage');

let engine: Promise<Stage> | null = null;
const load = (): Promise<Stage> => (engine ??= import('./stage'));

function afterLoadIdle(fn: () => void) {
  const idle = () => {
    const ric = (window as Window & { requestIdleCallback?: typeof requestIdleCallback })
      .requestIdleCallback;
    if (ric) ric(fn, { timeout: 2000 });
    else setTimeout(fn, 200);
  };
  if (document.readyState === 'complete') idle();
  else window.addEventListener('load', idle, { once: true });
}

export function watchDials(): void {
  if (typeof window === 'undefined' || engine || customElements.get('detent-dial')) return;

  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        afterLoadIdle(start);
      }
    },
    { rootMargin: '400px 0px' },
  );
  const watch = (el: Element) => {
    if (el.getAttribute('loading') === 'eager') start();
    else io.observe(el);
  };

  // Dials mounted later (lazy sections, templates) are watched too, until the engine is here.
  const mo = new MutationObserver((records) => {
    for (const r of records)
      for (const n of r.addedNodes)
        if (n instanceof Element) {
          if (n.localName === 'detent-dial') watch(n);
          n.querySelectorAll('detent-dial').forEach(watch);
        }
  });

  const intent = (e: Event) => {
    if ((e.target as Element | null)?.closest?.('detent-dial, [data-dial-step]')) start();
  };
  const INTENT = ['pointerover', 'touchstart', 'focusin'] as const;

  // A stepper pressed before the engine arrived still turns the dial, once it has.
  const click = (e: MouseEvent) => {
    const btn = (e.target as Element | null)?.closest<HTMLElement>('[data-dial-step]');
    if (btn && !customElements.get('detent-dial')) void load().then((m) => m.stepFrom(btn, false));
  };

  function start() {
    io.disconnect();
    mo.disconnect();
    for (const t of INTENT) document.removeEventListener(t, intent, true);
    void load();
  }

  for (const t of INTENT) document.addEventListener(t, intent, { capture: true, passive: true });
  document.addEventListener('click', click);
  mo.observe(document.documentElement, { childList: true, subtree: true });
  document.querySelectorAll('detent-dial').forEach(watch);
}
