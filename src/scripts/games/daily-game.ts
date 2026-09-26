/**
 * <daily-detent>: the Daily Detent. One hidden feel a day on a real
 * <detent-dial> (physics override); name its family in five tries.
 *
 * The page ships an opaque, build-shuffled list of { physics, hash } slots
 * (data-slots). Today's slot comes from the UTC epoch day. A guess is right
 * when answerHash(slot, guess) matches, so the answer is never in plain text.
 */
import { PROFILES, type ProfileId } from '@/data/product';
import { isSoundOn, onSoundChange, setSound } from '@/lib/sound';
import { read, write } from '@/lib/storage';
import { track } from '@/lib/analytics';
import { unlock } from '@/lib/achievements';
import { url } from '@/lib/url';
import type {
  DetentChangeDetail,
  DetentDialElement,
  DialValueState,
  FeelPhysics,
} from '@/scripts/dial/types';
import { puzzleNumber, utcDay } from './day';
import { answerHash, seeded, shuffle } from './rng';
import { emptyStreak, freezeReady, liveStreak, recordDay, type StreakState } from './streak';
import { FeelSensor, type Sense } from './feel-sense';
import { Trace } from './trace';
import { describe, torquePath } from './torque';
import { canShare, copyText, share, shareUrl } from './share';
import { startCountdown } from './countdown';
import * as sfx from './audio';

interface Slot {
  p: FeelPhysics;
  h: number;
}

interface Run {
  day: number;
  guesses: ProfileId[];
  solved: boolean;
  finished: boolean;
}

interface Store {
  v: 1;
  run: Run | null;
  streak: StreakState;
  played: number;
  wins: number;
  dist: number[];
}

const KEY = 'games:daily';
const TRIES = 5;
const HINTS_AT = [3, 4, 5];

const WORDS: Record<Sense['kind'], string> = {
  detent: 'Click',
  accent: 'Deep click',
  snap: 'Snap',
  stop: 'Wall',
  bump: 'Bump',
  hiss: 'Smooth',
  tension: 'Pulling back',
};

/** Today's slot: a fresh shuffle of all slots every cycle, so families rotate. */
export function slotFor(dayIndex: number, count: number): number {
  const d = Math.max(0, dayIndex);
  const cycle = Math.floor(d / count);
  const order = shuffle(
    Array.from({ length: count }, (_, i) => i),
    seeded(`detent-daily-cycle|${cycle}`),
  );
  return order[d % count]!;
}

const loadStore = (): Store => {
  const s = read<Store | null>(KEY, null);
  return s && s.v === 1 && Array.isArray(s.dist)
    ? s
    : { v: 1, run: null, streak: emptyStreak(), played: 0, wins: 0, dist: [0, 0, 0, 0, 0] };
};

class DailyDetent extends HTMLElement {
  #store: Store = loadStore();
  #today = utcDay();
  #number = 1;
  #slot = 0;
  #slots: Slot[] = [];
  #physics!: FeelPhysics;
  #run!: Run;
  #dial: DetentDialElement | null = null;
  #trace: Trace | null = null;
  #sensor!: FeelSensor;
  #angle = 0;
  #lastT = 0;
  #lastWord = '';
  #raf = 0;
  #stopCountdown: (() => void) | null = null;

