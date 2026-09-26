/**
 * Everything a <DialStage> needs once it goes live, fetched by ./loader.ts:
 * the <detent-dial> element (physics, SVG renderer, audio, haptics) and the
 * −/+ stepper buttons. three.js is a further, separate import the element
 * makes on its own when it is worth it.
 */
import './detent-dial';
import { hapticTap } from './haptics';
import { unlockAudio } from './audio';

export function stepFrom(btn: HTMLElement, gesture: boolean): void {
  const dial = btn.closest('.dial-stage-wrap')?.querySelector('detent-dial');
  if (!dial) return;
  if (gesture) {
    unlockAudio();
    hapticTap();
  }
  dial.nudge(Number(btn.dataset.dialStep) || 0);
}

document.addEventListener('click', (e) => {
  const btn = (e.target as Element | null)?.closest<HTMLElement>('[data-dial-step]');
  if (btn) stepFrom(btn, true);
});
