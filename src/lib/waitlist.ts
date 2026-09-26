/**
 * Waitlist + reservation adapter. Every signup form on the site goes through
 * here so behavior is identical everywhere.
 *
 * - Live: if PUBLIC_WAITLIST_ENDPOINT is set, POST JSON to it.
 * - Demo (default): nothing leaves the browser. Entries live in localStorage.
 *   Demo mode NEVER shows an invented queue position or invented counts.
 *
 * Referral codes are random (crypto), never derived from the email.
 * ?ref=CODE on any landing is captured by captureRef() and credited on join.
 * Reservations are a list: a browser can hold more than one (the shop says
 * "Reserving this build adds another"), and each can be cancelled.
 */
import { read, write, remove } from './storage';
import { track } from './analytics';
import type { EditionId, FinishId, ProfileId } from '@/data/product';

const ENDPOINT = import.meta.env.PUBLIC_WAITLIST_ENDPOINT as string | undefined;
export const IS_DEMO = !ENDPOINT;

export type Segment = 'editing' | 'music' | 'design' | 'code' | 'streaming';

export interface SegmentInfo {
  id: Segment;
  /** Chip label for "What would you turn?". */
  label: string;
  /** The feel profile this kind of work lives in most. */
  profile: ProfileId;
  /** Audience landing page, relative to the site root. */
  href: string;
}

/** Step 1 of every capture form: one tap that segments the list. */
export const SEGMENTS: SegmentInfo[] = [
  { id: 'editing', label: 'Editing', profile: 'ratchet', href: '/for/editors/' },
  { id: 'music', label: 'Music', profile: 'wall', href: '/for/musicians/' },
  { id: 'design', label: 'Design & 3D', profile: 'fluid', href: '/for/designers/' },
  { id: 'code', label: 'Code', profile: 'magnet', href: '/for/developers/' },
  { id: 'streaming', label: 'Streaming', profile: 'clock', href: '/integrations/' },
];

export const isSegment = (v: unknown): v is Segment => SEGMENTS.some((s) => s.id === v);

export interface WaitlistEntry {
  email: string;
  code: string; // this person's referral code
  referredBy?: string;
  segment?: Segment;
  finish?: FinishId;
  handle?: string;
  /** Feel profile shown on the Feel Pass signature ring. */
  profile?: ProfileId;
  joinedAt: number;
  /** Friends who joined with this code (live mode only; 0 in demo). */
  referrals: number;
}

export interface Reservation {
  id: string; // e.g. DT1-R-7K3Q9M
  email: string;
  edition: EditionId;
  finish: FinishId;
  /** The feel it starts in, when the reserver came from an audience page (?feel=). */
  feel?: ProfileId;
  /**
   * This reserver's own referral code: the link they share carries it.
   * Absent on reservations stored before codes existed.
   */
  code?: string;
  /** Referral code captured from ?ref= on arrival, credited like a waitlist join. */
  referredBy?: string;
  createdAt: number;
}

export type Result<T> = { ok: true; data: T; demo: boolean } | { ok: false; error: string };

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function randomCode(len = 8): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CROCKFORD[b % 32]).join('');
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/**
 * This browser's own referral codes: its waitlist entry, its reservations and
 * the last demo order (checkout keeps it in sessionStorage under
 * "shop:last-order"; read by key so this module doesn't import the shop).
 */
function ownCodes(): Set<string> {
  const order = read<{ referral?: string } | null>('shop:last-order', null, 'session');
  return new Set(
    [getEntry()?.code, ...getReservations().map((r) => r.code), order?.referral].filter(
      (c): c is string => !!c,
    ),
  );
}

/**
 * The friend's code this visitor came in on (call once per landing page).
 * ?ref= on the current URL is stored the first time only: a later link never
 * takes the credit from the friend who sent them first. A code of their own
 * (opening their own share link to check it) is never stored or credited.
 */
export function captureRef(): string | undefined {
  const own = ownCodes();
  const stored = read<string | undefined>('ref', undefined);
  const friend = stored && !own.has(stored) ? stored : undefined;
  if (friend) return friend;
  try {
    const ref = new URLSearchParams(location.search).get('ref')?.toUpperCase();
    if (ref && /^[0-9A-Z]{6,12}$/.test(ref) && !own.has(ref)) {
      write('ref', ref);
      return ref;
    }
  } catch {
    /* ignore */
  }
  // An own code stored before this rule existed is dropped, not credited.
  if (stored) remove('ref');
  return undefined;
}

export function getEntry(): WaitlistEntry | null {
  return read<WaitlistEntry | null>('waitlist', null);
}

