/**
 * Static font files for satori (which reads WOFF/TTF/OTF, not WOFF2 or
 * variable fonts), plus a tiny WOFF metrics reader so titles can be fitted
 * and balanced before layout instead of guessed.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';

export type FontKey = 'archivo-400' | 'archivo-600' | 'archivo-800' | 'mono-400' | 'mono-500';

const FILES: Record<
  FontKey,
  { pkg: string; file: string; name: string; weight: 400 | 500 | 600 | 800 }
> = {
  'archivo-400': {
    pkg: '@fontsource/archivo',
    file: 'archivo-latin-400-normal.woff',
    name: 'Archivo',
    weight: 400,
  },
  'archivo-600': {
    pkg: '@fontsource/archivo',
    file: 'archivo-latin-600-normal.woff',
    name: 'Archivo',
    weight: 600,
  },
  'archivo-800': {
    pkg: '@fontsource/archivo',
    file: 'archivo-latin-800-normal.woff',
    name: 'Archivo',
    weight: 800,
  },
  'mono-400': {
    pkg: '@fontsource/martian-mono',
    file: 'martian-mono-latin-400-normal.woff',
    name: 'Martian Mono',
    weight: 400,
  },
  'mono-500': {
    pkg: '@fontsource/martian-mono',
    file: 'martian-mono-latin-500-normal.woff',
    name: 'Martian Mono',
    weight: 500,
  },
};

const buffers = new Map<FontKey, Buffer>();

export function fontBuffer(key: FontKey): Buffer {
  let b = buffers.get(key);
  if (!b) {
    const f = FILES[key];
    b = readFileSync(resolve(process.cwd(), 'node_modules', f.pkg, 'files', f.file));
    buffers.set(key, b);
  }
  return b;
}

/** Font list in the shape satori expects. */
export function satoriFonts() {
  return (Object.keys(FILES) as FontKey[]).map((key) => {
    const f = FILES[key];
    const buf = fontBuffer(key);
    return {
      name: f.name,
      data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
      weight: f.weight,
      style: 'normal' as const,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Metrics: advance widths from the WOFF's cmap + hmtx tables                 */
/* -------------------------------------------------------------------------- */

interface Metrics {
  unitsPerEm: number;
  advance: (codePoint: number) => number;
}

const metricsCache = new Map<FontKey, Metrics>();

function readTables(woff: Buffer): Map<string, Buffer> {
  if (woff.toString('ascii', 0, 4) !== 'wOFF') throw new Error('[og] not a WOFF 1.0 file');
  const numTables = woff.readUInt16BE(12);
  const tables = new Map<string, Buffer>();
  for (let i = 0; i < numTables; i++) {
    const o = 44 + i * 20;
    const tag = woff.toString('ascii', o, o + 4);
    const offset = woff.readUInt32BE(o + 4);
    const compLength = woff.readUInt32BE(o + 8);
    const origLength = woff.readUInt32BE(o + 12);
    const data = woff.subarray(offset, offset + compLength);
    tables.set(tag, compLength < origLength ? inflateSync(data) : Buffer.from(data));
  }
  return tables;
}

function cmapLookup(cmap: Buffer): (cp: number) => number {
  const n = cmap.readUInt16BE(2);
  let best: { format: number; off: number } | null = null;
  for (let i = 0; i < n; i++) {
    const platform = cmap.readUInt16BE(4 + i * 8);
    const encoding = cmap.readUInt16BE(6 + i * 8);
    const off = cmap.readUInt32BE(8 + i * 8);
    const format = cmap.readUInt16BE(off);
    const unicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
    if (!unicode) continue;
    if (format === 12) best = { format, off };
    else if (format === 4 && !best) best = { format, off };
  }
  if (!best) throw new Error('[og] font has no Unicode cmap');
  const { format, off } = best;
  if (format === 12) {
    const groups = cmap.readUInt32BE(off + 12);
    return (cp) => {
      for (let g = 0; g < groups; g++) {
        const o = off + 16 + g * 12;
        const start = cmap.readUInt32BE(o);
        const end = cmap.readUInt32BE(o + 4);
        if (cp >= start && cp <= end) return cmap.readUInt32BE(o + 8) + (cp - start);
      }
      return 0;
    };
  }
  const segX2 = cmap.readUInt16BE(off + 6);
  const ends = off + 14;
  const starts = ends + segX2 + 2;
  const deltas = starts + segX2;
  const ranges = deltas + segX2;
  return (cp) => {
    for (let s = 0; s < segX2; s += 2) {
      const end = cmap.readUInt16BE(ends + s);
      if (cp > end) continue;
      const start = cmap.readUInt16BE(starts + s);
      if (cp < start) return 0;
      const delta = cmap.readInt16BE(deltas + s);
      const rangeOffset = cmap.readUInt16BE(ranges + s);
      if (rangeOffset === 0) return (cp + delta) & 0xffff;
      const glyph = cmap.readUInt16BE(ranges + s + rangeOffset + (cp - start) * 2);
      return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
    }
    return 0;
  };
}

export function metrics(key: FontKey): Metrics {
  const hit = metricsCache.get(key);
  if (hit) return hit;
  const t = readTables(fontBuffer(key));
  const head = t.get('head')!;
  const hhea = t.get('hhea')!;
  const hmtx = t.get('hmtx')!;
  const unitsPerEm = head.readUInt16BE(18);
  const numberOfHMetrics = hhea.readUInt16BE(34);
  const glyphOf = cmapLookup(t.get('cmap')!);
  const m: Metrics = {
    unitsPerEm,
    advance(cp) {
      const g = glyphOf(cp);
      const i = Math.min(g, numberOfHMetrics - 1);
      return hmtx.readUInt16BE(i * 4);
    },
  };
  metricsCache.set(key, m);
  return m;
}

/** Rendered width of a string in px, including letter-spacing (em). */
export function measure(text: string, key: FontKey, size: number, trackingEm = 0): number {
  const m = metrics(key);
  let units = 0;
  let n = 0;
  for (const ch of text) {
    units += m.advance(ch.codePointAt(0)!);
    n++;
  }
  return (units / m.unitsPerEm) * size + Math.max(0, n - 1) * trackingEm * size;
}

/* -------------------------------------------------------------------------- */
/* Balanced wrapping                                                          */
/* -------------------------------------------------------------------------- */

function greedy(words: string[], fits: (line: string) => boolean): string[] | null {
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (fits(next)) line = next;
    else {
      if (!line || !fits(w)) return null; // a single word wider than the box
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Break `text` into as few lines as fit `maxWidth`, then narrow the box until
 * one more squeeze would add a line: the same idea as text-wrap: balance.
 */
export function balance(
  text: string,
  width: (line: string) => number,
  maxWidth: number,
): string[] | null {
  const words = text.split(/\s+/).filter(Boolean);
  const first = greedy(words, (l) => width(l) <= maxWidth);
  if (!first) return null;
  let lo = 0;
  let hi = maxWidth;
  let best = first;
  while (hi - lo > 2) {
    const mid = (lo + hi) / 2;
    const attempt = greedy(words, (l) => width(l) <= mid);
    if (attempt && attempt.length <= first.length) {
      best = attempt;
      hi = mid;
    } else lo = mid;
  }
  return best;
}

export interface FittedTitle {
  size: number;
  lines: string[];
}

/**
 * Largest font size (stepping down) at which `text` wraps into at most
 * `maxLines` balanced lines within `maxWidth` and `maxHeight`.
 */
export function fitTitle(
  text: string,
  opts: {
    key: FontKey;
    maxWidth: number;
    maxHeight: number;
    maxLines: number;
    min: number;
    max: number;
    tracking: number;
    leading: number;
  },
): FittedTitle {
  // 2% slack for kerning pairs the advance table doesn't know about.
  const widthAt = (size: number) => (l: string) => measure(l, opts.key, size, opts.tracking) * 1.02;
  const fits = (lines: string[] | null, size: number): lines is string[] =>
    !!lines &&
    lines.length <= opts.maxLines &&
    lines.length * size * opts.leading <= opts.maxHeight;

  let byWord: FittedTitle | null = null;
  for (let size = opts.max; size >= opts.min && !byWord; size -= 2) {
    const lines = balance(text, widthAt(size), opts.maxWidth);
    if (fits(lines, size)) byWord = { size, lines };
  }

  // Prefer breaking at phrase ends ("Get in line. / Move up.") over breaking
  // mid-phrase ("Get in / line. / Move up.") when it costs under 20% of size.
  const phrases = text.split(/(?<=[.,;:?!])\s+/).filter(Boolean);
  if (phrases.length > 1) {
    for (let size = opts.max; size >= opts.min; size -= 2) {
      const lines = greedyPhrases(phrases, widthAt(size), opts.maxWidth);
      if (fits(lines, size)) {
        if (!byWord || size >= byWord.size * 0.8) return { size, lines };
        break;
      }
    }
  }
  if (byWord) return byWord;
  const size = opts.min;
  return { size, lines: balance(text, widthAt(size), opts.maxWidth) ?? [text] };
}

function greedyPhrases(
  phrases: string[],
  width: (l: string) => number,
  maxWidth: number,
): string[] | null {
  const lines: string[] = [];
  let line = '';
  for (const p of phrases) {
    if (width(p) > maxWidth) return null;
    const next = line ? `${line} ${p}` : p;
    if (width(next) <= maxWidth) line = next;
    else {
      lines.push(line);
      line = p;
    }
  }
  if (line) lines.push(line);
  return lines;
}
