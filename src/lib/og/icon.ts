/**
 * App icons (apple-touch, PWA 192/512, maskable) drawn from the favicon's
 * design: a graphite knob with an aluminum rim and the tally indicator. At
 * icon sizes there's room for one more true detail, so the knob sits inside
 * its 24-detent scale with the indicator resting on a lit detent.
 */
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { byProfile } from '@/data/product';
import { token } from './color';

export type IconId = 'apple-touch-icon' | 'icon-192' | 'icon-512' | 'icon-maskable-512';

export const ICONS: Record<IconId, { size: number; maskable: boolean }> = {
  'apple-touch-icon': { size: 180, maskable: false },
  'icon-192': { size: 192, maskable: false },
  'icon-512': { size: 512, maskable: false },
  // Maskable: everything that matters inside the central 80% circle.
  'icon-maskable-512': { size: 512, maskable: true },
};

const f = (n: number) => Number(n.toFixed(2));

export function iconSvg(maskable: boolean): string {
  const S = 512;
  const c = S / 2;
  const k = maskable ? 0.82 : 1;
  const face = 150 * k;
  const rim = 11 * k;
  const tickIn = 178 * k;
  const tickOut = 200 * k;
  const detents = byProfile('ratchet').physics.detents || 24;
  const step = 360 / detents;
  const angle = step * 2; // two detents past noon, close to the logo's 35°

  const bg = token('graphite-950');
  const lift = token('graphite-850');
  const knob = token('graphite-900');
  const alu = token('alu-200');
  const tickInk = token('alu-400');
  const tally = token('tally');

  const ticks: string[] = [];
  for (let i = 0; i < detents; i++) {
    const deg = i * step;
    const lit = Math.abs(deg - angle) < 0.01;
    ticks.push(
      `<line x1="0" y1="${f(-tickIn)}" x2="0" y2="${f(-tickOut)}" transform="rotate(${f(deg)})" stroke="${lit ? tally : tickInk}" stroke-opacity="${lit ? 1 : 0.5}" stroke-width="${f((lit ? 9 : 6) * k)}" stroke-linecap="round"/>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <radialGradient id="lamp" cx="0.3" cy="0.22" r="0.9">
      <stop offset="0" stop-color="${lift}"/><stop offset="1" stop-color="${bg}"/>
    </radialGradient>
  </defs>
  <rect width="${S}" height="${S}" fill="url(#lamp)"/>
  <g transform="translate(${c} ${c})">
    ${ticks.join('')}
    <circle r="${f(face)}" fill="${knob}" stroke="${alu}" stroke-width="${f(rim)}"/>
    <line x1="0" y1="${f(-face * 0.72)}" x2="0" y2="${f(-face * 0.3)}" transform="rotate(${f(angle)})" stroke="${tally}" stroke-width="${f(face * 0.22)}" stroke-linecap="round"/>
  </g>
</svg>`;
}

export async function renderIcon(id: IconId): Promise<Uint8Array> {
  const { size, maskable } = ICONS[id];
  const png = new Resvg(iconSvg(maskable), {
    fitTo: { mode: 'width', value: size },
    font: { loadSystemFonts: false },
  })
    .render()
    .asPng();
  const out = await sharp(png)
    .png({ compressionLevel: 9, palette: true, quality: 100, dither: 1 })
    .toBuffer();
  return new Uint8Array(out);
}
