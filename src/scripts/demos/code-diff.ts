/**
 * The code demo's pull request: one TypeScript file, six hunks (one per
 * Magnet snap point on the knob). Hunk headers are computed from the lines,
 * so the numbers are consistent. The tokenizer runs at build time only.
 */
export type LineKind = 'ctx' | 'add' | 'del';
export interface DiffLine {
  kind: LineKind;
  text: string;
  old?: number;
  new?: number;
}
export interface Hunk {
  header: string;
  section: string;
  lines: DiffLine[];
}

export const FILE = 'src/search/client.ts';
export const PR_TITLE = 'Cancel stale search requests';

const RAW: { oldStart: number; section: string; body: string }[] = [
  {
    oldStart: 1,
    section: '',
    body: ` import { fetchResults } from './api';
+import type { Result } from './api';

-const DELAY = 300;
+const DELAY_MS = 180;
 const MIN_QUERY = 2;`,
  },
  {
    oldStart: 14,
    section: 'export function createSearch(input: HTMLInputElement) {',
    body: `   let timer: number | undefined;
+  let inflight: AbortController | undefined;

   input.addEventListener('input', () => {
     clearTimeout(timer);
-    timer = setTimeout(run, DELAY);
+    timer = window.setTimeout(run, DELAY_MS);
   });`,
  },
  {
    oldStart: 27,
    section: 'export function createSearch(input: HTMLInputElement) {',
    body: `   async function run() {
     const q = input.value.trim();
-    if (q.length < MIN_QUERY) return;
-    const results = await fetchResults(q);
-    render(results);
+    if (q.length < MIN_QUERY) return render([]);
+    inflight?.abort();
+    inflight = new AbortController();
+    try {
+      render(await fetchResults(q, { signal: inflight.signal }));
+    } catch (err) {
+      if ((err as Error).name !== 'AbortError') throw err;
+    }
   }`,
  },
  {
    oldStart: 52,
    section: '',
    body: `-function render(results: any[]) {
-  list.innerHTML = '';
+function render(results: Result[]) {
+  list.replaceChildren();
   for (const r of results) {`,
  },
  {
    oldStart: 70,
    section: 'function render(results: Result[]) {',
    body: `   list.hidden = results.length === 0;
+  status.textContent = results.length
+    ? \`\${results.length} results\`
+    : 'No matches. Try fewer words.';
 }`,
  },
  {
    oldStart: 88,
    section: '',
    body: `
-export const VERSION = '1.3.0';
+export const VERSION = '1.4.0';`,
  },
];

export const HUNKS: Hunk[] = (() => {
  let shift = 0;
  return RAW.map(({ oldStart, section, body }) => {
    let o = oldStart;
    let n = oldStart + shift;
    const newStart = n;
    const lines: DiffLine[] = body.split('\n').map((l) => {
      const sign = l[0];
      const text = l.slice(1);
      if (sign === '+') return { kind: 'add', text, new: n++ };
      if (sign === '-') return { kind: 'del', text, old: o++ };
      return { kind: 'ctx', text, old: o++, new: n++ };
    });
    const oldCount = lines.filter((l) => l.kind !== 'add').length;
    const newCount = lines.filter((l) => l.kind !== 'del').length;
    shift += newCount - oldCount;
    return {
      header: `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`,
      section,
      lines,
    };
  });
})();

export const STATS = HUNKS.flatMap((h) => h.lines).reduce(
  (s, l) => ({ add: s.add + (l.kind === 'add' ? 1 : 0), del: s.del + (l.kind === 'del' ? 1 : 0) }),
  { add: 0, del: 0 },
);

/* ---- Build-time highlighter ---------------------------------------------- */

export type TokenKind = 'kw' | 'str' | 'num' | 'com' | 'fn' | 'ty' | 'txt';
export interface Token {
  k: TokenKind;
  v: string;
}

const KEYWORDS = new Set(
  'import from type const let export function async await return if try catch throw new for of as'.split(
    ' ',
  ),
);
const TYPES = new Set(
  'number string boolean undefined any HTMLInputElement AbortController Error Result'.split(' '),
);
const RE =
  /(\/\/.*$)|('(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*")|(\b\d+(?:\.\d+)*\b)|([A-Za-z_$][\w$]*)(\s*\()?|(\s+)|([^\sA-Za-z_$\d'"`/]+|\/)/gm;

export function tokenize(line: string): Token[] {
  const out: Token[] = [];
  for (const m of line.matchAll(RE)) {
    if (m[1]) out.push({ k: 'com', v: m[1] });
    else if (m[2]) out.push({ k: 'str', v: m[2] });
    else if (m[3]) out.push({ k: 'num', v: m[3] });
    else if (m[4]) {
      const w = m[4];
      const k: TokenKind = KEYWORDS.has(w) ? 'kw' : TYPES.has(w) ? 'ty' : m[5] ? 'fn' : 'txt';
      out.push({ k, v: w });
      if (m[5]) out.push({ k: 'txt', v: m[5] });
    } else out.push({ k: 'txt', v: m[0] });
  }
  return out;
}

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * One line as highlighted HTML with no stray whitespace (the code cell is
 * white-space: pre). `prefix` is visually hidden context for screen readers.
 */
export function highlight(line: string, prefix = ''): string {
  const lead = prefix ? `<span class="visually-hidden">${escape(prefix)}: </span>` : '';
  return (
    lead +
    tokenize(line)
      .map((t) => (t.k === 'txt' ? escape(t.v) : `<span class="t-${t.k}">${escape(t.v)}</span>`))
      .join('')
  );
}
