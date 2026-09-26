/**
 * /l/waitlist/: the dial is a rotary selector for "What would you turn?".
 * Chips (real radio inputs) and the dial stay in sync; the knob's feel,
 * halo and display follow the choice. Join -> Feel Pass (lazy module).
 *
 * Audience pages link here with ?segment=<id>&feel=<profile> (PhaseCTA's
 * `query`): the chip starts picked and the pass starts in that feel. Values
 * that aren't a real segment or profile are ignored.
 */
import { PROFILES, byProfile, type ProfileId } from '@/data/product';
import {
  getEntry,
  joinWaitlist,
  SEGMENTS,
  isSegment,
  type Segment,
  type WaitlistEntry,
} from '@/lib/waitlist';
import { SEGMENT_ANGLE, SEGMENT_COPY, REST_ANGLE } from '@/components/launch/segments';
import { initLanding, setStickyEnabled, whenDial } from './common';
import { prefersReducedMotion } from './feedback';
import { checkEmail, focusRegion, liveClear, setError, withBusy } from './forms';
import type { PassController } from './pass';

const isProfile = (v: unknown): v is ProfileId => PROFILES.some((p) => p.id === v);

/** Where the visitor came from: ?segment=music&feel=wall. */
function fromLink(): { segment: Segment | null; feel: ProfileId | null } {
  const q = new URLSearchParams(location.search);
  const segment = q.get('segment');
  const feel = q.get('feel');
  return { segment: isSegment(segment) ? segment : null, feel: isProfile(feel) ? feel : null };
}

