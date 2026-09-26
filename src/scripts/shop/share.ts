/**
 * Share a link: Web Share where the platform has it, clipboard otherwise.
 * Returns what actually happened so the caller can say so.
 */
export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

export async function shareOrCopy(
  data: ShareData & { url: string },
  prefer: 'share' | 'copy' = 'share',
): Promise<ShareResult> {
  if (prefer === 'share' && typeof navigator.share === 'function') {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return 'cancelled';
      // Fall through to the clipboard.
    }
  }
  try {
    await navigator.clipboard.writeText(data.url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
