/**
 * /l/tease/: the knob is a clock. Its display reads the time the indicator
 * points at (12 at the top). The page shows a date, 10.20. Set the dial to
 * 10:20 and hold it there: the heavier click at that mark (an accent detent
 * in the physics override) is the reveal, and the email form opens.
 *
 * Everything here enhances a page that already works: without JS the form
 * is visible and the skip link is a plain anchor.
 */
import { joinWaitlist } from '@/lib/waitlist';
import { track } from '@/lib/analytics';
import { initLanding, whenDial, rafThrottle } from './common';
import { buzz, chime, prefersReducedMotion, thud } from './feedback';
import { checkEmail, focusRegion, liveClear, withBusy } from './forms';
import { downloadIcs } from './ics';
import { clockDist, tuneAt } from './tease-tune';

const root = document.querySelector<HTMLElement>('[data-tease]');
if (root) void init(root);

async function init(root: HTMLElement) {
  initLanding();
  const reduced = prefersReducedMotion();
  const target = Number(root.dataset.target); // degrees, e.g. 310 for 10:20
  const detents = Number(root.dataset.detents); // e.g. 72
  const revealIso = root.dataset.reveal!;
  const revealDot = root.dataset.revealDot!;
  const signal = document.getElementById('signal') as HTMLElement;
  const hint = root.querySelector<HTMLElement>('[data-hint]')!;
  const ticks = [...root.querySelectorAll<SVGLineElement>('[data-tick]')];
  const lockRing = root.querySelector<SVGCircleElement>('[data-lock]')!;
  const canvas = root.querySelector<HTMLCanvasElement>('[data-signal-canvas]');
  const trace = canvas ? createTrace(canvas, reduced) : null;

  root.dataset.ready = '';
  let solved = false;
  const startedAt = performance.now();

  /* ---- Opening the signal section (solve, skip, or #signal) --------- */
  /**
   * Focus the heading, and scroll so the section starts at the top of the
   * screen, or, when the section is taller than the screen, so its action
   * (the email form before the reveal, the phase's CTA after) is still on it.
   * Most people arrive here from a "Get launch news" button: the field and
   * the button are what they came for.
   */
  const bringIntoView = (heading: HTMLElement | null) => {
    if (!heading) return;
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
    const action = [...signal.querySelectorAll<HTMLElement>('[data-signal-action]')].find(
      (el) => el.getClientRects().length > 0,
    );
    const padTop = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    const top = signal.getBoundingClientRect().top + scrollY - padTop;
    const end = action ? action.getBoundingClientRect().bottom + scrollY + 24 - innerHeight : top;
    scrollTo({ top: Math.max(0, top, end), behavior: reduced ? 'auto' : 'smooth' });
  };
  const open = (how: 'solved' | 'skipped') => {
    if (signal.dataset.open !== undefined) return;
    signal.dataset.open = how;
    root.dataset.state = how === 'solved' ? 'set' : 'skipped';
    const heading = signal.querySelector<HTMLElement>('[data-signal-heading]');
    if (heading) heading.textContent = heading.dataset[how] ?? heading.textContent;
    setTimeout(() => bringIntoView(heading), how === 'solved' && !reduced ? 900 : 0);
  };

  document.querySelectorAll<HTMLAnchorElement>('a[href$="#signal"]').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      if (!solved)
        track('tease_skip', { seconds: Math.round((performance.now() - startedAt) / 1000) });
      open(solved ? 'solved' : 'skipped');
    }),
  );
  if (location.hash === '#signal') open('skipped');

  /* ---- The dial ------------------------------------------------------ */
  const dial = await whenDial('tease-dial');
  if (!dial) return;
  const step = 360 / detents;
  const hours = Array.from({ length: 12 }, (_, i) => i * 30);
  dial.physics = {
    detents,
    strength: 0.55,
    damping: 0.18,
    spring: 0,
    stops: null,
    accents: [...hours, target],
  };

  const norm = (a: number) => ((a % 360) + 360) % 360;
  const timeOf = (a: number) => {
    const m = Math.round(norm(a) * 2) % 720; // 0.5° per minute
    const h = Math.floor(m / 60) || 12;
    return {
      h,
      m: m % 60,
      text: `${String(h).padStart(2, '0')}.${String(m % 60).padStart(2, '0')}`,
    };
  };
  const dist = (a: number) => clockDist(a, target);
  // What a screen reader hears: the time the knob points at (or is heading to:
  // the engine asks with the destination the moment a key is pressed).
  const revealTime = revealDot.replace('.', ':');
  dial.valueText = (s) => {
    if (solved && dist(s.angle) <= step / 2) return `Set to ${revealTime}`;
    const t = timeOf(s.angle);
    return `${t.h}:${String(t.m).padStart(2, '0')}`;
  };

  let touched = false;
  let hintLevel = 0;
  let hintTimer = 0;
  const setHint = (text: string) => {
    if (hint.textContent !== text) hint.textContent = text;
  };
  const scheduleHints = () => {
    clearTimeout(hintTimer);
    if (solved || hintLevel >= 2) return;
    hintTimer = window.setTimeout(
      () => {
        if (solved) return;
        hintLevel++;
        setHint(hintLevel === 1 ? root.dataset.hint1! : root.dataset.hint2!);
        scheduleHints();
      },
      hintLevel === 0 ? 7000 : 12000,
    );
  };

  /* Dwell: hold 10:20 for 700 ms. The lock ring fills while you hold. */
  const DWELL = reduced ? 350 : 700;
  const circ = 2 * Math.PI * Number(lockRing.getAttribute('r'));
  lockRing.style.strokeDasharray = `${circ}`;
  lockRing.style.strokeDashoffset = `${circ}`;
  let dwellStart = 0;
  let dwellRaf = 0;
  const dwellTick = () => {
    const p = Math.min(1, (performance.now() - dwellStart) / DWELL);
    lockRing.style.strokeDashoffset = `${circ * (1 - p)}`;
    if (p >= 1) return solve();
    dwellRaf = requestAnimationFrame(dwellTick);
  };
  const startDwell = () => {
    if (dwellStart || solved) return;
    dwellStart = performance.now();
    setHint(root.dataset.hintHold!);
    dwellRaf = requestAnimationFrame(dwellTick);
  };
  const stopDwell = () => {
    if (!dwellStart) return;
    dwellStart = 0;
    cancelAnimationFrame(dwellRaf);
    lockRing.style.strokeDashoffset = `${circ}`;
  };

  let current = -1;
  const paint = rafThrottle((angle: number) => {
    const t = timeOf(angle);
    dial.setAttribute('display', t.text);
    const idx = Math.round(norm(angle) / step) % detents;
    if (idx !== current) {
      ticks[current]?.classList.remove('is-here');
      ticks[idx]?.classList.add('is-here');
      current = idx;
    }
    if (!solved) {
      const tune = tuneAt(angle, target);
      root.style.setProperty('--tune', tune.toFixed(3));
      trace?.set(tune, false);
    }
  });

  dial.addEventListener('detent:change', (e) => {
    const { angle } = e.detail;
    paint(angle);
    if (!touched) {
      touched = true;
      root.dataset.touched = '';
      scheduleHints();
    }
    if (solved) return;
    if (dist(angle) <= step / 2) startDwell();
    else stopDwell();
  });

  // The magnet: let go close to 10:20 and it pulls in (the real engine
  // settles on detents; this makes the SVG fallback behave the same).
  dial.addEventListener('detent:release', () => {
    if (solved) return;
    const a = dial.angle;
    const d = dist(a);
    if (d > step / 2 && d <= step * 1.4) {
      const turns = Math.round((a - target) / 360);
      dial.setAngle(target + turns * 360);
    }
  });

  const solve = () => {
    if (solved) return;
    solved = true;
    stopDwell();
    lockRing.style.strokeDashoffset = '0';
    clearTimeout(hintTimer);
    thud(0.7);
    setTimeout(chime, 140);
    buzz([12, 40, 12]);
    root.style.setProperty('--tune', '1');
    setHint(root.dataset.hintSet!);
    dial.setAttribute('display', revealDot);
    dial.refreshAria?.();
    trace?.set(1, true);
    track('tease_solve', { seconds: Math.round((performance.now() - startedAt) / 1000) });
    open('solved');
  };

  // Starting point: 12:00, so the display reads a time from the first frame.
  dial.setAngle(0, { instant: true });
  paint(0);
  // The page painted this same value (--tune-start); setting it inline keeps it once JS owns it.
  root.style.setProperty('--tune', tuneAt(0, target).toFixed(3));

  /* ---- The form -------------------------------------------------------- */
  initForm(revealIso, revealDot, reduced);
}

