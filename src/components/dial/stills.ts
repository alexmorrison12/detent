/**
 * The product stills in public/renders/, made by scripts/render-stills.mjs.
 * Every finish × view is rendered with the Ratchet feel at 00 on the display;
 * a few are rendered again with another feel for a dial that starts on it, as
 * {finish}-{view}-{profile}, so its 3D takeover crossfades between two pictures
 * of the same display. Keep this list and PROFILE_STILLS in the script in step.
 */
import type { FinishId, ProfileId } from '@/data/product';

export type StillView = 'hero' | 'top' | 'side' | 'front' | 'exploded' | 'config';

const PROFILE_STILLS: Partial<Record<`${FinishId}-${StillView}`, readonly ProfileId[]>> = {
  'raw-hero': ['clock'],
};

/** The file stem of the still for a dial, and the feel its display shows. */
export function stillFor(
  finish: FinishId,
  view: StillView,
  profile?: ProfileId,
): { stem: string; profile: ProfileId } {
  const base = `${finish}-${view}` as const;
  if (profile && profile !== 'ratchet' && PROFILE_STILLS[base]?.includes(profile))
    return { stem: `${base}-${profile}`, profile };
  return { stem: base, profile: 'ratchet' };
}