/** Every reservation held in this browser, oldest first. */
export function getReservations(): Reservation[] {
  // Stored as a list; a single object is a reservation from before that.
  const stored = read<Reservation | Reservation[] | null>('reservation', null);
  return !stored ? [] : Array.isArray(stored) ? stored : [stored];
}

/** The latest reservation held in this browser. */
export function getReservation(): Reservation | null {
  const all = getReservations();
  return all[all.length - 1] ?? null;
}

/**
 * Handles are typed by the person (never pulled from anywhere), shown on
 * their pass: letters, digits, dot, dash, underscore; 20 chars max.
 */
export function sanitizeHandle(raw: string): string {
  return raw
    .trim()
    .replace(/^@+/, '')
    .replace(/[^A-Za-z0-9._-]/g, '')
    .slice(0, 20);
}

/** Personalise the stored entry (pass handle, finish, profile). Local only. */
export function updateEntry(
  patch: Partial<Pick<WaitlistEntry, 'handle' | 'finish' | 'segment' | 'profile'>>,
): WaitlistEntry | null {
  const entry = getEntry();
  if (!entry) return null;
  const next = { ...entry, ...patch };
  write('waitlist', next);
  return next;
}

/** Share URL that credits a referral code (a waitlist entry's or a reservation's). */
export function referralUrl(holder: { code: string }, path = '/l/waitlist/'): string {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, '');
  return new URL(`${base}${path}?ref=${holder.code}`, location.origin).toString();
}

async function post<T>(action: string, body: unknown): Promise<T> {
  const res = await fetch(ENDPOINT!, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, ...(body as object) }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function joinWaitlist(input: {
  email: string;
  segment?: Segment;
  finish?: FinishId;
  handle?: string;
  profile?: ProfileId;
  source: string;
}): Promise<Result<WaitlistEntry>> {
  const email = input.email.trim().toLowerCase();
  if (!isValidEmail(email))
    return { ok: false, error: 'That email doesn’t look right. Check for a typo?' };
  const existing = getEntry();
  if (existing && existing.email === email) return { ok: true, data: existing, demo: IS_DEMO };

  const referredBy = captureRef();
  try {
    const entry: WaitlistEntry = ENDPOINT
      ? await post<WaitlistEntry>('join', { ...input, email, referredBy })
      : {
          email,
          code: randomCode(),
          referredBy,
          segment: input.segment,
          finish: input.finish,
          handle: input.handle,
          profile: input.profile,
          joinedAt: Date.now(),
          referrals: 0,
        };
    write('waitlist', entry);
    track('lead_submit', { source: input.source, segment: input.segment, referred: !!referredBy });
    return { ok: true, data: entry, demo: IS_DEMO };
  } catch {
    return {
      ok: false,
      error: 'We couldn’t reach the server. Your email wasn’t saved; try again in a moment.',
    };
  }
}

export async function reserve(input: {
  email: string;
  edition: EditionId;
  finish: FinishId;
  feel?: ProfileId;
  source: string;
}): Promise<Result<Reservation>> {
  const email = input.email.trim().toLowerCase();
  if (!isValidEmail(email))
    return { ok: false, error: 'That email doesn’t look right. Check for a typo?' };
  const referredBy = captureRef();
  try {
    const r: Reservation = ENDPOINT
      ? await post<Reservation>('reserve', { ...input, email, referredBy })
      : {
          id: `DT1-R-${randomCode(6)}`,
          email,
          edition: input.edition,
          finish: input.finish,
          feel: input.feel,
          code: randomCode(),
          referredBy,
          createdAt: Date.now(),
        };
    write('reservation', [...getReservations(), r]);
    track('reserve_submit', {
      source: input.source,
      edition: input.edition,
      finish: input.finish,
      referred: !!referredBy,
    });
    return { ok: true, data: r, demo: IS_DEMO };
  } catch {
    return {
      ok: false,
      error: 'We couldn’t reach the server. Nothing was charged; try again in a moment.',
    };
  }
}

/**
 * One-click cancel of one reservation (the latest if no id is given).
 * Live: asks the endpoint to refund the deposit. Demo: forgets it in this browser.
 */
export async function cancelReservation(id?: string): Promise<Result<Reservation>> {
  const all = getReservations();
  const r = id ? all.find((x) => x.id === id) : all[all.length - 1];
  if (!r) return { ok: false, error: 'There is no reservation in this browser to cancel.' };
  try {
    if (ENDPOINT) await post('cancel', { id: r.id, email: r.email });
    const rest = all.filter((x) => x.id !== r.id);
    if (rest.length) write('reservation', rest);
    else remove('reservation');
    track('reserve_cancel', { edition: r.edition });
    return { ok: true, data: r, demo: IS_DEMO };
  } catch {
    return {
      ok: false,
      error: 'We couldn’t reach the server. Your reservation is unchanged; try again in a moment.',
    };
  }
}
