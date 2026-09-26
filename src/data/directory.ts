/**
 * /integrations/: what the status labels mean, the ≤10-character label the
 * knob's round display shows for each app, and the SDK sample. The apps
 * themselves (name, category, behavior, profile, status) live in
 * INTEGRATIONS in product.ts.
 */
import { INTEGRATIONS, type Integration } from './product';

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

/** The SDK sample: a real-looking profile for one app, and what the dial stores. */
export const SDK_SAMPLE = {
  file: 'review.profile.ts',
  code: `import { defineProfile, feel } from '@detent/sdk';

// Code review in VS Code: the dial snaps to every changed hunk,
// a light press stages the one you're on.
export default defineProfile({
  app: 'com.microsoft.VSCode',
  name: 'Review',
  display: 'REVIEW',
  feel: feel.magnet({ strength: 0.9, width: 7 }),

  // Runs in Detent Studio, not on the dial. Re-read when the diff changes.
  snaps: async ({ editor }) => {
    const hunks = await editor.diffHunks();
    return hunks.map((h) => h.startLine);
  },

  onSnap: ({ editor, value }) => editor.revealLine(value, { center: true }),

  press: {
    light: 'git.stageSelectedRanges',
    firm: 'workbench.action.editor.nextChange',
    hard: 'git.revertSelectedRanges',
  },
});
`,
  jsonFile: 'review.detent.json',
  json: `{
  "schema": 1,
  "app": "com.microsoft.VSCode",
  "name": "Review",
  "display": { "label": "REVIEW", "ring": "#ff7a59" },
  "feel": {
    "type": "magnet",
    "strength": 0.9,
    "width": 7,
    "damping": 0.12
  },
  "snaps": { "source": "host" },
  "press": ["light", "firm", "hard"]
}
`,
} as const;
