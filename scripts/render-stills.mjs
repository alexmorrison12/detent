#!/usr/bin/env node
/**
 * Product stills for Detent One, rendered from the same three.js scene the
 * site uses (src/pages/render/ harness), so every poster matches the live dial.
 *
 *   npm run render:stills                         # build the site, render everything
 *   node scripts/render-stills.mjs --no-build     # reuse dist/
 *   node scripts/render-stills.mjs --only graphite-hero,raw-top
 *
 * Output (public/renders/): {finish}-{view}.{avif,webp} at 1600 px, plus
 * {finish}-{view}-{800,480,240}.{avif,webp}, transparent background, so a 72 px
 * thumbnail never downloads a hero-sized file.
 * Finishes: raw, graphite, glacier, tally. Views: hero, top, side, front, exploded,
 * config (the shop configurator's camera, so its 3D takeover is a still-matched crossfade).
 *
 * Chromium runs headless with SwiftShader, so this works on GPU-less CI too.
 */
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'public', 'renders');
const BASE = (process.env.SITE_BASE ?? '/detent').replace(/\/+$/, '');

const FINISHES = ['raw', 'graphite', 'glacier', 'tally'];
const VIEWS = ['hero', 'top', 'side', 'front', 'exploded', 'config'];
/** Downscaled widths next to the full SIZE; DialStill's srcset lists the same set. */
const WIDTHS = [800, 480, 240];

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, d) => {
  const i = args.indexOf(`--${name}`);
  return i > -1 ? args[i + 1] : d;
};
const SIZE = Number(opt('size', 1600));
const only = opt('only', '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/* ---------------------------------- build ---------------------------------- */

if (!flag('no-build')) {
  console.log('Building the site…');
  const r = spawnSync('npx', ['astro', 'build'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
await stat(path.join(DIST, 'render', 'index.html')).catch(() => {
  console.error('dist/render/index.html is missing. Run without --no-build.');
  process.exit(1);
});

/* ------------------------------ static server ------------------------------ */

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (BASE && p.startsWith(BASE)) p = p.slice(BASE.length) || '/';
    let file = path.join(DIST, p);
    if (!file.startsWith(DIST)) throw new Error('outside dist');
    if (p.endsWith('/')) file = path.join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

/* --------------------------------- render ---------------------------------- */

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

/** Zero out nearly transparent pixels: premultiplied 8-bit storage leaves noisy colors there. */
async function cleanAlpha(png) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 3) data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0;
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
}

await mkdir(OUT, { recursive: true });
const report = [];
const jobs = FINISHES.flatMap((finish) =>
  VIEWS.map((view) => ({ finish, view, name: `${finish}-${view}` })),
).filter((j) => !only.length || only.includes(j.name));

for (const job of jobs) {
  const page = await browser.newPage({
    viewport: { width: SIZE, height: SIZE },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const q = new URLSearchParams({ finish: job.finish, camera: job.view, profile: 'ratchet' });
  const t0 = Date.now();
  await page.goto(`${origin}${BASE}/render/?${q}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__renderReady || window.__renderError, null, {
    timeout: 90_000,
  });
  const failure = await page.evaluate(() => window.__renderError);
  if (failure || errors.length) {
    console.error(`✗ ${job.name}: ${failure ?? ''} ${errors.join(' | ')}`);
    await page.close();
    process.exitCode = 1;
    continue;
  }
  const png = await page.screenshot({ omitBackground: true, type: 'png' });
  await page.close();

  const img = await cleanAlpha(png);
  const full = await img.clone().png().toBuffer();
  const outputs = [
    [`${job.name}.avif`, sharp(full).avif({ quality: 52, effort: 6 })],
    [
      `${job.name}.webp`,
      sharp(full).webp({ quality: 78, alphaQuality: 80, effort: 6, smartSubsample: true }),
    ],
  ];
  for (const w of WIDTHS.filter((x) => x < SIZE)) {
    const small = await sharp(full).resize(w, w, { kernel: 'lanczos3' }).png().toBuffer();
    // Smaller files carry fewer pixels per detail: a touch more quality keeps edges clean.
    const q = w >= 800 ? 56 : 60;
    outputs.push(
      [`${job.name}-${w}.avif`, sharp(small).avif({ quality: q, effort: 6 })],
      [
        `${job.name}-${w}.webp`,
        sharp(small).webp({ quality: q + 24, alphaQuality: 85, effort: 6, smartSubsample: true }),
      ],
    );
  }
  let bytes = 0;
  for (const [file, pipeline] of outputs) {
    const buf = await pipeline.toBuffer();
    await writeFile(path.join(OUT, file), buf);
    bytes += buf.length;
    report.push([file, buf.length]);
  }
  console.log(`✓ ${job.name}  ${(bytes / 1024).toFixed(0)} KB  ${Date.now() - t0} ms`);
}

await browser.close();
server.close();

const total = report.reduce((n, [, b]) => n + b, 0);
console.log(
  `\n${report.length} files, ${(total / 1024 / 1024).toFixed(2)} MB written to public/renders/`,
);
