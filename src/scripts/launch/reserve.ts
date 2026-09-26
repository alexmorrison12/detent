/**
 * /l/reserve/: edition + finish + email, the Turn-to-reserve ritual, and a
 * demo confirmation with a reservation number, .ics for launch day, and a
 * one-click cancel.
 *
 * Ritual: the dial gets a physics override of 12 detents (30° each) with a
 * hard stop at 90°. Three clicks reach the stop (drag, wheel, or three arrow
 * presses: the engine's key step is one detent); the stop "thuds" (sound if
 * enabled, vibrate([12,40,12]) on Android) and arms the button with a tally
 * fill. The button never waits for any of it.
 *
 * The shop and /products.json hand a build over as ?edition=&finish= (the
 * configurator's own field names); the form starts on it. Values that aren't
 * a real edition or finish, or a finish that edition doesn't come in, are ignored.
 * Audience pages add ?segment=&feel= (PhaseCTA's `query`): the dial takes that
 * feel, a line says what it does there, and the reservation keeps it.
 *
 * A browser can hold several reservations: the panel shows the latest, names
 * the others, and cancelling one brings the next one up.
 *
 * Deposits are taken only in the reserve phase. In any other phase the form
 * is hidden by CSS (data-phase-only) and this script leaves it unwired, so a
 * stale campaign link can't take a deposit at an expired price.
 */
import {
  EDITIONS,
  FINISHES,
  PROFILES,
  byEdition,
  byFinish,
  byProfile,
  formatUsd,
  type EditionId,
  type FinishId,
  type ProfileId,
} from '@/data/product';
import { LAUNCH } from '@/config/launch';
import { track } from '@/lib/analytics';
import {
  SEGMENTS,
  cancelReservation,
  getEntry,
  getReservation,
  getReservations,
  isSegment,
  referralUrl,
  reserve,
  type Reservation,
  type Segment,
} from '@/lib/waitlist';
import { SEGMENT_COPY } from '@/components/launch/segments';
import type { DetentDialElement } from '@/scripts/dial/types';
import { initLanding, goToForm, setStickyEnabled, whenDial } from './common';
import { buzz, prefersReducedMotion, thud } from './feedback';
import { checkEmail, focusRegion, liveClear, setError, withBusy } from './forms';
import { downloadIcs } from './ics';

/** Read live: the phase is set before first paint and can be previewed with ?phase=. */
const reservationsOpen = () => document.documentElement.dataset.phase === 'reserve';

/** Outside the reserve phase the dial is just the product: turn it, nothing to arm. */
async function idle() {
  initLanding();
  const dial = await whenDial('reserve-dial');
  dial?.setAttribute('label', 'Detent One. Turn it to feel the clicks');
}

const deposit = (e: EditionId) =>
  e === 'founders' ? LAUNCH.foundersDepositUsd : LAUNCH.depositUsd;

/** The ritual's geometry, in one place so the page counts exactly what the engine steps. */
const RITUAL = { detents: 12, stop: 90 };
const DETENT_DEG = 360 / RITUAL.detents;
const CLICKS_TO_ARM = Math.round(RITUAL.stop / DETENT_DEG);
const clicksAt = (angle: number) =>
  Math.floor((Math.max(0, Math.min(RITUAL.stop, angle)) + 1) / DETENT_DEG);

/** The finish the form starts on (checked in the markup). */
const START_FINISH: FinishId = 'graphite';

/** A build handed over by the shop or products.json, made whole: an edition and a finish it comes in. */
function buildFromLink(): { edition: EditionId; finish: FinishId } | null {
  const q = new URLSearchParams(location.search);
  const edition = EDITIONS.find((e) => e.id === q.get('edition'));
  const finish = FINISHES.find((f) => f.id === q.get('finish'));
  if (edition) {
    // A finish the edition doesn't come in (One in Tally) is dropped, not obeyed.
    if (finish && edition.finishes.includes(finish.id))
      return { edition: edition.id, finish: finish.id };
    const fallback = edition.finishes.includes(START_FINISH) ? START_FINISH : edition.finishes[0];
    return fallback ? { edition: edition.id, finish: fallback } : null;
  }
  // A finish alone picks the edition it comes in (Tally: Founders).
  const home = finish && EDITIONS.find((e) => e.finishes.includes(finish.id));
  return finish && home ? { edition: home.id, finish: finish.id } : null;
}

const isProfile = (v: unknown): v is ProfileId => PROFILES.some((p) => p.id === v);

/**
 * The feel an audience page sent: ?feel=, or the segment's own feel when only
 * ?segment= came. With it, the line that says what that feel does there.
 */
