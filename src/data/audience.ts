/**
 * Audience landing pages (/for/<id>/): the copy that is specific to each
 * page. Headlines, subheads, pains, apps and the default profile live in
 * AUDIENCES (src/data/product.ts); this file adds how Detent fixes each pain,
 * the demo it opens with, and the questions each crowd actually asks.
 */
import { FAQS, type AudienceId, type ProfileId } from './product';

export type DemoApp = 'edit' | 'mix' | 'design' | 'code';

export interface AudienceFix {
  /** Must match one of AUDIENCES[id].pains, in order. */
  pain: string;
  profile: ProfileId;
  /** The fix, concretely. Two or three sentences. */
  fix: string;
  /** Demo mode that shows this fix (a "Try it" link), if the hero demo has one. */
  mode?: string;
  /** Which app it applies to, shown as a small tag. */
  where: string;
}

export interface AudiencePage {
  id: AudienceId;
  /** <title> (BaseLayout appends " · Detent"). */
  title: string;
  /** Meta description, ≤ 160 characters. */
  description: string;
  /** The word in AUDIENCES[id].headline set in the page's feel color. */
  accentWord: string;
  /** The hero demo. */
  demo: DemoApp;
  /** A spec line under the audience label: what the knob does here, in numbers. */
  spec: string;
  painsTitle: string;
  fixes: AudienceFix[];
  appsTitle: string;
  offerTitle: string;
  offerLine: string;
  faqTitle: string;
  /** Questions this audience asks (shown before the shared ones). */
  faqs: { q: string; a: string }[];
  /** Questions to include from FAQS (src/data/product.ts), by exact text. */
  sharedFaqs: string[];
  /** Short label for cross-links from the other audience pages. */
  crossLine: string;
}

const SHARED = [
  'What is software-defined haptics?',
  'How does the $20 reservation work?',
  'What if I do not love it?',
];

