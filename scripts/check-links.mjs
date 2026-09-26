#!/usr/bin/env node
/**
 * Internal link check for the built site (no dependencies, no network).
 *
 *   npm run build && npm run check:links
 *   node scripts/check-links.mjs [--dist dist] [--anchors=warn] [--verbose]
 *
 * Crawls every HTML file in dist/ and collects href, src, srcset, poster,
 * action, canonical and og:image/twitter:image URLs; every url() in built
 * CSS; and every same-site absolute URL in text feeds (llms.txt,
 * products.json, robots.txt, sitemaps, the web manifest). Each internal
 * target must exist in dist/.
 *
 * Fails on:
 *   - a target file that doesn't exist
 *   - a root-relative URL that skips the base ("/shop/" instead of
 *     "/detent/shop/"): the classic GitHub Pages sub-path bug
 *   - a #fragment that no element on the target page has as its id
 *     (downgrade to warnings with --anchors=warn)
 * Warns on a page link without its trailing slash (Pages redirects it).
 *
 * Site and base come from astro.config.mjs, so SITE_URL/SITE_BASE set for
 * the build apply here too.
 */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, d) => {
  const eq = args.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.split('=')[1];
  const i = args.indexOf(`--${name}`);
  return i > -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};
const dist = path.resolve(root, opt('dist', 'dist'));
const anchorsLevel = opt('anchors', 'error');
const verbose = args.includes('--verbose');

const { default: config } = await import(path.join(root, 'astro.config.mjs'));
const site = new URL(config.site ?? 'http://localhost/');
const base = String(config.base ?? '/').replace(/\/+$/, ''); // '' or '/detent'

if (!existsSync(dist)) {
  console.error(`check-links: ${path.relative(root, dist)}/ not found. Run the build first.`);
  process.exit(2);
}

/* ---------------------------------------------------------------- helpers */

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

const posix = (p) => p.split(path.sep).join('/');
const files = (await walk(dist)).map((f) => posix(path.relative(dist, f)));
const fileSet = new Set(files);

const decode = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));

/** URL path a file is served at, e.g. 'shop/index.html' -> '/detent/shop/'. */
const servedPath = (rel) => `${base}/${rel.replace(/(^|\/)index\.html$/, '$1')}`;

const errors = [];
const warnings = [];
let checked = 0;
let external = 0;

function report(list, kind, target, from) {
  let item = list.find((e) => e.kind === kind && e.target === target);
  if (!item) list.push((item = { kind, target, from: new Set() }));
  item.from.add(from);
}

/** Resolve a site path (with base) to a dist file, or null. */
function resolveFile(pathname) {
  let rel = decodeURIComponent(pathname.slice(base.length)).replace(/^\/+/, '');
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  if (fileSet.has(rel)) return { rel };
  if (fileSet.has(`${rel}/index.html`)) return { rel: `${rel}/index.html`, noSlash: true };
  return null;
}

const ids = new Map(); // rel -> Set of ids
const pending = []; // anchor checks, run after every page's ids are known

const SKIP = /^(mailto|tel|sms|javascript|data|blob|about):/i;

/**
 * Check one reference. `fromPath` is the served path of the referring file
 * (used to resolve relative URLs); `from` is the label used in reports.
 */
function check(ref, fromPath, from, { anchors = true } = {}) {
  ref = ref.trim();
  if (!ref || SKIP.test(ref)) return;
  checked++;

  if (ref.startsWith('#')) {
    if (anchors) pending.push({ rel: fromRel(fromPath), hash: ref.slice(1), from, ref });
    return;
  }

  let u;
  try {
    u = new URL(ref, new URL(fromPath, site));
  } catch {
    report(errors, 'unparseable URL', ref, from);
    return;
  }

  if (u.origin !== site.origin) {
    external++;
    return;
  }

  const isRootRelative = ref.startsWith('/') && !ref.startsWith('//');
  const inBase = base === '' || u.pathname === base || u.pathname.startsWith(`${base}/`);
  if (!inBase) {
    report(
      errors,
      isRootRelative ? 'root-relative URL skips the base' : 'same-site URL outside the base',
      ref,
      from,
    );
    return;
  }

  const hit = resolveFile(u.pathname === base ? `${base}/` : u.pathname);
  if (!hit) {
    report(errors, 'missing target', u.pathname, from);
    return;
  }
  if (hit.noSlash)
    report(warnings, 'page link without trailing slash (Pages will redirect)', u.pathname, from);
  if (anchors && u.hash && hit.rel.endsWith('.html'))
    pending.push({ rel: hit.rel, hash: u.hash.slice(1), from, ref });
}

function fromRel(servedFrom) {
  return resolveFile(servedFrom)?.rel ?? '';
}

/* ------------------------------------------------------------------- HTML */

