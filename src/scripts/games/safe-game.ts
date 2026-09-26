/**
 * <safe-game>: Crack the Safe. Upgrades the server-rendered markup in
 * src/pages/crack/index.astro. Daily combination seeded by the UTC epoch day.
 *
 * Mechanics: a 100-detent dial (physics override on <detent-dial>). Turn
 * right to wheel 1, left to wheel 2, right to wheel 3; set each with Enter,
 * a press on the knob, or the Set button. Each wheel only "listens" while
 * the dial turns its way: near the right number the detent gets heavier
 * (dial.physics.strength rises, the click drops in pitch, the stethoscope
 * trace spikes). Each wheel also has one false gate that never feels heavy.
 */
import { isSoundOn, onSoundChange, setSound } from '@/lib/sound';
import { read, write } from '@/lib/storage';
import { track } from '@/lib/analytics';
import { unlock } from '@/lib/achievements';
import type { DetentChangeDetail, DetentDialElement, FeelPhysics } from '@/scripts/dial/types';
import { formatClock, puzzleNumber, spokenClock, utcDay } from './day';
import { randomCode, seeded } from './rng';
import { emptyStreak, freezeReady, liveStreak, recordDay, type StreakState } from './streak';
import { Trace, type BarKind } from './trace';
import { canShare, canvasToFile, copyText, share, shareUrl } from './share';
import { startCountdown } from './countdown';
import * as sfx from './audio';

const N = 100;
const STEP = 360 / N;
const DIRS = [1, -1, 1] as const;
const DIR_WORD = { 1: 'right', [-1]: 'left' } as Record<number, string>;
const ORDINAL = ['first', 'second', 'third'];

const mod = (a: number, n: number) => ((a % n) + n) % n;
const dist = (a: number, b: number) => {
  const d = mod(a - b, N);
  return Math.min(d, N - d);
};
const pad2 = (n: number) => String(n).padStart(2, '0');

interface Combo {
  combo: number[];
  decoys: number[];
}

/** Three numbers at least 15 apart in dialing order, plus one false gate per wheel. */
export function makeCombo(key: string): Combo {
  const r = seeded(key);
  const pick = () => Math.floor(r() * N);
  const combo: number[] = [];
  let prev = 0;
  for (let i = 0; i < 3; i++) {
    let n = pick();
    for (let g = 0; g < 64 && (dist(n, prev) < 15 || combo.some((c) => dist(c, n) < 6)); g++)
      n = pick();
    combo.push(n);
    prev = n;
  }
  const decoys = combo.map((t, i) => {
    const start = i ? combo[i - 1]! : 0;
    let d = pick();
    for (let g = 0; g < 64 && (dist(d, t) < 10 || dist(d, start) < 6); g++) d = pick();
    return d;
  });
  return { combo, decoys };
}

const FALLOFF = [1, 0.62, 0.4, 0.22, 0.1];
const FALSE_GATE = [0.46, 0.3, 0.14];
function weightAt(n: number, target: number, decoy: number): number {
  const a = dist(n, target);
  const b = dist(n, decoy);
  return Math.max(FALLOFF[a] ?? 0, FALSE_GATE[b] ?? 0);
}

type Reading = 'Quiet' | 'Faint' | 'Firm' | 'Heavy';
const reading = (w: number): Reading =>
  w >= 0.95 ? 'Heavy' : w >= 0.38 ? 'Firm' : w >= 0.12 ? 'Faint' : 'Quiet';

interface Run {
  day: number;
  wheel: number;
  found: (number | null)[];
  misses: number[];
  sets: number;
  startedAt: number | null;
  finishedAt: number | null;
  code: string | null;
}

interface Store {
  v: 1;
  run: Run | null;
  streak: StreakState;
  best: number | null;
  cracked: number;
  clean: number;
}

const KEY = 'games:crack';
const freshRun = (day: number): Run => ({
  day,
  wheel: 0,
  found: [null, null, null],
  misses: [0, 0, 0],
  sets: 0,
  startedAt: null,
  finishedAt: null,
  code: null,
});
const loadStore = (): Store => {
  const s = read<Store | null>(KEY, null);
  return s && s.v === 1
    ? s
    : { v: 1, run: null, streak: emptyStreak(), best: null, cracked: 0, clean: 0 };
};

