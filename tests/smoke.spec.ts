/**
 * Every route: served with 200, one h1, a real title and description, a
 * canonical URL, a social card that exists, and no errors in the console
 * after the page has been scrolled end to end.
 */
import { expect, test } from '@playwright/test';
import { ROUTES, rel } from './routes';
import { exercise, toLocal, watchErrors } from './helpers';

for (const route of ROUTES) {
  test(`${route} renders cleanly`, async ({ page, baseURL }) => {
    const errors = watchErrors(page);
    const res = await page.goto(rel(route), { waitUntil: 'load' });
    expect(res?.status(), `HTTP status for ${route}`).toBe(200);

    await expect(page.locator('h1'), 'exactly one h1').toHaveCount(1);
    await expect(page.locator('h1')).not.toHaveText(/^\s*$/);
    expect((await page.title()).trim(), 'document title').not.toBe('');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /\S/);
    // Indexable pages declare a canonical URL; noindex pages deliberately don't.
    const noindex = await page.locator('meta[name="robots"][content*="noindex"]').count();
    if (noindex) await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    else await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /^https?:\/\//);

    const og = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(og, 'og:image').toBeTruthy();
    const card = await page.request.get(toLocal(og!, baseURL!));
    expect(card.status(), `social card ${og}`).toBe(200);
    expect(card.headers()['content-type']).toContain('image/png');

    await exercise(page);
    expect(errors, `console/page errors on ${route}`).toEqual([]);
  });
}

test('unknown paths get the 404 page', async ({ page }) => {
  const errors = watchErrors(page);
  const res = await page.goto('this-detent-does-not-exist/');
  expect(res?.status()).toBe(404);
  await expect(page.locator('h1')).toHaveCount(1);
  expect((await page.title()).trim()).not.toBe('');
  // A dead end should still lead somewhere.
  await expect(page.locator('main a[href]').first()).toBeVisible();
  // The only acceptable error is the 404 response itself.
  expect(errors.filter((e) => !/404/.test(e))).toEqual([]);
});
