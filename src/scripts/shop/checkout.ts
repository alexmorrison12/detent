/**
 * /shop/checkout/ demo. Renders the cart summary, validates the form with
 * accessible errors (inline + a focused summary), estimates delivery from
 * the chosen country, and turns the cart into a demo order.
 *
 * A cart of reservations only asks for an email: the address is collected
 * when the batch ships, as /l/reserve/ promises. Nothing typed here is sent
 * anywhere. The order keeps only the country (for the confirmation page); a
 * demo reservation is also recorded in this browser through the adapter
 * /l/reserve/ uses, so both pages agree there is one.
 */
import { FINISHES, PAYMENT, PROFILES, formatUsd } from '@/data/product';
import { SHIP_REGIONS, shipRegion } from '@/data/shop';
import {
  addLine,
  cartSubtotal,
  clearCart,
  getCart,
  onCartChange,
  replaceLines,
  type CartState,
} from '@/lib/cart';
import { track } from '@/lib/analytics';
import { IS_DEMO, captureRef, isValidEmail, reserve } from '@/lib/waitlist';
import { url } from '@/lib/url';
import {
  cartLinesFor,
  currentPhase,
  hasBuildParams,
  launchNote,
  parseBuild,
  regularUnitPrice,
  syncCartLines,
} from './build';
import { createOrder, saveOrder } from './order';
import { esc, lineThumbHtml } from './render';

/** What the demo wallet "supplies" for an express reservation (RFC 2606 domain). */
const DEMO_WALLET_EMAIL = 'wallet@example.invalid';

const form = document.querySelector<HTMLFormElement>('[data-checkout]');
if (form) init(form);

