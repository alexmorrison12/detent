/**
 * Demo orders. Checkout turns the cart into one of these, keeps it in
 * sessionStorage for the confirmation page, then clears the cart.
 * Deliberately stores no name, email or address: only what the
 * confirmation page shows (country, delivery window, lines).
 */
import type { ProfileId } from '@/data/product';
import { cartSubtotal, type CartLine, type CartState } from '@/lib/cart';
import { read, write } from '@/lib/storage';
import { randomCode } from '@/lib/waitlist';
import { SHIP_REGIONS, shipRegion } from '@/data/shop';

export interface DemoOrder {
  id: string;
  kind: 'order' | 'reservation' | 'mixed';
  lines: CartLine[];
  subtotal: number;
  /** Sum of reservation lines (refundable deposits). */
  deposit: number;
  /** ISO code, or '' for express orders (the wallet would supply it). */
  country: string;
  countryName: string;
  transit: [number, number];
  gift: boolean;
  method: 'express' | 'form';
  firstFeel?: ProfileId;
  /** Query string of the first build in the order, for "share your build". */
  build?: string;
  /** Concept referral code ("Give $30, get $30"). */
  referral: string;
  createdAt: number;
}

const KEY = 'shop:last-order';

export function createOrder(
  cart: CartState,
  opts: { country: string; gift: boolean; method: DemoOrder['method'] },
): DemoOrder {
  const reservations = cart.lines.filter((l) => l.kind === 'reservation');
  const others = cart.lines.filter((l) => l.kind !== 'reservation');
  const kind: DemoOrder['kind'] =
    reservations.length && others.length ? 'mixed' : reservations.length ? 'reservation' : 'order';
  // Express orders carry no address in the demo: use the widest window.
  const region = shipRegion(opts.country) ?? {
    code: '',
    name: '',
    transit: [
      Math.min(...SHIP_REGIONS.map((r) => r.transit[0])),
      Math.max(...SHIP_REGIONS.map((r) => r.transit[1])),
    ] as [number, number],
  };
  const first = cart.lines.find((l) => l.kind !== 'accessory');
  return {
    id: `DEMO-${randomCode(6)}`,
    kind,
    lines: cart.lines.map((l) => ({ ...l })),
    subtotal: cartSubtotal(cart),
    deposit: reservations.reduce((n, l) => n + l.unitPriceUsd * l.qty, 0),
    country: region.code,
    countryName: region.name,
    transit: region.transit,
    gift: opts.gift,
    method: opts.method,
    firstFeel: first?.feel,
    build: first?.build,
    referral: randomCode(8),
    createdAt: Date.now(),
  };
}

export function saveOrder(order: DemoOrder): void {
  write(KEY, order, 'session');
}

export function lastOrder(): DemoOrder | null {
  return read<DemoOrder | null>(KEY, null, 'session');
}
