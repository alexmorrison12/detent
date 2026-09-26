/**
 * /l/waitlist/: the dial is a rotary selector for "What would you turn?".
 * Chips (real radio inputs) and the dial stay in sync; the knob's feel,
 * halo and display follow the choice. Join -> Founder Pass (lazy module).
 */
import { byProfile, type ProfileId } from '@/data/product';
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

const form = document.querySelector<HTMLFormElement>('[data-join]');
if (form) void init(form);

async function init(form: HTMLFormElement) {
  const ref = initLanding({ formTarget: '#join-email', doneTarget: '#pass-title' });
  const reduced = prefersReducedMotion();
  const hero = document.querySelector<HTMLElement>('.wl')!;
  const chips = [...form.querySelectorAll<HTMLInputElement>('input[name="segment"]')];
  const lineProfile = document.querySelector<HTMLElement>('[data-seg-profile]')!;
  const lineText = document.querySelector<HTMLElement>('[data-seg-text]')!;
  const marks = [...document.querySelectorAll<SVGGElement>('[data-mark]')];
  const joined = document.querySelector<HTMLElement>('[data-joined]')!;
  const email = form.querySelector<HTMLInputElement>('#join-email')!;
  const submit = form.querySelector<HTMLButtonElement>('button[type=submit]')!;
  const passSection = document.getElementById('pass');
  liveClear(email);

  /* ---- Founder Pass, loaded near the viewport or on join --------------- */
  let pass: Promise<PassController> | null = null;
  const loadPass = () => (pass ??= import('./pass').then((m) => m.mountPass(passSection!)));
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

  let current: Segment | null = null;
  let dial: Awaited<ReturnType<typeof whenDial>> = null;

  const inkFor = (p: ProfileId) => (p === 'ratchet' ? 'var(--tally-hot)' : `var(--feel-${p})`);

  function select(seg: Segment | null, from: 'dial' | 'chip' | 'init') {
    if (seg === current && from !== 'init') return;
    current = seg;
    const info = SEGMENTS.find((s) => s.id === seg);
    const profile = info ? byProfile(info.profile) : null;
    if (from !== 'chip') chips.forEach((c) => (c.checked = c.value === seg));
    marks.forEach((m) => m.classList.toggle('is-on', m.dataset.mark === seg));
    if (info && profile) {
      hero.style.setProperty('--feel', profile.color);
      hero.style.setProperty('--feel-ink', inkFor(profile.id));
      lineProfile.textContent = `${profile.name}:`;
      lineText.textContent = SEGMENT_COPY[info.id].line;
      if (dial) {
        dial.profile = profile.id;
        dial.setAttribute('display', SEGMENT_COPY[info.id].app);
        dial.setAttribute('aria-valuetext', `${info.label}, ${profile.name} feel`);
      }
      void pass?.then((p) => p.previewProfile(profile.id));
    } else {
      hero.style.removeProperty('--feel');
      hero.style.removeProperty('--feel-ink');
      if (dial) {
        dial.setAttribute('display', 'PICK ONE');
        dial.setAttribute('aria-valuetext', 'Nothing picked');
      }
    }
    if (from === 'chip' && dial && seg) dial.setAngle(SEGMENT_ANGLE[seg]);
  }

  chips.forEach((c) =>
    c.addEventListener('change', () => c.checked && select(c.value as Segment, 'chip')),
  );

  /* ---- The selector dial ------------------------------------------------ */
  dial = await whenDial('waitlist-dial');
  if (dial) {
    // Six positions, 30° apart: rest + five kinds of work. Hard stops at both ends.
    dial.physics = {
      detents: 12,
      strength: 0.9,
      damping: 0.22,
      spring: 0,
      stops: [REST_ANGLE, SEGMENT_ANGLE.streaming],
    };
    dial.setAngle(REST_ANGLE, { instant: true });
    dial.addEventListener('detent:change', (e) => {
      const idx = Math.round((e.detail.angle - REST_ANGLE) / 30);
      const seg = idx <= 0 ? null : (SEGMENTS[idx - 1]?.id ?? null);
      select(seg, 'dial');
    });
    const pre = chips.find((c) => c.checked)?.value;
    select(isSegment(pre) ? pre : null, 'init');
    if (isSegment(pre)) dial.setAngle(SEGMENT_ANGLE[pre], { instant: true });
  }

  /* ---- Join ---------------------------------------------------------------- */
  const showJoined = (entry: WaitlistEntry, announce: boolean) => {
    form.hidden = true;
    joined.hidden = false;
    setStickyEnabled(false);
    const out = joined.querySelector('[data-joined-email]');
    if (out) out.textContent = entry.email;
    void loadPass().then((p) => {
      p.setMine(entry);
      if (announce) focusRegion(document.getElementById('pass-title'), reduced);
    });
  };

  const existing = getEntry();
  if (existing) showJoined(existing, false);
  else if (ref) form.querySelector<HTMLElement>('[data-ref-note]')!.hidden = false;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submit.dataset.busy !== undefined || !checkEmail(email)) return;
    const seg = current ?? undefined;
    const profile = seg ? SEGMENTS.find((s) => s.id === seg)!.profile : 'ratchet';
    const res = await withBusy(submit, 'Joining…', () =>
      joinWaitlist({
        email: email.value,
        segment: seg,
        profile,
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
