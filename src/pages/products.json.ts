/**
 * /products.json: the Detent catalog for shopping agents, assistants and
 * comparison tools. Editions × finishes with ids, SKUs, prices, launch
 * prices, availability for the phase this build was made for, specs,
 * policies and a schema.org graph (Offers appear only in live mode).
 *
 * The top-level "mode" field says whether any of it can be bought; in demo
 * mode "concept" is true and "notice" explains why.
 */
import type { APIRoute } from 'astro';
import { buildCatalog } from '@/lib/agent/catalog';

export const GET: APIRoute = ({ site }) =>
  new Response(JSON.stringify(buildCatalog(site), null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