export const AUDIENCE_PAGES: Record<AudienceId, AudiencePage> = {
  editors: {
    id: 'editors',
    title: 'Detent One for video editors: frame step, shuttle, markers',
    description:
      'A machined dial that steps exactly one frame per click, shuttles from −4× to 4× and snaps to markers. For Resolve, Premiere, Final Cut and After Effects.',
    accentWord: 'frame',
    demo: 'edit',
    spec: '24 detents per turn · 1 frame per detent',
    painsTitle: 'Where the frames go missing.',
    fixes: [
      {
        pain: 'Overshooting the edit point by three frames',
        profile: 'ratchet',
        fix: 'Ratchet puts a detent on every frame: 24 per turn, one frame per click. Your hand stops on the frame, so the playhead does too.',
        mode: 'step',
        where: 'Resolve, Premiere Pro',
      },
      {
        pain: 'JKL gymnastics for a simple trim',
        profile: 'spring',
        fix: 'Turn away from center and Spring plays; turn further and it plays faster, up to 4× either way. Let go and it springs back and stops. J, K and L in one hand.',
        mode: 'shuttle',
        where: 'Resolve, Premiere Pro',
      },
      {
        pain: 'Scrubbing a 40-minute timeline with a mouse wheel',
        profile: 'magnet',
        fix: 'Magnet glides until it reaches a marker, then snaps onto it. Mark your selects once and travel the timeline marker to marker, by feel.',
        mode: 'markers',
        where: 'Resolve, After Effects',
      },
    ],
    appsTitle: 'In the apps you cut in.',
    offerTitle: 'One knob for the whole edit.',
    offerLine:
      'Resolve, Premiere, Final Cut and After Effects. The feel changes when you change apps, in about a millisecond.',
    faqTitle: 'Questions editors ask.',
    faqs: [
      {
        q: 'Is frame-stepping exact at 23.976 and 29.97 drop-frame?',
        a: 'Yes. Each detent asks the host for one frame, exactly like the arrow key does, so fractional and drop-frame rates step cleanly. There is no key repeat to overshoot with.',
      },
      {
        q: 'Does it replace my editing keyboard?',
        a: 'No. It replaces the mouse wheel and the jog you never bought. Keep your keyboard for cuts; Detent does the moving between them.',
      },
    ],
    sharedFaqs: SHARED,
    crossLine: 'One frame per click',
  },

  musicians: {
    id: 'musicians',
    title: 'Detent One for producers: a fader with a bump at unity',
    description:
      'A machined dial with hard stops at −∞ and +6 dB and a bump at unity gain. Class-compliant USB-C MIDI, native in Ableton, Logic and Bitwig.',
    accentWord: 'real',
    demo: 'mix',
    spec: '270° of travel · a bump at 0 dB',
    painsTitle: 'What a mouse does to a mix.',
    fixes: [
      {
        pain: 'Dragging tiny on-screen knobs with a mouse',
        profile: 'wall',
        fix: 'Map a macro or a plugin knob and the dial becomes it: 270° of real travel, hard stops where the knob ends and a bump at unity. The mouse stays on the mouse pad.',
        mode: 'fader',
        where: 'Ableton Live, Logic Pro',
      },
      {
        pain: 'Controllers that feel the same for every parameter',
        profile: 'clock',
        fix: 'Every parameter gets its own feel. Wall for gain, Clock with a heavy detent at noon for picking tracks and scenes, Spring for pitch bend. The dial changes over in about a millisecond.',
        mode: 'channel',
        where: 'Ableton Live, FL Studio',
      },
      {
        pain: 'MIDI mapping that never quite sticks',
        profile: 'spring',
        fix: 'Detent is a class-compliant USB-C MIDI device, no driver. Profiles are plain JSON that follow your plugin window, so a mapping made tonight is still there tomorrow.',
        where: 'Bitwig Studio, any DAW',
      },
    ],
    appsTitle: 'In the DAW you already have.',
    offerTitle: 'Put your hand back on the mix.',
    offerLine:
      'Native in Ableton, Logic and Bitwig, MIDI everywhere else. No driver, no account, no subscription.',
    faqTitle: 'Questions producers ask.',
    faqs: [
      {
        q: 'Does it work without a DAW plugin?',
        a: 'Yes. Over USB-C it is a class-compliant MIDI device, so anything that can MIDI-learn can use it. The native integrations add per-plugin profiles and the labels on the knob’s display.',
      },
      {
        q: 'Where exactly is the unity bump?',
        a: 'Wherever your DAW puts 0 dB on the fader. The bump is a firmware detent, not a notch in the metal, so it moves to match the fader law of the app you are in.',
      },
    ],
    sharedFaqs: SHARED,
    crossLine: 'A bump at unity gain',
  },

  designers: {
    id: 'designers',
    title: 'Detent One for designers: rotate, brush and orbit by feel',
    description:
      'A machined dial that rotates with weight to 0.1°, steps 15° per click and sets brush size between hard stops. For Figma, Photoshop, Lightroom and Blender.',
    accentWord: 'feel',
    demo: 'design',
    spec: '0.1° readout · 15° per click · 1 to 400 px',
    painsTitle: 'The numbers you never land on.',
    fixes: [
      {
        pain: 'Typing 37.5° because dragging never lands on it',
        profile: 'fluid',
        fix: 'Fluid turns with weight and no clicks, and reads to a tenth of a degree. Press the knob for 10:1 fine control and 37.5° is a slow, deliberate turn away.',
        mode: 'rotate',
        where: 'Figma, Photoshop',
      },
      {
        pain: 'Brush size shortcuts you can’t see',
        profile: 'wall',
        fix: 'Brush size lives on the dial, with hard stops at 1 and 400 px and a bump at 20. The knob’s display shows the size while you turn, so you feel it before you see the cursor.',
        mode: 'brush',
        where: 'Photoshop, Lightroom Classic',
      },
      {
        pain: 'Viewport orbit that fights your hand',
        profile: 'ratchet',
        fix: 'Orbit in Fluid with real inertia when you are exploring, then switch to Ratchet for exact 15° turns when you are setting up a shot. Same knob, two feels.',
        mode: 'step',
        where: 'Blender, Figma',
      },
    ],
    appsTitle: 'In the tools on your dock.',
    offerTitle: 'Pen in one hand. Dial in the other.',
    offerLine:
      'Figma, Photoshop, Lightroom and Blender, each with its own feel. At 412 g it stays where you put it.',
    faqTitle: 'Questions designers ask.',
    faqs: [
      {
        q: 'Does it work next to a pen tablet?',
        a: 'That is the point: pen in your drawing hand, dial in the other. It weighs 412 g on a micro-suction foot, so it does not slide when you turn it hard.',
      },
      {
        q: 'Does it work on iPad?',
        a: 'Yes, over Bluetooth or USB-C with iPadOS. System controls such as scroll, zoom and undo work everywhere; deeper integrations depend on each app.',
      },
    ],
    sharedFaqs: SHARED,
    crossLine: 'Rotation to 0.1°',
  },

  developers: {
    id: 'developers',
    title: 'Detent One for developers: snap through every hunk',
    description:
      'A machined dial that snaps through diff hunks, walks the undo stack one click at a time and steps the debugger. Open SDK in TypeScript and Rust, open firmware.',
    accentWord: 'diff',
    demo: 'code',
    spec: '1 snap per hunk · 1 line per click',
    painsTitle: 'Where your place goes.',
    fixes: [
      {
        pain: 'Losing your place in a 900-line diff',
        profile: 'magnet',
        fix: 'Magnet snaps to every hunk, problem and search result. Turn to the next change, press to mark it viewed. Your place in the review is wherever the knob is.',
        mode: 'hunks',
        where: 'VS Code',
      },
      {
        pain: 'Undo-undo-undo-redo',
        profile: 'ratchet',
        fix: 'Ratchet walks the undo stack one click per step, in both directions. Overshoot by one and you turn back by one, not three shortcuts.',
        mode: 'lines',
        where: 'VS Code',
      },
      {
        pain: 'Stepping a debugger with F10 for the 200th time',
        profile: 'ratchet',
        fix: 'Each click steps the debugger one line; press the knob to continue. The same detent you feel is the line you move.',
        mode: 'lines',
        where: 'Xcode',
      },
    ],
    appsTitle: 'In the editor, the debugger and the shell.',
    offerTitle: 'Hardware with a readable SDK.',
    offerLine:
      'Open SDK in TypeScript and Rust, Apache-2.0 firmware, profiles in plain JSON. No account, no telemetry by default.',
    faqTitle: 'Questions developers ask.',
    faqs: [
      {
        q: 'Can I write my own profile?',
        a: 'Yes. A profile is plain JSON: detent count, strength, damping, spring, end stops and snap points. The SDK lets any app switch profiles and read the knob; most community profiles take an evening.',
      },
      {
        q: 'Does it need a daemon running?',
        a: 'Detent Studio runs locally to switch profiles per app. Without it, the dial still works as a HID and MIDI device using the 64 profiles stored on it.',
      },
    ],
    sharedFaqs: [
      'What is software-defined haptics?',
      'Do I need an account?',
      'How does the $20 reservation work?',
      'What if I do not love it?',
    ],
    crossLine: 'Snaps to every hunk',
  },
};

export interface AudienceFaqItem {
  q: string;
  a: string;
  /** data-phase-only value, when the answer only applies in some phases. */
  phases?: string;
}

/** The page's own questions, then the shared ones (launch questions gated to pre-launch phases). */
export function faqsFor(page: AudiencePage): AudienceFaqItem[] {
  const shared = page.sharedFaqs
    .map((q) => FAQS.find((f) => f.q === q))
    .filter((f): f is NonNullable<typeof f> => Boolean(f))
    .map((f) => ({
      q: f.q,
      a: f.a,
      phases: f.topic === 'Launch' ? 'waitlist reserve' : undefined,
    }));
  return [...page.faqs, ...shared];
}
