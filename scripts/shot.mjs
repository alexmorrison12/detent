#!/usr/bin/env node
/**
 * Headless screenshots for visual QA.
 *
 *   node scripts/shot.mjs <url> <out-prefix> [--widths 1440,390] [--full] [--wait 1500]
 *                          [--reduced-motion] [--scroll 1200] [--dark|--light]
 *
 * Writes <out-prefix>-<width>.png for each width. WebGL works via SwiftShader.
 * Prints console errors from the page so you can catch runtime failures.
 */
import { chromium } from 'playwright';

const [url, outPrefix, ...rest] = process.argv.slice(2);
if (!url || !outPrefix) {
  console.error('usage: node scripts/shot.mjs <url> <out-prefix> [--widths 1440,390] [--full] [--wait ms] [--reduced-motion] [--scroll px]');
  process.exit(1);
}
const flag = (name) => rest.includes(`--${name}`);
const opt = (name, d) => {
  const i = rest.indexOf(`--${name}`);
  return i > -1 ? rest[i + 1] : d;
};
const widths = String(opt('widths', '1440,390')).split(',').map(Number);
const wait = Number(opt('wait', 1500));
const scroll = Number(opt('scroll', 0));

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const width of widths) {
  const height = width < 600 ? 844 : 900;
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    reducedMotion: flag('reduced-motion') ? 'reduce' : 'no-preference',
    colorScheme: flag('light') ? 'light' : 'dark',
    hasTouch: width < 600,
    isMobile: width < 600,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url, { waitUntil: 'networkidle' }).catch((e) => errors.push(`goto: ${e.message}`));
  if (scroll) await page.evaluate((y) => window.scrollTo(0, y), scroll);
  if (flag('full')) {
    // Walk the page so lazy/IO-driven content renders before a full-page capture.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });
  }
  await page.waitForTimeout(wait);
  const out = `${outPrefix}-${width}.png`;
  await page.screenshot({ path: out, fullPage: flag('full') });
  console.log(`saved ${out}${errors.length ? `\n  console errors:\n   - ${errors.join('\n   - ')}` : ''}`);
  await ctx.close();
}
await browser.close();
