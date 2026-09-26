/**
 * Home-page view data. Every number here is derived from @/data/product or
 * @/config/launch; this file only chooses, orders and phrases.
 */
import {
  AUDIENCES,
  EDITIONS,
  FAQS,
  INTEGRATIONS,
  PAYMENT,
  PROFILES,
  SPECS,
  byProfile,
  formatUsd,
  type AudienceId,
  type ProfileId,
} from '@/data/product';
import { LAUNCH } from '@/config/launch';
import type { DemoApp } from '@/components/demos/AppDemo.astro';
import type { DialPartId } from '@/scripts/dial/types';
import { PROFILE_FORMAT } from '@/scripts/feel/json';

/** Full spec value by group + label. Throws at build time if the data moves. */
export function spec(group: string, label: string): string {
  const row = SPECS.find((g) => g.title === group)?.rows.find((r) => r.label === label);
  if (!row) throw new Error(`[home] missing spec ${group} / ${label}`);
  return row.value;
}

/** First regex match inside a spec value (keeps the page's big numbers in sync with SPECS). */
export function specPart(group: string, label: string, re: RegExp): string {
  const v = spec(group, label);
  const m = v.match(re);
  if (!m) throw new Error(`[home] spec ${group} / ${label} no longer matches ${re}`);
  return m[1] ?? m[0];
}

const bits = Number(specPart('Haptics', 'Position sensing', /(\d+)-bit/));
export const ENCODER_POSITIONS = (2 ** bits).toLocaleString('en-US');

export const FACTS = {
  weight: specPart('Body', 'Weight', /^\d+\s?g/),
  baseDia: specPart('Body', 'Dimensions', /Ø\s?\d+\s?mm(?= base)/),
  knobDia: specPart('Body', 'Dimensions', /Ø\s?\d+\s?mm(?= knob)/),
  height: specPart('Body', 'Dimensions', /\d+\s?mm(?= tall)/),
  material: specPart('Body', 'Material', /^[\w-]+ aluminum/),
  torque: spec('Haptics', 'Peak torque'),
  resolution: specPart('Haptics', 'Position sensing', /[\d.]+°/),
  bits: `${bits}-bit`,
  focRate: specPart('Haptics', 'Motor', /\d+\s?kHz/),
  displaySize: specPart('Display & light', 'Display', /^[\d.]+″/),
  displayPx: specPart('Display & light', 'Display', /\d+ × \d+/),
  battery: specPart('Connectivity & power', 'Battery', /^[\d,]+ mAh/),
  batteryHours: specPart('Connectivity & power', 'Battery', /(\d+) hours/),
  pairings: specPart('Connectivity & power', 'Wireless', /(\w+) pairings/),
  latencyWired: specPart('Connectivity & power', 'Latency', /Under (\d+ ms) wired/),
  onDeviceProfiles: specPart('Haptics', 'Profiles on device', /^\d+/),
  license: specPart('Software', 'Firmware', /\(([^)]+)\)/),
  warrantyYears: PAYMENT.warrantyYears,
  trialDays: PAYMENT.trialDays,
} as const;

/* ---------------------------------------------------------------------- */
/* Mechanism: the exploded stack, top to bottom.                           */
/* ---------------------------------------------------------------------- */

export interface Part {
  id: string;
  name: string;
  /** Text for the knob's round display while this part is in focus (≤ 10 chars). */
  display: string;
  /** The model part the stage callout points at (dial.partAnchors()). */
  anchor: DialPartId;
  figure: string;
  unit?: string;
  body: string;
}

export const PARTS: Part[] = [
  {
    id: 'display',
    anchor: 'display',
    name: 'Display',
    display: 'DISPLAY',
    figure: FACTS.displaySize,
    unit: 'round AMOLED',
    body: `${FACTS.displayPx} pixels under strengthened glass, set into the knob face. It shows what the knob is holding right now: a frame number, a gain in dB, an angle.`,
  },
  {
    id: 'knob',
    anchor: 'knob',
    name: 'Knob ring',
    display: 'KNOB',
    figure: FACTS.knobDia,
    unit: 'knurled ring',
    body: `Turned from ${FACTS.material} and knurled so a fingertip finds grip without looking. The indicator line is tally red on every finish except Tally.`,
  },
  {
    id: 'motor',
    anchor: 'stator',
    name: 'Motor',
    display: 'MOTOR',
    figure: FACTS.torque,
    unit: 'peak torque',
    body: `A brushless gimbal motor under field-oriented control at ${FACTS.focRate}. There is no mechanical click anywhere inside. Every detent you feel is this motor pushing back.`,
  },
  {
    id: 'encoder',
    anchor: 'encoder',
    name: 'Encoder',
    display: 'ENCODER',
    figure: FACTS.resolution,
    unit: 'resolution',
    body: `A ${FACTS.bits} magnetic encoder reads ${ENCODER_POSITIONS} positions per turn, so the firmware knows where a detent should start before your finger reaches it.`,
  },
  {
    id: 'battery',
    anchor: 'battery',
    name: 'Battery',
    display: 'BATTERY',
    figure: FACTS.battery,
    unit: `about ${FACTS.batteryHours} h of haptics`,
    body: `Run it on Bluetooth, or leave it on USB-C for good: a charge limiter keeps the cell healthy. When it does wear out, the cell is sold as a part.`,
  },
  {
    id: 'base',
    anchor: 'base',
    name: 'Base',
    display: 'BASE',
    figure: FACTS.weight,
    unit: `${FACTS.baseDia}, ${FACTS.height} tall`,
    body: `Solid aluminum on a replaceable micro-suction foot. Flick the knob as hard as you like; the base stays where you put it.`,
  },
];

