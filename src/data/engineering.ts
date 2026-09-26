/**
 * Engineering facts for /specs/ that product.ts does not carry: drawing
 * dimensions, the exploded stack, compatibility, the honest limits list and
 * the mechanical-vs-software comparison. Anything product.ts already states
 * (price, weight, torque, resolution) is read from there, not repeated.
 */
import { SPECS, SYSTEM_SET } from './product';
import { MM } from '@/scripts/dial/model';

/** Pull a number out of a SPECS row, e.g. specNumber('Haptics', 'Peak torque') -> 32. */
export function specNumber(group: string, label: string): number {
  const row = SPECS.find((g) => g.title === group)?.rows.find((r) => r.label === label);
  const n = row ? parseFloat(row.value.replace(/,/g, '').match(/\d+(\.\d+)?/)?.[0] ?? '') : NaN;
  if (Number.isNaN(n)) throw new Error(`specNumber: no number for ${group} / ${label}`);
  return n;
}

export function specValue(group: string, label: string): string {
  const row = SPECS.find((g) => g.title === group)?.rows.find((r) => r.label === label);
  if (!row) throw new Error(`specValue: missing ${group} / ${label}`);
  return row.value;
}

/* -------------------------------------------------------------------------- */
/* Drawing dimensions (mm). The three headline numbers match SPECS; the rest  */
/* come from MM, the model both dial renderers and the stills are built from, */
/* so the drawing, the copy and every picture of the dial agree.              */
/* -------------------------------------------------------------------------- */

const displayInches = parseFloat(specValue('Display & light', 'Display'));

export const DIMENSIONS = {
  baseDia: 72,
  knobDia: 58,
  height: 44,
  /** Base, with its foot, up to where the knob starts. */
  baseHeight: MM.baseTop,
  /** Running clearance between base and knob. */
  knobGap: Math.round((MM.knobBottom - MM.baseTop) * 100) / 100,
  /** The halo ring's light slot, low on the base just above the foot. */
  haloFrom: MM.slotBottom,
  haloTo: MM.slotTop,
  /** Knurled band on the knob skirt. */
  knurlFrom: MM.knurlBottom,
  knurlTo: MM.knurlTop,
  knurlLines: MM.knurlTeeth,
  topChamfer: 1.2,
  /** Round display, diagonal from SPECS (1.43 in -> 36.3 mm). */
  displayDia: Math.round(displayInches * 25.4 * 10) / 10,
  weightG: specNumber('Body', 'Weight'),
} as const;

/* -------------------------------------------------------------------------- */
/* Exploded stack, top to bottom (a real physical order).                     */
/* -------------------------------------------------------------------------- */

export interface Part {
  name: string;
  detail: string;
}

export const EXPLODED_PARTS: Part[] = [
  { name: 'Cover glass', detail: 'Strengthened, anti-glare, 0.7 mm. Replaceable with the knob cap.' },
  { name: 'Display', detail: `${displayInches}″ round AMOLED, 466 × 466. It sits still while the knob turns around it.` },
  { name: 'Knob shell', detail: `6061-T6, knurled at ${MM.knurlTeeth} lines, turned and bead-blasted in one setup.` },
  { name: 'Gimbal motor', detail: 'Brushless, hollow shaft. The display cable runs through the middle.' },
  { name: 'Encoder', detail: 'A diametric magnet on the shaft over a 14-bit sensor. Nothing touches.' },
  { name: 'Main board', detail: 'Motor driver, Bluetooth radio and the 24 LEDs of the halo ring.' },
  { name: 'Battery', detail: '2,000 mAh, on a connector. Not glued, never glued.' },
  { name: 'Base and foot', detail: 'Solid 6061 for weight, four Torx screws, micro-suction silicone foot.' },
];

/* -------------------------------------------------------------------------- */
/* Camera presets for the viewer.                                             */
/* -------------------------------------------------------------------------- */

export const VIEWS = [
  { id: 'hero', label: 'Desk', caption: 'Three-quarter, the way it sits beside your keyboard.' },
  { id: 'top', label: 'Top', caption: 'From above: the round display and the tally line that tells you where zero is.' },
  { id: 'side', label: 'Side', caption: `Profile. ${DIMENSIONS.height} mm tall, low enough to rest your wrist beside it.` },
  { id: 'front', label: 'Front', caption: 'Face on, at desk height. The halo ring glows in a slot low on the base, just above the foot.' },
  { id: 'exploded', label: 'Exploded', caption: 'Eight layers, top to bottom. Every one comes apart with a T6 driver.' },
] as const;

export type ViewId = (typeof VIEWS)[number]['id'];

/* -------------------------------------------------------------------------- */
/* Fixed detents vs software-defined.                                          */
/* -------------------------------------------------------------------------- */

