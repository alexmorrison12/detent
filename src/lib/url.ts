/**
 * Base-aware URLs. The site is served from a sub-path on GitHub Pages
 * (e.g. /detent/), so NEVER hard-code "/shop/" in an href or src.
 *
 *   url('/shop/')          -> '/detent/shop/'
 *   url('/shop/#finishes') -> '/detent/shop/#finishes'
 *   url('renders/raw.avif')-> '/detent/renders/raw.avif'
 *   url('https://x.com')   -> 'https://x.com' (absolute URLs pass through)
 */
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');

export function url(path = '/'): string {
  if (/^([a-z]+:|#|\/\/)/i.test(path)) return path;
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${BASE}${clean}` || '/';
}

/** Absolute URL for canonical/OG tags. */
export function absoluteUrl(path: string, site: URL | string | undefined): string {
  return new URL(url(path), site ?? 'http://localhost:4321').toString();
}

/** Strip the base from a pathname (for active-nav matching). */
export function stripBase(pathname: string): string {
  return BASE && pathname.startsWith(BASE) ? pathname.slice(BASE.length) || '/' : pathname;
}