/* ---------------------------------------------------------------------- */
/* Context demo: four apps, four feels.                                    */
/* ---------------------------------------------------------------------- */

export interface ContextTab {
  app: DemoApp;
  audience: AudienceId;
  tab: string;
  appName: string;
  display: string;
  profile: ProfileId;
  line: string;
  linkLabel: string;
}

const aud = (id: AudienceId) => AUDIENCES.find((a) => a.id === id)!;
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const integ = (name: string) => {
  const i = INTEGRATIONS.find((x) => x.name === name);
  if (!i) throw new Error(`[home] missing integration ${name}`);
  return i;
};

export const CONTEXT_TABS: ContextTab[] = [
  {
    app: 'edit',
    audience: 'editors',
    tab: 'Edit',
    appName: 'DaVinci Resolve',
    display: 'TIMELINE',
    profile: aud('editors').profile,
    line: integ('DaVinci Resolve').does,
    linkLabel: `Detent for ${lowerFirst(aud('editors').label)}`,
  },
  {
    app: 'mix',
    audience: 'musicians',
    tab: 'Mix',
    appName: 'Logic Pro',
    display: 'MIXER',
    profile: aud('musicians').profile,
    line: integ('Logic Pro').does,
    linkLabel: `Detent for ${lowerFirst(aud('musicians').label)}`,
  },
  {
    app: 'design',
    audience: 'designers',
    tab: 'Design',
    appName: 'Figma',
    display: 'CANVAS',
    profile: aud('designers').profile,
    line: integ('Figma').does,
    linkLabel: `Detent for ${lowerFirst(aud('designers').label)}`,
  },
  {
    app: 'code',
    audience: 'developers',
    tab: 'Code',
    appName: 'VS Code',
    display: 'DIFF',
    profile: aud('developers').profile,
    line: integ('VS Code').does,
    linkLabel: `Detent for ${lowerFirst(aud('developers').label)}`,
  },
];

/* ---------------------------------------------------------------------- */
/* Open: a real-looking profile file, built from the Magnet physics.        */
/* ---------------------------------------------------------------------- */

// Same file format the feel library exports (format, name, app, base, color,
// physics): physics here overrides the base profile, and the app bindings
// (turn, press, display) ride along. Press levels use the SDK's names:
// a light press stages the hunk, a hard press reverts it.
const magnet = byProfile('magnet');
export const PROFILE_FILE_NAME = 'code-review.detent.json';
export const PROFILE_FILE = {
  format: PROFILE_FORMAT,
  name: 'Code review',
  app: 'com.microsoft.VSCode',
  when: 'isInDiffEditor',
  base: magnet.id,
  color: magnet.color,
  physics: {
    strength: magnet.physics.strength,
    damping: magnet.physics.damping,
    snaps: { source: 'diff.hunks' },
  },
  turn: {
    cw: 'workbench.action.compareEditor.nextChange',
    ccw: 'workbench.action.compareEditor.previousChange',
  },
  press: {
    light: 'git.stageSelectedRanges',
    hard: 'git.revertSelectedRanges',
  },
  display: { text: '{hunk} of {hunks}' },
};

/* ---------------------------------------------------------------------- */
/* Offer + honesty                                                         */
/* ---------------------------------------------------------------------- */

const one = EDITIONS.find((e) => e.id === 'one')!;
const founders = EDITIONS.find((e) => e.id === 'founders')!;
export { one as EDITION_ONE, founders as EDITION_FOUNDERS };

export const SERIAL_RANGE = `${'1'.padStart(4, '0')}–${String(founders.limited ?? LAUNCH.foundersRun)}`;

export const launchPriceEndsLabel = new Date(LAUNCH.launchPriceEnds).toLocaleDateString('en-US', {
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

export const communityApps = INTEGRATIONS.filter((i) => i.status === 'community').map(
  (i) => i.name,
);

export const CANT_DO: { title: string; body: string }[] = [
  {
    title: 'No iPhone app yet.',
    body: `Detent Studio runs on macOS, Windows and Linux. An iPad sees it as a plain keyboard and MIDI device; you set up profiles from a computer.`,
  },
  {
    title: `Bluetooth remembers ${FACTS.pairings} hosts.`,
    body: `Studio, laptop, one more. A fourth means forgetting one of them. USB-C has no limit and no pairing.`,
  },
  {
    title: 'It will stop a fingertip, not a wrist.',
    body: `Peak torque is ${FACTS.torque}: plenty for a wall your finger respects, well short of a force-feedback wheel.`,
  },
  {
    title: `Haptics cost battery.`,
    body: `About ${FACTS.batteryHours} hours of active clicking per charge, weeks on standby. Heavy days end on the cable.`,
  },
  {
    title: 'Some integrations are community-made.',
    body: `${listFormat(communityApps)} run on community profiles. They work, and people rather than a support contract keep them current.`,
  },
];

function listFormat(items: string[]): string {
  return new Intl.ListFormat('en-US', { style: 'long', type: 'conjunction' }).format(items);
}

/** The five questions that most often stand between a visitor and a deposit. */
const FAQ_PICKS = [
  'How does the $20 reservation work?',
  'When does it ship?',
  'What if I do not love it?',
  'What if my app is not supported?',
  'Do I need an account?',
];
export const HOME_FAQS = FAQ_PICKS.map((q) => {
  const f = FAQS.find((x) => x.q === q);
  if (!f) throw new Error(`[home] missing FAQ: ${q}`);
  return f;
});

export const PROFILE_IDS = PROFILES.map((p) => p.id);
export { formatUsd };