function feelFromLink(): { feel: ProfileId; segment: Segment | null } | null {
  const q = new URLSearchParams(location.search);
  const seg = q.get('segment');
  const segment = isSegment(seg) ? seg : null;
  const feel = q.get('feel');
  const own = SEGMENTS.find((s) => s.id === segment)?.profile;
  const picked = isProfile(feel) ? feel : own;
  return picked ? { feel: picked, segment } : null;
}

/** "Hard stops at 0 and 100, …" for the segment's own feel; the feel's own use otherwise. */
function feelLine(feel: ProfileId, segment: Segment | null): string {
  const own = segment && SEGMENTS.find((s) => s.id === segment)?.profile === feel;
  const line = own ? SEGMENT_COPY[segment].line : byProfile(feel).use;
  return `${line.charAt(0).toUpperCase()}${line.slice(1)}`;
}

async function init(hero: HTMLElement) {
  initLanding({ formTarget: '#reserve-email', doneTarget: '.rv__done-title' });
  const reduced = prefersReducedMotion();
  const form = hero.querySelector<HTMLFormElement>('[data-reserve]')!;
  // The form is display:contents (so the dial can sit beside the button);
  // hide its parts, not the form, or the dial goes with it.
  const formParts = [...form.querySelectorAll<HTMLElement>('.rv__fields, .rv__submit')];
  const done = hero.querySelector<HTMLElement>('[data-reserve-done]')!;
  const email = document.getElementById('reserve-email') as HTMLInputElement;
  const submit = document.getElementById('reserve-submit') as HTMLButtonElement;
  const editions = [...form.querySelectorAll<HTMLInputElement>('input[name="edition"]')];
  const finishes = [...form.querySelectorAll<HTMLInputElement>('input[name="finish"]')];
  const summary = hero.querySelector<HTMLElement>('[data-summary]')!;
  const amount = hero.querySelector<HTMLElement>('[data-amount]')!;
  const finishName = hero.querySelector<HTMLElement>('[data-finish-name]')!;
  const finishLine = hero.querySelector<HTMLElement>('[data-finish-line]')!;
  const label = submit.querySelector<HTMLElement>('[data-label]')!;
  const stickyLabel = document.querySelector<HTMLElement>('[data-sticky-go]');
  const feelNote = hero.querySelector<HTMLElement>('[data-feel-line]');
  liveClear(email);
  // The feel an audience page sent (the dial starts in it; the reservation keeps it).
  const arrived = feelFromLink();
  if (arrived && feelNote) {
    const p = byProfile(arrived.feel);
    feelNote.querySelector('[data-feel-name]')!.textContent = `First feel: ${p.name}.`;
    feelNote.querySelector('[data-feel-text]')!.textContent = feelLine(
      arrived.feel,
      arrived.segment,
    );
    feelNote.style.setProperty('--feel', p.color);
    feelNote.hidden = false;
  }

  /** The live dial, once its engine arrives (it loads lazily; the form doesn't wait for it). */
  let dial: DetentDialElement | null = null;

  /* ---- Edition <-> finish: Tally is Founders, Founders is Tally ---------- */
  const state = (): { edition: EditionId; finish: FinishId } => ({
    edition: (editions.find((i) => i.checked)?.value as EditionId) ?? 'one',
    finish: (finishes.find((i) => i.checked)?.value as FinishId) ?? START_FINISH,
  });
  let lastStandard: FinishId = START_FINISH;
  const check = (inputs: HTMLInputElement[], v: string) =>
    inputs.forEach((i) => (i.checked = i.value === v));

  const render = () => {
    const { edition, finish } = state();
    const ed = byEdition(edition);
    const f = byFinish(finish);
    const dep = deposit(edition);
    const text = `Reserve for ${formatUsd(dep)}`;
    label.textContent = text;
    if (stickyLabel) stickyLabel.textContent = text;
    amount.textContent = formatUsd(dep);
    finishName.textContent = f.name;
    finishLine.textContent = f.line;
    summary.textContent = `${ed.name} · ${f.name} · ${formatUsd(dep)} today, ${formatUsd(ed.launchPriceUsd - dep)} when your batch ships.`;
    if (dial && dial.finish !== finish) dial.finish = finish;
  };

  editions.forEach((i) =>
    i.addEventListener('change', () => {
      if (i.value === 'founders') check(finishes, 'tally');
      else if (state().finish === 'tally') check(finishes, lastStandard);
      render();
    }),
  );
  finishes.forEach((i) =>
    i.addEventListener('change', () => {
      if (i.value === 'tally') check(editions, 'founders');
      else {
        lastStandard = i.value as FinishId;
        if (state().edition === 'founders') check(editions, 'one');
      }
      render();
    }),
  );

  // Edition buttons further down the page pick the edition and bring you back up.
  document.querySelectorAll<HTMLAnchorElement>('[data-pick-edition]').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const id = a.dataset.pickEdition as EditionId;
      check(editions, id);
      if (id === 'founders') check(finishes, 'tally');
      else if (state().finish === 'tally') check(finishes, lastStandard);
      render();
      track('edition_pick', { edition: id, placement: 'editions' });
      goToForm(email);
    }),
  );

  /* ---- The ritual -------------------------------------------------------- */
  const marks = [...hero.querySelectorAll<SVGGElement>('[data-detent]')];
  let armed = false;

  function arm() {
    armed = true;
    hero.dataset.armed = '';
    hero.style.setProperty('--arm', '1');
    thud();
    buzz([12, 40, 12]);
    dial?.setAttribute('display', 'ARMED');
    dial?.refreshAria?.();
    track('reserve_ritual_armed', {});
  }

  /* ---- Submit ------------------------------------------------------------- */
  /** The reservation the panel shows (the latest held, until it is cancelled). */
  let shown = null as Reservation | null;
  const showDone = (r: Reservation, announce: boolean) => {
    shown = r;
    const ed = byEdition(r.edition);
    const dep = deposit(r.edition);
    done.querySelector('[data-res-id]')!.textContent = r.id;
    done.querySelector('[data-res-edition]')!.textContent = ed.name;
    done.querySelector('[data-res-finish]')!.textContent = byFinish(r.finish).name;
    const feelRow = done.querySelector<HTMLElement>('[data-res-feel-row]')!;
    feelRow.hidden = !r.feel;
    if (r.feel) done.querySelector('[data-res-feel]')!.textContent = byProfile(r.feel).name;
    // Any others held in this browser, named so none goes missing.
    const others = getReservations().filter((x) => x.id !== r.id);
    const othersNote = done.querySelector<HTMLElement>('[data-res-others]')!;
    othersNote.hidden = !others.length;
    othersNote.textContent = others.length
      ? `Also held in this browser: ${others
          .map((x) => `${x.id}, ${byEdition(x.edition).name} in ${byFinish(x.finish).name}`)
          .join('; ')}.`
      : '';
    done.querySelector('[data-res-deposit]')!.textContent = formatUsd(dep);
    done.querySelector('[data-res-balance]')!.textContent = formatUsd(ed.launchPriceUsd - dep);
    // Only an edition priced below its regular price has a launch price (Founders doesn't).
    const launchPrice = ed.launchPriceUsd < ed.priceUsd ? ' launch price' : '';
    done.querySelector('[data-res-balance-note]')!.textContent =
      `${formatUsd(ed.launchPriceUsd)}${launchPrice}, less your deposit`;
    formParts.forEach((el) => (el.hidden = true));
    done.hidden = false;
    setStickyEnabled(false);
    hero.dataset.done = '';
    if (dial) {
      dial.finish = r.finish;
      dial.profile = r.feel ?? 'ratchet';
      dial.setAttribute('display', 'RESERVED');
      dial.removeAttribute('interactive');
    }
    if (announce) focusRegion(done.querySelector<HTMLElement>('.rv__done-title'), reduced);
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!reservationsOpen()) return;
    if (submit.dataset.busy !== undefined || !checkEmail(email)) return;
    const { edition, finish } = state();
    const res = await withBusy(submit, 'Reserving…', () =>
      reserve({
        email: email.value,
        edition,
        finish,
        feel: arrived?.feel,
        source: armed ? 'reserve-ritual' : 'reserve',
      }),
    );
    if (!res.ok) {
      setError(email, res.error);
      email.focus();
      return;
    }
    showDone(res.data, true);
  });

  done.querySelector('[data-ics-launch]')?.addEventListener('click', () => {
    const r = getReservation();
    const pageUrl = `${location.origin}${location.pathname}`;
    downloadIcs(
      'detent-launch-day.ics',
      {
        start: LAUNCH.launchDate,
        durationMin: 60,
        title: 'Detent One launch day',
        description: `Orders open. ${r ? `Your reservation: ${r.id}.` : ''} Launch pricing ends ${new Date(LAUNCH.launchPriceEnds).toUTCString()}. ${pageUrl}`,
        url: pageUrl,
        alarm: 15,
      },
      'launch_day',
    );
  });

  /* ---- Tell a friend: this page, with your referral code on it ------------------ */
  // One code per person: the waitlist entry's if they're on the list (so it
  // counts toward their pass), else the reservation's own.
  const status = done.querySelector<HTMLElement>('[data-done-status]')!;
  const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';
  done.querySelector('[data-share-reservation]')?.addEventListener('click', async () => {
    const r = shown ?? getReservation();
    const code = getEntry()?.code ?? r?.code;
    const link = code
      ? referralUrl({ code }, '/l/reserve/')
      : `${location.origin}${location.pathname}`;
    const build = r ? `${byEdition(r.edition).name} in ${byFinish(r.finish).name}` : 'Detent One';
    const text = `I reserved a ${build}. ${formatUsd(LAUNCH.depositUsd)} holds one, fully refundable:`;
    status.textContent = '';
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Reserve Detent One', text, url: link });
        track('referral_share', { method: 'share_link', placement: 'reserve-done' });
        return;
      } catch (e) {
        if (isAbort(e)) return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${link}`);
      status.textContent = code ? 'Link copied, with your referral code on it.' : 'Link copied.';
    } catch {
      status.textContent = `Copy this link: ${link}`;
    }
    track('referral_share', { method: 'copy_link', placement: 'reserve-done' });
  });

  done.querySelector('[data-cancel]')?.addEventListener('click', async () => {
    const r = shown;
    const res = await cancelReservation(r?.id);
    if (!res.ok) {
      status.textContent = res.error;
      return;
    }
    const back = formatUsd(deposit(res.data.edition));
    const refunded = `${back} refunded in full${res.demo ? ' (in a real reservation; this demo charged nothing)' : ''}`;
    // Another reservation still held here: it takes the panel.
    const next = getReservation();
    if (next) {
      showDone(next, false);
      status.textContent = `Cancelled ${res.data.id}. ${refunded}. Showing ${next.id}.`;
      return;
    }
    shown = null;
    status.textContent = '';
    done.hidden = true;
    formParts.forEach((el) => (el.hidden = false));
    setStickyEnabled(true);
    delete hero.dataset.done;
    if (dial) dial.profile = arrived?.feel ?? 'ratchet';
    dial?.setAttribute('interactive', '');
    dial?.setAttribute('display', armed ? 'ARMED' : 'TURN');
    summary.textContent = `Cancelled. ${refunded}. You can reserve again any time.`;
    submit.focus();
  });

  /* ---- Initial state --------------------------------------------------------- */
  const existing = getReservation();
  if (existing) {
    check(editions, existing.edition);
    check(finishes, existing.finish);
    render();
    showDone(existing, false);
  } else {
    const handed = buildFromLink();
    if (handed) {
      check(editions, handed.edition);
      check(finishes, handed.finish);
      if (!byFinish(handed.finish).foundersOnly) lastStandard = handed.finish;
    }
    render();
  }

  /* ---- The dial arrives: the ritual, and the finish it previews ---------------- */
  const d = await whenDial('reserve-dial');
  if (!d) return;
  dial = d;
  d.finish = state().finish;
  // An audience page's feel names the knob; the ritual keeps its own three clean
  // clicks (no accents or snaps from that feel to catch the knob between them).
  const feel = shown ? shown.feel : arrived?.feel;
  if (feel) d.profile = feel;
  d.physics = {
    detents: RITUAL.detents,
    strength: 1,
    damping: 0.25,
    spring: 0,
    stops: [0, RITUAL.stop],
    accents: [],
    snaps: [],
  };
  d.setAngle(0, { instant: true });
  // What a screen reader hears, asked by the engine with the destination the
  // moment a key is pressed: the third press says "Armed" as it's made.
  d.valueText = (s) => {
    const clicks = clicksAt(s.angle);
    if (armed || clicks >= CLICKS_TO_ARM) return 'Armed. Press Reserve when you’re ready';
    return clicks ? `${clicks} of ${CLICKS_TO_ARM} clicks` : 'Not turned';
  };
  d.addEventListener('detent:change', (e) => {
    const a = Math.max(0, Math.min(RITUAL.stop, e.detail.angle));
    const clicks = clicksAt(a);
    marks.forEach((m) => m.classList.toggle('is-on', Number(m.dataset.detent) <= clicks));
    // Reserved: the display keeps saying so.
    if (!armed && hero.dataset.done === undefined) {
      hero.style.setProperty('--arm', (a / RITUAL.stop).toFixed(3));
      d.setAttribute('display', clicks ? `${clicks} / ${CLICKS_TO_ARM}` : 'TURN');
    }
    if (!armed && a >= RITUAL.stop - 0.5) arm();
  });
  // A reservation shown on load: the dial shows the build, and rests.
  if (hero.dataset.done !== undefined) {
    d.setAttribute('display', 'RESERVED');
    d.removeAttribute('interactive');
  }
}

// Last, so every constant above is initialised before init runs its synchronous part.
const hero = document.querySelector<HTMLElement>('[data-rv]');
if (hero) {
  if (reservationsOpen()) void init(hero);
  else void idle();
}
