/**
 * Every public route, in the site's own path form (no base). Tests navigate
 * with rel(route) so the configured base (/detent/ or /) is applied by
 * Playwright's baseURL.
 */
export const ROUTES = [
  '/',
  '/shop/',
  '/shop/checkout/',
  '/specs/',
  '/integrations/',
  '/support/',
  '/story/',
  '/press/',
  '/changelog/',
  '/profiles/',
  '/crack/',
  '/daily/',
  '/launch-plan/',
  '/l/tease/',
  '/l/waitlist/',
  '/l/reserve/',
  '/l/launch/',
  '/for/editors/',
  '/for/musicians/',
  '/for/designers/',
  '/for/developers/',
  '/legal/privacy/',
  '/legal/terms/',
] as const;

/** Pages audited with axe: the home page, the store and every funnel step. */
export const KEY_PAGES = [
  '/',
  '/shop/',
  '/shop/checkout/',
  '/specs/',
  '/profiles/',
  '/integrations/',
  '/support/',
  '/l/tease/',
  '/l/waitlist/',
  '/l/reserve/',
  '/l/launch/',
  '/for/editors/',
  '/crack/',
  '/daily/',
] as const;

/** '/shop/' -> 'shop/' so it resolves against baseURL instead of the host root. */
export const rel = (route: string) => route.replace(/^\/+/, '');
