/**
 * Sharing for the daily games: plain text first (it works everywhere, like a
 * Wordle grid), then the Web Share sheet, then an image file where supported.
 */
import { url } from '@/lib/url';
import { getEntry } from '@/lib/waitlist';

/**
 * Absolute URL for a site path, for share text. Carries the player's referral
 * code when they're on the waitlist, so a friend who joins from a shared
 * result credits them (captureRef() on the game pages stores it).
 */
export function shareUrl(path: string): string {
  const u = new URL(url(path), location.origin);
  const code = getEntry()?.code;
  if (code) u.searchParams.set('ref', code);
  return u.toString();
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older Safari / insecure contexts.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;inset:0 auto auto 0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

export const canShare = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function';

/** Share sheet with text (and a file when the platform accepts files). */
export async function share(
  text: string,
  file?: File | null,
): Promise<'shared' | 'cancelled' | 'unsupported'> {
  if (!canShare()) return 'unsupported';
  const data: ShareData = { text };
  if (file && navigator.canShare?.({ files: [file] })) data.files = [file];
  try {
    await navigator.share(data);
    return 'shared';
  } catch (e) {
    return (e as DOMException)?.name === 'AbortError' ? 'cancelled' : 'unsupported';
  }
}

export function canvasToFile(canvas: HTMLCanvasElement, name: string): Promise<File | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob ? new File([blob], name, { type: 'image/png' }) : null),
      'image/png',
    );
  });
}