export const COMPARISON: { aspect: string; mechanical: string; detent: string }[] = [
  {
    aspect: 'Where the clicks come from',
    mechanical: 'A notched wheel and a spring, cut at the factory',
    detent: 'A brushless motor, redrawn by firmware 10,000 times a second',
  },
  { aspect: 'Detents per turn', mechanical: 'Fixed. Usually 20 or 24', detent: 'Any number from 0 to 360, per app, per control' },
  { aspect: 'End stops', mechanical: 'None, or a metal pin that is always there', detent: 'Virtual, at any angle, or none at all' },
  { aspect: 'Return to center', mechanical: 'A separate spring-loaded part', detent: 'A setting. That is the Spring profile' },
  { aspect: 'Snapping to content', mechanical: 'Not possible', detent: 'Magnet snaps to markers, keyframes and diff hunks' },
  { aspect: 'Changing the feel', mechanical: 'Buy a different knob', detent: 'About a millisecond, when you switch apps' },
  { aspect: 'Positions per turn', mechanical: 'As many as it has clicks', detent: '16,384, from a 14-bit sensor' },
  { aspect: 'Wear', mechanical: 'Metal contacts. The clicks soften over the years', detent: 'Contactless sensing. Only two ball bearings touch' },
];

/** A typical mechanical panel encoder, for the torque plot. */
export const MECHANICAL = { detents: 24, torque: 9 } as const;

/* -------------------------------------------------------------------------- */
/* Compatibility                                                              */
/* -------------------------------------------------------------------------- */

export type Support = 'yes' | 'partial' | 'no';
export const PLATFORMS = ['macOS 13+', 'Windows 11', 'Linux', 'iPadOS'] as const;

export const COMPATIBILITY: { feature: string; cells: { s: Support; note?: string }[] }[] = [
  {
    // The system set is plain HID: it needs no app, so it works everywhere.
    feature: `${SYSTEM_SET.charAt(0).toUpperCase()}${SYSTEM_SET.slice(1)} over USB-C`,
    cells: [{ s: 'yes' }, { s: 'yes' }, { s: 'yes' }, { s: 'yes' }],
  },
  {
    feature: 'Class-compliant MIDI',
    cells: [{ s: 'yes' }, { s: 'yes' }, { s: 'yes', note: 'ALSA' }, { s: 'yes' }],
  },
  {
    feature: 'Bluetooth LE, three pairings',
    cells: [{ s: 'yes' }, { s: 'yes' }, { s: 'yes', note: 'BlueZ 5.66+' }, { s: 'yes' }],
  },
  {
    feature: 'Detent Studio app',
    cells: [{ s: 'yes' }, { s: 'yes' }, { s: 'yes', note: 'AppImage, .deb, Flatpak' }, { s: 'no' }],
  },
  {
    feature: 'Automatic per-app profiles',
    cells: [
      { s: 'yes' },
      { s: 'yes' },
      { s: 'partial', note: 'X11, GNOME and KDE on Wayland' },
      { s: 'partial', note: 'Pick on the knob: press and turn' },
    ],
  },
  {
    feature: 'Firmware updates',
    cells: [{ s: 'yes' }, { s: 'yes' }, { s: 'yes' }, { s: 'partial', note: 'From a Mac or PC' }],
  },
];

/* -------------------------------------------------------------------------- */
/* What it can't do (yet). Honest limits, each with a status.                 */
/* -------------------------------------------------------------------------- */

export interface Limit {
  title: string;
  body: string;
  status: string;
  /** true when a fix is on the roadmap. */
  planned: boolean;
}

export const LIMITS: Limit[] = [
  {
    title: 'Switch profiles by itself on an iPad.',
    body: 'iPadOS does not tell other apps which app is in front. On iPad you choose the profile on the knob: press and turn.',
    status: 'Waiting on Apple',
    planned: false,
  },
  {
    title: 'Tell browser tabs apart.',
    body: `To Detent, your browser is one app. Figma in a tab gets its profile through the Figma plugin; other web apps get the system set: ${SYSTEM_SET}.`,
    status: 'Planned: browser extension, Studio 1.3',
    planned: true,
  },
  {
    title: 'Give full torque on battery.',
    body: 'Wireless, peak torque is capped at 24 mN·m so a charge lasts about 40 hours. Plug in and you get the full 32.',
    status: 'By design',
    planned: false,
  },
  {
    title: 'Work as a linked pair.',
    body: 'Two Detents on one desk are two separate devices today. Linked pairs, one scrubbing and one zooming, arrive in firmware 1.2.',
    status: 'Planned: firmware 1.2, spring 2027',
    planned: true,
  },
  {
    title: 'Replace your shortcuts.',
    body: 'One knob and one press with three pressure levels. It is not a macro pad and does not pretend to be.',
    status: 'By design',
    planned: false,
  },
  {
    title: 'Be felt through this website.',
    body: 'A screen cannot push back on your finger. What you hear and see here is a simulation of the torque, not the torque.',
    status: 'Physics',
    planned: false,
  },
];
