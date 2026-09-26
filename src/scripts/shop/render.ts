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

export function quoteLinesHtml(lines: QuoteLine[]): string {
  return lines
    .map((l) => {
      const qty = l.qty && l.qty > 1 ? `<span class="ql__qty"> ×${l.qty}</span>` : '';
      const detail = l.detail ? `<span class="ql__detail">${esc(l.detail)}</span>` : '';
      const right = l.amount === null ? esc(l.note ?? '') : formatUsd(l.amount);
      const cls = l.amount === null ? 'ql ql--note' : 'ql';
      return `<li class="${cls}"><span class="ql__label">${esc(l.label)}${qty}</span><span class="ql__amount">${right}</span>${detail}</li>`;
    })
    .join('');
}
