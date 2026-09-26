/**
 * /support/: policies, repair parts, contact expectations, and the extra
 * Care questions that sit alongside FAQS from product.ts.
 * Trial length and warranty years always come from PAYMENT.
 */
import { PAYMENT } from './product';
import { LAUNCH } from '@/config/launch';
import { serialRange } from '@/scripts/launch/format';

const editionNumbers = serialRange(LAUNCH.foundersRun);

export const CONTACT = {
  hours: 'Monday to Friday, 09:00 to 17:00 Pacific',
  firstReply: 'one working day',
  /** What to put in the email so the first reply can already fix it. */
  include: [
    // Every unit has a serial. Only the Founders Edition also has an edition number.
    `The serial number: in Detent Studio under Device, and engraved on the base. On a Founders Edition, not the ${editionNumbers} edition number beside it`,
    'Your firmware version, from the same screen',
    'The app you were in and what the dial did instead of what you expected',
  ],
} as const;

export interface Policy {
  id: 'shipping' | 'returns' | 'warranty' | 'repair';
  /** A full sentence with the number in it. */
  headline: string;
  points: string[];
}

export const POLICIES: Policy[] = [
  {
    id: 'shipping',
    headline: 'Free shipping, duties included.',
    points: [
      'Free, tracked and insured to the US, Canada, the UK, the EU, Australia, New Zealand, Japan and South Korea.',
      'Duties and import taxes are included in the price you see. Nobody knocks on your door for more.',
      'Orders leave within two working days of your batch date. You get the tracking number the same day.',
    ],
  },
  {
    id: 'returns',
    headline: `A ${PAYMENT.trialDays}-day studio trial.`,
    points: [
      `Use it for ${PAYMENT.trialDays} days on real work. If it has not earned the spot on your desk, send it back.`,
      'We email a prepaid label. Refunds go back to the original payment method within 5 working days of the dial arriving.',
      'Engraved units are returnable too. We re-machine the base and give it a second life as a test unit.',
    ],
  },
  {
    id: 'warranty',
    headline: `Warranty: ${PAYMENT.warrantyYears} years, parts and labor.`,
    points: [
      'Covers the motor, encoder, display, board and battery against defects, including a battery that falls below 80% capacity.',
      'Does not cover drops, liquids or a knob cap you scratched on purpose. Those are what the parts list is for.',
      'We cover shipping both ways. If a repair takes more than 10 days, we send a replacement first.',
    ],
  },
  {
    id: 'repair',
    headline: 'Opening it is allowed.',
    points: [
      'Opening the dial does not void the warranty. Breaking it while it is open is on you, and parts are cheap.',
      'Every part on the list ships with a T6 driver and a printed guide. Guides and teardown photos are on GitHub.',
    ],
  },
];

export const REPAIR_STEPS: string[] = [
  'Turn the dial over on a soft cloth and peel back the silicone foot from the notch.',
  'Remove the four T6 screws. They are the same length; you cannot put them back wrong.',
  'Lift the base straight up. The battery sits on a connector, not glue: unplug it first.',
  'Swap the part, plug the battery back in, and reverse the steps. Detent Studio runs a self-test when you reconnect.',
];

export const PARTS: { name: string; priceUsd: number; note: string }[] = [
  { name: 'Battery, 2,000 mAh', priceUsd: 19, note: 'Plug-in connector' },
  { name: 'Micro-suction foot', priceUsd: 6, note: 'Pack of two' },
  { name: 'Knob cap with cover glass', priceUsd: 29, note: 'Per finish' },
  { name: 'Braided USB-C cable, 1 m', priceUsd: 15, note: 'Same as in the box' },
];

/** Care questions: extra FAQ entries owned by the support page. */
export const CARE_FAQS: { q: string; a: string }[] = [
  {
    q: 'How do I update the firmware?',
    a: 'Detent Studio checks once a day and asks before installing. Updates are signed, take about 40 seconds over USB or two minutes over Bluetooth, and keep all 64 of your profiles.',
  },
  {
    q: 'Can I replace the battery myself?',
    a: 'Yes. Four T6 screws, one connector, no glue. The replacement battery ships with the driver and a printed guide.',
  },
  {
    q: 'Does it work through a dock, hub or KVM switch?',
    a: 'Over USB it is a standard HID and MIDI device, so any hub or dock that passes a keyboard through will pass Detent through. Some KVM switches emulate keyboards instead of passing them through; on those, use Bluetooth.',
  },
  {
    q: 'How do I clean it?',
    a: 'A dry microfiber cloth for the body, a slightly damp one for the glass. If the foot stops gripping, rinse it under warm water and let it air-dry.',
  },
];
