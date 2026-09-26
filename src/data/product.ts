/**
 * Detent One: the single source of truth for product facts.
 * Pages, JSON-LD, the product feed and llms.txt all read from here.
 * Never hard-code a price, spec or finish name in a page.
 */
// The leaf, not '@/config/launch': that module quotes prices from this one.
import { LAUNCH } from '@/config/launch-terms';

export type FinishId = 'raw' | 'graphite' | 'glacier' | 'tally';

export interface Finish {
  id: FinishId;
  name: string;
  /** One sensory line; used under swatches. */
  line: string;
  /** Anodized/bead-blasted body color for 3D + swatches (sRGB hex; 3D converts). */
  body: string;
  /** Knob top/indicator ring accent. */
  accent: string;
  /** PBR hints for the 3D material. */
  metalness: number;
  roughness: number;
  foundersOnly?: boolean;
}

export const FINISHES: Finish[] = [
  {
    id: 'raw',
    name: 'Raw',
    line: 'Bead-blasted 6061 aluminum. Cool, bright, a little industrial.',
    body: '#c9c8c6',
    accent: '#e0115f',
    metalness: 1,
    roughness: 0.38,
  },
  {
    id: 'graphite',
    name: 'Graphite',
    line: 'Anodized near-black. Disappears on a dark desk until you touch it.',
    body: '#2a2729',
    accent: '#e0115f',
    metalness: 0.9,
    roughness: 0.42,
  },
  {
    id: 'glacier',
    name: 'Glacier',
    line: 'Pale blue anodize, the color of cold aluminum at 6 a.m.',
    body: '#b8c9d6',
    accent: '#e0115f',
    metalness: 0.95,
    roughness: 0.34,
  },
  {
    id: 'tally',
    name: 'Tally',
    line: 'The on-air red. Numbered, engraved, and only on the Founders Edition.',
    body: '#c4124f',
    accent: '#f4f1f2',
    metalness: 0.9,
    roughness: 0.3,
    foundersOnly: true,
  },
];

export type EditionId = 'one' | 'founders';

export interface Edition {
  id: EditionId;
  name: string;
  sku: string;
  priceUsd: number;
  /** Launch price: reservations, and orders until LAUNCH.launchPriceEnds (72 hours). */
  launchPriceUsd: number;
  finishes: FinishId[];
  summary: string;
  includes: string[];
  limited?: number;
}

export const EDITIONS: Edition[] = [
  {
    id: 'one',
    name: 'Detent One',
    sku: 'DT1',
    priceUsd: 349,
    launchPriceUsd: 299,
    finishes: ['raw', 'graphite', 'glacier'],
    summary: 'The dial. Every feel, every integration, every update.',
    includes: [
      'Detent One in Raw, Graphite or Glacier',
      '1 m braided USB-C cable',
      'Free engraving on the base',
      '60-day studio trial, 3-year warranty',
    ],
  },
  {
    id: 'founders',
    name: 'Founders Edition',
    sku: 'DT1-F',
    priceUsd: 449,
    launchPriceUsd: 449,
    finishes: ['tally'],
    summary: 'Numbered 0001–2000 in Tally red, with a machined walnut plinth.',
    includes: [
      'Detent One in Tally, serial-engraved 0001–2000',
      'Machined walnut plinth ($59 value)',
      'Founders feel pack: 12 profiles tuned with early testers',
      'Early firmware channel for life',
      'Everything in Detent One',
    ],
    limited: 2000,
  },
];

export interface Accessory {
  id: string;
  name: string;
  priceUsd: number;
  line: string;
}

export const ACCESSORIES: Accessory[] = [
  { id: 'plinth', name: 'Walnut plinth', priceUsd: 59, line: 'Tilts the dial 8° toward you. Oiled black walnut, machined pocket.' },
  { id: 'case', name: 'Travel case', priceUsd: 39, line: 'Molded felt shell with a cable pocket. Fits in a laptop sleeve.' },
  { id: 'cable', name: 'Coiled cable', priceUsd: 25, line: 'Aviator-coiled USB-C in graphite. Because you were going to ask.' },
];

export const PAYMENT = {
  installments: 4,
  /** Display helper: "or 4 payments of $87.25". */
  installmentLabel(price: number): string {
    return `or 4 interest-free payments of $${(price / 4).toFixed(2)}`;
  },
  trialDays: 60,
  warrantyYears: 3,
  freeShippingOverUsd: 0,
} as const;

/* -------------------------------------------------------------------------- */
/* Feel profiles: the haptic "modes". Physics params drive both the in-browser */
/* simulation (audio/vibration/visual) and the copy.                           */
/* -------------------------------------------------------------------------- */

