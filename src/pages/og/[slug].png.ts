/**
 * One 1200×630 social card per OG_PAGES entry, rendered at build time.
 * Pages reference them with ogImage={ogPath('<slug>')}.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { OG_PAGES } from '@/config/og';
import { renderCard } from '@/lib/og/card';

export const getStaticPaths: GetStaticPaths = () =>
  Object.keys(OG_PAGES).map((slug) => ({ params: { slug } }));

export const GET: APIRoute = async ({ params }) => {
  const png = await renderCard(String(params.slug));
  return new Response(png as BodyInit, {
    headers: { 'Content-Type': 'image/png' },
  });
};
