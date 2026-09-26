/**
 * /shop/thanks/: personalize the confirmation from the demo order that
 * checkout left in sessionStorage. Which copy shows (order, reservation or
 * nothing to confirm) is decided before first paint by the page's head
 * script; this only fills in details that don't move the layout.
 *
 * It never touches the cart: checkout clears it before coming here, and a
 * visitor who comes back to this page may have started a new one.
 */
import { PHASES } from '@/config/launch';
import { EDITIONS, FINISHES, PROFILES, formatUsd } from '@/data/product';
import { shipsOnKnob } from '@/data/shop';
import { track } from '@/lib/analytics';
import { url } from '@/lib/url';
import type { DetentDialElement } from '@/scripts/dial/types';
import { currentPhase } from './build';
import { lastOrder } from './order';
import { esc } from './render';
import { shareOrCopy } from './share';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel);
const setAll = (sel: string, text: string) =>
  document.querySelectorAll(sel).forEach((el) => (el.textContent = text));

const order = lastOrder();
const dial = $<DetentDialElement>('#thanks-dial');

if (!order) {
  dial?.setAttribute('display', 'NO ORDER');
} else {
  const reservation = order.kind === 'reservation';
  const feel = PROFILES.find((p) => p.id === order.firstFeel);
  const first = order.lines.find((l) => l.kind !== 'accessory');
  const finish = FINISHES.find((f) => f.id === first?.finish);

  $('[data-ty-id]')!.textContent = `Demo ${reservation ? 'reservation' : 'order'} ${order.id}`;

  // The dial on the page is theirs: same finish, same first feel, and the
  // batch it ships in (a reservation holds a place in the reserve batch).
  if (dial && finish) dial.setAttribute('finish', finish.id);
  if (dial && feel) dial.setAttribute('profile', feel.id);
  dial?.setAttribute(
    'display',
    shipsOnKnob(PHASES[reservation ? 'reserve' : currentPhase()].ships),
  );

  // Reservation: the balance they will be asked for, from their own lines.
  if (reservation) {
    const held = order.lines.filter((l) => l.kind === 'reservation');
    const launchTotal = held.reduce(
      (n, l) => n + (EDITIONS.find((e) => e.id === l.edition)?.launchPriceUsd ?? 0) * l.qty,
      0,
    );
    setAll('[data-ty-deposit]', formatUsd(order.deposit));
    setAll('[data-ty-balance]', formatUsd(Math.max(0, launchTotal - order.deposit)));
  }

  const [lo, hi] = order.transit;
  setAll(
    '[data-ty-transit]',
    order.countryName
      ? ` To ${order.countryName}, ${lo}–${hi} business days.`
      : ` ${lo}–${hi} business days to the address in your wallet.`,
  );
  if (feel) {
    setAll(
      '[data-ty-feel]',
      ` Yours starts in ${feel.name}: ${feel.feel.charAt(0).toLowerCase()}${feel.feel.slice(1)}`,
    );
  }

  // Recap.
  $('[data-ty-lines]')!.innerHTML = order.lines
    .map((l) => {
      const f = FINISHES.find((x) => x.id === l.finish);
      const meta = [l.kind === 'device' && f ? f.name : '', l.engraving ? `“${l.engraving}”` : '']
        .filter(Boolean)
        .map(esc)
        .join(' · ');
      return `<li><span>${esc(l.name.replace(/^Reservation: /, 'Reservation · '))}${l.qty > 1 ? ` ×${l.qty}` : ''}${meta ? `<span class="ty__line-meta">${meta}</span>` : ''}</span><span class="readout">${formatUsd(l.unitPriceUsd * l.qty)}</span></li>`;
    })
    .join('');
  $('[data-ty-total-label]')!.textContent = reservation ? 'Deposit, refundable' : 'Total';
  $('[data-ty-total]')!.textContent = formatUsd(order.subtotal);
  $('[data-ty-recap]')!.hidden = false;

  // Referral (concept): the build link, carrying this buyer's code. The
  // reward is a feel profile, never money (REFERRAL in @/data/shop).
  const refer = $<HTMLElement>('[data-ty-refer]')!;
  const query = `${order.build ? `${order.build}&` : ''}ref=${order.referral}`;
  const refLink = new URL(`${url('/shop/')}?${query}`, location.origin).toString();
  const input = $<HTMLInputElement>('[data-ty-link]')!;
  input.value = refLink;
  $('[data-ty-referred]')!.hidden = !order.referredBy;
  refer.hidden = false;
  const refStatus = $<HTMLElement>('[data-ty-ref-status]')!;
  $<HTMLButtonElement>('[data-ty-copy]')!.addEventListener('click', async () => {
    const result = await shareOrCopy({ url: refLink }, 'copy');
    if (result === 'copied')
      refStatus.textContent = 'Copied. Send it to someone whose trackpad is suffering.';
    else {
      input.select();
      refStatus.textContent = 'Press Cmd+C or Ctrl+C to copy the selected link.';
    }
    track('referral_share', { method: 'copy' });
  });
  const shareRef = $<HTMLButtonElement>('[data-ty-share-ref]');
  if (shareRef && typeof navigator.share === 'function') {
    shareRef.hidden = false;
    shareRef.addEventListener('click', async () => {
      const result = await shareOrCopy({
        title: 'My Detent build',
        text: `The Detent I just ${reservation ? 'reserved' : 'ordered'}. Turn it, then build yours.`,
        url: refLink,
      });
      if (result === 'copied') refStatus.textContent = 'Link copied.';
      track('referral_share', { method: result });
    });
  }
}
