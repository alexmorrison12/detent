/**
 * Cart drawer behavior (every full-chrome page). Renders lines from the cart
 * store, keeps focus sensible across re-renders, announces changes, and
 * offers Undo after a remove instead of a confirmation prompt.
 */
import { FINISHES, PAYMENT, PROFILES, formatUsd } from '@/data/product';
import {
  addLine,
  cartCount,
  cartSubtotal,
  getCart,
  onCartChange,
  removeLine,
  setQty,
  type CartLine,
  type CartState,
} from '@/lib/cart';
import { track } from '@/lib/analytics';
import { esc } from './render';

const drawer = document.getElementById('cart-drawer') as HTMLDialogElement | null;
if (drawer) init(drawer);

function init(drawer: HTMLDialogElement) {
  const $ = <T extends Element>(sel: string) => drawer.querySelector<T>(sel)!;
  const list = $<HTMLUListElement>('[data-cart-lines]');
  const empty = $<HTMLElement>('[data-cart-empty]');
  const foot = $<HTMLElement>('[data-cart-foot]');
  const live = $<HTMLElement>('[data-cart-live]');
  const notice = $<HTMLElement>('[data-cart-notice]');
  const noticeText = $<HTMLElement>('[data-cart-notice-text]');
  const undoBtn = $<HTMLButtonElement>('[data-cart-undo]');
  const title = $<HTMLElement>('#cart-title');
  let removed: CartLine | null = null;

  const finishName = (id?: string) => FINISHES.find((f) => f.id === id)?.name ?? '';
  const feelName = (id?: string) => PROFILES.find((p) => p.id === id)?.name ?? '';

  function lineLabel(l: CartLine): string {
    return l.kind === 'accessory'
      ? l.name
      : `${l.kind === 'reservation' ? 'Reservation, ' : ''}${l.name.replace(/^Reservation: /, '')}${l.kind === 'device' ? `, ${finishName(l.finish)}` : ''}`;
  }

  function meta(l: CartLine): string {
    const parts: string[] = [];
    if (l.kind === 'device') parts.push(finishName(l.finish));
    if (l.feel) parts.push(`Starts in ${feelName(l.feel)}`);
    if (l.engraving) parts.push(`“${l.engraving}”`);
    if (l.kind === 'reservation') parts.push('Refundable deposit, credited to your order');
    return parts.map(esc).join(' · ');
  }

  function thumb(l: CartLine): string {
    const key = l.kind === 'accessory' ? `acc:${l.accessoryId}` : `finish:${l.finish}`;
    const tpl = drawer.querySelector<HTMLTemplateElement>(`template[data-thumb="${key}"]`);
    const html = tpl?.innerHTML.trim() ?? '<span class="cart-thumb"></span>';
    return l.kind === 'reservation'
      ? html.replace('cart-thumb ', 'cart-thumb cart-thumb--reservation ')
      : html;
  }

  function render(state: CartState) {
    // Remember what had focus so a re-render doesn't throw keyboard users out.
    const active = document.activeElement as HTMLElement | null;
    const focusLine = active?.closest<HTMLElement>('[data-line-id]')?.dataset.lineId;
    const focusCtl = active?.dataset.ctl;

    const n = cartCount(state);
    $('[data-cart-drawer-count]').textContent = n ? `${n} item${n === 1 ? '' : 's'}` : '';
    empty.hidden = n > 0;
    foot.hidden = n === 0;
    // Devices and reservations first, accessories after: stable across undo.
    const rank = { device: 0, reservation: 1, accessory: 2 } as const;
    const lines = [...state.lines].sort((a, b) => rank[a.kind] - rank[b.kind]);
    list.innerHTML = lines
      .map((l) => {
        const label = esc(lineLabel(l));
        const name = esc(
          l.kind === 'reservation' ? l.name.replace(/^Reservation: /, 'Reservation · ') : l.name,
        );
        return `<li class="line" data-line-id="${esc(l.id)}">
          ${thumb(l)}
          <div class="line__body">
            <p class="line__name">${name}</p>
            ${meta(l) ? `<p class="line__meta">${meta(l)}</p>` : ''}
            <div class="line__controls">
              <div class="qty" role="group" aria-label="Quantity, ${label}">
                <button type="button" class="qty__btn" data-ctl="dec" aria-label="One fewer" aria-disabled="${l.qty <= 1}">
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 12h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                </button>
                <span class="qty__val readout">${l.qty}</span>
                <button type="button" class="qty__btn" data-ctl="inc" aria-label="One more" aria-disabled="${l.qty >= 9}">
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 12h12M12 6v12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                </button>
              </div>
              <button type="button" class="line__remove" data-ctl="remove">Remove<span class="visually-hidden"> ${label}</span></button>
            </div>
          </div>
          <p class="line__price readout">${formatUsd(l.unitPriceUsd * l.qty)}</p>
        </li>`;
      })
      .join('');

    const subtotal = cartSubtotal(state);
    $('[data-cart-subtotal]').textContent = formatUsd(subtotal);
    const hasDevice = state.lines.some((l) => l.kind !== 'reservation');
    $('[data-cart-installments]').textContent = hasDevice
      ? `${PAYMENT.installmentLabel(subtotal)} at checkout.`
      : 'Deposits are fully refundable until your batch ships.';

    if (focusLine && focusCtl) {
      const el = list.querySelector<HTMLElement>(
        `[data-line-id="${CSS.escape(focusLine)}"] [data-ctl="${focusCtl}"]`,
      );
      if (el) el.focus();
      else if (!undoBtn.hidden) undoBtn.focus();
      else title.focus();
    }
  }

  function announce(msg: string) {
    live.textContent = '';
    requestAnimationFrame(() => (live.textContent = msg));
  }

  function showNotice(msg: string, undo = false) {
    noticeText.textContent = msg;
    undoBtn.hidden = !undo;
    notice.hidden = false;
  }

  function open(message?: string) {
    render(getCart());
    if (message) {
      removed = null;
      showNotice(message);
      announce(`${message}. Cart subtotal ${formatUsd(cartSubtotal())}.`);
    } else {
      notice.hidden = true;
    }
    if (!drawer.open) drawer.showModal();
  }

  document.addEventListener('click', (e) => {
    const t = e.target as Element;
    if (t.closest('[data-cart-open]')) open();
    else if (t.closest('[data-cart-close]')) drawer.close();
    else if (t === drawer) drawer.close(); // backdrop click
  });
  window.addEventListener('detent:cart-open', (e) =>
    open((e as CustomEvent<{ message?: string }>).detail?.message),
  );

  list.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('[data-ctl]');
    const id = btn?.closest<HTMLElement>('[data-line-id]')?.dataset.lineId;
    if (!btn || !id || btn.getAttribute('aria-disabled') === 'true') return;
    const line = getCart().lines.find((l) => l.id === id);
    if (!line) return;
    const label = lineLabel(line);
    if (btn.dataset.ctl === 'remove') {
      removed = { ...line };
      showNotice(`Removed ${label}.`, true);
      removeLine(id);
      announce(`Removed ${label}. Undo is available.`);
      track('cart_remove', { kind: line.kind });
    } else {
      const next = line.qty + (btn.dataset.ctl === 'inc' ? 1 : -1);
      setQty(id, next);
      announce(`${label}: quantity ${next}. Subtotal ${formatUsd(cartSubtotal())}.`);
    }
  });

  undoBtn.addEventListener('click', () => {
    if (!removed) return;
    const line = removed;
    removed = null;
    addLine(line);
    showNotice(`Put back ${lineLabel(line)}.`);
    announce(`Put back ${lineLabel(line)}.`);
    list
      .querySelector<HTMLElement>(`[data-line-id="${CSS.escape(line.id)}"] [data-ctl="remove"]`)
      ?.focus();
  });

  drawer.addEventListener('close', () => {
    notice.hidden = true;
    removed = null;
  });

  onCartChange((s) => {
    if (drawer.open) render(s);
  });

  if (location.hash === '#cart') open();
}
