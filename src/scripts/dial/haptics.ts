/**
 * Detent haptics for the web, honestly scoped.
 *
 *   import { haptic, hapticTap, supportsHaptics } from '@/scripts/dial/haptics';
 *
 *   haptic('detent', 0.8);   // Android: one short pulse, scaled by strength
 *   haptic('stop');          // Android: a double knock
 *   button.addEventListener('click', () => hapticTap()); // iPhone: one Taptic tick, in a real tap only
 *
 * - Android (Chromium, Firefox): navigator.vibrate, 8–18 ms pulses, at most one
 *   per 40 ms so fast spins don't turn into a buzz. Needs sticky user activation.
 * - iPhone (Safari 17.4+): there is no Vibration API. Toggling a hidden
 *   <input type="checkbox" switch> from inside a trusted tap plays one system
 *   tick. It only works during the gesture itself, never from timers or drags,
 *   and newer iOS versions may ignore it. We feature-detect and fail silently.
 * - A user preference (default on) is stored as detent:haptics.
 */
import { read, write } from '@/lib/storage';
import type { TickKind } from './types';

let enabled: boolean | null = null;
let lastPulse = 0;
let switchLabel: HTMLLabelElement | null = null;

const hasVibrate = () =>
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
const hasSwitch = () =>
  typeof HTMLInputElement !== 'undefined' && 'switch' in HTMLInputElement.prototype;

/** True when this browser can produce any haptic at all. */
export function supportsHaptics(): boolean {
  return hasVibrate() || hasSwitch();
}

export function isHapticsEnabled(): boolean {
  enabled ??= read<boolean>('haptics', true);
  return enabled;
}

export function setHapticsEnabled(on: boolean): void {
  enabled = on;
  write('haptics', on);
}

function activated(): boolean {
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } })
    .userActivation;
  return ua ? ua.hasBeenActive : true;
}

/**
 * One haptic event (Android). `strength` 0..1 scales the pulse length.
 * Safe to call from animation frames; rate-limited internally.
 */
export function haptic(kind: TickKind = 'detent', strength = 1): void {
  if (!hasVibrate() || !isHapticsEnabled() || !activated()) return;
  const now = performance.now();
  if (now - lastPulse < 40) return;
  lastPulse = now;
  const s = Math.max(0, Math.min(1, strength));
  let pattern: number | number[];
  switch (kind) {
    case 'stop':
      pattern = [12, 40, 12];
      break;
    case 'accent':
      pattern = 18;
      break;
    case 'snap':
      pattern = 14;
      break;
    default:
      pattern = Math.round(8 + 6 * s);
  }
  try {
    navigator.vibrate(pattern);
  } catch {
    /* some browsers throw when not allowed; nothing to do */
  }
}

/**
 * One tick for a discrete, user-initiated tap (a stepper button, a press on
 * the knob). On iPhone this uses the switch trick; elsewhere it vibrates.
 * Call it synchronously inside the event handler of a real user gesture.
 */
export function hapticTap(kind: TickKind = 'detent'): void {
  if (!isHapticsEnabled()) return;
  if (hasVibrate()) {
    haptic(kind, 1);
    return;
  }
  if (!hasSwitch() || typeof document === 'undefined') return;
  try {
    if (!switchLabel) {
      switchLabel = document.createElement('label');
      switchLabel.setAttribute('aria-hidden', 'true');
      switchLabel.style.cssText =
        'position:fixed;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);opacity:0;pointer-events:none';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.tabIndex = -1;
      switchLabel.appendChild(input);
      document.body.appendChild(switchLabel);
    }
    switchLabel.click();
  } catch {
    /* fail silently */
  }
}
