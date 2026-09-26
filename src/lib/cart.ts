/**
 * Cart store (client-only, persisted to localStorage). The header badge and
 * the cart drawer subscribe; the shop/configurator adds lines.
 * Every mutation dispatches `detent:cart` on window with the new state.
 */
import { read, write } from './storage';
import type { EditionId, FinishId } from '@/data/product';

export interface CartLine {
  /** Stable id for the line: edition+finish+engraving+accessory combo. */
  id: string;
  kind: 'device' | 'accessory' | 'reservation';
  edition?: EditionId;
  finish?: FinishId;
  engraving?: string;
  accessoryId?: string;
  name: string;
  unitPriceUsd: number;
  qty: number;
}

export interface CartState {
  lines: CartLine[];
  updatedAt: number;
}

const KEY = 'cart';
const empty = (): CartState => ({ lines: [], updatedAt: Date.now() });

export function getCart(): CartState {
  return read<CartState>(KEY, empty());
}

function commit(state: CartState): CartState {
  state.updatedAt = Date.now();
  write(KEY, state);
  window.dispatchEvent(new CustomEvent<CartState>('detent:cart', { detail: state }));
  return state;
}

export function addLine(line: Omit<CartLine, 'qty'> & { qty?: number }): CartState {
  const state = getCart();
  const existing = state.lines.find((l) => l.id === line.id);
  if (existing) existing.qty = Math.min(9, existing.qty + (line.qty ?? 1));
  else state.lines.push({ ...line, qty: line.qty ?? 1 });
  return commit(state);
}

export function setQty(id: string, qty: number): CartState {
  const state = getCart();
  state.lines = state.lines
    .map((l) => (l.id === id ? { ...l, qty: Math.max(0, Math.min(9, qty)) } : l))
    .filter((l) => l.qty > 0);
  return commit(state);
}

export function removeLine(id: string): CartState {
  return setQty(id, 0);
}

export function clearCart(): CartState {
  return commit(empty());
}

export function cartCount(state = getCart()): number {
  return state.lines.reduce((n, l) => n + l.qty, 0);
}

export function cartSubtotal(state = getCart()): number {
  return state.lines.reduce((n, l) => n + l.unitPriceUsd * l.qty, 0);
}

export function onCartChange(fn: (s: CartState) => void): () => void {
  const handler = (e: Event) => fn((e as CustomEvent<CartState>).detail);
  const storage = (e: StorageEvent) => e.key === `detent:${KEY}` && fn(getCart());
  window.addEventListener('detent:cart', handler);
  window.addEventListener('storage', storage);
  return () => {
    window.removeEventListener('detent:cart', handler);
    window.removeEventListener('storage', storage);
  };
}
