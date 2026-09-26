/**
 * App demos: which feels each mock app uses, and what they are for.
 * Shared by the server-rendered markup (AppDemo.astro) and the client
 * controllers, so the mode switcher and the behavior never disagree.
 */
import type { ProfileId } from '@/data/product';
import type { FeelPhysics } from '@/scripts/dial/types';
import { UNITY_ANGLE } from './mix-model';

export type DemoApp = 'edit' | 'mix' | 'design' | 'code';

export interface DemoMode {
  id: string;
  profile: ProfileId;
  /** What the dial controls in this mode (window bar, dial label). */
  label: string;
  /** One short line under the profile name in the switcher (and on the audience fix cards). */
  hint: string;
  /** Physics on top of the profile's own while this mode is on (the fix cards draw it too). */
  physics?: Partial<FeelPhysics>;
  /** Spoken when the mode is selected. */
  spoken: string;
}

export interface DemoMeta {
  /** Accessible name for the whole demo. */
  name: string;
  /** Document/session name shown in the window bar. */
  doc: string;
  /** Visible how-to line under the switcher. */
  how: string;
}

export const DEMO_MODES: Record<DemoApp, DemoMode[]> = {
  edit: [
    {
      id: 'step',
      profile: 'ratchet',
      label: 'Frame step',
      hint: 'One frame per click',
      spoken: 'Ratchet. Each click steps the playhead exactly one frame.',
    },
    {
      id: 'markers',
      profile: 'magnet',
      label: 'Markers',
      hint: 'Snaps to every marker',
      spoken: 'Magnet. The playhead glides, then snaps to the nearest marker.',
    },
    {
      id: 'shuttle',
      profile: 'spring',
      label: 'Shuttle',
      hint: 'Push to play, −4× to 4×',
      spoken: 'Spring. Turn away from center to play; further is faster, up to four times.',
    },
  ],
  mix: [
    {
      id: 'fader',
      profile: 'wall',
      label: 'Fader',
      hint: 'Stops at −∞ and +6\u00a0dB, bump at 0\u00a0dB',
      // Unity sits three quarters up the fader, so the Wall bump moves there.
      physics: { accents: [UNITY_ANGLE] },
      spoken: 'Wall. The dial rides the selected fader, with hard stops and a bump at unity gain.',
    },
    {
      id: 'channel',
      profile: 'clock',
      label: 'Channel',
      hint: 'One channel per click',
      spoken: 'Clock. Each heavy click selects the next channel.',
    },
  ],
  design: [
    {
      id: 'rotate',
      profile: 'fluid',
      label: 'Rotate',
      hint: 'Weighted glide, to 0.1°',
      spoken: 'Fluid. Rotation glides with weight. Press the dial for ten to one fine control.',
    },
    {
      id: 'step',
      profile: 'ratchet',
      label: 'Rotate 15°',
      hint: '15° per click',
      spoken: 'Ratchet. Each click rotates the layer fifteen degrees.',
    },
    {
      id: 'brush',
      profile: 'wall',
      label: 'Brush size',
      hint: 'Stops at 1 and 400\u00a0px, bump at 20\u00a0px',
      spoken:
        'Wall. The dial sets brush size, with hard stops at 1 and 400 pixels and a bump at 20.',
    },
  ],
  code: [
    {
      id: 'hunks',
      profile: 'magnet',
      label: 'Hunks',
      hint: 'One snap per hunk',
      spoken: 'Magnet. The dial snaps from hunk to hunk. Press it to mark a hunk viewed.',
    },
    {
      id: 'lines',
      profile: 'ratchet',
      label: 'Lines',
      hint: 'One line per click',
      spoken: 'Ratchet. Each click moves the cursor one line.',
    },
  ],
};

export const DEMO_META: Record<DemoApp, DemoMeta> = {
  edit: {
    name: 'Timeline demo',
    doc: 'Night Drive · Reel 04',
    how: 'Drag the dial, scroll over it, or focus it and use the arrow keys. Press it to set in and out points.',
  },
  mix: {
    name: 'Mixer demo',
    doc: 'Night Drive · Mix 3',
    how: 'Drag the dial, scroll over it, or focus it and use the arrow keys. Press it to mute the channel.',
  },
  design: {
    name: 'Canvas demo',
    doc: 'Poster · Night Drive',
    how: 'Drag the dial, scroll over it, or focus it and use the arrow keys. Press it in Fluid for 10:1 fine control.',
  },
  code: {
    name: 'Code review demo',
    doc: 'PR 482 · Cancel stale searches',
    how: 'Drag the dial, scroll over it, or focus it and use the arrow keys. Press it to mark a hunk viewed.',
  },
};

export function modeById(app: DemoApp, id: string | undefined): DemoMode {
  const modes = DEMO_MODES[app];
  return modes.find((m) => m.id === id) ?? modes[0]!;
}

/** The first mode that uses `profile`, or the app's default mode. */
export function modeForProfile(app: DemoApp, profile: ProfileId | undefined): DemoMode {
  const modes = DEMO_MODES[app];
  return modes.find((m) => m.profile === profile) ?? modes[0]!;
}
