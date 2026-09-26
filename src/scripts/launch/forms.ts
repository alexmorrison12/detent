/**
 * Form plumbing shared by every launch form: inline validation with
 * accessible errors, a visible busy state, and focus management.
 * Markup contract (see EmailField.astro):
 *   <input id="x" aria-describedby="x-err ..."> + <p id="x-err" class="field-error" role="alert"> (empty = hidden)
 */
import { isValidEmail } from '@/lib/waitlist';

export function setError(input: HTMLInputElement, message: string | null): void {
  const err = document.getElementById(`${input.id}-err`);
  if (message) {
    input.setAttribute('aria-invalid', 'true');
    if (err) err.textContent = message;
  } else {
    input.removeAttribute('aria-invalid');
    if (err) err.textContent = '';
  }
}

/** Validates an email input; on failure shows the error and focuses the field. */
export function checkEmail(input: HTMLInputElement): boolean {
  const v = input.value.trim();
  if (!v) {
    setError(input, 'Enter your email so we know where to write.');
    input.focus();
    return false;
  }
  if (!isValidEmail(v)) {
    setError(input, 'That email doesn’t look right. Check for a typo?');
    input.focus();
    return false;
  }
  setError(input, null);
  return true;
}

/** Clear the error as soon as the person fixes the field. */
export function liveClear(input: HTMLInputElement): void {
  input.addEventListener('input', () => {
    if (input.getAttribute('aria-invalid') === 'true' && isValidEmail(input.value))
      setError(input, null);
  });
}

/**
 * Runs fn with the button in a busy state. Keeps the state up for at least
 * `minMs` so the change is perceivable even when the demo adapter resolves
 * instantly.
 */
export async function withBusy<T>(
  button: HTMLButtonElement,
  busyLabel: string,
  fn: () => Promise<T>,
  minMs = 320,
): Promise<T> {
  const label = button.querySelector<HTMLElement>('[data-label]') ?? button;
  const idle = label.textContent;
  button.setAttribute('aria-disabled', 'true');
  button.dataset.busy = '';
  label.textContent = busyLabel;
  const [result] = await Promise.all([fn(), new Promise((r) => setTimeout(r, minMs))]);
  button.removeAttribute('aria-disabled');
  delete button.dataset.busy;
  label.textContent = idle;
  return result as T;
}

/** Move focus to a region's heading without scrolling jank, and bring it into view. */
export function focusRegion(el: HTMLElement | null, reduced: boolean): void {
  if (!el) return;
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
}