class SafeGame extends HTMLElement {
  #store: Store = loadStore();
  #today = utcDay();
  #number = 1;
  #mode: 'daily' | 'practice' = 'daily';
  #combo: Combo = makeCombo('x');
  #run: Run = freshRun(0);

  #dial: DetentDialElement | null = null;
  #bezel: SVGGElement | null = null;
  #trace: Trace | null = null;
  #k = 0;
  #lastDir = 0;
  #wrongRun = 0;
  #weight = 0;
  #strength: number = 0.35;
  #angle = 0;
  #raf = 0;
  #clock = 0;
  #stopCountdown: (() => void) | null = null;
  #cardUrl: string | null = null;
  #cardFile: File | null = null;
  #physics: FeelPhysics = { detents: N, strength: 0.35, damping: 0.18, spring: 0, stops: null };

  connectedCallback() {
    const epochDay = Number(this.dataset.epochDay) || this.#today;
    this.#number = puzzleNumber(this.#today, epochDay);
    this.#physics.strength = this.#strength = Number(this.dataset.baseStrength) || 0.35;
    this.#q('[data-safe-no]').forEach((el) => (el.textContent = `#${this.#number}`));

    this.#dial = this.querySelector('detent-dial');
    this.#bezel = this.querySelector('[data-safe-bezel]');
    const canvas = this.querySelector<HTMLCanvasElement>('canvas[data-trace]');
    if (canvas) this.#trace = new Trace(canvas, 56);

    this.#startDaily();
    this.#bind();
    this.dataset.ready = '';
  }

  disconnectedCallback() {
    clearInterval(this.#clock);
    this.#stopCountdown?.();
    this.#trace?.destroy();
    if (this.#cardUrl) URL.revokeObjectURL(this.#cardUrl);
  }

  /* ---------------------------------------------------------------- setup */

  #q<T extends Element = HTMLElement>(sel: string): T[] {
    return Array.from(this.querySelectorAll<T>(sel));
  }
  #one<T extends Element = HTMLElement>(sel: string): T | null {
    return this.querySelector<T>(sel);
  }

  #startDaily() {
    this.#mode = 'daily';
    this.#combo = makeCombo(`detent-safe|${this.#today}`);
    const saved = this.#store.run;
    this.#run = saved && saved.day === this.#today ? saved : freshRun(this.#today);
    this.#resetInstrument();
    if (this.#run.finishedAt) this.#parkOn(this.#combo.combo[2]!);
    else if (this.#run.wheel > 0) this.#parkOn(this.#run.found[this.#run.wheel - 1] ?? 0);
    this.#render();
    if (this.#run.finishedAt) this.#showDone(false);
  }

  #startPractice() {
    this.#mode = 'practice';
    this.#combo = makeCombo(`detent-practice|${randomCode(10)}`);
    this.#run = freshRun(this.#today);
    this.#resetInstrument();
    this.#parkOn(0);
    this.#render();
    this.#feedback('Practice safe. New numbers, same rules. It doesn’t touch your streak.');
    this.#dial?.focus({ preventScroll: true });
    track('game_practice', { game: 'crack' });
  }

  #resetInstrument() {
    this.#lastDir = 0;
    this.#wrongRun = 0;
    this.#weight = 0;
    this.#trace?.clear();
    this.#setWeight(0);
    const word = this.#one('[data-trace-word]');
    if (word) word.textContent = 'Quiet';
  }

