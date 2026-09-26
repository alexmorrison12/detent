/**
 * Day math for the daily games. Everyone gets the same puzzle on the same UTC
 * day; the seed is the UTC epoch day (whole days since 1970-01-01).
 */
export const DAY_MS = 86_400_000;

export const utcDay = (t: number = Date.now()): number => Math.floor(t / DAY_MS);

export const dayFromIso = (iso: string): number =>
  Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);

/** Puzzle #1 is the epoch day. Clamped so a skewed clock never shows #-3. */
export const puzzleNumber = (day: number, epochDay: number): number =>
  Math.max(1, day - epochDay + 1);

export const msToNextUtcDay = (t: number = Date.now()): number => (utcDay(t) + 1) * DAY_MS - t;

/** Monday-based week index for epoch days (1970-01-01 was a Thursday). */
export const weekOf = (day: number): number => Math.floor((day + 3) / 7);

const pad = (n: number) => String(n).padStart(2, '0');

/** 05:04:09 */
export function formatHMS(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** 0:42, 12:07, 1:02:33 */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/** "4 minutes 12 seconds", for screen readers. */
export function spokenClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  const parts: string[] = [];
  if (m) parts.push(`${m} minute${m === 1 ? '' : 's'}`);
  parts.push(`${r} second${r === 1 ? '' : 's'}`);
  return parts.join(' ');
}
