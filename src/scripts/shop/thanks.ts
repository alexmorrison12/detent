/**
 * /shop/thanks/: personalize the confirmation from the demo order that
 * checkout left in sessionStorage. Also makes sure the cart is empty.
 */
import { FINISHES, PROFILES, formatUsd } from '@/data/product';
import { REFERRAL } from '@/data/shop';
import { cartCount, clearCart } from '@/lib/cart';
import { track } from '@/lib/analytics';
import { url } from '@/lib/url';
import type { DetentDialElement } from '@/scripts/dial/types';
import { lastOrder } from './order';
import { esc } from './render';
import { shareOrCopy } from './share';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel);

const order = lastOrder();
if (cartCount() > 0 && order) clearCart();

if (!order) {
  $('[data-ty-body]')!.hidden = true;
  $('[data-ty-empty]')!.hidden = false;
  $('[data-ty-title]')!.textContent = 'Nothing to confirm yet.';
  $('[data-ty-lede]')!.textContent =
    'Orders you place in the demo checkout show up here, in this browser. Build one first.';
  $('[data-ty-concept]')!.hidden = true;
  $('#thanks-dial')?.setAttribute('display', 'NO ORDER');
} else {
  const reservation = order.kind === 'reservation';
  const feel = PROFILES.find((p) => p.id === order.firstFeel);
  const first = order.lines.find((l) => l.kind !== 'accessory');
  const finish = FINISHES.find((f) => f.id === first?.finish);

  const id = $<HTMLElement>('[data-ty-id]')!;
  id.textContent = `Demo ${reservation ? 'reservation' : 'order'} ${order.id}`;
  id.hidden = false;
  $('[data-ty-title]')!.textContent = reservation
    ? 'Reserved. You’re in line.'
    : 'Done. Now we machine it.';
  if (finish) {
    $('[data-ty-lede]')!.textContent = reservation
      ? `Your ${finish.name} Detent has a place in Batch 1. The deposit comes off the price when you complete the order.`
      : `Your ${finish.name} Detent ships with Batch 1. Here’s everything between now and your desk.`;
  }

  // The dial on the page is theirs: same finish, same first feel.
  const dial = $<DetentDialElement>('#thanks-dial');
  if (dial && finish) dial.setAttribute('finish', finish.id);
  if (dial && feel) dial.setAttribute('profile', feel.id);

  // Timeline variant + personal details.
  document.querySelectorAll<HTMLElement>('[data-ty-timeline]').forEach((ol) => {
    ol.hidden = ol.dataset.tyTimeline !== (reservation ? 'reservation' : 'order');
  });
  const [lo, hi] = order.transit;
  document.querySelectorAll('[data-ty-transit]').forEach((el) => {
    el.textContent = order.countryName
      ? ` To ${order.countryName}, ${lo}–${hi} business days.`
      : ` ${lo}–${hi} business days to the address in your wallet.`;
  });
  if (feel) {
    document
      .querySelectorAll('[data-ty-feel]')
      .forEach(
        (el) =>
          (el.textContent = ` Yours starts in ${feel.name}: ${feel.feel.charAt(0).toLowerCase()}${feel.feel.slice(1)}`),
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

  // Share your build.
  const buildBtn = $<HTMLButtonElement>('[data-ty-share-build]');
  if (buildBtn && order.build) {
    buildBtn.hidden = false;
    const link = new URL(`${url('/shop/')}?${order.build}`, location.origin).toString();
    buildBtn.addEventListener('click', async () => {
      const result = await shareOrCopy({
        title: 'My Detent build',
        text: `The Detent I just ${reservation ? 'reserved' : 'ordered'}.`,
        url: link,
      });
      const status = $('[data-ty-build-status]');
      if (status)
        status.textContent =
          result === 'copied' ? 'Link to your build copied.' : result === 'failed' ? link : '';
      track('build_share', { method: result, placement: 'thanks' });
    });
  }

  // Referral (concept).
  const refer = $<HTMLElement>('[data-ty-refer]')!;
  const refLink = new URL(`${url('/shop/')}?ref=${order.referral}`, location.origin).toString();
  const input = $<HTMLInputElement>('[data-ty-link]')!;
  input.value = refLink;
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
        title: 'Detent One',
        text: `A knob that clicks one frame at a time. Here’s ${formatUsd(REFERRAL.giveUsd)} off.`,
        url: refLink,
      });
      if (result === 'copied') refStatus.textContent = 'Link copied.';
      track('referral_share', { method: result });
    });
  }
}
