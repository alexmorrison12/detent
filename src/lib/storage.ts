/**
 * localStorage/sessionStorage that never throws (Safari private mode,
 * disabled storage, quota) and namespaces every key with "detent:".
 */
type Area = 'local' | 'session';

function area(kind: Area): Storage | null {
  try {
    const s = kind === 'local' ? window.localStorage : window.sessionStorage;
    const probe = '__detent_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function read<T>(key: string, fallback: T, kind: Area = 'local'): T {
  const s = area(kind);
  if (!s) return fallback;
  try {
    const raw = s.getItem(`detent:${key}`);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function write<T>(key: string, value: T, kind: Area = 'local'): void {
  const s = area(kind);
  if (!s) return;
  try {
    s.setItem(`detent:${key}`, JSON.stringify(value));
  } catch {
    /* quota or disabled: the feature degrades to in-memory for this page */
  }
}

export function remove(key: string, kind: Area = 'local'): void {
  area(kind)?.removeItem(`detent:${key}`);
}
