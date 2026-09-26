import { defineConfig, devices } from '@playwright/test';

/**
 * Tests run against the built site served by `astro preview`, so they see
 * exactly what GitHub Pages will serve. Build first:
 *
 *   npm run build && npm run test
 *
 * PREVIEW_PORT picks the port; SITE_BASE must match the build's base.
 */
const PORT = Number(process.env.PREVIEW_PORT ?? 4399);
const BASE_PATH = `${(process.env.SITE_BASE ?? '/detent').replace(/\/+$/, '')}/`;
export const BASE = `http://localhost:${PORT}${BASE_PATH}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // --ignore-lock: a dev/preview server someone already has open must not block the test server.
    command: `npx astro preview --port ${PORT} --ignore-lock`,
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