function initForm(revealIso: string, revealDot: string, reduced: boolean) {
  const form = document.querySelector<HTMLFormElement>('[data-tease-form]');
  if (!form) return;
  const input = form.querySelector<HTMLInputElement>('input[type=email]')!;
  const button = form.querySelector<HTMLButtonElement>('button[type=submit]')!;
  const done = document.querySelector<HTMLElement>('[data-tease-done]')!;
  liveClear(input);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (button.dataset.busy !== undefined || !checkEmail(input)) return;
    const res = await withBusy(button, 'Saving…', () =>
      joinWaitlist({ email: input.value, source: 'tease' }),
    );
    if (!res.ok) {
      const err = document.getElementById(`${input.id}-err`);
      if (err) err.textContent = res.error;
      input.setAttribute('aria-invalid', 'true');
      return;
    }
    form.hidden = true;
    done.hidden = false;
    focusRegion(done.querySelector('h3'), reduced);
  });

  done.querySelector('[data-ics]')?.addEventListener('click', () => {
    downloadIcs(
      `detent-reveal-${revealDot.replace('.', '-')}.ics`,
      {
        start: revealIso,
        title: 'Detent: the reveal',
        description: `The thing behind the dial. ${location.origin}${location.pathname}`,
        url: `${location.origin}${location.pathname}`,
        alarm: 9,
      },
      'reveal',
    );
  });
}

