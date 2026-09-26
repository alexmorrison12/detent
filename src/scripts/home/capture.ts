/**
 * Inline capture after the third profile change (lazy-loaded).
 * Rules: never an overlay, at most once per session, dismissible, and quiet
 * for 30 days after a dismissal. Skipped entirely for people already on the list.
 */
import { read, write } from '@/lib/storage';
import { getEntry, joinWaitlist, type Segment } from '@/lib/waitlist';
import { track } from '@/lib/analytics';
import { url } from '@/lib/url';

const SHOWN = 'home-capture-shown';
const DISMISSED = 'home-capture-dismissed';
const QUIET_MS = 30 * 24 * 60 * 60 * 1000;

const NEXT: Record<Segment, { href: string; label: string }> = {
  editing: { href: '/for/editors/', label: 'See what it does for editing' },
  music: { href: '/for/musicians/', label: 'See what it does for music' },
  design: { href: '/for/designers/', label: 'See what it does for design' },
  code: { href: '/for/developers/', label: 'See what it does for code' },
  streaming: { href: '/integrations/', label: 'See the OBS integration' },
};

export function canShow(): boolean {
  if (read<boolean>(SHOWN, false, 'session')) return false;
  const dismissedAt = read<number>(DISMISSED, 0);
  if (dismissedAt && Date.now() - dismissedAt < QUIET_MS) return false;
  return !getEntry();
}

export function reveal(scope: ParentNode): void {
  if (!canShow()) return;
  const boxes = Array.from(scope.querySelectorAll<HTMLElement>('[data-capture]'));
  if (!boxes.length) return;
  write(SHOWN, true, 'session');
  boxes.forEach(wire);
  const visible = boxes.find((b) => b.offsetParent !== null) ?? boxes[0]!;
  track('capture_view', { placement: 'home-feel', variant: visible.dataset.phaseOnly ?? '' });
}

function wire(box: HTMLElement) {
  box.hidden = false;
  const step = (name: string) => box.querySelector<HTMLElement>(`[data-step="${name}"]`);
  const show = (name: string) =>
    box
      .querySelectorAll<HTMLElement>('[data-step]')
      .forEach((s) => (s.hidden = s.dataset.step !== name));

  let segment: Segment | undefined;

  box.querySelectorAll<HTMLButtonElement>('[data-segment]').forEach((b) =>
    b.addEventListener('click', () => {
      segment = b.dataset.segment as Segment;
      track('capture_segment', { segment, placement: 'home-feel' });
      show('email');
      step('email')?.querySelector<HTMLInputElement>('input[type="email"]')?.focus();
    }),
  );

  box.querySelector('[data-capture-back]')?.addEventListener('click', () => {
    show('segment');
    box.querySelector<HTMLButtonElement>('[data-segment]')?.focus();
  });

  box.querySelector('[data-capture-close]')?.addEventListener('click', () => {
    write(DISMISSED, Date.now());
    box.hidden = true;
    track('capture_dismiss', { placement: 'home-feel' });
    document.querySelector<HTMLElement>('input[name="home-profile"]:checked')?.focus();
  });

  const form = box instanceof HTMLFormElement ? box : box.querySelector('form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = form.querySelector<HTMLInputElement>('input[type="email"]')!;
    const error = form.querySelector<HTMLElement>('[data-capture-error]');
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (button) button.disabled = true;
    const res = await joinWaitlist({
      email: input.value,
      segment,
      source: segment ? 'home-feel' : 'home-launch-news',
    });
    if (button) button.disabled = false;
    if (!res.ok) {
      input.setAttribute('aria-invalid', 'true');
      if (error) error.textContent = res.error;
      input.focus();
      return;
    }
    input.removeAttribute('aria-invalid');
    if (error) error.textContent = '';
    const next = box.querySelector<HTMLAnchorElement>('[data-capture-next]');
    if (next) {
      const n = NEXT[segment ?? 'editing'];
      next.href = url(n.href);
      next.textContent = n.label;
    }
    show('done');
    box
      .querySelector<HTMLButtonElement>('[data-capture-close]')
      ?.setAttribute('aria-label', 'Close');
  });
}
