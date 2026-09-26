/**
 * A real countdown to the next UTC midnight, when both daily games roll over.
 * Updates once a second while the tab is visible. role="timer" regions are
 * not live by default, so screen readers are not spammed.
 */
import { formatHMS, msToNextUtcDay, utcDay } from './day';

export function startCountdown(el: HTMLElement, onRollover: () => void): () => void {
  const startDay = utcDay();
  let id = 0;
  const tick = () => {
    const ms = msToNextUtcDay();
    el.textContent = formatHMS(ms);
    el.setAttribute(
      'datetime',
      `PT${Math.floor(ms / 3_600_000)}H${Math.floor((ms % 3_600_000) / 60_000)}M${Math.floor((ms % 60_000) / 1000)}S`,
    );
    if (utcDay() !== startDay) {
      stop();
      onRollover();
    }
  };
  const start = () => {
    if (id) return;
    tick();
    id = window.setInterval(tick, 1000);
  };
  const stop = () => {
    clearInterval(id);
    id = 0;
  };
  const vis = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', vis);
  start();
  return () => {
    stop();
    document.removeEventListener('visibilitychange', vis);
  };
}
