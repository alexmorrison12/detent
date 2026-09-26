/**
 * Feel Links: a whole haptic profile in a URL fragment.
 *
 *   /profiles/#v1.z<base64url(deflate-raw(compact JSON))>
 *   /profiles/#v1.j<base64url(compact JSON)>          (when deflate isn't shorter or available)
 *
 * The fragment never reaches a server, so a Feel Link is private by
 * construction. Decoding treats every link as hostile: the payload is size
 * capped, structurally validated, and every number is clamped to what the
 * motor is allowed to do before anything reaches the dial's audio or
 * vibration. Invalid links decode to null; callers fall back to a core
 * profile.
 *
 * Compact form (positional array, trailing defaults may be omitted):
 *   [name, base, detents, strength%, damping%, spring%, stopLo, stopHi, accents[], snaps[]]
 *   base      index into PROFILES (color world + archetype)
 *   stopLo/Hi 0 and 0 = endless
 */
import { PROFILES, type FeelProfile, type ProfileId } from '@/data/product';
import { url } from '@/lib/url';

export type FeelPhysics = FeelProfile['physics'];

export interface FeelSpec {
  name: string;
  /** The core profile whose color world (and archetype) this feel uses. */
  base: ProfileId;
  physics: FeelPhysics;
}

export const FEEL_LINK_VERSION = 'v1';

/** Hard limits. Anything outside is clamped, not rejected. */
export const FEEL_LIMITS = {
  detents: [0, 72],
  unit: [0, 1],
  /** Each end stop sits between these magnitudes from center, in degrees. */
  stop: [10, 180],
  accents: 8,
  snaps: 24,
  /** Snap points closer than this (degrees) are merged. */
  snapGap: 4,
  nameLength: 28,
  /** Longest fragment we will even try to decode. */
  maxFragment: 1024,
  /** Longest decompressed JSON we accept (defends against deflate bombs). */
  maxJson: 2048,
} as const;

export const DEFAULT_NAME = 'Untitled feel';

/* -------------------------------------------------------------------------- */
/* Clamping and validation                                                     */
/* -------------------------------------------------------------------------- */

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

/** Wrap any angle into (-180, 180]. */
export function wrapDeg(deg: number): number {
  const w = ((((deg + 180) % 360) + 360) % 360) - 180;
  return w === -180 ? 180 : w;
}

function cleanAngles(list: unknown, max: number, minGap = 0.5): number[] {
  if (!Array.isArray(list)) return [];
  const out: number[] = [];
  for (const v of list.slice(0, 64)) {
    const n = num(v);
    if (n === undefined) continue;
    const a = Math.round(wrapDeg(n));
    if (out.some((o) => Math.abs(wrapDeg(o - a)) < minGap)) continue;
    out.push(a);
    if (out.length >= max) break;
  }
  return out.sort((a, b) => a - b);
}

/** Strip control, zero-width and bidi-override characters; collapse spaces; cap length. */
export function sanitizeName(raw: unknown, fallback = DEFAULT_NAME): string {
  if (typeof raw !== 'string') return fallback;
  const clean = raw
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const capped = Array.from(clean).slice(0, FEEL_LIMITS.nameLength).join('').trim();
  return capped || fallback;
}

/**
 * Clamp every field of a (possibly hostile) physics object into the safe
 * envelope. Missing fields fall back to `fallback` (a core profile's physics).
 */
export function clampPhysics(input: unknown, fallback: FeelPhysics = PROFILES[0]!.physics): FeelPhysics {
  const p = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const [dMin, dMax] = FEEL_LIMITS.detents;
  const unit = (v: unknown, d: number) => round2(clamp(num(v) ?? d, 0, 1));

  let stops: [number, number] | null = null;
  const rawStops = 'stops' in p ? p.stops : fallback.stops;
  if (Array.isArray(rawStops) && rawStops.length === 2) {
    const lo = num(rawStops[0]);
    const hi = num(rawStops[1]);
    if (lo !== undefined && hi !== undefined && !(lo === 0 && hi === 0)) {
      const [sMin, sMax] = FEEL_LIMITS.stop;
      stops = [-clamp(Math.round(Math.abs(lo)), sMin, sMax), clamp(Math.round(Math.abs(hi)), sMin, sMax)];
    }
  }

  return {
    detents: Math.round(clamp(num(p.detents) ?? fallback.detents, dMin, dMax)),
    strength: unit(p.strength, fallback.strength),
    damping: unit(p.damping, fallback.damping),
    spring: unit(p.spring, fallback.spring),
    stops,
    // Optional lists: absent means none (never inherited from the fallback).
    accents: cleanAngles(p.accents, FEEL_LIMITS.accents),
    snaps: cleanAngles(p.snaps, FEEL_LIMITS.snaps, FEEL_LIMITS.snapGap),
  };
}

export function isProfileId(v: unknown): v is ProfileId {
  return typeof v === 'string' && PROFILES.some((p) => p.id === v);
}

export function clampSpec(input: Partial<FeelSpec> & Record<string, unknown>): FeelSpec {
  const base = isProfileId(input.base) ? input.base : PROFILES[0]!.id;
  const core = PROFILES.find((p) => p.id === base)!;
  return {
    name: sanitizeName(input.name),
    base,
    physics: clampPhysics(input.physics, core.physics),
  };
}

