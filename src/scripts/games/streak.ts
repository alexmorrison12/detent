/**
 * Streaks for the daily games, with one free freeze per week: miss a single
 * day and the streak carries on, once per Monday-to-Sunday week. Nothing here
 * is framed as a loss; a broken streak simply starts again at 1.
 */
import { weekOf } from './day';

export interface StreakState {
  current: number;
  best: number;
  /** Last UTC epoch day that counted. */
  last: number | null;
  /** Epoch days that were bridged by a freeze. */
  freezes: number[];
}

export const emptyStreak = (): StreakState => ({ current: 0, best: 0, last: null, freezes: [] });

const freezeUsedInWeek = (s: StreakState, week: number) =>
  s.freezes.some((d) => weekOf(d) === week);

/** Record today as played. Returns the new state and whether a freeze bridged a gap. */
export function recordDay(prev: StreakState, day: number): { state: StreakState; froze: boolean } {
  const s: StreakState = { ...prev, freezes: prev.freezes.slice(-8) };
  if (s.last === day) return { state: s, froze: false };
  let froze = false;
  if (s.last === day - 1) s.current += 1;
  else if (s.last === day - 2 && !freezeUsedInWeek(s, weekOf(day - 1))) {
    s.current += 1;
    s.freezes.push(day - 1);
    froze = true;
  } else s.current = 1;
  s.best = Math.max(s.best, s.current);
  s.last = day;
  return { state: s, froze };
}

/** The streak as it stands today (still alive if today or a freezable gap can continue it). */
export function liveStreak(s: StreakState, today: number): number {
  if (s.last === null) return 0;
  if (s.last >= today - 1) return s.current;
  if (s.last === today - 2 && !freezeUsedInWeek(s, weekOf(today - 1))) return s.current;
  return 0;
}

/** Is this week's freeze still unused? */
export const freezeReady = (s: StreakState, today: number): boolean =>
  !freezeUsedInWeek(s, weekOf(today));
