/**
 * Detent One, drawn top-down as raw SVG for raster cards.
 *
 * Built from the product's own geometry rather than decoration: an engraved
 * tick scale, the bead-blasted base, the knurled knob wall, a lathe-turned
 * top (concentric tool marks), the round AMOLED display with its profile
 * ring, and the tally indicator. Light comes from the upper left, like the
 * desk lamp in DESIGN.md's scene.
 */
import { mix, token } from './color';

export interface DialArt {
  /** Knob body color (hex). */
  body: string;
  /** Indicator color: tally on most finishes, white on the Tally finish. */
  indicator: string;
  /** Display ring color(s): one feel color, or several for segmented rings. */
  ring: string[];
  /** Knob rotation, degrees; 0 = indicator at 12 o'clock. */
  angle: number;
  /** Ticks on the engraved scale. */
  ticks: number;
  /** Portion of the display ring lit, 0..1 (single-color rings). */
  value: number;
  /** Tease: an unlit silhouette with only rims and the indicator. */
  silhouette?: boolean;
}

const f = (n: number) => Number(n.toFixed(2));

function polar(r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [f(r * Math.cos(a)), f(r * Math.sin(a))];
}

function arc(r: number, from: number, to: number): string {
  const [x1, y1] = polar(r, from);
  const [x2, y2] = polar(r, to);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  return `M${x1} ${y1}A${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

/**
 * The dial as an SVG fragment centered on (cx, cy) with base radius R.
 * `id` namespaces gradient/filter ids so several dials can share a document.
 */
export function dialSvg(art: DialArt, cx: number, cy: number, R: number, id = 'd'): string {
  const graphite950 = token('graphite-950');
  const alu100 = token('alu-100');
  const alu300 = token('alu-300');
  const tally = art.indicator;
  const dim = art.silhouette;

  const light = (t: number) => mix(art.body, '#ffffff', t);
  const dark = (t: number) => mix(art.body, '#000000', t);
  const baseTop = dim ? mix(graphite950, '#ffffff', 0.05) : dark(0.45);
  const baseBottom = dim ? graphite950 : dark(0.78);

  const rScaleIn = R * 1.045;
  const rScaleOut = R * 1.085;
  const rScaleLong = R * 1.115;
  const rKnurlOut = R * 0.86;
  const rTop = R * 0.79;
  const rDisplay = R * 0.5;
  const rRing = R * 0.43;
  const indicatorAt = art.angle;

  const parts: string[] = [];

  // --- defs -----------------------------------------------------------------
  parts.push(`<defs>
    <radialGradient id="${id}-base" cx="0.36" cy="0.3" r="0.85">
      <stop offset="0" stop-color="${baseTop}"/>
      <stop offset="1" stop-color="${baseBottom}"/>
    </radialGradient>
    <linearGradient id="${id}-top" x1="0.15" y1="0.1" x2="0.85" y2="0.95">
      <stop offset="0" stop-color="${dim ? mix(graphite950, '#ffffff', 0.09) : light(0.22)}"/>
      <stop offset="0.55" stop-color="${dim ? mix(graphite950, '#ffffff', 0.04) : art.body}"/>
      <stop offset="1" stop-color="${dim ? graphite950 : dark(0.35)}"/>
    </linearGradient>
    <linearGradient id="${id}-rim" x1="0.1" y1="0.05" x2="0.9" y2="0.95">
      <stop offset="0" stop-color="#ffffff" stop-opacity="${dim ? 0.5 : 0.6}"/>
      <stop offset="0.45" stop-color="#ffffff" stop-opacity="0.06"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="${id}-shade" x1="0.2" y1="0.1" x2="0.85" y2="0.95">
      <stop offset="0" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.5"/>
    </linearGradient>
    <radialGradient id="${id}-glass" cx="0.35" cy="0.25" r="0.9">
      <stop offset="0" stop-color="#1a1718"/>
      <stop offset="0.6" stop-color="#070606"/>
      <stop offset="1" stop-color="#030303"/>
    </radialGradient>
    <filter id="${id}-shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="${f(R * 0.09)}"/>
    </filter>
    <filter id="${id}-glow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="${f(R * 0.02)}"/>
    </filter>
  </defs>`);

  parts.push(`<g transform="translate(${cx} ${cy})">`);

  // --- cast shadow on the desk ----------------------------------------------
  parts.push(
    `<circle cx="${f(R * 0.06)}" cy="${f(R * 0.1)}" r="${f(R * 0.98)}" fill="#000000" opacity="0.55" filter="url(#${id}-shadow)"/>`,
  );

  // --- engraved scale ---------------------------------------------------------
  const lit = Math.round((((indicatorAt % 360) + 360) % 360) / (360 / art.ticks)) % art.ticks;
  const ticks: string[] = [];
  for (let i = 0; i < art.ticks; i++) {
    if (i === lit && !dim) continue;
    const deg = (360 / art.ticks) * i;
    const long = i % 5 === 0;
    const [x1, y1] = polar(rScaleIn, deg);
    const [x2, y2] = polar(long ? rScaleLong : rScaleOut, deg);
    ticks.push(
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${alu300}" stroke-opacity="${long ? 0.42 : 0.2}" stroke-width="${long ? 2 : 1.5}"/>`,
    );
  }
  parts.push(`<g stroke-linecap="round">${ticks.join('')}</g>`);

  // --- base -------------------------------------------------------------------
  parts.push(`<circle r="${R}" fill="url(#${id}-base)"/>`);
  parts.push(`<circle r="${f(R - 1)}" fill="none" stroke="url(#${id}-rim)" stroke-width="2"/>`);
  parts.push(
    `<circle r="${f(R * 0.955)}" fill="none" stroke="#000000" stroke-opacity="0.35" stroke-width="1.5"/>`,
  );

  // --- knob wall: knurling seen from above --------------------------------------
  parts.push(
    `<circle r="${f(rKnurlOut)}" fill="${dim ? mix(graphite950, '#ffffff', 0.03) : dark(0.3)}"/>`,
  );
  const knurl: string[] = [];
  const N = 180;
  for (let i = 0; i < N; i++) {
    const deg = (360 / N) * i + indicatorAt;
    const [x1, y1] = polar(rTop + 1, deg);
    const [x2, y2] = polar(rKnurlOut - 1, deg);
    const bright = i % 2 === 0;
    knurl.push(
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${bright ? '#ffffff' : '#000000'}" stroke-opacity="${bright ? (dim ? 0.05 : 0.16) : 0.4}" stroke-width="1.6"/>`,
    );
  }
  parts.push(`<g>${knurl.join('')}</g>`);
  // light falls off across the wall toward the lower right
  parts.push(`<circle r="${f(rKnurlOut)}" fill="url(#${id}-shade)"/>`);
  parts.push(
    `<circle r="${f(rKnurlOut - 0.75)}" fill="none" stroke="url(#${id}-rim)" stroke-width="1.5"/>`,
  );

  // --- knob top: lathe-turned face ---------------------------------------------
  parts.push(`<circle r="${f(rTop)}" fill="url(#${id}-top)"/>`);
  const rings: string[] = [];
  for (let r = rDisplay + 4, i = 0; r < rTop - 2; r += 2.6, i++) {
    rings.push(
      `<circle r="${f(r)}" fill="none" stroke="${i % 2 ? '#000000' : '#ffffff'}" stroke-opacity="${dim ? 0.025 : i % 3 === 0 ? 0.07 : 0.035}" stroke-width="1"/>`,
    );
  }
  parts.push(`<g>${rings.join('')}</g>`);
  parts.push(
    `<circle r="${f(rTop - 1)}" fill="none" stroke="url(#${id}-rim)" stroke-width="2.5"/>`,
  );

  // --- display: glass, bezel, profile ring -----------------------------------------
  parts.push(`<circle r="${f(rDisplay + 5)}" fill="#000000" fill-opacity="0.55"/>`);
  parts.push(`<circle r="${f(rDisplay)}" fill="url(#${id}-glass)"/>`);
  parts.push(
    `<circle r="${f(rDisplay)}" fill="none" stroke="${alu100}" stroke-opacity="0.12" stroke-width="1.5"/>`,
  );

  if (!dim) {
    const w = f(R * 0.022);
    if (art.ring.length > 1) {
      const n = art.ring.length;
      const gap = 7;
      const seg = 360 / n;
      art.ring.forEach((c, i) => {
        const from = i * seg + gap / 2 - 90 + indicatorAt;
        parts.push(
          `<path d="${arc(rRing, from, from + seg - gap)}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`,
        );
      });
    } else {
      const c = art.ring[0]!;
      const sweep = 270;
      const start = -135;
      const end = start + sweep * Math.min(1, Math.max(0.02, art.value));
      parts.push(
        `<path d="${arc(rRing, start, start + sweep)}" fill="none" stroke="${c}" stroke-opacity="0.16" stroke-width="${w}" stroke-linecap="round"/>`,
        `<path d="${arc(rRing, start, end)}" fill="none" stroke="${c}" stroke-opacity="0.55" stroke-width="${f(Number(w) * 2.4)}" stroke-linecap="round" filter="url(#${id}-glow)"/>`,
        `<path d="${arc(rRing, start, end)}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`,
      );
    }
  }

  // --- tally indicator on the knob top -------------------------------------------
  const [ix1, iy1] = polar(rTop * 0.93, indicatorAt);
  const [ix2, iy2] = polar(rDisplay + R * 0.1, indicatorAt);
  const iw = f(R * 0.038);
  parts.push(
    `<line x1="${ix1}" y1="${iy1}" x2="${ix2}" y2="${iy2}" stroke="${tally}" stroke-opacity="0.7" stroke-width="${f(iw * 2)}" stroke-linecap="round" filter="url(#${id}-glow)"/>`,
    `<line x1="${ix1}" y1="${iy1}" x2="${ix2}" y2="${iy2}" stroke="${tally}" stroke-width="${iw}" stroke-linecap="round"/>`,
  );

  // --- the lit detent on the scale: where the indicator points ----------------------
  if (!dim) {
    const deg = (360 / art.ticks) * lit;
    const [x1, y1] = polar(rScaleIn, deg);
    const [x2, y2] = polar(rScaleLong + R * 0.02, deg);
    parts.push(
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${tally}" stroke-width="3" stroke-linecap="round" stroke-opacity="0.6" filter="url(#${id}-glow)"/>`,
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${tally}" stroke-width="2.5" stroke-linecap="round"/>`,
    );
  }

  parts.push('</g>');
  return parts.join('');
}
