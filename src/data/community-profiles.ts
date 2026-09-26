/**
 * Feel library data: the six core profiles plus community profiles.
 *
 * Detent is a concept product, so the community is too: every creator and
 * handle below is fictional. The physics are real, though. Each profile uses
 * the same shape as the core PROFILES in @/data/product and loads into the
 * dial exactly as written. No download counts, no ratings: nobody has
 * downloaded anything.
 */
import {
  INTEGRATIONS,
  PROFILES,
  type FeelProfile,
  type IntegrationCategory,
  type ProfileId,
} from '@/data/product';

export type FeelPhysics = FeelProfile['physics'];

export interface CommunityProfile {
  /** URL-safe id, used in ?p=<id>. */
  id: string;
  name: string;
  /** Fictional creator handle, including the @. */
  author: string;
  /** App it was tuned for. Must match an INTEGRATIONS name. */
  app: string;
  /** The core profile it grew out of. Sets its color world. */
  base: ProfileId;
  /** How it feels, in one sentence. */
  feel: string;
  physics: FeelPhysics;
}

export const COMMUNITY_PROFILES: CommunityProfile[] = [
  {
    id: 'broadcast-jog',
    name: 'Broadcast Jog',
    author: '@cutonaction',
    app: 'DaVinci Resolve',
    base: 'ratchet',
    feel: 'Thirty clicks a turn, one turn per second of 30 fps, and a heavier click every time the second rolls over.',
    physics: { detents: 30, strength: 0.7, damping: 0.12, spring: 0, stops: null, accents: [0] },
  },
  {
    id: 'trim-sixty',
    name: 'Trim Sixty',
    author: '@twopop',
    app: 'Premiere Pro',
    base: 'ratchet',
    feel: 'Sixty light clicks for 60 fps trims. Fine enough to feel, too fine to count.',
    physics: { detents: 60, strength: 0.45, damping: 0.2, spring: 0, stops: null },
  },
  {
    id: 'shuttle-notch',
    name: 'Shuttle Notch',
    author: '@colormeslow',
    app: 'DaVinci Resolve',
    base: 'spring',
    feel: 'A lazy spring with a notch at zero, so stopping playback is something your thumb finds on its own.',
    physics: { detents: 0, strength: 0.5, damping: 0.3, spring: 0.7, stops: [-90, 90], accents: [0] },
  },
  {
    id: 'keyframe-hunter',
    name: 'Keyframe Hunter',
    author: '@ease.inout',
    app: 'After Effects',
    base: 'magnet',
    feel: 'Glides between keys, then drops into each one like a ball bearing into a dimple.',
    physics: { detents: 0, strength: 0.8, damping: 0.1, spring: 0, stops: null, snaps: [-135, -90, -45, 0, 45, 90, 135, 180] },
  },
  {
    id: 'heavy-reel',
    name: 'Heavy Reel',
    author: '@reelweight',
    app: 'Final Cut Pro',
    base: 'fluid',
    feel: 'Almost no drag. Flick it and the timeline keeps rolling like a loaded film reel.',
    physics: { detents: 0, strength: 0, damping: 0.02, spring: 0, stops: null },
  },
  {
    id: 'filter-sweep',
    name: 'Filter Sweep',
    author: '@lowpassdaily',
    app: 'Ableton Live',
    base: 'wall',
    feel: 'Thick, even drag from fully closed to fully open, and a wall at each end so the sweep lands.',
    physics: { detents: 0, strength: 0.3, damping: 0.42, spring: 0, stops: [-150, 150] },
  },
  {
    id: 'unity-bump',
    name: 'Unity Bump',
    author: '@mixbus_mira',
    app: 'Logic Pro',
    base: 'wall',
    feel: 'A fader ride with a bump at 0 dB, three quarters of the way up, like a console fader’s unity detent.',
    physics: { detents: 0, strength: 0.55, damping: 0.3, spring: 0, stops: [-135, 135], accents: [68] },
  },
  {
    id: 'mod-depth',
    name: 'Mod Depth',
    author: '@euclidsnare',
    app: 'Bitwig Studio',
    base: 'spring',
    feel: 'Bipolar. Springs home to zero modulation and clicks as you cross it.',
    physics: { detents: 0, strength: 0.6, damping: 0.2, spring: 0.5, stops: [-135, 135], accents: [0] },
  },
  {
    id: 'sixteen-steps',
    name: 'Sixteen Steps',
    author: '@snarebucket',
    app: 'FL Studio',
    base: 'clock',
    feel: 'Sixteen heavy steps, one per pattern, with a deeper click on the downbeat.',
    physics: { detents: 16, strength: 0.95, damping: 0.2, spring: 0, stops: null, accents: [0] },
  },
  {
    id: 'fifteen-degrees',
    name: 'Fifteen Degrees',
    author: '@pixelnudge',
    app: 'Figma',
    base: 'clock',
    feel: 'A click every 15°, a heavier one at each right angle. For rotating things you will want to line up later.',
    physics: { detents: 24, strength: 0.6, damping: 0.18, spring: 0, stops: null, accents: [-90, 0, 90, 180] },
  },
  {
    id: 'brush-steps',
    name: 'Brush Steps',
    author: '@dodgeandburn',
    app: 'Photoshop',
    base: 'wall',
    feel: 'Twenty soft steps between the smallest brush and the biggest, with a wall at both ends.',
    physics: { detents: 20, strength: 0.3, damping: 0.3, spring: 0, stops: [-140, 140] },
  },
  {
    id: 'third-stop',
    name: 'Third Stop',
    author: '@halfstop',
    app: 'Lightroom Classic',
    base: 'wall',
    feel: 'One third of a stop per click, a firm detent at zero, and a hard stop at plus and minus 5 EV.',
    physics: { detents: 36, strength: 0.55, damping: 0.25, spring: 0, stops: [-150, 150], accents: [0] },
  },
  {
    id: 'orbit-views',
    name: 'Orbit Views',
    author: '@subdivsurf',
    app: 'Blender',
    base: 'fluid',
    feel: 'Weighted orbit with soft magnets at the front, side and back views.',
    physics: { detents: 0, strength: 0.5, damping: 0.18, spring: 0, stops: null, snaps: [-90, 0, 90, 180] },
  },
  {
    id: 'tool-wheel',
    name: 'Tool Wheel',
    author: '@nurbsandbolts',
    app: 'Cinema 4D',
    base: 'clock',
    feel: 'Eight big, deliberate clicks. One per tool, and no accidental switches.',
    physics: { detents: 8, strength: 1, damping: 0.25, spring: 0, stops: null },
  },
  {
    id: 'hunk-by-hunk',
    name: 'Hunk by Hunk',
    author: '@rebase.ria',
    app: 'VS Code',
    base: 'magnet',
    feel: 'Snaps to each diff hunk and coasts through the unchanged lines in between.',
    physics: { detents: 0, strength: 0.85, damping: 0.1, spring: 0, stops: null, snaps: [-160, -110, -60, -5, 40, 95, 150] },
  },
  {
    id: 'step-over',
    name: 'Step Over',
    author: '@breakpoint.bo',
    app: 'Xcode',
    base: 'ratchet',
    feel: 'Eighteen firm clicks. One line per click, and it will not run away from you.',
    physics: { detents: 18, strength: 0.9, damping: 0.3, spring: 0, stops: null },
  },
  {
    id: 'scrollback',
    name: 'Scrollback',
    author: '@tty.nomad',
    app: 'Terminal',
    base: 'fluid',
    feel: 'Long coast for flying through logs, with 48 faint ticks you only notice when you slow down.',
    physics: { detents: 48, strength: 0.1, damping: 0.08, spring: 0, stops: null },
  },
  {
    id: 'scene-cut',
    name: 'Scene Cut',
    author: '@liveatfive',
    app: 'OBS Studio',
    base: 'clock',
    feel: 'Six scenes, six heavy clicks, and a deeper one on your main camera.',
    physics: { detents: 6, strength: 1, damping: 0.22, spring: 0, stops: null, accents: [0] },
  },
  {
    id: 'mic-ride',
    name: 'Mic Ride',
    author: '@gainstaged',
    app: 'OBS Studio',
    base: 'wall',
    feel: 'A hard floor at silence, a bump at your target level, and a wall before you clip.',
    physics: { detents: 0, strength: 0.5, damping: 0.35, spring: 0, stops: [-120, 120], accents: [60] },
  },
  {
    id: 'quiet-hours',
    name: 'Quiet Hours',
    author: '@nightdesk',
    app: 'System',
    base: 'wall',
    feel: 'Heavy damping over a short range, so volume changes after 11 p.m. stay polite.',
    physics: { detents: 0, strength: 0.2, damping: 0.6, spring: 0, stops: [-90, 90] },
  },
];