  /** Put the dial on a number without it counting as travel. */
  #parkOn(n: number) {
    this.#k = n;
    this.#angle = n * STEP;
    this.#paintBezel();
    const dial = this.#dial;
    if (!dial) return;
    const apply = () => {
      this.#k = n;
      dial.setAngle(n * STEP, { instant: true });
      this.#k = Math.round(dial.angle / STEP);
      this.#paintDial();
    };
    if (customElements.get('detent-dial')) apply();
    else customElements.whenDefined('detent-dial').then(apply);
  }

  #bind() {
    const dial = this.#dial;
    if (dial) {
      const ready = () => {
        dial.physics = { ...this.#physics };
        dial.feelColor = null;
        this.#paintDial();
      };
      customElements.whenDefined('detent-dial').then(ready);
      dial.addEventListener('detent:ready', ready);
      dial.addEventListener('detent:change', (e) => this.#onChange(e.detail));
      dial.addEventListener('detent:press', () => this.#set());
      dial.addEventListener('detent:release', () => this.#snap());
    }

    this.#bindGrip();
    this.#one('[data-set]')?.addEventListener('click', () => this.#set());
    this.#one('[data-practice]')?.addEventListener('click', () => this.#startPractice());
    this.#q('[data-today]').forEach((b) =>
      b.addEventListener('click', () => {
        this.#startDaily();
        this.#dial?.focus({ preventScroll: true });
      }),
    );

    const sound = this.#one<HTMLButtonElement>('[data-sound]');
    const syncSound = (on: boolean) => {
      if (!sound) return;
      sound.setAttribute('aria-pressed', String(on));
      const state = sound.querySelector('[data-sound-state]');
      if (state) state.textContent = on ? 'on' : 'off';
    };
    sound?.addEventListener('click', () => setSound(!isSoundOn()));
    syncSound(isSoundOn());
    onSoundChange(syncSound);

    this.#one('[data-copy]')?.addEventListener('click', async () => {
      const ok = await copyText(this.#shareText());
      this.#status(
        ok
          ? 'Copied. Paste it anywhere.'
          : 'Couldn’t reach the clipboard. Select the text above and copy it.',
      );
      track('game_share', { game: 'crack', method: 'copy' });
    });
    const shareBtn = this.#one<HTMLButtonElement>('[data-share]');
    if (shareBtn) {
      shareBtn.hidden = !canShare();
      shareBtn.addEventListener('click', async () => {
        const res = await share(this.#shareText(), this.#cardFile);
        if (res === 'shared') this.#status('Shared.');
        track('game_share', { game: 'crack', method: 'native', result: res });
      });
    }

    document.addEventListener('visibilitychange', () => this.#paintClock());
  }

  /** Drag anywhere on the numbered bezel to turn the dial too. */
  #bindGrip() {
    const grip = this.#one('[data-safe-grip]');
    const dial = this.#dial;
    if (!grip || !dial) return;
    let drag: { id: number; last: number } | null = null;
    const pointerAngle = (e: PointerEvent) => {
      const r = grip.getBoundingClientRect();
      return (
        (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) /
        Math.PI
      );
    };
    const emit = (type: 'detent:grab' | 'detent:release') =>
      dial.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail: {} }));
    grip.addEventListener('pointerdown', (e) => {
      if (!e.isPrimary || e.button > 0) return;
      e.preventDefault();
      grip.setPointerCapture(e.pointerId);
      drag = { id: e.pointerId, last: pointerAngle(e) };
      dial.focus({ preventScroll: true });
      emit('detent:grab');
      this.dataset.grabbing = '';
    });
    grip.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const now = pointerAngle(e);
      let d = now - drag.last;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      drag.last = now;
      dial.setAngle(dial.angle + d, { instant: true });
    });
    const end = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      delete this.dataset.grabbing;
      emit('detent:release');
    };
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
  }

  /** Settle on the nearest number after a drag (the real engine does this itself). */
  #snap() {
    const dial = this.#dial;
    if (!dial) return;
    const target = Math.round(dial.angle / STEP) * STEP;
    if (Math.abs(target - dial.angle) > 0.01) dial.setAngle(target, { instant: true });
  }

  /* ----------------------------------------------------------------- play */

  #onChange(d: DetentChangeDetail) {
    this.#angle = d.angle;
    if (!this.#raf) {
      this.#raf = requestAnimationFrame(() => {
        this.#raf = 0;
        this.#paintBezel();
      });
    }
    const k1 = Math.round(d.angle / STEP);
    if (k1 !== this.#k) {
      const dir = Math.sign(k1 - this.#k);
      const steps = Math.min(Math.abs(k1 - this.#k), N);
      for (let i = 1; i <= steps; i++) this.#cross(this.#k + dir * i, dir);
      this.#k = k1;
    }
    this.#paintDial();
  }

  #cross(k: number, dir: number) {
    const n = mod(k, N);
    const run = this.#run;
    if (run.finishedAt) {
      sfx.click({ strength: this.#physics.strength });
      return;
    }
    if (run.startedAt === null) {
      run.startedAt = Date.now();
      this.#persist();
      this.#runClock();
    }
    this.#lastDir = dir;
    const need = DIRS[run.wheel]!;
    let w = 0;
    if (dir === need) {
      w = weightAt(n, this.#combo.combo[run.wheel]!, this.#combo.decoys[run.wheel]!);
      this.#wrongRun = 0;
    } else if (++this.#wrongRun === 6) {
      this.#feedback(`Wheel ${run.wheel + 1} only listens on a ${DIR_WORD[need]} turn.`);
    }
    const r = reading(w);
    const kind: BarKind = r === 'Heavy' ? 'signal' : r === 'Firm' ? 'strong' : 'base';
    this.#trace?.push(Math.max(0.035, w + Math.random() * 0.07 * (1 - w)), kind);
    sfx.click({ weight: w, strength: this.#physics.strength });
    if (r === 'Heavy') sfx.buzz(14);
    this.#setWeight(w);
    const word = this.#one('[data-trace-word]');
    if (word && word.textContent !== r) word.textContent = r;
  }

  /** Heavier detent near the gate: physics for the engine, a CSS var for the page. */
  #setWeight(w: number) {
    this.#weight = w;
    this.style.setProperty('--w', w.toFixed(2));
    const base = Number(this.dataset.baseStrength) || 0.35;
    const strength = +(base + (1 - base) * w).toFixed(2);
    if (this.#dial && Math.abs(strength - this.#strength) >= 0.04) {
      this.#strength = strength;
      this.#dial.physics = {
        ...this.#physics,
        strength,
        accents: w >= 0.95 ? [mod(this.#k, N) * STEP] : [],
      };
    }
  }

  #set() {
    const run = this.#run;
    if (run.finishedAt) return;
    const n = mod(this.#k, N);
    const need = DIRS[run.wheel]!;
    if (this.#lastDir !== need) {
      const way = need > 0 ? 'clockwise' : 'counterclockwise';
      this.#feedback(
        `Set wheel ${run.wheel + 1} on a ${DIR_WORD[need]} turn. Come back to it ${way}.`,
      );
      return;
    }
    run.sets += 1;
    this.#lastDir = 0;
    if (n === this.#combo.combo[run.wheel]) {
      run.found[run.wheel] = n;
      run.wheel += 1;
      this.#wrongRun = 0;
      if (run.wheel === 3) {
        this.#finish();
        return;
      }
      const next = DIRS[run.wheel]!;
      this.#feedback(`Wheel ${run.wheel} caught on ${pad2(n)}. Now ${DIR_WORD[next]}.`);
      this.#flash('caught');
    } else {
      run.misses[run.wheel]! += 1;
      this.#feedback(`${pad2(n)} didn’t catch. Keep turning ${DIR_WORD[need]} and listen.`);
      this.#flash('miss');
    }
    this.#persist();
    this.#render();
  }

  #finish() {
    const run = this.#run;
    run.finishedAt = Date.now();
    const elapsed = run.finishedAt - (run.startedAt ?? run.finishedAt);
    const clean = run.misses.every((m) => m === 0);
    if (this.#mode === 'daily') {
      run.code = `SAFE-${String(this.#number).padStart(3, '0')}-${randomCode(4)}`;
      const s = this.#store;
      s.cracked += 1;
      if (clean) s.clean += 1;
      s.best = s.best === null ? elapsed : Math.min(s.best, elapsed);
      s.streak = recordDay(s.streak, this.#today).state;
      this.#persist();
      unlock('safecracker');
      if (s.streak.current >= 3) unlock('streak-3');
    }
    track('game_complete', {
      game: 'crack',
      mode: this.#mode,
      seconds: Math.round(elapsed / 1000),
      sets: run.sets,
      clean,
    });
    sfx.opened();
    sfx.buzz([18, 60, 30]);
    clearInterval(this.#clock);
    this.#render();
    this.#showDone(true);
  }

  /* --------------------------------------------------------------- render */

  #persist() {
    if (this.#mode !== 'daily') return;
    this.#store.run = this.#run;
    write(KEY, this.#store);
  }

  #feedback(msg: string) {
    const el = this.#one('[data-feedback]');
    if (el) el.textContent = msg;
  }

  #status(msg: string) {
    const el = this.#one('[data-share-status]');
    if (el) el.textContent = msg;
  }

  #flash(kind: 'caught' | 'miss') {
    this.dataset.flash = kind;
    window.setTimeout(() => {
      if (this.dataset.flash === kind) delete this.dataset.flash;
    }, 700);
  }

  #paintBezel() {
    this.#bezel?.setAttribute('transform', `rotate(${this.#angle.toFixed(2)})`);
  }

  #paintDial() {
    const dial = this.#dial;
    if (!dial) return;
    const n = mod(this.#k, N);
    const done = !!this.#run.finishedAt;
    const label = done ? 'OPEN' : pad2(n);
    if (dial.getAttribute('display') !== label) dial.setAttribute('display', label);
    dial.setAttribute('aria-label', 'Safe dial');
    dial.setAttribute('aria-valuemin', '0');
    dial.setAttribute('aria-valuemax', '99');
    dial.setAttribute('aria-valuenow', String(n));
    dial.setAttribute('aria-valuetext', done ? `${n}. Open.` : `${n}. ${reading(this.#weight)}.`);
    this.#q('[data-set-n]').forEach((el) => (el.textContent = pad2(n)));
  }

  #runClock() {
    clearInterval(this.#clock);
    this.#paintClock();
    if (this.#run.startedAt && !this.#run.finishedAt)
      this.#clock = window.setInterval(() => this.#paintClock(), 1000);
  }

  #paintClock() {
    const run = this.#run;
    const ms = run.startedAt ? (run.finishedAt ?? Date.now()) - run.startedAt : 0;
    this.#q('[data-time]').forEach((el) => (el.textContent = formatClock(ms)));
  }

  #render() {
    const run = this.#run;
    const done = !!run.finishedAt;
    this.dataset.state = done ? 'open' : 'play';
    this.dataset.mode = this.#mode;
    const wheel = Math.min(run.wheel, 2);
    const need = DIRS[wheel]!;
    this.dataset.dir = done ? 'none' : DIR_WORD[need];

    const word = this.#one('[data-dir-word]');
    const rest = this.#one('[data-dir-rest]');
    const lead = this.#one('[data-dir-lead]');
    if (word && rest && lead) {
      if (done) {
        lead.textContent = '';
        word.textContent = 'Open.';
        rest.textContent = '';
      } else {
        lead.textContent = run.wheel === 0 ? 'Turn ' : run.wheel === 1 ? 'Now ' : '';
        word.textContent = run.wheel === 2 ? 'Right' : DIR_WORD[need]!;
        rest.textContent =
          run.wheel === 2 ? ' again to the third number.' : ` to the ${ORDINAL[run.wheel]} number.`;
      }
    }

    this.#q<HTMLElement>('[data-wheel]').forEach((li) => {
      const i = Number(li.dataset.wheel);
      const f = run.found[i];
      li.dataset.status =
        f !== null && f !== undefined ? 'found' : i === run.wheel ? 'active' : 'waiting';
      const v = li.querySelector('[data-wheel-value]');
      if (v) v.textContent = f !== null && f !== undefined ? pad2(f) : '--';
      const m = li.querySelector('[data-wheel-misses]');
      const misses = run.misses[i] ?? 0;
      if (m)
        m.textContent = misses
          ? `${misses} miss${misses === 1 ? '' : 'es'}`
          : f !== null && f !== undefined
            ? 'First set'
            : '';
    });

    // Found numbers get a tally pin on the bezel.
    const marks = this.#one('[data-safe-marks]');
    if (marks) {
      marks.innerHTML = '';
      run.found.forEach((f) => {
        if (f === null || f === undefined) return;
        const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('r', '7');
        c.setAttribute('cx', '0');
        c.setAttribute('cy', '-281');
        c.setAttribute('transform', `rotate(${-f * STEP})`);
        c.setAttribute('class', 'safe__pin');
        marks.appendChild(c);
      });
    }

    this.#q('[data-sets]').forEach((el) => (el.textContent = String(run.sets)));
    const set = this.#one<HTMLButtonElement>('[data-set]');
    if (set) set.disabled = done;
    this.#paintDial();
    this.#runClock();
    this.#renderStats();
  }

  #renderStats() {
    const s = this.#store;
    const streak = liveStreak(s.streak, this.#today);
    const put = (k: string, v: string) =>
      this.#q(`[data-stat="${k}"]`).forEach((el) => (el.textContent = v));
    put('streak', String(streak));
    put('best', s.best === null ? '–' : formatClock(s.best));
    put('cracked', String(s.cracked));
    put('clean', String(s.clean));
    put('best-streak', String(s.streak.best));
    put(
      'freeze',
      freezeReady(s.streak, this.#today)
        ? 'This week’s freeze is ready'
        : 'This week’s freeze is used',
    );
  }

  #shareText(): string {
    const run = this.#run;
    const elapsed = (run.finishedAt ?? 0) - (run.startedAt ?? 0);
    const clean = run.misses.filter((m) => m === 0).length;
    const marks = run.misses.map((m) => (m === 0 ? '🔴' : '⭕')).join('');
    return `Detent Safe #${this.#number} · ${clean}/3 · ${formatClock(elapsed)} · ${marks}\n${shareUrl('/crack/')}`;
  }

  #showDone(fresh: boolean) {
    const run = this.#run;
    const daily = this.#mode === 'daily';
    const elapsed = (run.finishedAt ?? 0) - (run.startedAt ?? run.finishedAt ?? 0);
    const clean = run.misses.filter((m) => m === 0).length;
    this.#q('[data-done-time]').forEach((el) => {
      el.textContent = formatClock(elapsed);
      el.setAttribute('aria-label', spokenClock(elapsed));
    });
    this.#q('[data-done-sets]').forEach((el) => (el.textContent = String(run.sets)));
    this.#q('[data-done-clean]').forEach((el) => (el.textContent = `${clean}/3`));
    this.#q('[data-daily-only]').forEach((el) => (el.hidden = !daily));
    this.#q('[data-practice-only]').forEach((el) => (el.hidden = daily));

    if (fresh) {
      this.#feedback(
        daily
          ? `Open. ${spokenClock(elapsed)}, ${run.sets} sets.`
          : `Practice safe open in ${formatClock(elapsed)}.`,
      );
      this.#one<HTMLElement>('[data-done-heading]')?.focus();
    }

    if (daily) {
      const pre = this.#one('[data-share-text]');
      if (pre) pre.textContent = this.#shareText();
      this.#q('[data-code]').forEach((el) => (el.textContent = run.code ?? ''));
      const cd = this.#one('[data-countdown]');
      if (cd && !this.#stopCountdown) {
        this.#stopCountdown = startCountdown(cd, () => {
          this.#q('[data-rollover]').forEach((el) => (el.hidden = false));
          this.#q('[data-countdown-line]').forEach((el) => (el.hidden = true));
        });
      }
      void this.#buildCard();
    }
  }

  async #buildCard() {
    const run = this.#run;
    if (!run.finishedAt) return;
    try {
      const { drawSafeCard } = await import('./safe-card');
      const canvas = await drawSafeCard({
        number: this.#number,
        time: formatClock(run.finishedAt - (run.startedAt ?? run.finishedAt)),
        wheels: run.misses.map((m) => m === 0),
        sets: run.sets,
        streak: liveStreak(this.#store.streak, this.#today),
        url: shareUrl('/crack/'),
      });
      const file = await canvasToFile(canvas, `detent-safe-${this.#number}.png`);
      if (!file) return;
      this.#cardFile = file;
      if (this.#cardUrl) URL.revokeObjectURL(this.#cardUrl);
      this.#cardUrl = URL.createObjectURL(file);
      const slot = this.#one('[data-card-slot]');
      let img = slot?.querySelector('img') ?? null;
      if (slot && !img) {
        img = document.createElement('img');
        img.width = 1200;
        img.height = 630;
        img.decoding = 'async';
        slot.appendChild(img);
      }
      if (img) {
        img.src = this.#cardUrl;
        img.alt = `Share card: Detent Safe #${this.#number}, open in ${formatClock(run.finishedAt - (run.startedAt ?? 0))}, ${run.misses.filter((m) => m === 0).length} of 3 wheels on the first set.`;
      }
      const save = this.#one<HTMLAnchorElement>('[data-save-card]');
      if (save) {
        save.href = this.#cardUrl;
        save.download = file.name;
        save.hidden = false;
      }
      this.#q('[data-card-wrap]').forEach((el) => (el.hidden = false));
    } catch {
      /* the text share still works */
    }
  }
}

if (!customElements.get('safe-game')) customElements.define('safe-game', SafeGame);