export type ProfileId = 'ratchet' | 'fluid' | 'spring' | 'clock' | 'wall' | 'magnet';

export interface FeelProfile {
  id: ProfileId;
  name: string;
  /** How it feels, in one sentence. Physical words. */
  feel: string;
  /** What it's for, concretely. */
  use: string;
  /** Display ring color on the knob face (sRGB hex). */
  color: string;
  physics: {
    /** Detents per full revolution (0 = none). */
    detents: number;
    /** 0..1 click strength. */
    strength: number;
    /** 0..1 viscous damping. */
    damping: number;
    /** Spring-return stiffness toward center (0 = none). */
    spring: number;
    /** Virtual end stops in degrees from center, or null for endless. */
    stops: [number, number] | null;
    /** Extra-strong detents at these angles (degrees), e.g. a "home" click. */
    accents?: number[];
    /** Snap points (degrees) for magnet mode. */
    snaps?: number[];
  };
}

export const PROFILES: FeelProfile[] = [
  {
    id: 'ratchet',
    name: 'Ratchet',
    feel: 'Twenty-four crisp clicks per turn, like a good camera dial.',
    use: 'Step through frames, list items, undo history.',
    color: '#e0115f',
    physics: { detents: 24, strength: 0.8, damping: 0.15, spring: 0, stops: null },
  },
  {
    id: 'fluid',
    name: 'Fluid',
    feel: 'No clicks. Weighted and slippery, like a flywheel in oil.',
    use: 'Scrub timelines, zoom canvases, sweep filters.',
    color: '#5fd4e6',
    physics: { detents: 0, strength: 0, damping: 0.05, spring: 0, stops: null },
  },
  {
    id: 'spring',
    name: 'Spring',
    feel: 'Pulls back to center. The further you push, the harder it pushes back.',
    use: 'Shuttle playback speed, pitch bend, nudge values.',
    color: '#b6e35a',
    physics: { detents: 0, strength: 0, damping: 0.25, spring: 0.9, stops: [-120, 120] },
  },
  {
    id: 'clock',
    name: 'Clock',
    feel: 'Twelve heavy detents with a deeper one at noon.',
    use: 'Switch tools, pick brushes, choose tracks.',
    color: '#ffb547',
    physics: { detents: 12, strength: 1, damping: 0.2, spring: 0, stops: null, accents: [0] },
  },
  {
    id: 'wall',
    name: 'Wall',
    feel: 'Hard stops at zero and a hundred, a soft bump halfway.',
    use: 'Volume, opacity, brush size: anything with a real range.',
    color: '#a58bff',
    physics: { detents: 0, strength: 0.4, damping: 0.3, spring: 0, stops: [-135, 135], accents: [0] },
  },
  {
    id: 'magnet',
    name: 'Magnet',
    feel: 'Smooth until it finds something that matters, then it snaps.',
    use: 'Jump between markers, keyframes, git hunks, chorus and verse.',
    color: '#ff7a59',
    physics: { detents: 0, strength: 0.9, damping: 0.12, spring: 0, stops: null, snaps: [-150, -95, -20, 35, 110, 160] },
  },
];

/* -------------------------------------------------------------------------- */
/* Specs                                                                      */
/* -------------------------------------------------------------------------- */

export interface SpecGroup {
  title: string;
  rows: { label: string; value: string }[];
}

