/**
 * Build-time color helpers for raster output (OG cards, icons).
 *
 * resvg and satori speak sRGB hex, the design system speaks OKLCH. Rather
 * than copy hex values by hand (and drift the day someone retunes the tally
 * red), we read src/styles/tokens.css at build time and convert.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type Rgb = [number, number, number];

/** OKLCH (L 0..1, C, h degrees) -> sRGB 0..255, gamut-clipped. */
export function oklchToRgb(L: number, C: number, h: number): Rgb {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return lin.map((c) => {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.max(c, 0) ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, v)) * 255);
  }) as Rgb;
}

export const toHex = ([r, g, b]: Rgb): string =>
  `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mix two hex colors in sRGB; t = 0 gives a, t = 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return toHex(x.map((v, i) => Math.round(v + (y[i]! - v) * t)) as Rgb);
}

/** Relative luminance (WCAG). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

let cache: Record<string, string> | null = null;

/**
 * Every `--name: oklch(...)` (or var() alias) declared in tokens.css, as hex.
 * Only the palette is needed here; semantic world tokens are ignored.
 */
export function tokens(): Record<string, string> {
  if (cache) return cache;
  const css = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8');
  const raw = new Map<string, string>();
  for (const m of css.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    if (!raw.has(m[1]!)) raw.set(m[1]!, m[2]!.trim());
  }
  const out: Record<string, string> = {};
  const resolveToken = (name: string, depth = 0): string | undefined => {
    if (out[name]) return out[name];
    const v = raw.get(name);
    if (!v || depth > 4) return undefined;
    const alias = v.match(/^var\(--([a-z0-9-]+)\)$/i);
    if (alias) return (out[name] = resolveToken(alias[1]!, depth + 1)!);
    const ok = v.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/i);
    if (ok) return (out[name] = toHex(oklchToRgb(Number(ok[1]), Number(ok[2]), Number(ok[3]))));
    return undefined;
  };
  for (const name of raw.keys()) resolveToken(name);
  cache = out;
  return out;
}

/** A palette token as hex; throws if tokens.css no longer defines it. */
export function token(name: string): string {
  const v = tokens()[name];
  if (!v) throw new Error(`[og] tokens.css has no OKLCH value for --${name}`);
  return v;
}
