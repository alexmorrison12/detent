/**
 * Profile JSON: the plain file the SDK, the companion app and the dial read.
 * Pretty-printed with short arrays kept on one line, plus a tiny highlighter
 * for the on-page view. Pure; used at build time and at runtime.
 */
import type { ProfileId } from '@/data/product';
import type { FeelPhysics } from './model';

export const PROFILE_FORMAT = 'detent.profile/1';

export interface ProfileDoc {
  id?: string;
  name: string;
  author?: string;
  app?: string;
  base: ProfileId;
  color: string;
  physics: FeelPhysics;
}

const lit = (v: unknown) => (Array.isArray(v) ? `[${v.map((x) => JSON.stringify(x)).join(', ')}]` : JSON.stringify(v));

export function profileJson(doc: ProfileDoc): string {
  const p = doc.physics;
  const top: [string, unknown][] = [
    ['format', PROFILE_FORMAT],
    ...(doc.id ? ([['id', doc.id]] as [string, unknown][]) : []),
    ['name', doc.name],
    ...(doc.author ? ([['author', doc.author]] as [string, unknown][]) : []),
    ...(doc.app ? ([['app', doc.app]] as [string, unknown][]) : []),
    ['base', doc.base],
    ['color', doc.color],
  ];
  const physics: [string, unknown][] = [
    ['detents', p.detents],
    ['strength', p.strength],
    ['damping', p.damping],
    ['spring', p.spring],
    ['stops', p.stops],
    ['accents', p.accents ?? []],
    ['snaps', p.snaps ?? []],
  ];
  const lines = [
    '{',
    ...top.map(([k, v]) => `  ${JSON.stringify(k)}: ${lit(v)},`),
    '  "physics": {',
    ...physics.map(([k, v], i) => `    ${JSON.stringify(k)}: ${lit(v)}${i < physics.length - 1 ? ',' : ''}`),
    '  }',
    '}',
  ];
  return lines.join('\n');
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Highlighted HTML for a JSON string (keys, strings, numbers, literals). */
export function highlightJson(json: string): string {
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b/g;
  let out = '';
  let last = 0;
  for (let m = re.exec(json); m; m = re.exec(json)) {
    out += escapeHtml(json.slice(last, m.index));
    if (m[1]) out += m[2] ? `<span class="j-k">${escapeHtml(m[1])}</span>${m[2]}` : `<span class="j-s">${escapeHtml(m[1])}</span>`;
    else if (m[3]) out += `<span class="j-n">${m[3]}</span>`;
    else if (m[4]) out += `<span class="j-l">${m[4]}</span>`;
    last = re.lastIndex;
  }
  return out + escapeHtml(json.slice(last));
}

/** A safe file name: "hunk-by-hunk.detent.json". */
export function profileFileName(name: string, ext = 'detent.json'): string {
  const slug =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 40) || 'feel';
  return `${slug}.${ext}`;
}
