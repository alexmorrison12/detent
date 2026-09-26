/**
 * Achievements: a small, local discovery system. Seven things to find, one
 * concept reward for finding all of them. Stored in this browser only.
 *
 * Tracked automatically (initAchievementTracking, run site-wide by
 * <Achievements/> in BaseLayout) from the dial's public events:
 *   first-turn    any user-driven detent:tick (or 20°+ of travel)
 *   every-feel    all six PROFILES turned by hand (detent:tick / detent:change)
 *   full-circle   360° net rotation in one grab (or one keyboard focus)
 *   night-owl     a dial turned between 00:00 and 05:00 local time
 *   profile-author  window event 'detent:profile-authored' (see below)
 * Unlocked by the games directly with unlock():
 *   safecracker   the daily safe is open
 *   streak-3      three days running on either daily game
 *
 * For other features:
 * - A dial showing a custom or hidden feel (games, previews) should sit inside
 *   an element with [data-feel-custom] so it doesn't count toward every-feel.
 * - The feel library dispatches this when someone saves their own profile:
 *     window.dispatchEvent(new CustomEvent('detent:profile-authored', { detail: { name } }))
 * - Any element with [data-studio-log-open] opens the Studio log.
 * - Every unlock dispatches 'detent:achievement' on window with AchievementEventDetail.
 */
import { read, write, remove } from './storage';
import { PROFILES, type ProfileId } from '@/data/product';

export type AchievementId =
  | 'first-turn'
  | 'every-feel'
  | 'full-circle'
  | 'safecracker'
  | 'streak-3'
  | 'profile-author'
  | 'night-owl';

export interface Achievement {
  id: AchievementId;
  name: string;
  /** Shown once found. */
  found: string;
  /** Shown while still hidden. */
  hint: string;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    id: 'first-turn',
    name: 'First turn',
    found: 'You turned a Detent. Everything after this is detail.',
    hint: 'Turn any dial on the site.',
  },
  {
    id: 'every-feel',
    name: 'Tried every feel',
    found: 'Ratchet to Magnet, all six by hand.',
    hint: 'There are six feels. Turn each one.',
  },
  {
    id: 'full-circle',
    name: 'Full circle',
    found: '360° in one grab, without letting go.',
    hint: 'One grab, all the way around.',
  },
  {
    id: 'safecracker',
    name: 'Safecracker',
    found: 'Three numbers, found by feel.',
    hint: 'Somewhere on this site is a safe.',
  },
  {
    id: 'streak-3',
    name: 'Three days running',
    found: 'Back three days in a row.',
    hint: 'Come back tomorrow. And the day after.',
  },
  {
    id: 'profile-author',
    name: 'Profile author',
    found: 'You wrote a feel of your own.',
    hint: 'The feel library has a builder. Save a feel of your own.',
  },
  {
    id: 'night-owl',
    name: 'Night owl',
    found: 'Turned a dial between midnight and five.',
    hint: 'Some sessions run late.',
  },
];

export const ACHIEVEMENT_TOTAL = ACHIEVEMENTS.length;
export const ACHIEVEMENT_EVENT = 'detent:achievement';
export const PROFILE_AUTHORED_EVENT = 'detent:profile-authored';

export interface AchievementEventDetail {
  id: AchievementId;
  achievement: Achievement;
  found: number;
  total: number;
  complete: boolean;
}

export interface AchievementState {
  v: 1;
  /** id -> timestamp found */
  found: Partial<Record<AchievementId, number>>;
  /** Feels turned by hand so far (for every-feel). */
  feels: ProfileId[];
}

const KEY = 'achievements';
const empty = (): AchievementState => ({ v: 1, found: {}, feels: [] });

/** In-memory copy; dial events arrive every frame and must not hit storage each time. */
let cache: AchievementState | null = null;

export function getAchievements(): AchievementState {
  if (cache) return cache;
  const s = read<AchievementState>(KEY, empty());
  cache = s && s.v === 1 && s.found && Array.isArray(s.feels) ? s : empty();
  return cache;
}

function save(s: AchievementState) {
  cache = s;
  write(KEY, s);
}

if (typeof window !== 'undefined') {
  // Another tab found something: drop the cache and let listeners repaint.
  window.addEventListener('storage', (e) => {
    if (e.key !== `detent:${KEY}`) return;
    cache = null;
    window.dispatchEvent(new CustomEvent(ACHIEVEMENT_EVENT, { detail: null }));
  });
}

export const byAchievement = (id: AchievementId): Achievement =>
  ACHIEVEMENTS.find((a) => a.id === id)!;
