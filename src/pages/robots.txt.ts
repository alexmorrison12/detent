/**
 * robots.txt, generated so paths and absolute URLs follow SITE_URL/SITE_BASE.
 *
 * Crawlers only read robots.txt at the host root. On a GitHub Pages project
 * site (/detent/) this file is advisory; it takes effect as soon as the site
 * moves to its own domain (SITE_BASE=/). Agents are welcome: the catalog and
 * llms.txt exist so they can read the product without scraping the canvas.
 */
import type { APIRoute } from 'astro';
import { SITE } from '@/config/site';
import { MODE } from '@/config/launch';
import { url, absoluteUrl } from '@/lib/url';

export const GET: APIRoute = ({ site }) => {
  const lines = [
    `# ${SITE.product}. ${SITE.tagline}`,
    ...(MODE === 'live' ? [] : [`# ${SITE.conceptNotice}`]),
    '',
    'User-agent: *',
    `Allow: ${url('/')}`,
    // Headless render targets for stills, and the internal launch runbook.
    `Disallow: ${url('/render/')}`,
    `Disallow: ${url('/launch-plan/')}`,
    // Demo checkout has nothing to index and should never be prerendered by bots.
    `Disallow: ${url('/shop/checkout/')}`,
    '',
    '# Machine-readable product facts for agents and assistants:',
    `#   ${absoluteUrl('/llms.txt', site)}`,
    `#   ${absoluteUrl('/products.json', site)}`,
    '',
    `Sitemap: ${absoluteUrl('/sitemap-index.xml', site)}`,
    '',
  ];
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
