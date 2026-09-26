/**
 * The feel, drawn: an engraved bezel around the configurator dial that shows
 * where the selected profile clicks, stops, springs or snaps. Pure string
 * builders so Astro can server-render the default and the client can redraw.
 *
 * Coordinates: viewBox -100 -100 200 200, 0° at 12 o'clock, clockwise.
 */
import type { FeelProfile } from '@/data/product';

export const RING_R = 84;

const rad = (deg: number) => (deg * Math.PI) / 180;
const pt = (r: number, deg: number) => [r * Math.sin(rad(deg)), -r * Math.cos(rad(deg))] as const;
const f = (n: number) => (Math.round(n * 100) / 100).toString();

function tick(deg: number, r1: number, r2: number, cls: string): string {
  const [x1, y1] = pt(r1, deg);
  const [x2, y2] = pt(r2, deg);
  return `<line class="${cls}" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`;
}

function arc(r: number, from: number, to: number, cls: string): string {
  const [x1, y1] = pt(r, from);
  const [x2, y2] = pt(r, to);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  return `<path class="${cls}" d="M${f(x1)} ${f(y1)}A${r} ${r} 0 ${large} 1 ${f(x2)} ${f(y2)}"/>`;
}

/** Inner SVG markup for a profile's bezel (no wrapper element). */
export function feelRingMarkup(p: FeelProfile): string {
  const { detents, stops, spring, accents = [], snaps } = p.physics;
  const out: string[] = [];

  // Fine graduation every 3°, the machined part of the bezel.
  for (let d = 0; d < 360; d += 3) out.push(tick(d, RING_R + 5, RING_R + 7, 'fr-grad'));

  if (stops) {
    const [a, b] = stops;
    out.push(arc(RING_R, a, b, 'fr-track'));
    out.push(arc(RING_R, b, a + 360, 'fr-dead'));
    out.push(tick(a, RING_R - 9, RING_R + 4, 'fr-stop'));
    out.push(tick(b, RING_R - 9, RING_R + 4, 'fr-stop'));
    if (spring) {
      // Spring: the pull back to center, drawn as graduated ticks that grow
      // toward the ends (the further you push, the harder it pushes back).
      for (let d = 10; d < b; d += 10) {
        const len = 2 + (d / b) * 6;
        out.push(tick(d, RING_R - len, RING_R, 'fr-tick'));
        out.push(tick(-d, RING_R - len, RING_R, 'fr-tick'));
      }
    }
  } else {
    out.push(`<circle class="fr-track" r="${RING_R}"/>`);
  }

  if (detents > 0) {
    const step = 360 / detents;
    for (let i = 0; i < detents; i++) {
      const d = i * step;
      const accent = accents.some((a) => Math.abs((((d - a) % 360) + 360) % 360) < 0.001);
      out.push(
        accent
          ? tick(d, RING_R - 13, RING_R + 3, 'fr-accent')
          : tick(d, RING_R - 8, RING_R, 'fr-tick'),
      );
    }
  } else {
    for (const a of accents) out.push(tick(a, RING_R - 13, RING_R + 3, 'fr-accent'));
  }

  if (snaps) {
    for (const s of snaps) {
      const [x, y] = pt(RING_R, s);
      out.push(`<circle class="fr-snap" cx="${f(x)}" cy="${f(y)}" r="3.2"/>`);
    }
  }

  if (!detents && !stops && !snaps) {
    // Fluid: no detents at all, just a second, softer track for the flywheel.
    out.push(`<circle class="fr-flow" r="${RING_R - 5}"/>`);
  }

  return out.join('');
}

/** One-line description of the physics, generated from the numbers. */
export function feelSummary(p: FeelProfile): string {
  const { detents, stops, spring, accents = [], snaps } = p.physics;
  if (snaps?.length) return `${snaps.length} snap points, smooth between`;
  if (stops && spring) return `Returns to 0°, ±${stops[1]}° of travel`;
  if (stops) return `Hard stops at ±${stops[1]}°${accents.length ? ', a bump at center' : ''}`;
  if (detents)
    return `${detents} detents, ${(360 / detents).toFixed(1)}° apart${accents.length ? ', heavy at noon' : ''}`;
  return 'No detents, damped glide';
}

/** The shortest honest readout, for option cards. */
export function feelShort(p: FeelProfile): string {
  const { detents, stops, spring, snaps } = p.physics;
  if (snaps?.length) return `${snaps.length} snap points`;
  if (stops && spring) return `Springs back, ±${stops[1]}°`;
  if (stops) return `Stops at ±${stops[1]}°`;
  if (detents) return `${detents} detents`;
  return 'No detents';
}