function init(form: HTMLFormElement) {
  const $ = <T extends Element>(sel: string, root: ParentNode = document) =>
    root.querySelector<T>(sel)!;
  const field = (name: string) => $<HTMLInputElement>(`[data-field="${name}"]`, form);
  const grid = $<HTMLElement>('[data-co-grid]');
  const empty = $<HTMLElement>('[data-co-empty]');
  const details = $<HTMLDetailsElement>('[data-co-details]');

  // The cart may have been filled in an earlier phase: re-price it first.
  const synced = syncCartLines(getCart().lines, currentPhase());
  if (synced.changed) replaceLines(synced.lines);

  // Agent-friendly deep link: /shop/checkout/?edition=one&finish=raw adds that
  // build to the cart (addLine merges an identical line), whatever is already
  // in it. The params are stripped below, so a reload doesn't add it twice.
  const params = new URLSearchParams(location.search);
  if (hasBuildParams(params)) {
    cartLinesFor(parseBuild(params), currentPhase()).forEach((l) => addLine(l));
  }
  const express = params.get('express') === '1';
  if (params.toString()) history.replaceState(history.state, '', location.pathname + location.hash);

  /* ------------------------------------------------------------ summary */
  const finishOf = (id?: string) => FINISHES.find((f) => f.id === id);
  const feelName = (id?: string) => PROFILES.find((p) => p.id === id)?.name;

  /** A cart of deposits only: no address, no delivery step, no shipping rows. */
  let reservationsOnly = false;

  function renderSummary(state: CartState) {
    const has = state.lines.length > 0;
    grid.hidden = !has;
    empty.hidden = has;
    if (!has) return;
    const subtotal = cartSubtotal(state);
    reservationsOnly = state.lines.every((l) => l.kind === 'reservation');
    document.querySelectorAll<HTMLElement>('[data-co-only]').forEach((el) => {
      el.hidden = el.dataset.coOnly !== (reservationsOnly ? 'reservation' : 'order');
    });
    $('[data-co-lines]').innerHTML = state.lines
      .map((l) => {
        const f = finishOf(l.finish);
        const regular = regularUnitPrice(l);
        const was =
          regular === null
            ? ''
            : `<s class="col__was"><span class="visually-hidden">Regular price </span>${formatUsd(regular * l.qty)}</s>`;
        const meta = [
          l.kind === 'reservation' ? 'Refundable deposit' : '',
          l.kind === 'device' && f ? f.name : '',
          feelName(l.feel) ? `Starts in ${feelName(l.feel)}` : '',
          l.engraving ? `“${l.engraving}”` : '',
        ]
          .filter(Boolean)
          .map(esc)
          .join(' · ');
        return `<li class="col">
          <span class="col__thumb">${lineThumbHtml(l)}${l.qty > 1 ? `<span class="col__qty readout">${l.qty}</span>` : ''}</span>
          <span><span class="col__name">${esc(l.name.replace(/^Reservation: /, 'Reservation · '))}${l.qty > 1 ? `<span class="visually-hidden">, quantity ${l.qty}</span>` : ''}</span>${meta ? `<br><span class="col__meta">${meta}</span>` : ''}</span>
          <span class="col__price readout">${was}<span>${formatUsd(l.unitPriceUsd * l.qty)}</span></span>
        </li>`;
      })
      .join('');
    $('[data-co-subtotal]').textContent = formatUsd(subtotal);
    $('[data-co-total]').textContent = formatUsd(subtotal);
    $('[data-co-total-short]').textContent = formatUsd(subtotal);
    $('[data-co-total-label]').textContent = reservationsOnly ? 'Due today, refundable' : 'Total';
    // Pay over time: live store only, never on a deposit (see the launch plan).
    $('[data-co-installments]').textContent =
      !reservationsOnly && currentPhase() === 'live'
        ? `${PAYMENT.installmentLabel(subtotal)}.`
        : '';
    // Launch week: the dated deadline and the saving, right by the button
    // (the summary is folded on phones).
    const deadline = $<HTMLElement>('[data-co-launch-note]');
    deadline.textContent = launchNote(state.lines);
    deadline.hidden = !deadline.textContent;
    $('[data-co-submit-total]').textContent = formatUsd(subtotal);
    $('[data-co-submit-label]').textContent = reservationsOnly
      ? 'Place demo reservation'
      : 'Place demo order';
  }
  renderSummary(getCart());
  onCartChange(renderSummary);

  // Summary starts open on wide screens, folded on phones.
  const wide = matchMedia('(min-width: 60rem)');
  const syncDetails = () => (details.open = wide.matches);
  syncDetails();
  wide.addEventListener('change', syncDetails);

  /* ----------------------------------------------------------- delivery */
  const country = $<HTMLSelectElement>('[data-field="country"]', form);
  function renderDelivery() {
    const r = shipRegion(country.value) ?? SHIP_REGIONS[0]!;
    $('[data-co-delivery-text]').textContent =
      `Tracked and insured, free. To ${r.name}, ${r.transit[0]}–${r.transit[1]} business days after it leaves us.`;
    $('[data-postal-label]').textContent = r.postal.label;
    $('[data-postal-hint]').textContent = `For example, ${r.postal.example}`;
    const postal = field('postal');
    if (postal.getAttribute('aria-invalid') === 'true') validate('postal');
  }
  country.addEventListener('change', renderDelivery);
  renderDelivery();

  /* --------------------------------------------------------- validation */
  type Rule = { id: string; label: string; check: (v: string) => string | null };
  const rules: Record<string, Rule> = {
    email: {
      id: 'co-email',
      label: 'Email',
      check: (v) =>
        !v
          ? 'Enter your email address.'
          : isValidEmail(v)
            ? null
            : 'Enter an email address like name@example.com.',
    },
    name: {
      id: 'co-name',
      label: 'Full name',
      check: (v) => (v.length >= 2 ? null : 'Enter the name for the shipping label.'),
    },
    address: {
      id: 'co-address',
      label: 'Street address',
      check: (v) => (v.length >= 3 ? null : 'Enter a street address.'),
    },
    city: {
      id: 'co-city',
      label: 'City',
      check: (v) => (v.length >= 2 ? null : 'Enter a city or town.'),
    },
    postal: {
      id: 'co-postal',
      get label() {
        return (shipRegion(country.value) ?? SHIP_REGIONS[0]!).postal.label;
      },
      check: (v) => {
        const r = shipRegion(country.value) ?? SHIP_REGIONS[0]!;
        // "ZIP code" and "CAP" keep their capitals; "Postal code" reads lower-case mid-sentence.
        const noun = /^[A-Z]{3}/.test(r.postal.label)
          ? r.postal.label
          : r.postal.label.toLowerCase();
        if (!v) return `Enter a ${noun}.`;
        return new RegExp(r.postal.pattern).test(v)
          ? null
          : `That doesn’t look like a ${r.name} ${noun}. For example, ${r.postal.example}.`;
      },
    },
  };

  function validate(name: string): string | null {
    const rule = rules[name]!;
    const input = field(name);
    const msg = rule.check(input.value.trim());
    const errId = `${rule.id}-error`;
    let err = document.getElementById(errId);
    const described = (input.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .filter((x) => x && x !== errId);
    if (msg) {
      if (!err) {
        err = document.createElement('p');
        err.id = errId;
        err.className = 'field-error';
        input.insertAdjacentElement('afterend', err);
      }
      err.textContent = msg;
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', [errId, ...described].join(' '));
    } else {
      err?.remove();
      input.removeAttribute('aria-invalid');
      if (described.length) input.setAttribute('aria-describedby', described.join(' '));
      else input.removeAttribute('aria-describedby');
    }
    return msg;
  }

  // Validate on blur once a field has been touched; re-check live after an error.
  for (const name of Object.keys(rules)) {
    const input = field(name);
    input.addEventListener('blur', () => {
      if (input.value.trim() || input.dataset.touched) validate(name);
      input.dataset.touched = '1';
    });
    input.addEventListener('input', () => {
      if (input.getAttribute('aria-invalid') === 'true') validate(name);
    });
  }

  const errorsBox = $<HTMLElement>('[data-co-errors]');
  function showErrors(list: { id: string; label: string; msg: string }[]) {
    if (!list.length) {
      errorsBox.hidden = true;
      return;
    }
    $('[data-co-errors-title]').textContent =
      list.length === 1
        ? 'One thing to fix before we can finish:'
        : `${list.length} things to fix before we can finish:`;
    $('[data-co-errors-list]').innerHTML = list
      .map((e) => `<li><a href="#${e.id}">${esc(e.label)}</a>: ${esc(e.msg)}</li>`)
      .join('');
    errorsBox.hidden = false;
    errorsBox.focus();
  }
  errorsBox.addEventListener('click', (e) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!a) return;
    e.preventDefault();
    document.getElementById(a.hash.slice(1))?.focus();
  });

  /** Only the steps on screen are validated: a reservation needs an email. */
  const activeRules = () => (reservationsOnly ? ['email'] : Object.keys(rules));

  /* ------------------------------------------------------------- finish */
  async function complete(method: 'express' | 'form', button: HTMLButtonElement) {
    const cart = getCart();
    if (!cart.lines.length) return;
    button.setAttribute('aria-busy', 'true');
    button.disabled = true;
    // One reservation system, whichever button paid: record it where
    // /l/reserve/, the header and the shop look, so they show it as held
    // (same id) instead of offering a second one. Demo only: a live endpoint
    // must never receive a reservation from a demo checkout. The demo wallet
    // has no email to hand over, so express uses the one typed, if any, or a
    // placeholder on a reserved domain; it never leaves this browser.
    const held = cart.lines.find((l) => l.kind === 'reservation');
    let reservationId: string | undefined;
    if (held?.edition && held.finish && IS_DEMO) {
      const typed = field('email').value.trim();
      const r = await reserve({
        email: method === 'form' || isValidEmail(typed) ? typed : DEMO_WALLET_EMAIL,
        edition: held.edition,
        finish: held.finish,
        source: method === 'express' ? 'shop-express' : 'shop-checkout',
      });
      if (r.ok) reservationId = r.data.id;
    }
    const order = createOrder(cart, {
      country: method === 'express' || reservationsOnly ? '' : country.value,
      gift: !reservationsOnly && !!field('gift').checked,
      method,
      id: reservationsOnly ? reservationId : undefined,
      referredBy: captureRef(),
    });
    saveOrder(order);
    track('demo_order_complete', {
      kind: order.kind,
      method,
      value: order.subtotal,
      items: order.lines.reduce((n, l) => n + l.qty, 0),
      country: method === 'form' ? order.country : undefined,
    });
    clearCart();
    location.assign(url('/shop/thanks/'));
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const errors = activeRules()
      .map((name) => ({ name, msg: validate(name) }))
      .filter((x): x is { name: string; msg: string } => !!x.msg)
      .map((x) => ({ id: rules[x.name]!.id, label: rules[x.name]!.label, msg: x.msg }));
    showErrors(errors);
    if (errors.length) {
      track('checkout_error', { fields: errors.length });
      return;
    }
    void complete('form', $<HTMLButtonElement>('[data-co-submit]', form));
  });

  const expressBtn = $<HTMLButtonElement>('[data-co-express]', form);
  expressBtn.addEventListener('click', () => void complete('express', expressBtn));
  if (express) {
    expressBtn.scrollIntoView({ block: 'center' });
    expressBtn.focus({ preventScroll: true });
  }
}