async function init(form: HTMLFormElement) {
  const ref = initLanding({ formTarget: '#join-email', doneTarget: '#pass-title' });
  const reduced = prefersReducedMotion();
  const hero = document.querySelector<HTMLElement>('.wl')!;
  const chips = [...form.querySelectorAll<HTMLInputElement>('input[name="segment"]')];
  const lineProfile = document.querySelector<HTMLElement>('[data-seg-profile]')!;
  const lineText = document.querySelector<HTMLElement>('[data-seg-text]')!;
  const lineIdle = [lineProfile.textContent, lineText.textContent];
  const marks = [...document.querySelectorAll<SVGGElement>('[data-mark]')];
  const joined = document.querySelector<HTMLElement>('[data-joined]')!;
  const email = form.querySelector<HTMLInputElement>('#join-email')!;
  const submit = form.querySelector<HTMLButtonElement>('button[type=submit]')!;
  const passSection = document.getElementById('pass');
  const arrived = fromLink();
  liveClear(email);

  /* ---- Feel Pass, loaded near the viewport or on join --------------- */
  let pass: Promise<PassController> | null = null;
  const loadPass = () =>
    (pass ??= import('./pass')
      .then((m) => m.mountPass(passSection!))
      .then((p) => {
        // The sample ring starts in the feel picked so far (or the one the link carried).
        const feel = feelFor(current);
        if (feel) p.previewProfile(feel);
        return p;
      }));
  if (passSection) {
    const io = new IntersectionObserver(
      ([en]) => {
        if (en?.isIntersecting) {
          void loadPass();
          io.disconnect();
        }
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(passSection);
  }

  /**
   * The feel for a pick: the one the link carried while the segment it came
   * with (or no segment, if it came alone) is picked; otherwise the segment's own.
   */
  const feelFor = (seg: Segment | null): ProfileId | null => {
    if (arrived.feel && seg === arrived.segment) return arrived.feel;
    return SEGMENTS.find((s) => s.id === seg)?.profile ?? null;
  };
  /** What the dial says to a screen reader at a position: page words, never the engine's. */
  const spoken = (seg: Segment | null) => {
    const info = SEGMENTS.find((s) => s.id === seg);
    const feel = feelFor(seg);
    return info && feel ? `${info.label}, ${byProfile(feel).name} feel` : 'Nothing picked';
  };

  let current: Segment | null = null;
  let dial: Awaited<ReturnType<typeof whenDial>> = null;
  /**
   * The segment a chip is turning the dial to. While set, the zones the dial
   * passes on the way are ignored: selecting one would set dial.profile, and
   * a profile change re-seats the knob on the nearest detent, parking it on
   * the first zone it crossed. Cleared on arrival, on settle, or as soon as
   * the person takes the dial themselves.
   */
  let driving: Segment | null = null;
  const segAt = (angle: number): Segment | null => {
    const idx = Math.round((angle - REST_ANGLE) / 30);
    return idx <= 0 ? null : (SEGMENTS[idx - 1]?.id ?? null);
  };

  const inkFor = (p: ProfileId) => (p === 'ratchet' ? 'var(--tally-hot)' : `var(--feel-${p})`);

  /** The knob follows the pick: feel, display, and what it says. */
  const syncDial = () => {
    if (!dial) return;
    const feel = feelFor(current);
    if (current && feel) {
      dial.profile = feel;
      dial.setAttribute('display', SEGMENT_COPY[current].app);
    } else {
      dial.setAttribute('display', 'PICK ONE');
    }
    dial.refreshAria?.();
  };

  function select(seg: Segment | null, from: 'dial' | 'chip' | 'init') {
    if (seg === current && from !== 'init') return;
    current = seg;
    const feel = feelFor(seg);
    const profile = feel ? byProfile(feel) : null;
    if (from !== 'chip') chips.forEach((c) => (c.checked = c.value === seg));
    marks.forEach((m) => m.classList.toggle('is-on', m.dataset.mark === seg));
    if (seg && profile) {
      hero.style.setProperty('--feel', profile.color);
      hero.style.setProperty('--feel-ink', inkFor(profile.id));
      lineProfile.textContent = `${profile.name}:`;
      // The segment's line is written for its own feel; a feel from a link speaks for itself.
      const own = SEGMENTS.find((s) => s.id === seg)!.profile === profile.id;
      lineText.textContent = own
        ? SEGMENT_COPY[seg].line
        : `${profile.use.charAt(0).toLowerCase()}${profile.use.slice(1)}`;
    } else {
      hero.style.removeProperty('--feel');
      hero.style.removeProperty('--feel-ink');
      [lineProfile.textContent, lineText.textContent] = lineIdle;
    }
    if (profile) void pass?.then((p) => p.previewProfile(profile.id));
    // Setting dial.profile re-seats the knob on its current detent, so a chip's
    // move starts after it, and is left to finish (see `driving`).
    const turnTo = from === 'chip' && dial ? seg : null;
    if (turnTo) driving = turnTo;
    syncDial();
    if (turnTo) dial!.setAngle(SEGMENT_ANGLE[turnTo]);
  }

  chips.forEach((c) =>
    c.addEventListener('change', () => c.checked && select(c.value as Segment, 'chip')),
  );

  // A chip restored by the browser (back/forward) wins over the link: it's the latest choice.
  const restored = chips.find((c) => c.checked)?.value;
  const pre = isSegment(restored) ? restored : arrived.segment;
  select(pre, 'init');

  /* ---- The selector dial ------------------------------------------------ */
  dial = await whenDial('waitlist-dial');
  if (dial) {
    // Six positions, 30° apart: rest + five kinds of work. Hard stops at both ends.
    // No accents or snaps: the profiles' own (Wall's heavy click at 0°, Magnet's
    // snap at 35°) would hold the knob between positions or off its mark.
    dial.physics = {
      detents: 12,
      strength: 0.9,
      damping: 0.22,
      spring: 0,
      stops: [REST_ANGLE, SEGMENT_ANGLE.streaming],
      accents: [],
      snaps: [],
    };
    syncDial();
    dial.setAngle(current ? SEGMENT_ANGLE[current] : REST_ANGLE, { instant: true });
    // The engine asks this with the destination the moment a key is pressed,
    // so the words never lag the knob or flip to the engine's own.
    dial.valueText = (s) => spoken(driving ?? segAt(s.angle));
    dial.addEventListener('detent:change', (e) => {
      if (driving) {
        if (Math.abs(e.detail.angle - SEGMENT_ANGLE[driving]) < 1) driving = null;
        return;
      }
      select(segAt(e.detail.angle), 'dial');
    });
    dial.addEventListener('detent:settle', (e) => {
      driving = null;
      select(segAt(e.detail.angle), 'dial');
    });
    const takeOver = () => (driving = null);
    dial.addEventListener('pointerdown', takeOver, { capture: true });
    dial.addEventListener('keydown', takeOver, { capture: true });
    dial.addEventListener('wheel', takeOver, { capture: true, passive: true });
  }

  /* ---- Join ---------------------------------------------------------------- */
  const showJoined = (entry: WaitlistEntry, announce: boolean) => {
    form.hidden = true;
    joined.hidden = false;
    const refNote = document.querySelector<HTMLElement>('[data-ref-note]');
    if (refNote) refNote.hidden = true;
    // The bar's job was the join; from reservations on it carries the phase CTA instead.
    const phase = document.documentElement.dataset.phase;
    if (phase === 'tease' || phase === 'waitlist') setStickyEnabled(false);
    const out = joined.querySelector('[data-joined-email]');
    if (out) out.textContent = entry.email;
    void loadPass().then((p) => {
      p.setMine(entry);
      if (announce) focusRegion(document.getElementById('pass-title'), reduced);
    });
  };

  const existing = getEntry();
  if (existing) showJoined(existing, false);
  else if (ref) document.querySelector<HTMLElement>('[data-ref-note]')!.hidden = false;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submit.dataset.busy !== undefined || !checkEmail(email)) return;
    const seg = current ?? undefined;
    const res = await withBusy(submit, 'Joining…', () =>
      joinWaitlist({
        email: email.value,
        segment: seg,
        profile: feelFor(current) ?? 'ratchet',
        finish: 'graphite',
        source: 'waitlist',
      }),
    );
    if (!res.ok) {
      setError(email, res.error);
      email.focus();
      return;
    }
    showJoined(res.data, true);
  });
}

// Last, so every constant above is initialised before init runs its synchronous part.
const form = document.querySelector<HTMLFormElement>('[data-join]');
if (form) void init(form);
