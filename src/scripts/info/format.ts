/**
 * Small formatting helpers shared by the info pages (server and client).
 */

/**
 * Split a spec value into prose and readout segments so numbers with units
 * ("Ø 72 mm", "0.022°", "2,000 mAh", "466 × 466") can be set in mono while the
 * words around them stay in Archivo. Numbers glued to a word or hyphen
 * ("Apache-2.0", "USB-C") are left alone.
 */
const READOUT =
  /(?<![\w.-])(?:Ø\s?)?\d(?:[\d,]*\d)?(?:\.\d+)?(?:\s?×\s?\d+)?(?:\+|″|°|%)?(?:-(?:T\d+|bit|LED|day))?(?:\s?(?:mm|mN·m|mAh|kHz|Hz|ms|g|hours|years|m)(?![\w·]))?/g;

export interface Segment {
  text: string;
  readout: boolean;
}

export function readoutSegments(value: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of value.matchAll(READOUT)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: value.slice(last, i), readout: false });
    out.push({ text: m[0].replace(/^Ø\s/, 'Ø'), readout: true });
    last = i + m[0].length;
  }
  if (last < value.length) out.push({ text: value.slice(last), readout: false });
  return out;
}

/** "2026-09-22" -> "Sep 22, 2026" (UTC, so build and browser agree). */
export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }): string {
  const d = new Date(iso.length === 7 ? `${iso}-01T00:00:00Z` : `${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
}

/** OKLCH -> sRGB hex (gamut-clipped). For showing hex next to brand tokens. */
export function oklchToHex([L, C, h]: [number, number, number]): string {
  const hr = (h * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return (
    '#' +
    rgb
      .map((x) => {
        const c = Math.min(1, Math.max(0, x));
        const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
        return Math.round(v * 255)
          .toString(16)
          .padStart(2, '0');
      })
      .join('')
  );
}

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
/** 6 -> "six"; numbers above twelve stay numerals. */
export const numberWord = (n: number, capital = false): string => {
  const w = WORDS[n] ?? n.toLocaleString('en-US');
  return capital ? w.charAt(0).toUpperCase() + w.slice(1) : w;
};
