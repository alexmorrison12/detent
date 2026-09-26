/**
 * First-party, privacy-friendly event bus. No third-party scripts ship with
 * the site. Events go to window.dataLayer (so any tag manager can be added
 * later without touching components) and are re-dispatched as a DOM event.
 *
 *   track('cta_click', { placement: 'hero', phase: 'reserve' })
 *
 * Declarative: any element with data-track="event_name" (and optional
 * data-track-* attributes) is tracked on click by initAutoTrack().
 */
export type EventProps = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export function track(event: string, props: EventProps = {}): void {
  if (typeof window === 'undefined') return;
  const payload = {
    event,
    ...props,
    phase: document.documentElement.dataset.phase,
    path: location.pathname,
    ts: Date.now(),
  };
  (window.dataLayer ??= []).push(payload);
  window.dispatchEvent(new CustomEvent('detent:track', { detail: payload }));
  if (import.meta.env.DEV) console.debug('[track]', event, props);
}

let autoTrackBound = false;
export function initAutoTrack(): void {
  if (autoTrackBound) return;
  autoTrackBound = true;
  document.addEventListener(
    'click',
    (e) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>('[data-track]');
      if (!el) return;
      const props: EventProps = {};
      for (const [k, v] of Object.entries(el.dataset)) {
        if (k.startsWith('track') && k !== 'track') {
          props[k.slice(5).replace(/^./, (c) => c.toLowerCase())] = v;
        }
      }
      track(el.dataset.track!, props);
    },
    { capture: true },
  );
}
