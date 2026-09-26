/**
 * Phase preview, in place. Does exactly what ?phase=<id> does on page load
 * (BaseLayout's inline script): sets <html data-phase> and the tab's
 * sessionStorage key, so every PhaseCTA, the announcement bar and every
 * data-phase-only block follow, without a reload.
 *
 * Any link with data-phase-link="<id>" (or data-phase-reset) on the page is
 * enhanced; without JS those links are plain ?phase= URLs and still work.
 * Fires `plan:phase` on window so the dial can follow a tab click.
 */
import { BUILD_PHASE, PHASES, PHASE_ORDER, type Phase } from '@/config/launch';
import { track } from '@/lib/analytics';

export type PreviewVia = 'dial' | 'link' | 'reset';
export interface PlanPhaseDetail {
  phase: Phase;
  via: PreviewVia;
}

declare global {
  interface WindowEventMap {
    'plan:phase': CustomEvent<PlanPhaseDetail>;
  }
}

const root = document.documentElement;
const KEY = 'detent:phase';

export const isPhase = (v: unknown): v is Phase => PHASE_ORDER.includes(v as Phase);
export const currentPhase = (): Phase =>
  isPhase(root.dataset.phase) ? root.dataset.phase : BUILD_PHASE;

function paintLinks(p: Phase) {
  document.querySelectorAll<HTMLAnchorElement>('[data-phase-link]').forEach((a) => {
    if (a.dataset.phaseLink === p) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  });
}

let status: HTMLElement | null = null;
function announce(text: string) {
  if (!status) {
    status = document.createElement('p');
    status.className = 'visually-hidden';
    status.setAttribute('role', 'status');
    document.body.append(status);
  }
  status.textContent = text;
}

/**
 * Say it and count it once the phase stops changing. The page follows every
 * click as it happens, but a turn across three detents is one choice, not three
 * announcements and three phase_preview events.
 */
const REPORT_AFTER_MS = 400;
let reported: Phase = currentPhase();
let reportTimer = 0;
function report(p: Phase, via: PreviewVia) {
  clearTimeout(reportTimer);
  reportTimer = window.setTimeout(() => {
    if (p === reported && via !== 'reset') return;
    reported = p;
    announce(`Previewing ${PHASES[p].name}. Every page now shows “${PHASES[p].primary.label}”.`);
    track('phase_preview', { phase: p, via });
  }, REPORT_AFTER_MS);
}

export function applyPhase(p: Phase, via: PreviewVia): void {
  if (p === currentPhase() && via !== 'reset') return;
  root.dataset.phase = p;
  try {
    if (via === 'reset') sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, p);
  } catch {
    /* storage blocked: the preview still applies to this page */
  }
  const u = new URL(location.href);
  if (via === 'reset') u.searchParams.delete('phase');
  else u.searchParams.set('phase', p);
  history.replaceState(history.state, '', u);
  paintLinks(p);
  window.dispatchEvent(new CustomEvent('plan:phase', { detail: { phase: p, via } }));
  report(p, via);
}

let bound = false;
export function initPhaseLinks(): void {
  if (bound) return;
  bound = true;
  paintLinks(currentPhase());
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return;
    const t = e.target as Element | null;
    const link = t?.closest<HTMLAnchorElement>('[data-phase-link]');
    if (link && isPhase(link.dataset.phaseLink)) {
      e.preventDefault();
      applyPhase(link.dataset.phaseLink, 'link');
      return;
    }
    if (t?.closest('[data-phase-reset]')) {
      e.preventDefault();
      applyPhase(BUILD_PHASE, 'reset');
    }
  });
  // Back/forward cache: the tab's phase may have changed on another page.
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    reported = currentPhase();
    paintLinks(reported);
  });
}

/** Expand/collapse lists that show only the tuned phase on small screens. */
export function initTunables(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-tune-toggle]').forEach((btn) => {
    const box = btn.closest<HTMLElement>('[data-tunable]');
    if (!box || btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.hidden = false;
    const label = btn.textContent ?? '';
    btn.addEventListener('click', () => {
      const open = box.toggleAttribute('data-expanded');
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = open ? 'Show only the phase you’re previewing' : label;
    });
  });
}
