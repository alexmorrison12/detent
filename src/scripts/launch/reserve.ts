/**
 * /l/reserve/: edition + finish + email, the Turn-to-reserve ritual, and a
 * demo confirmation with a reservation number, .ics for launch day, and a
 * one-click cancel.
 *
 * Ritual: the dial gets a physics override of 12 detents (30° each) with a
 * hard stop at 90°. Three clicks reach the stop; the stop "thuds" (sound if
 * enabled, vibrate([12,40,12]) on Android) and arms the button with a tally
 * fill. The button never waits for any of it.
 *
 * Deposits are taken only in the reserve phase. In any other phase the form
 * is hidden by CSS (data-phase-only) and this script leaves it unwired, so a
 * stale campaign link can't take a deposit at an expired price.
 */
import { byEdition, byFinish, formatUsd, type EditionId, type FinishId } from '@/data/product';
import { LAUNCH } from '@/config/launch';
import { track } from '@/lib/analytics';
import {
  cancelReservation,
  getEntry,
  getReservation,
  referralUrl,
  reserve,
  type Reservation,
} from '@/lib/waitlist';
import { initLanding, goToForm, setStickyEnabled, whenDial } from './common';
import { buzz, prefersReducedMotion, thud } from './feedback';
import { checkEmail, focusRegion, liveClear, setError, withBusy } from './forms';
import { downloadIcs } from './ics';

const hero = document.querySelector<HTMLElement>('[data-rv]');
/** Read live: the phase is set before first paint and can be previewed with ?phase=. */
const reservationsOpen = () => document.documentElement.dataset.phase === 'reserve';
if (hero) {
  if (reservationsOpen()) void init(hero);
  else void idle();
}

/** Outside the reserve phase the dial is just the product: turn it, nothing to arm. */
async function idle() {
  initLanding();
  const dial = await whenDial('reserve-dial');
  dial?.setAttribute('label', 'Detent One. Turn it to feel the clicks');
}

const deposit = (e: EditionId) =>
  e === 'founders' ? LAUNCH.foundersDepositUsd : LAUNCH.depositUsd;

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
  liveClear(email);

  const dial = await whenDial('reserve-dial');

  /* ---- Edition <-> finish: Tally is Founders, Founders is Tally ---------- */
  const state = (): { edition: EditionId; finish: FinishId } => ({
    edition: (editions.find((i) => i.checked)?.value as EditionId) ?? 'one',
    finish: (finishes.find((i) => i.checked)?.value as FinishId) ?? 'graphite',
  });
  let lastStandard: FinishId = 'graphite';
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
  if (dial) {
    dial.physics = { detents: 12, strength: 1, damping: 0.25, spring: 0, stops: [0, 90] };
    dial.setAngle(0, { instant: true });
    dial.addEventListener('detent:change', (e) => {
      const a = Math.max(0, Math.min(90, e.detail.angle));
      const clicks = Math.floor((a + 1) / 30);
      marks.forEach((m) => m.classList.toggle('is-on', Number(m.dataset.detent) <= clicks));
      if (!armed) {
        hero.style.setProperty('--arm', (a / 90).toFixed(3));
        dial.setAttribute('display', clicks ? `${clicks} / 3` : 'TURN');
        dial.setAttribute('aria-valuetext', clicks ? `${clicks} of 3 clicks` : 'Not turned');
      }
      if (!armed && a >= 89.5) arm();
    });
  }

  function arm() {
    armed = true;
    hero.dataset.armed = '';
    hero.style.setProperty('--arm', '1');
    thud();
    buzz([12, 40, 12]);
    dial?.setAttribute('display', 'ARMED');
    dial?.setAttribute('aria-valuetext', 'Armed. Press Reserve when you’re ready');
    track('reserve_ritual_armed', {});
  }

  /* ---- Submit ------------------------------------------------------------- */
  const showDone = (r: Reservation, announce: boolean) => {
    const ed = byEdition(r.edition);
    const dep = deposit(r.edition);
    done.querySelector('[data-res-id]')!.textContent = r.id;
    done.querySelector('[data-res-edition]')!.textContent = ed.name;
    done.querySelector('[data-res-finish]')!.textContent = byFinish(r.finish).name;
    done.querySelector('[data-res-deposit]')!.textContent = formatUsd(dep);
    done.querySelector('[data-res-balance]')!.textContent = formatUsd(ed.launchPriceUsd - dep);
    done.querySelector('[data-res-balance-note]')!.textContent =
      `${formatUsd(ed.launchPriceUsd)} launch price, less your deposit`;
    formParts.forEach((el) => (el.hidden = true));
    done.hidden = false;
    setStickyEnabled(false);
    hero.dataset.done = '';
    if (dial) {
      dial.finish = r.finish;
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

  /* ---- Tell a friend: this page, with your referral code if you're on the list -- */
  const status = done.querySelector<HTMLElement>('[data-done-status]')!;
  const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';
  done.querySelector('[data-share-reservation]')?.addEventListener('click', async () => {
    const r = getReservation();
    const entry = getEntry();
    const link = entry
      ? referralUrl(entry, '/l/reserve/')
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
      status.textContent = entry ? 'Link copied, with your referral code on it.' : 'Link copied.';
    } catch {
      status.textContent = `Copy this link: ${link}`;
    }
    track('referral_share', { method: 'copy_link', placement: 'reserve-done' });
  });

  done.querySelector('[data-cancel]')?.addEventListener('click', async () => {
    const r = getReservation();
    const res = await cancelReservation();
    if (!res.ok) {
      status.textContent = res.error;
      return;
    }
    done.hidden = true;
    formParts.forEach((el) => (el.hidden = false));
    setStickyEnabled(true);
    delete hero.dataset.done;
    dial?.setAttribute('interactive', '');
    dial?.setAttribute('display', armed ? 'ARMED' : 'TURN');
    const back = r ? formatUsd(deposit(r.edition)) : 'The deposit';
    summary.textContent = `Cancelled. ${back} refunded in full${res.demo ? ' (in a real reservation; this demo charged nothing)' : ''}. You can reserve again any time.`;
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
    render();
  }
}
