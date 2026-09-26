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
  /** Feel profile shown on the Founder Pass signature ring. */
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

/** Store ?ref= from the current URL (call once per landing page). */
export function captureRef(): string | undefined {
  try {
    const ref = new URLSearchParams(location.search).get('ref')?.toUpperCase();
    if (ref && /^[0-9A-Z]{6,12}$/.test(ref)) {
      write('ref', ref);
      return ref;
    }
  } catch {
    /* ignore */
  }
  return read<string | undefined>('ref', undefined);
}

export function getEntry(): WaitlistEntry | null {
  return read<WaitlistEntry | null>('waitlist', null);
}

export function getReservation(): Reservation | null {
  return read<Reservation | null>('reservation', null);
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

/** Share URL that credits this entry's referral code. */
export function referralUrl(entry: WaitlistEntry, path = '/l/waitlist/'): string {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, '');
  return new URL(`${base}${path}?ref=${entry.code}`, location.origin).toString();
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
  source: string;
}): Promise<Result<Reservation>> {
  const email = input.email.trim().toLowerCase();
  if (!isValidEmail(email))
    return { ok: false, error: 'That email doesn’t look right. Check for a typo?' };
  try {
    const r: Reservation = ENDPOINT
      ? await post<Reservation>('reserve', { ...input, email })
      : {
          id: `DT1-R-${randomCode(6)}`,
          email,
          edition: input.edition,
          finish: input.finish,
          createdAt: Date.now(),
        };
    write('reservation', r);
    track('reserve_submit', { source: input.source, edition: input.edition, finish: input.finish });
    return { ok: true, data: r, demo: IS_DEMO };
  } catch {
    return {
      ok: false,
      error: 'We couldn’t reach the server. Nothing was charged; try again in a moment.',
    };
  }
}

/**
 * One-click cancel. Live: asks the endpoint to refund the deposit.
 * Demo: forgets the reservation stored in this browser.
 */
export async function cancelReservation(): Promise<Result<Reservation>> {
  const r = getReservation();
  if (!r) return { ok: false, error: 'There is no reservation in this browser to cancel.' };
  try {
    if (ENDPOINT) await post('cancel', { id: r.id, email: r.email });
    remove('reservation');
    track('reserve_cancel', { edition: r.edition });
    return { ok: true, data: r, demo: IS_DEMO };
  } catch {
    return {
      ok: false,
      error: 'We couldn’t reach the server. Your reservation is unchanged; try again in a moment.',
    };
  }
}