/* -------------------------------------------------------------------------- */
/* The unified library the feel station browses.                              */
/* -------------------------------------------------------------------------- */

export type LibraryCategory = 'Core' | IntegrationCategory;

export interface LibraryEntry {
  id: string;
  name: string;
  /** "Detent Labs" for core profiles, a fictional @handle for community ones. */
  author: string;
  kind: 'core' | 'community';
  /** App it was tuned for, or "Every app" for core profiles. */
  app: string;
  category: LibraryCategory;
  base: ProfileId;
  feel: string;
  /** Core profiles only: what it's for. */
  use?: string;
  /** Display color (sRGB hex) for the dial's face ring and halo. */
  color: string;
  physics: FeelPhysics;
}

const categoryOf = (app: string): IntegrationCategory =>
  INTEGRATIONS.find((i) => i.name === app)?.category ?? 'System';

const colorOf = (id: ProfileId) => PROFILES.find((p) => p.id === id)?.color ?? PROFILES[0]!.color;

export const LIBRARY: LibraryEntry[] = [
  ...PROFILES.map<LibraryEntry>((p) => ({
    id: p.id,
    name: p.name,
    author: 'Detent Labs',
    kind: 'core',
    app: 'Every app',
    category: 'Core',
    base: p.id,
    feel: p.feel,
    use: p.use,
    color: p.color,
    physics: p.physics,
  })),
  ...COMMUNITY_PROFILES.map<LibraryEntry>((c) => ({
    id: c.id,
    name: c.name,
    author: c.author,
    kind: 'community',
    app: c.app,
    category: categoryOf(c.app),
    base: c.base,
    feel: c.feel,
    color: colorOf(c.base),
    physics: c.physics,
  })),
];

/** Filter chips, in a stable order, only for categories that have profiles. */
const CATEGORY_ORDER: LibraryCategory[] = ['Core', 'Video', 'Audio', 'Design', '3D', 'Code', 'Stream', 'System'];
export const LIBRARY_CATEGORIES: LibraryCategory[] = CATEGORY_ORDER.filter((c) => LIBRARY.some((e) => e.category === c));

export const libraryEntry = (id: string | null | undefined): LibraryEntry | undefined =>
  id ? LIBRARY.find((e) => e.id === id) : undefined;
