/**
 * Release notes for firmware, Detent Studio and the SDK. Pre-launch betas ran
 * on DVT units and now run on the 500 PVT units testers have on their desks.
 * Newest first. /changelog/ and /changelog/rss.xml both read from here.
 */
import { PROFILE_FORMAT } from '@/scripts/feel/json';

export type Stream = 'Firmware' | 'Studio' | 'SDK';
export type ChangeKind = 'New' | 'Improved' | 'Fixed' | 'Changed' | 'Known issue';

export interface Release {
  stream: Stream;
  version: string;
  /** ISO date (UTC) the release went out. */
  date: string;
  title: string;
  summary: string;
  changes: { kind: ChangeKind; text: string }[];
}

export const RELEASES: Release[] = [
  {
    stream: 'Firmware',
    version: '0.9.2-beta',
    date: '2026-09-22',
    title: 'Quieter Spring, faster Magnet',
    summary: 'Two tester complaints fixed and one we found ourselves. Recommended for everyone on the beta channel.',
    changes: [
      { kind: 'Improved', text: 'Motor PWM moved from 20 kHz to 25 kHz. The faint whine some of you heard in Spring at small deflections is now above hearing range.' },
      { kind: 'Improved', text: 'Magnet snaps settle in 38 ms instead of 55 ms, with no extra overshoot.' },
      { kind: 'Fixed', text: 'Halo LED 17 flickered at 3% brightness on some units.' },
      { kind: 'Fixed', text: 'A long press during a profile switch could register as two presses.' },
    ],
  },
  {
    stream: 'Studio',
    version: '0.14.0-beta',
    date: '2026-09-15',
    title: 'Profile diff',
    summary: 'Compare any two profiles side by side, torque curves overlaid, before you save over the one you liked.',
    changes: [
      { kind: 'New', text: 'Profile diff view: parameters in a table, torque curves on one plot, and a one-click revert per field.' },
      { kind: 'New', text: 'Linux: automatic per-app switching on KDE Plasma 6 under Wayland.' },
      { kind: 'Fixed', text: 'The Premiere Pro plugin lost its connection after Windows 11 woke from sleep.' },
    ],
  },
  {
    stream: 'SDK',
    version: '0.8.0',
    date: '2026-09-02',
    title: 'Rust reaches parity',
    summary: 'The Rust crate now does everything the TypeScript package does. Snap providers can be async.',
    changes: [
      { kind: 'New', text: 'The detent crate covers the full profile API, including snap providers and press handlers.' },
      { kind: 'New', text: 'Snap providers may return a Promise. Studio keeps the last result for 2 s so the dial never waits on your code.' },
      { kind: 'Changed', text: 'feel.wall() takes its stops in degrees, not radians. A codemod ships with the release: npx @detent/codemod wall-degrees.' },
    ],
  },
  {
    stream: 'Firmware',
    version: '0.9.0-beta',
    date: '2026-08-25',
    title: 'Three ways to press',
    summary: 'The force sensor under the knob face is live. Light, firm and hard presses can each do something different.',
    changes: [
      { kind: 'New', text: 'Three pressure levels on the knob face, with thresholds you can set in Studio.' },
      { kind: 'Improved', text: 'Wired latency down from 4.8 ms to 3.6 ms after moving HID reports to a 1 kHz interval.' },
      { kind: 'Fixed', text: 'Encoder zero drifted by up to 0.3° after six hours at 35 °C. It now recalibrates against temperature.' },
    ],
  },
  {
    stream: 'Studio',
    version: '0.13.0-beta',
    date: '2026-08-11',
    title: 'OBS and Lightroom Classic',
    summary: 'Two new plugins, and plugins no longer ask you to restart the app they plug into.',
    changes: [
      { kind: 'New', text: 'OBS Studio plugin: switch scenes in Clock, ride mic gain in Wall.' },
      { kind: 'New', text: 'Lightroom Classic plugin: exposure and white balance with a detent at zero.' },
      { kind: 'Improved', text: 'Plugins install without restarting the host app. DaVinci Resolve still needs one restart; we have asked nicely.' },
    ],
  },
  {
    stream: 'Firmware',
    version: '0.8.4-beta',
    date: '2026-07-21',
    title: 'Bluetooth that behaves',
    summary: 'Wireless is now close enough to wired that most testers stopped noticing which one they were on.',
    changes: [
      { kind: 'Improved', text: 'Bluetooth latency down from 15 ms to 11 ms with a shorter connection interval.' },
      { kind: 'New', text: 'A third pairing slot. Press and hold for two seconds to cycle between hosts.' },
      { kind: 'Fixed', text: 'Reconnecting after a Mac woke from sleep took up to 9 s. It now takes under 1 s.' },
    ],
  },
  {
    stream: 'Studio',
    version: '0.12.0-beta',
    date: '2026-07-02',
    title: 'Studio on Linux',
    summary: 'Detent Studio runs on Linux, packaged three ways, with per-app switching where the desktop allows it.',
    changes: [
      { kind: 'New', text: 'AppImage, .deb and Flatpak builds for x86-64 and ARM64.' },
      { kind: 'New', text: 'Per-app switching on X11, and on GNOME Wayland through a small shell extension Studio installs for you.' },
      { kind: 'Known issue', text: 'Other Wayland compositors fall back to manual switching: press and turn on the knob.' },
    ],
  },
  {
    stream: 'Firmware',
    version: '0.8.0-beta',
    date: '2026-06-10',
    title: 'Sixty-four profiles on the dial',
    summary: 'Profiles live on the device, so it feels right on a machine that has never seen Detent Studio.',
    changes: [
      { kind: 'Changed', text: 'On-device profile storage goes from 16 to 64 slots.' },
      { kind: 'New', text: 'Always-on dim mode: the display drops to 1 Hz at 2% brightness after a minute idle and wakes on touch.' },
      { kind: 'Fixed', text: 'Clock’s noon detent could land one position early after a fast spin.' },
    ],
  },
  {
    stream: 'SDK',
    version: '0.6.0',
    date: '2026-05-19',
    title: 'The SDK goes public',
    summary: 'The TypeScript SDK and the profile format are open, Apache-2.0, on the same day as the firmware source.',
    changes: [
      { kind: 'New', text: 'SDK repository public under Apache-2.0, with examples for VS Code, Blender and a MIDI bridge.' },
      { kind: 'New', text: `Profile format ${PROFILE_FORMAT} published. A profile is one plain JSON file (base feel, physics, press bindings) you can diff, review and version.` },
      { kind: 'New', text: 'Firmware source public, with signed builds so a modified dial can still be told apart.' },
    ],
  },
  {
    stream: 'Firmware',
    version: '0.7.0-beta',
    date: '2026-04-28',
    title: 'Magnet',
    summary: 'The sixth profile. It came from our testers, not from us.',
    changes: [
      { kind: 'New', text: 'Magnet: smooth until it finds a snap point, then it pulls you in. Asked for by 23 of 40 early testers.' },
      { kind: 'Improved', text: 'Ratchet detent edges are 18% sharper without raising peak current.' },
      { kind: 'Fixed', text: 'Wall end stops could be pushed through by about 2° with a hard flick.' },
    ],
  },
  {
    stream: 'Studio',
    version: '0.10.0-beta',
    date: '2026-03-30',
    title: 'Draw your own feel',
    summary: 'The torque curve editor: drag points on a plot, feel the result on the dial as you drag.',
    changes: [
      { kind: 'New', text: 'Torque curve editor with live preview on the connected dial.' },
      { kind: 'New', text: 'Export any profile as JSON, import one by dropping the file on the window.' },
      { kind: 'Fixed', text: 'The Windows installer asked for admin rights it did not need.' },
    ],
  },
];

export const STREAMS: Stream[] = ['Firmware', 'Studio', 'SDK'];

/** Stable anchor id for a release, e.g. "firmware-0-9-2-beta". */
export function releaseId(r: Release): string {
  return `${r.stream}-${r.version}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function releaseName(r: Release): string {
  const product = r.stream === 'Studio' ? 'Detent Studio' : r.stream === 'SDK' ? 'Detent SDK' : 'Firmware';
  return `${product} ${r.version}`;
}
