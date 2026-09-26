// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// GitHub Pages project site: https://<user>.github.io/<repo>/
// Override both for a custom domain: SITE_URL=https://detent.example SITE_BASE=/
const site = process.env.SITE_URL ?? 'https://alexmorrison12.github.io';
const base = process.env.SITE_BASE ?? '/detent';

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
  integrations: [
    sitemap({
      filter: (page) => !/\/(render|launch-plan|og)\//.test(page),
    }),
  ],
  vite: {
    build: { target: 'es2022' },
  },
});
