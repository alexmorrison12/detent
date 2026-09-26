/**
 * /story/: manifesto, founders, prototype timeline, principles and roadmap.
 * Detent Labs and its people are fictional (the site is a concept demo); the
 * page says so. The one real credit is Scott Bezek's open-source SmartKnob.
 */
import { LAUNCH } from '@/config/launch';
import { APPS } from './directory';

export const SMARTKNOB = {
  name: 'SmartKnob',
  author: 'Scott Bezek',
  url: 'https://github.com/scottbez1/smartknob',
} as const;

/** Read top to bottom, one line per beat. */
export const MANIFESTO: string[] = [
  'Every knob on your screen is a picture of a knob.',
  'You turn it with a device built for pointing.',
  'Your hands know better. They can find a frame, a semitone, a line of code, if something tells them where it is.',
  'So we built one real knob that can become all of the others.',
  'It clicks where the software says a click belongs. It stops where the range ends. It snaps to what matters.',
];

export interface Founder {
  name: string;
  role: string;
  line: string;
}

export const FOUNDERS: Founder[] = [
  {
    name: 'Mira Castellanos',
    role: 'Firmware and haptics',
    line: 'Ten years writing motor control for camera gimbals. Nights mixing records for friends, with a mouse, badly.',
  },
  {
    name: 'Oskar Nyberg',
    role: 'Industrial design and machining',
    line: 'Designed lab instruments for a living. Learned to run a CNC mill because waiting three weeks for a prototype felt worse.',
  },
];

export interface Milestone {
  /** Real prototype or build-stage name. */
  code: string;
  /** ISO year-month. */
  date: string;
  title: string;
  body: string;
  /** The number that mattered at that stage. */
  figure: string;
  figureLabel: string;
}

export const MILESTONES: Milestone[] = [
  {
    code: 'P0',
    date: '2023-11',
    title: 'A weekend knob',
    body: 'Mira builds a SmartKnob from the open-source files and does not put it down for a week. It has one profile she keeps retuning at 2 a.m.',
    figure: '1',
    figureLabel: 'knob, no plan',
  },
  {
    code: 'P1',
    date: '2024-03',
    title: 'Our own feel engine',
    body: 'New firmware from scratch, built around one question: how fast can the feel change when you switch apps? The first answer was not fast enough.',
    figure: '38 ms',
    figureLabel: 'app switch to new feel',
  },
  {
    code: 'P2',
    date: '2024-09',
    title: 'The first machined body',
    body: 'Oskar mills the housing from a single billet of 6061. It is beautiful and it weighs 290 g, which is exactly light enough to skate across the desk when you flick it.',
    figure: '290 g',
    figureLabel: 'too light',
  },
  {
    code: 'P3',
    date: '2025-04',
    title: 'Solid base, round screen',
    body: 'We stop hollowing the base and add the round display. The dial now stays where you put it and tells you what it is controlling.',
    figure: '412 g',
    figureLabel: 'stays put',
  },
  {
    code: 'EVT',
    date: '2025-10',
    title: 'Forty strangers',
    body: 'Engineering validation units go to editors, mix engineers, designers and developers we had never met. Their first request, from 23 of them, became Magnet.',
    figure: '40',
    figureLabel: 'units, 40 testers',
  },
  {
    code: 'DVT',
    date: '2026-04',
    title: 'Break it on purpose',
    body: 'Drop tests, heat soak, and a rig that turns the knob until the bearings give up. They did not give up.',
    figure: '1,000,000',
    figureLabel: 'turns on the test rig',
  },
  {
    code: 'PVT',
    date: '2026-08',
    title: 'Off the production line',
    body: 'Five hundred units from the real line, with real tolerances. The same firmware you can read on GitHub runs on every one.',
    figure: '3.6 ms',
    figureLabel: 'wired latency',
  },
];

export interface Principle {
  word: string;
  claim: string;
  proof: string;
}

export const PRINCIPLES: Principle[] = [
  {
    word: 'Local-first',
    claim: 'No account, no cloud, no telemetry unless you turn it on.',
    proof: 'Profiles live on the dial, so it feels right on a computer that has never seen Detent Studio.',
  },
  {
    word: 'Open',
    claim: 'Firmware under Apache-2.0. SDK in TypeScript and Rust.',
    proof: 'Profiles are plain JSON. You can diff a feel, review it in a pull request, and fork ours.',
  },
  {
    word: 'Repairable',
    claim: 'Four Torx screws and the whole thing comes apart.',
    proof: 'Battery, foot and knob cap are sold as parts, with prices on the support page.',
  },
  {
    word: 'Honest',
    claim: 'Real dates, a refundable deposit, a numbered run that really ends.',
    proof: `The Founders Edition stops at ${LAUNCH.foundersRun.toLocaleString('en-US')}. And this site says plainly that Detent is a concept.`,
  },
];

export interface RoadmapItem {
  when: string;
  title: string;
  body: string;
  state: 'now' | 'next' | 'later';
}

const nativeOrPlugin = APPS.filter((i) => i.status !== 'community').length;

export const ROADMAP: RoadmapItem[] = [
  {
    when: 'Now',
    title: 'Beta on 500 desks',
    body: 'Firmware 0.9 and Studio 0.14 on every PVT unit. The SDK is public and taking pull requests.',
    state: 'now',
  },
  {
    when: 'December 2026',
    title: 'Firmware 1.0 and Studio 1.0',
    body: `Launch software: profiles for ${nativeOrPlugin} apps built in or by plugin, every community profile that passes review, and system controls everywhere else.`,
    state: 'next',
  },
  {
    when: LAUNCH.firstShipBatch,
    title: 'Batch 1 ships',
    body: `Reservations are filled in order. Batch 2 follows in ${LAUNCH.secondShipBatch}.`,
    state: 'next',
  },
  {
    when: 'Spring 2027',
    title: 'Linked pairs',
    body: 'Two dials, one profile set: scrub with your left hand, zoom with your right. Firmware 1.2.',
    state: 'later',
  },
  {
    when: 'Summer 2027',
    title: 'Profiles per browser tab',
    body: 'A browser extension so web apps get their own feel instead of sharing one. Studio 1.3.',
    state: 'later',
  },
  {
    when: 'After that',
    title: 'Not Detent Two',
    body: 'A profile library inside Studio, more integrations, longer battery. A second product waits until the first one is right.',
    state: 'later',
  },
];
