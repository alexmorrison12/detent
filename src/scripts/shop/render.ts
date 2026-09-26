/**
 * Tiny string renderers shared by the server (set:html) and the client
 * (innerHTML). Everything a visitor typed goes through esc().
 */
import { formatUsd } from '@/data/product';
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