export const SPECS: SpecGroup[] = [
  {
    title: 'Body',
    rows: [
      { label: 'Material', value: '6061-T6 aluminum, CNC-machined from one billet' },
      { label: 'Finish', value: 'Bead-blasted; Type II anodize (Graphite, Glacier, Tally)' },
      { label: 'Dimensions', value: 'Ø 72 mm base, Ø 58 mm knob, 44 mm tall' },
      { label: 'Weight', value: '412 g. It does not slide.' },
      { label: 'Foot', value: 'Replaceable silicone, micro-suction' },
    ],
  },
  {
    title: 'Haptics',
    rows: [
      { label: 'Motor', value: 'Brushless gimbal motor, field-oriented control at 10 kHz' },
      { label: 'Position sensing', value: '14-bit magnetic encoder, 0.022° resolution' },
      // A bare figure: pages set it as a readout ("32 mN·m peak torque") and
      // parse the number. Qualifiers go in their own row.
      { label: 'Peak torque', value: '32 mN·m' },
      { label: 'Torque on battery', value: '24 mN·m peak, capped to save charge' },
      { label: 'Press', value: 'Force-sensing knob, three pressure levels' },
      { label: 'Profiles on device', value: '64, switched automatically per app' },
    ],
  },
  {
    title: 'Display & light',
    rows: [
      { label: 'Display', value: '1.43″ round AMOLED, 466 × 466, under strengthened glass' },
      { label: 'Refresh', value: '60 Hz, always-on dim mode' },
      { label: 'Halo', value: '24-LED light ring in the base, per-profile color' },
    ],
  },
  {
    title: 'Connectivity & power',
    rows: [
      { label: 'Wired', value: 'USB-C: HID + class-compliant MIDI, no driver needed' },
      { label: 'Wireless', value: 'Bluetooth LE 5.3, three pairings' },
      { label: 'Latency', value: 'Under 4 ms wired, under 12 ms wireless' },
      { label: 'Battery', value: '2,000 mAh, about 40 hours of active haptics' },
      { label: 'Works with', value: 'macOS 13+, Windows 11, Linux, iPadOS' },
    ],
  },
  {
    title: 'Software',
    rows: [
      { label: 'Companion app', value: 'Detent Studio for macOS, Windows and Linux' },
      { label: 'Account', value: 'None required. Local-first, no cloud, no telemetry by default' },
      { label: 'SDK', value: 'Open SDK (TypeScript and Rust); profiles are plain JSON' },
      { label: 'Firmware', value: 'Open source (Apache-2.0), signed updates over USB or BLE' },
    ],
  },
  {
    title: 'In the box',
    rows: [
      { label: 'Detent One', value: 'In your finish, engraved if you asked' },
      { label: 'Cable', value: '1 m braided USB-C to USB-C' },
      { label: 'Paper', value: 'One quick-start card. That’s it.' },
    ],
  },
  {
    title: 'Care',
    rows: [
      { label: 'Warranty', value: '3 years, parts and labor' },
      { label: 'Trial', value: '60-day studio trial, free return shipping' },
      { label: 'Repair', value: 'Four Torx screws. Battery, foot and knob cap sold as parts' },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Integrations                                                               */
/* -------------------------------------------------------------------------- */

/**
 * What every app gets with no profile at all. Say it with this constant
 * wherever the site answers "does it work with my app?".
 */
export const SYSTEM_SET = 'scroll, zoom, undo, volume, brightness and media';

export type IntegrationCategory = 'Video' | 'Audio' | 'Design' | '3D' | 'Code' | 'Stream' | 'System';

export interface Integration {
  name: string;
  category: IntegrationCategory;
  /** What the dial does there, concretely. */
  does: string;
  /** Default profile used in this app. */
  profile: ProfileId;
  status: 'native' | 'plugin' | 'community';
}

export const INTEGRATIONS: Integration[] = [
  { name: 'DaVinci Resolve', category: 'Video', does: 'Frame-step in Ratchet, shuttle in Spring, snap to markers in Magnet.', profile: 'ratchet', status: 'plugin' },
  { name: 'Premiere Pro', category: 'Video', does: 'Jog the playhead, trim edits frame by frame, ride clip gain.', profile: 'ratchet', status: 'plugin' },
  { name: 'Final Cut Pro', category: 'Video', does: 'Scrub with real inertia; press to set in and out points.', profile: 'fluid', status: 'plugin' },
  { name: 'After Effects', category: 'Video', does: 'Nudge keyframes; Magnet snaps to every key on the layer.', profile: 'magnet', status: 'plugin' },
  { name: 'Ableton Live', category: 'Audio', does: 'Macro knobs with hard end stops; Clock picks scenes.', profile: 'wall', status: 'native' },
  { name: 'Logic Pro', category: 'Audio', does: 'Fader rides with a bump at unity gain.', profile: 'wall', status: 'native' },
  { name: 'Bitwig Studio', category: 'Audio', does: 'Modulator depth with Spring return; MIDI-learn anything.', profile: 'spring', status: 'native' },
  { name: 'FL Studio', category: 'Audio', does: 'Pattern select in Clock, tempo in Ratchet.', profile: 'clock', status: 'community' },
  { name: 'Figma', category: 'Design', does: 'Rotate, resize and scrub numeric fields without touching the trackpad.', profile: 'ratchet', status: 'plugin' },
  { name: 'Photoshop', category: 'Design', does: 'Brush size with Wall stops, history scrubbing in Fluid.', profile: 'wall', status: 'plugin' },
  { name: 'Lightroom Classic', category: 'Design', does: 'Exposure and white balance with a detent at zero.', profile: 'wall', status: 'plugin' },
  { name: 'Blender', category: '3D', does: 'Timeline scrub, orbit the viewport, set values with Magnet on keyframes.', profile: 'fluid', status: 'community' },
  { name: 'Cinema 4D', category: '3D', does: 'Orbit and dolly the camera; Clock switches tools.', profile: 'clock', status: 'community' },
  { name: 'VS Code', category: 'Code', does: 'Magnet snaps through diff hunks and problems; Ratchet walks the undo stack.', profile: 'magnet', status: 'native' },
  { name: 'Xcode', category: 'Code', does: 'Step the debugger one line per click; press to continue.', profile: 'ratchet', status: 'community' },
  { name: 'Terminal', category: 'Code', does: 'Scroll history in Fluid, cycle shells and tabs in Clock.', profile: 'fluid', status: 'native' },
  { name: 'OBS Studio', category: 'Stream', does: 'Switch scenes in Clock, ride mic gain with Wall.', profile: 'clock', status: 'plugin' },
  { name: 'System', category: 'System', does: `${SYSTEM_SET[0]!.toUpperCase()}${SYSTEM_SET.slice(1)}, in every app, out of the box.`, profile: 'wall', status: 'native' },
];

/* -------------------------------------------------------------------------- */
/* Audiences (landing pages at /for/<id>/)                                    */
/* -------------------------------------------------------------------------- */

export type AudienceId = 'editors' | 'musicians' | 'designers' | 'developers';

export interface Audience {
  id: AudienceId;
  label: string;
  /** Headline for the audience landing page. Specific, not generic. */
  headline: string;
  subhead: string;
  pains: string[];
  profile: ProfileId;
  apps: string[];
}

export const AUDIENCES: Audience[] = [
  {
    id: 'editors',
    label: 'Video editors',
    headline: 'Cut on the frame, not near it.',
    subhead: 'Ratchet steps one frame per click. Spring shuttles. Magnet lands on every marker. Your trackpad goes back to being a trackpad.',
    pains: ['Overshooting the edit point by three frames', 'JKL gymnastics for a simple trim', 'Scrubbing a 40-minute timeline with a mouse wheel'],
    profile: 'ratchet',
    apps: ['DaVinci Resolve', 'Premiere Pro', 'Final Cut Pro', 'After Effects'],
  },
  {
    id: 'musicians',
    label: 'Music producers',
    headline: 'A real knob for every fake one.',
    subhead: 'Hard stops at −∞ and +6\u00a0dB, a bump at 0\u00a0dB, and 64 profiles that switch with your plugin window.',
    pains: ['Dragging tiny on-screen knobs with a mouse', 'Controllers that feel the same for every parameter', 'MIDI mapping that never quite sticks'],
    profile: 'wall',
    apps: ['Ableton Live', 'Logic Pro', 'Bitwig Studio', 'FL Studio'],
  },
  {
    id: 'designers',
    label: 'Designers & 3D artists',
    headline: 'Rotate it by feel.',
    subhead: 'Brush size with real end stops. Orbit the viewport with inertia. Scrub any number field without reaching for the keyboard.',
    pains: ['Typing 37.5° because dragging never lands on it', 'Brush size shortcuts you can’t see', 'Viewport orbit that fights your hand'],
    profile: 'fluid',
    apps: ['Figma', 'Photoshop', 'Lightroom Classic', 'Blender'],
  },
  {
    id: 'developers',
    label: 'Developers',
    headline: 'Feel the diff.',
    subhead: 'Magnet snaps through hunks, problems and search results. Ratchet walks the undo stack. Press to step the debugger.',
    pains: ['Losing your place in a 900-line diff', 'Undo-undo-undo-redo', 'Stepping a debugger with F10 for the 200th time'],
    profile: 'magnet',
    apps: ['VS Code', 'Xcode', 'Terminal'],
  },
];

/* -------------------------------------------------------------------------- */
/* Early tester notes (fictional personas; the site is a concept demo)        */
/* -------------------------------------------------------------------------- */

export interface TesterNote {
  quote: string;
  name: string;
  role: string;
  profile: ProfileId;
}

export const TESTER_NOTES: TesterNote[] = [
  { quote: 'I stopped overshooting edits in the first hour. The Ratchet click is exactly one frame and my hand learned it before my head did.', name: 'Maren Okafor', role: 'Colorist and editor', profile: 'ratchet' },
  { quote: 'Unity gain has a little bump now. I did not know I needed that until I had it, and now every other fader feels broken.', name: 'Theo Lindqvist', role: 'Mix engineer', profile: 'wall' },
  { quote: 'Magnet mode through a code review is ridiculous. It snaps to each hunk. I review faster and I look at every change.', name: 'Priya Raman', role: 'Staff engineer', profile: 'magnet' },
  { quote: 'The weight is the first thing you notice. The second is that you keep touching it when you are thinking.', name: 'Jonah Achterberg', role: 'Industrial designer', profile: 'fluid' },
];

/** Convenience lookups. Declared before FAQS, whose answers quote them. */
export const byFinish = (id: FinishId) => FINISHES.find((f) => f.id === id)!;
export const byProfile = (id: ProfileId) => PROFILES.find((p) => p.id === id)!;
export const byEdition = (id: EditionId) => EDITIONS.find((e) => e.id === id)!;
export const formatUsd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: n % 1 ? 2 : 0 });

/* -------------------------------------------------------------------------- */
/* FAQ                                                                        */
/* -------------------------------------------------------------------------- */

export interface Faq {
  q: string;
  a: string;
  topic: 'Buying' | 'Shipping' | 'Product' | 'Software' | 'Launch';
}

/*
 * Answers show in every phase on /support/, /l/launch/ and llms.txt, so each
 * one holds in all of them. The live store opens when the launch price ends
 * (docs/LAUNCH_PLAN.md), and pay over time arrives with it: "December 4".
 */
const faqOne = byEdition('one');
const faqFounders = byEdition('founders');
const storeLiveDay = new Date(LAUNCH.launchPriceEnds).toLocaleDateString('en-US', {
  timeZone: 'America/Los_Angeles',
  month: 'long',
  day: 'numeric',
});

export const FAQS: Faq[] = [
  {
    topic: 'Launch',
    q: `How does the $${LAUNCH.depositUsd} reservation work?`,
    a: `A ${formatUsd(LAUNCH.depositUsd)} deposit holds your place and locks the ${formatUsd(faqOne.launchPriceUsd)} launch price on ${faqOne.name}. The ${faqFounders.name} is always ${formatUsd(faqFounders.priceUsd)}; its ${formatUsd(LAUNCH.foundersDepositUsd)} deposit holds one numbered serial. When your batch is ready we email a ship date and a link to pay the rest; the deposit comes off the price. Cancel any time before it ships for a full refund, one click, no questions.`,
  },
  { topic: 'Launch', q: 'When does it ship?', a: `Batch 1 ships in ${LAUNCH.firstShipBatch} and Batch 2 in ${LAUNCH.secondShipBatch}. Reservations are filled in order, and your confirmation email shows your batch.` },
  { topic: 'Launch', q: 'What makes the Founders Edition different?', a: 'Tally red anodize, a serial number from 0001 to 2000 engraved on the base, a machined walnut plinth, the Founders feel pack and early firmware for life. When the 2,000 are gone, Tally is gone.' },
  { topic: 'Product', q: 'What is software-defined haptics?', a: 'Instead of a mechanical click, a small brushless motor pushes back on your fingers. Firmware decides where the clicks are, how strong they feel, whether it springs back or stops dead, and it can change that per app in about a millisecond.' },
  { topic: 'Product', q: 'Is it loud?', a: 'The clicks you feel are silent; the motor is quieter than a keyboard. There is an optional tick sound in the app if you like hearing them.' },
  { topic: 'Product', q: 'Can I use it wirelessly?', a: 'Yes. Bluetooth LE with three pairings, about 40 hours of active haptics per charge, and weeks on standby. Or leave it plugged in forever; the battery charge limiter keeps it healthy.' },
  { topic: 'Software', q: 'Do I need an account?', a: 'No. Detent Studio runs locally, profiles live on the device, and nothing is sent anywhere unless you opt in to crash reports.' },
  { topic: 'Software', q: 'What if my app is not supported?', a: `Every app gets the system set out of the box: ${SYSTEM_SET}. Beyond that, the open SDK lets anyone publish a profile, and most community profiles take an evening to write.` },
  { topic: 'Buying', q: 'What if I do not love it?', a: 'Use it for 60 days. If it has not earned its spot on your desk, send it back with the prepaid label for a full refund.' },
  {
    topic: 'Buying',
    q: 'Can I pay over time?',
    a: `Yes, from ${storeLiveDay}, when the store goes live. Checkout splits the price into ${PAYMENT.installments} interest-free payments: ${formatUsd(faqOne.priceUsd / PAYMENT.installments)} each for ${faqOne.name} at ${formatUsd(faqOne.priceUsd)}. It is not offered on deposits or on launch-week orders.`,
  },
  { topic: 'Shipping', q: 'Where do you ship?', a: 'The US, Canada, the UK, the EU, Australia, New Zealand, Japan and South Korea at launch, with duties included in the price you see.' },
  { topic: 'Shipping', q: 'Is shipping free?', a: 'Yes, everywhere we ship, with tracking and insurance.' },
];
