/**
 * /integrations/: what the status labels mean, the ≤10-character label the
 * knob's round display shows for each app, and the SDK sample. The apps
 * themselves (name, category, behavior, profile, status) live in
 * INTEGRATIONS in product.ts.
 */
import { INTEGRATIONS, byProfile, type Integration } from './product';
import { PROFILE_FORMAT, profileFileName } from '@/scripts/feel/json';

/**
 * The apps with their own profile. INTEGRATIONS also lists "System" (volume,
 * brightness, media), which is not an app: count and describe APPS whenever
 * copy says "N apps", so every page gives the same number.
 */
export const APPS = INTEGRATIONS.filter((i) => i.category !== 'System');
export const appsBy = (status: Integration['status']) => APPS.filter((i) => i.status === status).length;

export const STATUS: Record<Integration['status'], { label: string; line: string }> = {
  native: { label: 'Native', line: 'Built into Detent Studio. Works the moment you plug in.' },
  plugin: { label: 'Plugin', line: 'A small plugin for the app, installed from Studio in one click.' },
  community: { label: 'Community', line: 'Written by users with the open SDK, reviewed before it is listed.' },
};

const SHORT: Record<string, string> = {
  'DaVinci Resolve': 'RESOLVE',
  'Premiere Pro': 'PREMIERE',
  'Final Cut Pro': 'FINAL CUT',
  'After Effects': 'AFTER FX',
  'Ableton Live': 'LIVE',
  'Logic Pro': 'LOGIC',
  'Bitwig Studio': 'BITWIG',
  'Lightroom Classic': 'LIGHTROOM',
  'OBS Studio': 'OBS',
};

/** Label for the knob's round display (the dial contract allows ≤ 10 chars). */
export const displayLabel = (name: string): string => (SHORT[name] ?? name.toUpperCase()).slice(0, 10);

/*
 * The SDK sample: a profile written in TypeScript, and the file it becomes.
 * The file is the one profile format the whole site shows (the home page's
 * code panel, the feel library's export): format, name, app, base, color,
 * physics that override the base feel, then the app bindings. Press keys are
 * the SDK's names for the three pressure levels: light, firm, hard. The feel
 * numbers are the Magnet profile's, from product.ts.
 */
const magnet = byProfile('magnet');
const REVIEW = {
  app: 'com.microsoft.VSCode',
  name: 'Review',
  display: 'REVIEW',
  press: {
    light: 'git.stageSelectedRanges',
    firm: 'workbench.action.editor.nextChange',
    hard: 'git.revertSelectedRanges',
  },
} as const;

/** What the dial stores: plain JSON in the shared profile format. */
const REVIEW_FILE = {
  format: PROFILE_FORMAT,
  name: REVIEW.name,
  app: REVIEW.app,
  base: magnet.id,
  color: magnet.color,
  physics: {
    strength: magnet.physics.strength,
    damping: magnet.physics.damping,
    // The profile's own code, running in Detent Studio, sends the snap positions.
    snaps: { source: 'studio' },
  },
  press: REVIEW.press,
  display: { text: REVIEW.display },
};

export const SDK_SAMPLE = {
  file: 'review.profile.ts',
  code: `import { defineProfile, feel } from '@detent/sdk';

// Code review in VS Code: the dial snaps to every changed hunk,
// a light press stages the one you're on.
export default defineProfile({
  app: '${REVIEW.app}',
  name: '${REVIEW.name}',
  display: { text: '${REVIEW.display}' },
  feel: feel.${magnet.id}({ strength: ${magnet.physics.strength}, damping: ${magnet.physics.damping} }),

  // Runs in Detent Studio, not on the dial. Re-read when the diff changes.
  snaps: async ({ editor }) => {
    const hunks = await editor.diffHunks();
    return hunks.map((h) => h.startLine);
  },

  onSnap: ({ editor, value }) => editor.revealLine(value, { center: true }),

  press: {
    light: '${REVIEW.press.light}',
    firm: '${REVIEW.press.firm}',
    hard: '${REVIEW.press.hard}',
  },
});
`,
  jsonFile: profileFileName(REVIEW.name),
  json: `${JSON.stringify(REVIEW_FILE, null, 2)}\n`,
};