  connectedCallback() {
    try {
      this.#slots = JSON.parse(this.dataset.slots ?? '[]') as Slot[];
    } catch {
      this.#slots = [];
    }
    if (!this.#slots.length) return;
    const epochDay = Number(this.dataset.epochDay) || this.#today;
    this.#number = puzzleNumber(this.#today, epochDay);
    this.#slot = slotFor(this.#today - epochDay, this.#slots.length);
    this.#physics = this.#slots[this.#slot]!.p;
    this.#sensor = new FeelSensor(this.#physics);
    const saved = this.#store.run;
    this.#run =
      saved && saved.day === this.#today
        ? saved
        : { day: this.#today, guesses: [], solved: false, finished: false };

    this.#q('[data-daily-no]').forEach((el) => (el.textContent = `#${this.#number}`));
    this.#dial = this.querySelector('detent-dial');
    const canvas = this.querySelector<HTMLCanvasElement>('canvas[data-trace]');
    if (canvas) this.#trace = new Trace(canvas, 64);

    this.#bind();
    this.#render();
    if (this.#run.finished) void this.#showResult(false);
    this.dataset.ready = '';
  }

  disconnectedCallback() {
    this.#stopCountdown?.();
    this.#trace?.destroy();
  }

  #q<T extends Element = HTMLElement>(sel: string): T[] {
    return Array.from(this.querySelectorAll<T>(sel));
  }
  #one<T extends Element = HTMLElement>(sel: string): T | null {
    return this.querySelector<T>(sel);
  }

  #bind() {
    const dial = this.#dial;
    if (dial) {
      dial.valueText = this.#valueText;
      const ready = () => {
        dial.physics = { ...this.#physics };
        if (!this.#run.finished) {
          dial.feelColor = '#8d8a8c';
          dial.setAttribute('display', `#${this.#number}`);
        }
        this.#angle = dial.angle;
        this.#paintAngle();
      };
      customElements.whenDefined('detent-dial').then(ready);
      dial.addEventListener('detent:ready', ready);
      dial.addEventListener('detent:change', (e) => this.#onChange(e.detail));
    }

    this.#q<HTMLButtonElement>('[data-guess]').forEach((b) =>
      b.addEventListener('click', () => void this.#guess(b.dataset.guess as ProfileId)),
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
      track('game_share', { game: 'daily', method: 'copy' });
    });
    const shareBtn = this.#one<HTMLButtonElement>('[data-share]');
    if (shareBtn) {
      shareBtn.hidden = !canShare();
      shareBtn.addEventListener('click', async () => {
        const res = await share(this.#shareText());
        if (res === 'shared') this.#status('Shared.');
        track('game_share', { game: 'daily', method: 'native', result: res });
      });
    }
  }

  /* ----------------------------------------------------------------- feel */

  #onChange(d: DetentChangeDetail) {
    const now = performance.now();
    const dt = this.#lastT ? now - this.#lastT : 16;
    this.#lastT = now;
    const senses = this.#sensor.feed(this.#angle, d.angle, dt);
    this.#angle = d.angle;
    for (const s of senses) this.#emit(s);
    if (!this.#raf) {
      this.#raf = requestAnimationFrame(() => {
        this.#raf = 0;
        this.#paintAngle();
      });
    }
  }

  #emit(s: Sense) {
    const p = this.#physics;
    switch (s.kind) {
      case 'detent':
        this.#trace?.push(s.h, 'base');
        sfx.click({ strength: p.strength });
        break;
      case 'accent':
        this.#trace?.push(s.h, 'strong');
        sfx.click({ weight: 0.75, strength: 1 });
        break;
      case 'snap':
        this.#trace?.push(s.h, 'strong');
        sfx.snap();
        break;
      case 'stop':
        this.#trace?.push(1, 'wall');
        sfx.thud();
        sfx.buzz(20);
        break;
      case 'bump':
        this.#trace?.push(s.h, 'strong');
        sfx.bump();
        break;
      case 'tension':
        this.#trace?.push(s.h, 'base');
        sfx.grain(0, s.level ?? 0);
        break;
      default:
        this.#trace?.push(s.h, 'base');
        sfx.grain(s.h);
    }
    const w = WORDS[s.kind];
    if (w !== this.#lastWord) {
      this.#lastWord = w;
      const el = this.#one('[data-trace-word]');
      if (el) el.textContent = w;
    }
  }

  #paintAngle() {
    const a = this.#angle;
    this.#one('[data-pointer]')?.setAttribute('transform', `rotate(${a.toFixed(2)})`);
    const shown = Math.round(a);
    const text = `${shown > 0 ? '+' : shown < 0 ? '−' : '±'}${String(Math.abs(shown)).padStart(3, '0')}°`;
    this.#q('[data-angle]').forEach((el) => (el.textContent = text));
  }

  /**
   * What a screen reader hears: the angle and what the contact mic picked up.
   * Owned by the dial (its valueText contract) so its trailing aria update
   * can't swap in the stock readout, which names the feel ("Centered",
   * "Detent 3 of 24") and would give the answer away.
   */
  #valueText = (s: DialValueState): string =>
    `${Math.round(s.angle)} degrees${this.#lastWord ? `. ${this.#lastWord}` : ''}`;

  /* ---------------------------------------------------------------- guess */

  async #guess(id: ProfileId) {
    const run = this.#run;
    if (run.finished || run.guesses.includes(id)) return;
    run.guesses.push(id);
    const right = answerHash(this.#slot, id) === this.#slots[this.#slot]!.h;
    const name = PROFILES.find((p) => p.id === id)?.name ?? id;
    if (right) {
      run.solved = true;
      run.finished = true;
    } else if (run.guesses.length >= TRIES) {
      run.finished = true;
    }
    track('daily_guess', { try: run.guesses.length, right });

    if (run.finished) {
      this.#finish();
    } else {
      const left = TRIES - run.guesses.length;
      const hintNow = HINTS_AT.indexOf(run.guesses.length + 1);
      this.#feedback(
        `Not ${name}. ${left} ${left === 1 ? 'try' : 'tries'} left.${hintNow > -1 ? ' A torque hint just appeared below.' : ''}`,
      );
      this.#persist();
      this.#render();
      this.dataset.flash = 'miss';
      window.setTimeout(() => delete this.dataset.flash, 500);
    }
  }

  #answer(): ProfileId | null {
    const h = this.#slots[this.#slot]!.h;
    return PROFILES.find((p) => answerHash(this.#slot, p.id) === h)?.id ?? null;
  }

  #finish() {
    const run = this.#run;
    const s = this.#store;
    s.played += 1;
    if (run.solved) {
      s.wins += 1;
      s.dist[run.guesses.length - 1] = (s.dist[run.guesses.length - 1] ?? 0) + 1;
    }
    s.streak = recordDay(s.streak, this.#today).state;
    this.#persist();
    if (s.streak.current >= 3) unlock('streak-3');
    track('game_complete', { game: 'daily', solved: run.solved, tries: run.guesses.length });
    if (run.solved) {
      sfx.correct();
      sfx.buzz([14, 50, 14]);
    }
    this.#render();
    void this.#showResult(true);
  }

  #persist() {
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

  /* --------------------------------------------------------------- render */

  #glyphs(): string {
    const run = this.#run;
    return Array.from({ length: TRIES }, (_, i) => {
      if (i >= run.guesses.length) return '○';
      if (i === run.guesses.length - 1 && run.solved) return '◐';
      return '●';
    }).join('');
  }

  #shareText(): string {
    const run = this.#run;
    const score = run.solved ? `${run.guesses.length}/${TRIES}` : `X/${TRIES}`;
    return `Daily Detent #${this.#number} ${this.#glyphs()} ${score}\n${shareUrl('/daily/')}`;
  }

  #render() {
    const run = this.#run;
    this.dataset.state = run.finished ? 'done' : 'play';
    const answer = run.finished ? this.#answer() : null;

    // Try glyphs.
    const tries = this.#q('[data-try]');
    tries.forEach((t, i) => {
      t.dataset.state =
        i >= run.guesses.length
          ? i === run.guesses.length && !run.finished
            ? 'next'
            : 'open'
          : i === run.guesses.length - 1 && run.solved
            ? 'hit'
            : 'miss';
    });
    const triesLabel = this.#one('[data-tries]');
    if (triesLabel) {
      triesLabel.setAttribute(
        'aria-label',
        run.finished
          ? `${run.guesses.length} of ${TRIES} tries used`
          : `Try ${run.guesses.length + 1} of ${TRIES}`,
      );
    }
    this.#q('[data-try-count]').forEach(
      (el) =>
        (el.textContent = run.finished
          ? `${run.guesses.length}/${TRIES}`
          : `Try ${run.guesses.length + 1} of ${TRIES}`),
    );

    // Answer keys.
    this.#q<HTMLButtonElement>('[data-guess]').forEach((b) => {
      const id = b.dataset.guess as ProfileId;
      const guessed = run.guesses.includes(id);
      const isAnswer = answer === id;
      b.dataset.state = isAnswer ? (run.solved ? 'right' : 'reveal') : guessed ? 'wrong' : 'open';
      const disabled = run.finished || guessed;
      b.setAttribute('aria-disabled', String(disabled));
      const state = b.querySelector('[data-guess-state]');
      if (state)
        state.textContent = isAnswer
          ? run.solved
            ? 'Right'
            : 'Today’s feel'
          : guessed
            ? 'Not it'
            : '';
    });

    // Torque hints appear on tries 3, 4 and 5. The next one to open is marked.
    let soon = true;
    this.#q<HTMLElement>('[data-hint]').forEach((fig) => {
      const i = Number(fig.dataset.hint);
      const open = run.finished || run.guesses.length + 1 >= HINTS_AT[i]!;
      fig.dataset.locked = String(!open);
      fig.toggleAttribute('data-soon', !open && soon);
      if (!open) soon = false;
      if (!open || fig.dataset.drawn) return;
      fig.dataset.drawn = '';
      const path = fig.querySelector('[data-hint-path]');
      const w = Number(fig.dataset.w) || 320;
      const h = Number(fig.dataset.h) || 120;
      if (path)
        path.setAttribute(
          'd',
          i === 0
            ? torquePath(this.#physics, 0, 90, w, h, 240)
            : torquePath(this.#physics, -180, 180, w, h),
        );
      const stops = fig.querySelector('[data-hint-stops]');
      if (stops && this.#physics.stops && i > 0) {
        stops.innerHTML = this.#physics.stops
          .map((s) => {
            const x = (((s + 180) / 360) * w).toFixed(1);
            return `<line x1="${x}" x2="${x}" y1="0" y2="${h}" class="hint__stop"></line>`;
          })
          .join('');
      }
      const list = fig.querySelector('[data-hint-list]');
      if (list)
        list.innerHTML = describe(this.#physics)
          .map((l) => `<li>${l}</li>`)
          .join('');
    });

    this.#renderStats();
  }

  #renderStats() {
    const s = this.#store;
    const put = (k: string, v: string) =>
      this.#q(`[data-stat="${k}"]`).forEach((el) => (el.textContent = v));
    put('played', String(s.played));
    put('rate', s.played ? `${Math.round((s.wins / s.played) * 100)}%` : '–');
    put('streak', String(liveStreak(s.streak, this.#today)));
    put('best-streak', String(s.streak.best));
    put(
      'freeze',
      freezeReady(s.streak, this.#today)
        ? 'This week’s freeze is ready'
        : 'This week’s freeze is used',
    );
    const max = Math.max(1, ...s.dist);
    this.#q<HTMLElement>('[data-dist-row]').forEach((row) => {
      const i = Number(row.dataset.distRow);
      const n = s.dist[i] ?? 0;
      row.style.setProperty('--share', String(n / max));
      row.dataset.today = String(this.#run.solved && this.#run.guesses.length - 1 === i);
      const c = row.querySelector('[data-dist-n]');
      if (c) c.textContent = String(n);
    });
  }

  async #showResult(fresh: boolean) {
    const run = this.#run;
    const id = this.#answer();
    const profile = PROFILES.find((p) => p.id === id);
    if (!profile) return;
    this.style.setProperty('--feel', `var(--feel-${profile.id})`);

    const title = this.#one('[data-result-title]');
    if (title)
      title.textContent = run.solved
        ? `It was ${profile.name}.`
        : `Today’s feel was ${profile.name}.`;
    const sub = this.#one('[data-result-sub]');
    if (sub) {
      sub.textContent = run.solved
        ? run.guesses.length === 1
          ? 'First try. Your hands already speak the language.'
          : `Named in ${run.guesses.length}. The vocabulary sticks faster than you’d think.`
        : 'Five tries is a hard ask. Turn it again now you know; it will read differently.';
    }
    const feel = this.#one('[data-result-feel]');
    if (feel) feel.textContent = profile.feel;
    const cut = this.#one('[data-result-cut]');
    if (cut)
      cut.innerHTML = describe(this.#physics)
        .map((l) => `<li>${l}</li>`)
        .join('');
    const link = this.#one<HTMLAnchorElement>('[data-feel-link]');
    if (link) {
      link.href = url(`/profiles/?p=${profile.id}`);
      link.textContent = `Feel ${profile.name} in the library`;
      link.dataset.trackProfile = profile.id;
    }
    const pre = this.#one('[data-share-text]');
    if (pre) pre.textContent = this.#shareText();

    const dial = this.#dial;
    if (dial) {
      const reveal = () => {
        dial.profile = profile.id;
        dial.feelColor = profile.color;
        dial.setAttribute('display', profile.name.toUpperCase());
      };
      if (customElements.get('detent-dial')) reveal();
      else customElements.whenDefined('detent-dial').then(reveal);
    }

    const cd = this.#one('[data-countdown]');
    if (cd && !this.#stopCountdown) {
      this.#stopCountdown = startCountdown(cd, () => {
        this.#q('[data-rollover]').forEach((el) => (el.hidden = false));
        this.#q('[data-countdown-line]').forEach((el) => (el.hidden = true));
      });
    }
    if (fresh) {
      this.#feedback(
        run.solved ? `Right on try ${run.guesses.length}.` : 'Out of tries. Here is today’s feel.',
      );
      this.#one<HTMLElement>('[data-result-title]')?.focus();
    }
  }
}

if (!customElements.get('daily-detent')) customElements.define('daily-detent', DailyDetent);
