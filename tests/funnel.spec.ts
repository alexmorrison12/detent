/**
 * The moving parts of the funnel: the launch-phase switch every CTA obeys,
 * the cart, and the dial that sells the product.
 */
import { expect, test, type Page } from '@playwright/test';
import { watchErrors } from './helpers';

const phaseOf = (page: Page) => page.locator('html').getAttribute('data-phase');
/** Primary CTAs rendered by <PhaseCTA> for one phase, that a person can actually see. */
const visiblePrimary = (page: Page, phase: string) =>
  page.locator(`a[data-track-cta="${phase}:primary"]`).filter({ visible: true });

test.describe('launch phase preview', () => {
  test('?phase= swaps every CTA, persists across pages, and ?phase=reset restores the build', async ({
    page,
  }) => {
    await page.goto('');
    const built = (await phaseOf(page)) ?? 'reserve';
    const target = built === 'live' ? 'tease' : 'live';
    await expect(visiblePrimary(page, built).first()).toBeVisible();

    await page.goto(`?phase=${target}`);
    await expect(page.locator('html')).toHaveAttribute('data-phase', target);
    await expect(visiblePrimary(page, target).first()).toBeVisible();
    await expect(visiblePrimary(page, built)).toHaveCount(0);

    // Same tab session, different page, no parameter: still previewing.
    await page.goto('crack/');
    await expect(page.locator('html')).toHaveAttribute('data-phase', target);
    await expect(visiblePrimary(page, built)).toHaveCount(0);

    await page.goto('?phase=reset');
    await expect(page.locator('html')).toHaveAttribute('data-phase', built);
    await expect(visiblePrimary(page, built).first()).toBeVisible();
    await expect(visiblePrimary(page, target)).toHaveCount(0);
  });
});

test.describe('cart', () => {
  test('add from the shop, badge counts, drawer opens, remove empties it', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('shop/?phase=live');
    await expect(page.locator('html')).toHaveAttribute('data-phase', 'live');

    const add = page
      .getByRole('button', { name: /add to (cart|bag)/i })
      .filter({ visible: true })
      .first();
    await expect(add).toBeVisible();
    await add.click();

    // The header's cart button names its count; the badge shows it.
    await expect(page.getByRole('button', { name: /open cart, 1 item/i }).first()).toBeAttached();
    await expect(page.locator('[data-cart-count]').first()).toHaveText('1');

    const drawer = page.locator('#cart-drawer');
    if (!(await drawer.evaluate((d) => (d as HTMLDialogElement).open))) {
      await page.locator('[data-cart-open]').filter({ visible: true }).first().click();
    }
    await expect(drawer).toHaveAttribute('open', '');
    await expect(drawer.getByRole('heading').first()).toBeVisible();

    await drawer
      .getByRole('button', { name: /remove/i })
      .first()
      .click();
    await expect(page.locator('[data-cart-count]').first()).toBeHidden();
    await expect(page.getByRole('button', { name: /^open cart$/i }).first()).toBeAttached();

    // Survives a reload as empty, not as a ghost line.
    await page.reload();
    await expect(page.locator('[data-cart-count]').first()).toBeHidden();
    expect(errors).toEqual([]);
  });
});

test.describe('the dial', () => {
  test('the hero dial turns from the keyboard and reports it', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('');
    const dial = page.locator('main').getByRole('slider').first();
    await expect(dial).toBeAttached();

    await page.evaluate(() => {
      const w = window as unknown as { __ticks: number };
      w.__ticks = 0;
      window.addEventListener('detent:tick', () => w.__ticks++);
    });
    const reading = () =>
      dial.evaluate((el) =>
        [
          el.getAttribute('aria-valuenow'),
          el.getAttribute('aria-valuetext'),
          'value' in el ? String((el as HTMLInputElement).value) : '',
        ].join('|'),
      );

    await dial.focus();
    await expect(dial).toBeFocused();
    const before = await reading();
    await page.keyboard.press('ArrowRight');

    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __ticks: number }).__ticks))
      .toBeGreaterThan(0);
    await expect.poll(reading).not.toBe(before);
    await expect(dial).toHaveAttribute('aria-valuetext', /\S/);
    expect(errors).toEqual([]);
  });
});
