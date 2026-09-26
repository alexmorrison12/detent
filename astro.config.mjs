// @ts-check
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// GitHub Pages project site: https://<user>.github.io/<repo>/
// Override both for a custom domain: SITE_URL=https://detent.example SITE_BASE=/
const site = process.env.SITE_URL ?? 'https://alexmorrison12.github.io';
const base = process.env.SITE_BASE ?? '/detent';
const outDir = fileURLToPath(new URL('./dist/', import.meta.url));

/**
 * Pages that opt out of indexing stay out of the sitemap too. The
 * <meta name="robots" content="noindex"> tag (BaseLayout's `noindex` prop) is
 * the real control: on a GitHub Pages project site robots.txt is served at
 * /detent/robots.txt, and crawlers only read the host-root /robots.txt, so
 * its rules only apply on a custom domain (SITE_BASE=/).
 */
/** @param {string} page absolute page URL */
function indexable(page) {
  if (/\/(render|launch-plan|og)\//.test(page)) return false;
  const path = new URL(page).pathname.slice(base.replace(/\/$/, '').length);
  try {
    const html = readFileSync(join(outDir, path, 'index.html'), 'utf8');
    return !/<meta name="?robots"? content="?noindex/i.test(html);
  } catch {
    return true;
  }
}

/**
 * Astro emits one module script per component, and each pulls shared chunks
 * (sound, cart, analytics, storage...) that the browser only discovers after
 * parsing the entry: two or three round trips before anything runs. This
 * adds <link rel="modulepreload"> for every chunk a page's entry scripts
 * import statically, placed just before the first entry script so they're
 * requested with the entries, not ahead of the font and hero image.
 * Dynamic import() targets (three.js, heavy demos) are left lazy.
 */
function modulePreload() {
  return {
    name: 'detent:modulepreload',
    hooks: {
      /** @param {{ dir: URL }} options */
      'astro:build:done': ({ dir }) => {
        const root = fileURLToPath(dir);
        const prefix = `${base.replace(/\/$/, '')}/`;
        /** @type {Map<string, string[]>} */
        const cache = new Map();
        /** @param {string} file absolute path of a built chunk */
        const imports = (file) => {
          if (!cache.has(file)) {
            let code = '';
            try {
              code = readFileSync(file, 'utf8');
            } catch {
              /* not a local chunk */
            }
            const found = [...code.matchAll(/(?:\bfrom|\bimport)\s*["'](\.{1,2}\/[^"']+\.js)["']/g)].map((m) =>
              resolve(dirname(file), m[1]),
            );
            cache.set(file, found);
          }
          return cache.get(file) ?? [];
        };
        /** @type {(d: string) => string[]} */
        const walk = (d) =>
          readdirSync(d, { withFileTypes: true }).flatMap((e) =>
            e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith('.html') ? [join(d, e.name)] : [],
          );
        for (const page of walk(root)) {
          let html = readFileSync(page, 'utf8');
          const entries = [...html.matchAll(/<script type="module" src="([^"]+\.js)"/g)]
            .map((m) => m[1])
            .filter((src) => src.startsWith(prefix));
          if (!entries.length) continue;
          const toFile = (/** @type {string} */ src) => join(root, src.slice(prefix.length));
          const seen = new Set(entries.map(toFile));
          const deps = new Set();
          const queue = [...seen];
          while (queue.length) {
            for (const dep of imports(/** @type {string} */ (queue.pop()))) {
              if (seen.has(dep)) continue;
              seen.add(dep);
              deps.add(dep);
              queue.push(dep);
            }
          }
          if (!deps.size) continue;
          const links = [...deps]
            .map((f) => `<link rel="modulepreload" href="${prefix}${relative(root, f).split('\\').join('/')}">`)
            .join('');
          const at = html.indexOf('<script type="module" src="');
          html = html.slice(0, at) + links + html.slice(at);
          writeFileSync(page, html);
        }
      },
    },
  };
}

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  compressHTML: true,
  // Speculation Rules (in BaseLayout) handle prefetch/prerender instead.
  prefetch: false,
  build: {
    format: 'directory',
    inlineStylesheets: 'auto',
  },
  integrations: [sitemap({ filter: indexable }), modulePreload()],
  vite: {
    build: { target: 'es2022' },
  },
});