const TAG = /<([a-zA-Z][\w:-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
const ATTR = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const META_URLS = new Set([
  'og:image',
  'og:image:url',
  'og:image:secure_url',
  'og:url',
  'twitter:image',
  'og:audio',
  'og:video',
]);

const html = files.filter((f) => f.endsWith('.html'));
for (const rel of html) {
  const raw = await readFile(path.join(dist, rel), 'utf8');
  // Script/style bodies and comments are not markup; keep the tags themselves.
  const markup = raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(<script\b[^>]*>)[\s\S]*?(<\/script>)/gi, '$1$2')
    .replace(/(<style\b[^>]*>)[\s\S]*?(<\/style>)/gi, '$1$2');
  const from = servedPath(rel);
  const pageIds = new Set();
  ids.set(rel, pageIds);

  for (const [, tagName, attrText] of markup.matchAll(TAG)) {
    const tag = tagName.toLowerCase();
    const attrs = {};
    for (const [, name, a, b, c] of attrText.matchAll(ATTR))
      attrs[name.toLowerCase()] = decode(a ?? b ?? c ?? '');
    if (attrs.id) pageIds.add(attrs.id);
    if (tag === 'a' && attrs.name) pageIds.add(attrs.name);

    if (tag === 'meta') {
      const key = (attrs.property ?? attrs.name ?? '').toLowerCase();
      if (META_URLS.has(key) && attrs.content) check(attrs.content, from, from);
      continue;
    }
    // SVG <use href="#…"> and similar are in-document references, not links.
    if (
      ['use', 'image', 'feimage', 'textpath', 'mpath'].includes(tag) &&
      attrs.href?.startsWith('#')
    )
      continue;

    for (const name of ['href', 'src', 'poster', 'action', 'data', 'xlink:href']) {
      if (name === 'data' && tag !== 'object') continue;
      if (attrs[name] !== undefined)
        check(attrs[name], from, from, { anchors: tag === 'a' || tag === 'area' });
    }
    for (const name of ['srcset', 'imagesrcset']) {
      if (!attrs[name]) continue;
      for (const candidate of attrs[name].split(/,\s+/))
        check(candidate.trim().split(/\s+/)[0] ?? '', from, from);
    }
  }
}

/* -------------------------------------------------------------------- CSS */

for (const rel of files.filter((f) => f.endsWith('.css'))) {
  const css = await readFile(path.join(dist, rel), 'utf8');
  const from = servedPath(rel);
  for (const [, a, b, c] of css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/g)) {
    const ref = a ?? b ?? c ?? '';
    if (!ref.startsWith('#')) check(ref, from, from, { anchors: false });
  }
}

/* --------------------------------------------------- feeds and manifests */

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ABS = new RegExp(`${escapeRe(site.origin)}[^\\s"'<>)\\]]*`, 'g');
for (const rel of files.filter((f) => /\.(txt|json|xml|webmanifest)$/.test(f))) {
  const text = await readFile(path.join(dist, rel), 'utf8');
  const from = servedPath(rel);
  // JSON-LD @ids (…/#org) are identifiers, not anchors, so fragments aren't checked here.
  for (const [m] of text.matchAll(ABS))
    check(m.replace(/[.,;:]+$/, ''), from, from, { anchors: false });
  if (rel.endsWith('.webmanifest')) {
    const walkJson = (v) => {
      if (typeof v === 'string' && v.startsWith('/')) check(v, from, from, { anchors: false });
      else if (Array.isArray(v)) v.forEach(walkJson);
      else if (v && typeof v === 'object') Object.values(v).forEach(walkJson);
    };
    walkJson(JSON.parse(text));
  }
}

/* ---------------------------------------------------------------- anchors */

const isAnchor = /^[A-Za-z][\w:-]*$/; // skip payload fragments like #v1.eJx… or :~:text=
for (const { rel, hash, from, ref } of pending) {
  if (!hash || hash === 'top' || !isAnchor.test(hash)) continue;
  if (ids.get(rel)?.has(hash)) continue;
  report(anchorsLevel === 'warn' ? warnings : errors, `no element with id="${hash}"`, ref, from);
}

/* ----------------------------------------------------------------- report */

const print = (list, label) => {
  for (const item of list) {
    const from = [...item.from];
    const shown = verbose ? from : from.slice(0, 3);
    const more = from.length - shown.length;
    console.log(`  ${label} ${item.kind}: ${item.target}`);
    console.log(`      from ${shown.join(', ')}${more > 0 ? ` and ${more} more` : ''}`);
  }
};

console.log(
  `check-links: ${html.length} pages, ${files.length} files, ${checked} references (${external} external, not fetched). Base: "${base || '/'}".`,
);
if (warnings.length) {
  console.log(`\n${warnings.length} warning${warnings.length === 1 ? '' : 's'}:`);
  print(warnings, '~');
}
if (errors.length) {
  console.log(`\n${errors.length} broken target${errors.length === 1 ? '' : 's'}:`);
  print(errors, '✗');
  process.exit(1);
}
console.log('\nAll internal links resolve.');