export const isFound = (id: AchievementId): boolean => !!getAchievements().found[id];
export const foundCount = (s = getAchievements()): number =>
  ACHIEVEMENTS.filter((a) => s.found[a.id]).length;

/** Unlock once. Returns true when this call found it. */
export function unlock(id: AchievementId): boolean {
  if (typeof window === 'undefined') return false;
  const s = getAchievements();
  if (s.found[id]) return false;
  s.found[id] = Date.now();
  save(s);
  const found = foundCount(s);
  const detail: AchievementEventDetail = {
    id,
    achievement: byAchievement(id),
    found,
    total: ACHIEVEMENT_TOTAL,
    complete: found === ACHIEVEMENT_TOTAL,
  };
  window.dispatchEvent(new CustomEvent<AchievementEventDetail>(ACHIEVEMENT_EVENT, { detail }));
  return true;
}

/** Record a feel turned by hand; unlocks every-feel at six of six. */
export function markFeel(profile: ProfileId): number {
  const s = getAchievements();
  if (s.feels.includes(profile)) return s.feels.length;
  if (PROFILES.some((p) => p.id === profile)) {
    s.feels.push(profile);
    save(s);
  }
  if (s.feels.length >= PROFILES.length) unlock('every-feel');
  return s.feels.length;
}

export function resetAchievements(): void {
  remove(KEY);
  cache = null;
  window.dispatchEvent(new CustomEvent(ACHIEVEMENT_EVENT, { detail: null }));
}

/* -------------------------------------------------------------------------- */
/* Automatic tracking from dial events                                        */
/* -------------------------------------------------------------------------- */

interface DialLike extends HTMLElement {
  angle?: number;
}

let bound = false;

export function initAchievementTracking(): void {
  if (bound || typeof window === 'undefined') return;
  bound = true;

  let grabbed: DialLike | null = null;
  let session: { el: DialLike; start: number; travel: number; last: number } | null = null;

  const dialOf = (t: EventTarget | null): DialLike | null =>
    t instanceof HTMLElement && t.localName === 'detent-dial' ? (t as DialLike) : null;

  /** Only count turns a person made: a grab in progress, or keyboard focus. */
  const userDriven = (el: DialLike) =>
    el.hasAttribute('interactive') &&
    (grabbed === el || el === document.activeElement || el.contains(document.activeElement));

  const begin = (el: DialLike) => {
    const a = typeof el.angle === 'number' ? el.angle : 0;
    session = { el, start: a, travel: 0, last: a };
  };

  const custom = (el: Element) => !!el.closest('[data-feel-custom]');

  const nightOwl = () => {
    if (new Date().getHours() < 5) unlock('night-owl');
  };

  window.addEventListener('detent:grab', (e) => {
    const el = dialOf(e.target);
    if (!el) return;
    grabbed = el;
    begin(el);
  });
  window.addEventListener('detent:release', (e) => {
    if (dialOf(e.target) === grabbed) grabbed = null;
    if (session && session.el !== document.activeElement) session = null;
  });
  window.addEventListener('focusin', (e) => {
    const el = dialOf(e.target);
    if (el?.hasAttribute('interactive') && session?.el !== el) begin(el);
  });
  window.addEventListener('focusout', (e) => {
    if (session && dialOf(e.target) === session.el && grabbed !== session.el) session = null;
  });

  window.addEventListener('detent:tick', (e) => {
    const el = dialOf(e.target);
    if (!el || !userDriven(el)) return;
    unlock('first-turn');
    nightOwl();
    const detail = (e as CustomEvent<{ profile?: ProfileId }>).detail;
    if (detail?.profile && !custom(el)) markFeel(detail.profile);
  });

  window.addEventListener('detent:change', (e) => {
    const el = dialOf(e.target);
    if (!el || !userDriven(el)) return;
    const detail = (e as CustomEvent<{ angle: number; profile?: ProfileId }>).detail;
    if (!detail || typeof detail.angle !== 'number') return;
    if (!session || session.el !== el) begin(el);
    const s = session!;
    s.travel += Math.abs(detail.angle - s.last);
    s.last = detail.angle;
    if (s.travel >= 20) {
      unlock('first-turn');
      nightOwl();
      if (detail.profile && !custom(el)) markFeel(detail.profile);
    }
    if (Math.abs(detail.angle - s.start) >= 360) unlock('full-circle');
  });

  window.addEventListener(PROFILE_AUTHORED_EVENT, () => unlock('profile-author'));
}