/* ------------------------------------------------------------------------ */
/* The signal trace: a hairline across the page. Off-station it is noise;    */
/* as you approach 10:20 it flattens; when set it becomes a clean row of     */
/* detents. Renders on demand and stops when settled.                        */
/* ------------------------------------------------------------------------ */
function createTrace(canvas: HTMLCanvasElement, reduced: boolean) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  let w = 0;
  let h = 0;
  let tune = 0.4;
  let locked = false;
  let lockT = 0;
  let agitation = 1;
  let running = false;
  let last = performance.now();
  const phase = [Math.random() * 6, Math.random() * 6, Math.random() * 6];
  const styles = getComputedStyle(canvas);

  const resize = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    w = r.width;
    h = r.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(performance.now() / 1000);
  };

  function draw(time: number) {
    ctx!.clearRect(0, 0, w, h);
    const mid = h / 2;
    const t = reduced ? 0 : time;
    const noise = (1 - tune) * h * 0.36 * (reduced ? 1 : 0.3 + 0.7 * agitation);
    const teeth = Math.max(12, Math.round(w / 34));
    const lockAmp = h * 0.16 * lockT;
    ctx!.beginPath();
    for (let x = 0; x <= w; x += 2) {
      const u = x / w;
      const env = Math.sin(Math.PI * u) ** 0.7;
      const n =
        Math.sin(u * 41 + t * 1.7 + phase[0]!) * 0.5 +
        Math.sin(u * 97 - t * 2.9 + phase[1]!) * 0.3 +
        Math.sin(u * 211 + t * 4.3 + phase[2]!) * 0.2;
      // A detent torque curve: a steep rise and a slow fall per click.
      const saw = ((u * teeth) % 1) ** 3 - 0.5;
      const y = mid + n * noise * env + saw * lockAmp * env;
      if (x === 0) ctx!.moveTo(x, y);
      else ctx!.lineTo(x, y);
    }
    const ink = styles.getPropertyValue('--trace-ink').trim() || 'rgba(255,255,255,.35)';
    const lit = styles.getPropertyValue('--trace-lit').trim() || '#e0115f';
    ctx!.strokeStyle = locked ? lit : ink;
    ctx!.lineWidth = locked ? 1.5 : 1;
    ctx!.stroke();
  }

  const loop = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    agitation *= Math.exp(-dt / 0.45);
    if (locked) lockT = Math.min(1, lockT + dt / 0.9);
    draw(now / 1000);
    if (agitation > 0.02 || (locked && lockT < 1)) requestAnimationFrame(loop);
    else running = false;
  };
  const kick = () => {
    if (reduced) {
      if (locked) lockT = 1;
      draw(0);
      return;
    }
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(loop);
  };

  new ResizeObserver(resize).observe(canvas);
  return {
    set(nextTune: number, nextLocked: boolean) {
      tune = nextTune;
      if (nextLocked && !locked) locked = true;
      agitation = 1;
      kick();
    },
  };
}
