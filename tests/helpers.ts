import type { Page } from '@playwright/test';

/** Collect console errors and uncaught exceptions for the life of the page. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const where = msg.location()?.url;
    errors.push(`console: ${msg.text()}${where ? ` (${where})` : ''}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req) => {
    const failure = req.failure()?.errorText ?? '';
    // Navigations away and aborted prefetches are not failures of the page.
    if (/ERR_ABORTED|NS_BINDING_ABORTED/.test(failure)) return;
    errors.push(`requestfailed: ${req.url()} ${failure}`);
  });
  return errors;
}

/**
 * Walk the page top to bottom so IntersectionObserver- and idle-loaded code
 * (dials, demos, games) actually boots before we look for errors.
 */
export async function exercise(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const step = Math.max(400, Math.round(window.innerHeight * 0.8));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState('networkidle').catch(() => {});
}

/** Map an absolute URL on the production site to the local preview server. */
export function toLocal(absolute: string, baseURL: string): string {
  const u = new URL(absolute);
  return new URL(u.pathname + u.search, baseURL).toString();
}
