/**
 * Home-screen and install icons, rendered at build time from the same
 * drawing as the favicon: /apple-touch-icon.png, /icon-192.png,
 * /icon-512.png and /icon-maskable-512.png (see manifest.webmanifest).
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { ICONS, renderIcon, type IconId } from '@/lib/og/icon';

export const getStaticPaths: GetStaticPaths = () =>
  (Object.keys(ICONS) as IconId[]).map((icon) => ({ params: { icon } }));

export const GET: APIRoute = async ({ params }) => {
  const png = await renderIcon(params.icon as IconId);
  return new Response(png as BodyInit, { headers: { 'Content-Type': 'image/png' } });
};
