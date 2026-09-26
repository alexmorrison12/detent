/**
 * The machine-facing surface: social cards, icons, manifest, robots,
 * llms.txt and the product catalog. These are what crawlers, chat apps and
 * shopping agents see instead of the page.
 */
import { expect, test } from '@playwright/test';
import { toLocal } from './helpers';

test.describe.configure({ mode: 'parallel' });
// These requests don't render anything; one browser project is enough.
test.skip(({ isMobile }) => isMobile, 'desktop project only');

/** Width and height from a PNG's IHDR chunk. */
function pngSize(buf: Buffer): { width: number; height: number } {
  expect(buf.subarray(1, 4).toString('ascii'), 'PNG signature').toBe('PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test('social cards are 1200×630 PNGs under 300 KB', async ({ request }) => {
  const home = await request.get('');
  const html = await home.text();
  const og = html.match(/property="og:image" content="([^"]+)"/)?.[1];
  expect(og).toBeTruthy();
  for (const slug of ['default', 'home', 'shop', 'specs', 'reserve', '404']) {
    const res = await request.get(`og/${slug}.png`);
    expect(res.status(), slug).toBe(200);
    const body = await res.body();
    expect(pngSize(body), slug).toEqual({ width: 1200, height: 630 });
    expect(body.byteLength, `${slug} size`).toBeLessThan(300_000);
  }
});

test('manifest: base-aware paths and icons that exist at their declared sizes', async ({
  request,
  baseURL,
}) => {
  const res = await request.get('manifest.webmanifest');
  expect(res.status()).toBe(200);
  const manifest = await res.json();
  const base = new URL(baseURL!).pathname;
  expect(manifest.start_url).toBe(base);
  expect(manifest.scope).toBe(base);
  expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true);
  for (const icon of manifest.icons as { src: string; sizes: string; type: string }[]) {
    expect(icon.src.startsWith(base), icon.src).toBe(true);
    const file = await request.get(new URL(icon.src, baseURL).toString());
    expect(file.status(), icon.src).toBe(200);
    if (icon.type === 'image/png') {
      const [w, h] = icon.sizes.split('x').map(Number);
      expect(pngSize(await file.body()), icon.src).toEqual({ width: w, height: h });
    }
  }
  const touch = await request.get('apple-touch-icon.png');
  expect(pngSize(await touch.body())).toEqual({ width: 180, height: 180 });
});

test('robots.txt points at the sitemap and the agent feeds', async ({ request, baseURL }) => {
  const text = await (await request.get('robots.txt')).text();
  const sitemap = text.match(/^Sitemap:\s*(\S+)/m)?.[1];
  expect(sitemap).toBeTruthy();
  expect((await request.get(toLocal(sitemap!, baseURL!))).status()).toBe(200);
  expect(text).toContain('llms.txt');
  expect(text).toContain('products.json');
});

test('llms.txt follows the llmstxt.org shape', async ({ request }) => {
  const res = await request.get('llms.txt');
  expect(res.status()).toBe(200);
  const text = await res.text();
  const lines = text.split('\n');
  expect(lines[0]).toMatch(/^# \S/);
  expect(text).toMatch(/^> \S/m);
  expect(text).toMatch(/^## /m);
  // Facts come before the first H2; nothing between H1 and it uses headings.
  const firstH2 = lines.findIndex((l) => l.startsWith('## '));
  expect(lines.slice(1, firstH2).some((l) => /^#{1,6} /.test(l))).toBe(false);
  expect(text).toMatch(/concept/i);
  expect(text).toMatch(/\$\d{3}/);
});

test('products.json: mode, concept notice, editions × finishes, schema.org without offers in demo', async ({
  request,
}) => {
  const res = await request.get('products.json');
  expect(res.status()).toBe(200);
  const catalog = await res.json();
  expect(['demo', 'live']).toContain(catalog.mode);
  expect(typeof catalog.notice).toBe('string');
  expect(catalog.products.length).toBeGreaterThan(0);

  const skus = new Set<string>();
  for (const p of catalog.products) {
    expect(p.priceUsd).toBeGreaterThan(0);
    expect(p.launchPriceUsd).toBeGreaterThan(0);
    expect(p.availability.phase).toBe(catalog.launch.phase);
    if (catalog.mode === 'demo')
      expect(p.availability.purchasable, 'nothing is purchasable in demo mode').toBe(false);
    for (const v of p.variants) {
      expect(skus.has(v.sku), `duplicate SKU ${v.sku}`).toBe(false);
      skus.add(v.sku);
      expect(v.url).toMatch(/^https?:\/\//);
      expect(v.images.length).toBeGreaterThan(0);
    }
  }

  const graph = catalog.schemaOrg['@graph'] as Record<string, unknown>[];
  expect(graph.some((n) => n['@type'] === 'ProductGroup')).toBe(true);
  const hasOffers = JSON.stringify(graph).includes('"offers"');
  expect(hasOffers, 'Offers only in live mode').toBe(catalog.mode === 'live');
});
