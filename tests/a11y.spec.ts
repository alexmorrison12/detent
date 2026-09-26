/**
 * axe-core on the pages that carry the funnel. Fails on serious or critical
 * WCAG 2.x A/AA (including 2.2) violations. Runs with reduced motion so
 * contrast is measured on finished states, not mid-transition frames.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { KEY_PAGES, rel } from './routes';
import { exercise } from './helpers';

test.use({ reducedMotion: 'reduce' });

for (const route of KEY_PAGES) {
  test(`${route} has no serious accessibility violations`, async ({ page }) => {
    const res = await page.goto(rel(route));
    expect(res?.status(), `HTTP status for ${route}`).toBe(200);
    await exercise(page);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    const summary = blocking
      .map(
        (v) =>
          `${v.impact} ${v.id}: ${v.help}\n    ${v.nodes
            .slice(0, 4)
            .map((n) => n.target.join(' '))
            .join('\n    ')}`,
      )
      .join('\n');
    expect(blocking, summary).toEqual([]);
  });
}
