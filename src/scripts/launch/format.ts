/**
 * Date and number formatting for the launch funnel. Pure functions (no DOM),
 * safe in Astro frontmatter and in the browser. Dates come from
 * src/config/launch.ts as ISO strings; date-only strings are read as UTC.
 */

function toDate(iso: string): Date {
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00Z` : iso);
}

/** '2026-10-20' -> '10.20' (the campaign's date style). */
export function dotDate(iso: string): string {
  const d = toDate(iso);
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** '2026-10-20' -> 'October 20'. */
export function longDate(iso: string, withYear = false): string {
  return toDate(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  });
}

/** '2026-12-04T17:00:00Z' -> 'December 4, 17:00 UTC'. Server-rendered, then localised in the browser. */
export function utcDateTime(iso: string): string {
  const d = toDate(iso);
  const time = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  return `${longDate(iso)}, ${time} UTC`;
}

/** Browser-local version of utcDateTime, e.g. 'December 4, 9:00 AM PST'. */
export function localDateTime(iso: string): string {
  return toDate(iso).toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

export function toTime(iso: string): number {
  return toDate(iso).getTime();
}

/** '7K3Q9M2X' -> '7K3Q-9M2X'. */
export function passId(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

/** Founders serial range from the run size: 2000 -> '0001–2000'. */
export function serialRange(run: number): string {
  return `0001–${String(run).padStart(4, '0')}`;
}
