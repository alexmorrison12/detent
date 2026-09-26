/**
 * Tiny string renderers shared by the server (set:html) and the client
 * (innerHTML). Everything a visitor typed goes through esc().
 */
import { FINISHES, formatUsd } from '@/data/product';
import type { CartLine } from '@/lib/cart';
import type { QuoteLine } from './build';

export function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

/**
 * Build line items. Labels and notes ("Engraving", "Free") are set in the
 * UI face; only the numbers (prices, quantities) are readouts in mono
 * (DESIGN.md: Martian Mono for readouts only).
 */
export function quoteLinesHtml(lines: QuoteLine[]): string {
  return lines
    .map((l) => {
      const qty = l.qty && l.qty > 1 ? ` <span class="ql__qty readout">×${l.qty}</span>` : '';
      const detail = l.detail ? `<span class="ql__detail">${esc(l.detail)}</span>` : '';
      const right =
        l.amount === null
          ? `<span class="ql__amount">${esc(l.note ?? '')}</span>`
          : `<span class="ql__amount readout">${formatUsd(l.amount)}</span>`;
      const cls = l.amount === null ? 'ql ql--note' : 'ql';
      return `<li class="${cls}"><span class="ql__label">${esc(l.label)}${qty}</span>${right}${detail}</li>`;
    })
    .join('');
}

/** Line icons for accessories, drawn on a 24-unit grid (stroke set in CSS). */
const ACC_ICONS: Record<string, string> = {
  plinth:
    '<path d="M3.5 19.5h17v-3.2L3.5 18.8z"/><circle cx="12" cy="11" r="4.6"/><path d="M12 6.4v2.2"/>',
  case: '<rect x="3.5" y="7.5" width="17" height="11" rx="4"/><path d="M8.5 7.5V6a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 15.5 6v1.5M3.5 13h17"/>',
  cable:
    '<rect x="2.5" y="10" width="4" height="4" rx="1"/><path d="M6.5 12h1.5c0-3 3-3 3 0s3 3 3 0 3-3 3 0h1.5"/><path d="M19.5 12h2"/>',
};

/**
 * A cart line's thumbnail, shared by the cart drawer and the checkout
 * summary: the knob in its finish with its tally line for a device (a dashed
 * rim for a reservation), the accessory's icon otherwise. Colors come from
 * FINISHES, so they stay in data. Styles: src/components/shop/line-thumb.css.
 */
export function lineThumbHtml(l: Pick<CartLine, 'kind' | 'finish' | 'accessoryId'>): string {
  if (l.kind === 'accessory') {
    const icon = ACC_ICONS[l.accessoryId ?? ''] ?? '<circle cx="12" cy="12" r="7"/>';
    return `<span class="cart-thumb cart-thumb--acc"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">${icon}</svg></span>`;
  }
  const f = FINISHES.find((x) => x.id === l.finish);
  const style = f ? ` style="--chip: ${esc(f.body)}; --chip-accent: ${esc(f.accent)}"` : '';
  const reservation = l.kind === 'reservation' ? ' cart-thumb--reservation' : '';
  return `<span class="cart-thumb cart-thumb--knob${reservation}"${style}></span>`;
}