/* -------------------------------------------------------------------------- */
/* Compact form                                                                */
/* -------------------------------------------------------------------------- */

type Compact = [string, number, number, number, number, number, number, number, number[], number[]];

export function toCompact(spec: FeelSpec): unknown[] {
  const s = clampSpec(spec as FeelSpec & Record<string, unknown>);
  const p = s.physics;
  const out: unknown[] = [
    s.name,
    Math.max(0, PROFILES.findIndex((x) => x.id === s.base)),
    p.detents,
    Math.round(p.strength * 100),
    Math.round(p.damping * 100),
    Math.round(p.spring * 100),
    p.stops ? p.stops[0] : 0,
    p.stops ? p.stops[1] : 0,
    p.accents ?? [],
    p.snaps ?? [],
  ];
  // Drop trailing defaults to keep links short.
  while (out.length > 6) {
    const last = out[out.length - 1];
    const empty = Array.isArray(last) ? last.length === 0 : last === 0;
    if (!empty) break;
    out.pop();
  }
  return out;
}

export function fromCompact(data: unknown): FeelSpec | null {
  if (!Array.isArray(data) || data.length < 6 || data.length > 10) return null;
  const [name, baseIdx, detents, s, d, k, lo = 0, hi = 0, accents = [], snaps = []] = data as Partial<Compact>;
  if (typeof name !== 'string') return null;
  const b = num(baseIdx);
  if (b === undefined || [detents, s, d, k, lo, hi].some((v) => num(v) === undefined)) return null;
  if (!Array.isArray(accents) || !Array.isArray(snaps)) return null;
  const base = PROFILES[clamp(Math.round(b), 0, PROFILES.length - 1)]!;
  return {
    name: sanitizeName(name),
    base: base.id,
    physics: clampPhysics(
      {
        detents,
        strength: (s as number) / 100,
        damping: (d as number) / 100,
        spring: (k as number) / 100,
        stops: lo === 0 && hi === 0 ? null : [lo, hi],
        accents,
        snaps,
      },
      base.physics,
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* Bytes <-> base64url, deflate-raw                                            */
/* -------------------------------------------------------------------------- */

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

const canDeflate = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Inflate with an output cap, so a tiny hostile link can't expand into megabytes. */
async function inflate(bytes: Uint8Array, cap: number): Promise<Uint8Array | null> {
  try {
    const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > cap) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const out = new Uint8Array(total);
    let o = 0;
    for (const c of chunks) {
      out.set(c, o);
      o += c.byteLength;
    }
    return out;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

/** Encode a feel to a fragment payload, e.g. "v1.zq1Y…" (no leading #). */
export async function encodeFeel(spec: FeelSpec): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(toCompact(spec)));
  let body = 'j' + toBase64Url(json);
  if (canDeflate()) {
    try {
      const z = 'z' + toBase64Url(await deflate(json));
      if (z.length < body.length) body = z;
    } catch {
      /* keep the plain form */
    }
  }
  return `${FEEL_LINK_VERSION}.${body}`;
}

/** True when a fragment looks like a Feel Link (cheap, synchronous). */
export function isFeelFragment(hash: string): boolean {
  return hash.replace(/^#/, '').startsWith(`${FEEL_LINK_VERSION}.`);
}

/**
 * Decode a fragment ("#v1.…" or "v1.…"). Returns a clamped, sanitized spec,
 * or null for anything malformed, oversized or from an unknown version.
 */
export async function decodeFeel(fragment: string): Promise<FeelSpec | null> {
  const raw = fragment.replace(/^#/, '');
  if (!raw || raw.length > FEEL_LIMITS.maxFragment || !isFeelFragment(raw)) return null;
  const body = raw.slice(FEEL_LINK_VERSION.length + 1);
  const mode = body[0];
  const bytes = fromBase64Url(body.slice(1));
  if (!bytes || !bytes.length) return null;

  let json: Uint8Array | null = null;
  if (mode === 'j') json = bytes.length <= FEEL_LIMITS.maxJson ? bytes : null;
  else if (mode === 'z' && canDeflate()) json = await inflate(bytes, FEEL_LIMITS.maxJson);
  if (!json) return null;

  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(json);
    return fromCompact(JSON.parse(text));
  } catch {
    return null;
  }
}

/** Absolute (in the browser) or base-relative URL for a payload from encodeFeel(). */
export function feelLinkUrl(payload: string, origin?: string): string {
  const path = `${url('/profiles/')}#${payload}`;
  const o = origin ?? (typeof location !== 'undefined' ? location.origin : undefined);
  return o ? new URL(path, o).toString() : path;
}

/** Read and decode the current page's fragment, if it is a Feel Link. */
export async function readFeelLink(): Promise<FeelSpec | null> {
  if (typeof location === 'undefined' || !isFeelFragment(location.hash)) return null;
  return decodeFeel(location.hash);
}

/** Equality on the clamped physics (used to tell "unchanged library profile" from a remix). */
export function samePhysics(a: FeelPhysics, b: FeelPhysics): boolean {
  const ca = clampPhysics(a);
  const cb = clampPhysics(b);
  return JSON.stringify(ca) === JSON.stringify(cb);
}
