/**
 * Web app manifest, generated so every path follows the configured base
 * (/detent/ on GitHub Pages, / on a custom domain) and the name, colors and
 * shortcuts follow src/config.
 */
import type { APIRoute } from 'astro';
import { SITE, FOOTER_NAV } from '@/config/site';
import { OG_PAGES } from '@/config/og';
import { url } from '@/lib/url';
import { ICONS, type IconId } from '@/lib/og/icon';

/** Label from the footer nav, or the page's social-card kicker when it isn't in the nav. */
const label = (href: string, og: keyof typeof OG_PAGES) =>
  FOOTER_NAV.flatMap((c) => c.items).find((i) => i.href === href)?.label ?? OG_PAGES[og].kicker;

export const GET: APIRoute = () => {
  const icon = (id: IconId, purpose: 'any' | 'maskable') => ({
    src: url(`/${id}.png`),
    sizes: `${ICONS[id].size}x${ICONS[id].size}`,
    type: 'image/png',
    purpose,
  });

  const shortcuts = (
    [
      ['/profiles/', 'profiles'],
      ['/crack/', 'crack'],
      ['/daily/', 'daily'],
      ['/shop/', 'shop'],
    ] as const
  ).map(([href, og]) => ({ name: label(href, og), url: url(href) }));

  const manifest = {
    id: url('/'),
    name: SITE.product,
    short_name: SITE.name,
    description: SITE.description,
    lang: SITE.lang,
    dir: 'ltr',
    start_url: url('/'),
    scope: url('/'),
    display: 'standalone',
    orientation: 'any',
    background_color: SITE.themeColor,
    theme_color: SITE.themeColor,
    categories: ['shopping', 'productivity', 'music', 'photo'],
    icons: [
      { src: url('/favicon.svg'), sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      icon('icon-192', 'any'),
      icon('icon-512', 'any'),
      icon('icon-maskable-512', 'maskable'),
    ],
    shortcuts,
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' },
  });
};
