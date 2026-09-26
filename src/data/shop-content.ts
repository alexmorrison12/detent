/**
 * Server-only shop content: the edition comparison and the abridged bill of
 * materials behind "why it costs what it costs". Every number is read from
 * @/data/product or @/config/launch.
 */
import { ACCESSORIES, SPECS, PAYMENT, formatUsd, byEdition } from './product';
import { LAUNCH } from '@/config/launch';

/* -------------------------------------------------------------------------- */
/* Edition comparison                                                         */
/* -------------------------------------------------------------------------- */

const one = byEdition('one');
const founders = byEdition('founders');
const plinthIncluded = founders.includes.find((i) => /plinth/i.test(i)) ?? 'Machined walnut plinth';
const plinthAccessory = ACCESSORIES.find((a) => a.id === 'plinth');
const featurePack = founders.includes.find((i) => /feel pack/i.test(i)) ?? 'Founders feel pack';

export interface CompareRow {
  label: string;
  one: string;
  founders: string;
  /** True when both editions are identical on this row (rendered quieter). */
  same?: boolean;
}

export const COMPARE: CompareRow[] = [
  {
    label: 'Price',
    one: `${formatUsd(one.priceUsd)}, or ${formatUsd(one.launchPriceUsd)} at launch`,
    founders: formatUsd(founders.priceUsd),
  },
  { label: 'Finish', one: 'Raw, Graphite or Glacier', founders: 'Tally red. Only on this edition' },
  {
    label: 'Serial number',
    one: 'Unnumbered',
    founders: `Engraved on the base, 0001 to ${String(LAUNCH.foundersRun).padStart(4, '0')}`,
  },
  {
    label: 'Walnut plinth',
    one: plinthAccessory
      ? `Add it for ${formatUsd(plinthAccessory.priceUsd)}`
      : 'Available as an add-on',
    founders: plinthIncluded.replace(/\s*\(.*\)/, '') + ', included',
  },
  {
    label: 'Feel profiles',
    one: 'All six built-in feels, 64 slots on the device',
    founders: `Everything in Detent One, plus the ${featurePack.replace(/^Founders feel pack: /i, 'Founders pack: ')}`,
  },
  { label: 'Firmware', one: 'Stable channel', founders: 'Early channel, for life' },
  {
    label: 'Reservation deposit',
    one: `${formatUsd(LAUNCH.depositUsd)}, refundable`,
    founders: `${formatUsd(LAUNCH.foundersDepositUsd)}, refundable`,
  },
  {
    label: 'Engraving',
    one: 'Free, up to 24 characters',
    founders: 'Free, up to 24 characters, beside your serial',
  },
  { label: 'Motor, encoder, display', one: 'Identical', founders: 'Identical', same: true },
  {
    label: 'Trial and warranty',
    one: `${PAYMENT.trialDays} days, ${PAYMENT.warrantyYears} years`,
    founders: `${PAYMENT.trialDays} days, ${PAYMENT.warrantyYears} years`,
    same: true,
  },
  {
    label: 'Ships',
    one: `Batch 1, ${LAUNCH.firstShipBatch}`,
    founders: `Batch 1, ${LAUNCH.firstShipBatch}`,
    same: true,
  },
];

/* -------------------------------------------------------------------------- */
/* Why it costs what it costs: an abridged bill of materials                  */
/* -------------------------------------------------------------------------- */

/** Look up a spec value by its row label (throws at build time if renamed). */
export function spec(label: string): string {
  for (const g of SPECS) {
    const row = g.rows.find((r) => r.label === label);
    if (row) return row.value;
  }
  throw new Error(`spec(): no row labelled "${label}" in SPECS`);
}

export interface BomRow {
  part: string;
  spec: string[];
  why: string;
}

export const BOM: BomRow[] = [
  {
    part: 'Body',
    spec: [spec('Material'), spec('Weight').replace(/\..*$/, '')],
    why: 'It does not slide, flex or creak when you lean on it, and it will outlast the computer it is plugged into.',
  },
  {
    part: 'Motor',
    spec: [spec('Motor'), `${spec('Peak torque')} peak torque`],
    why: 'The click is made with torque, not a spring. That is why firmware can make it any click, or none.',
  },
  {
    part: 'Sensor',
    spec: [spec('Position sensing')],
    why: '16,384 positions per turn. It knows where your finger is before you feel the next detent.',
  },
  {
    part: 'Display',
    spec: [spec('Display')],
    why: 'The knob face says what it is controlling, so you never guess which app has the dial.',
  },
  {
    part: 'Care',
    spec: [
      `Warranty: ${spec('Warranty')}`,
      `Opens with ${spec('Repair').split('.')[0]!.replace(/^Four/, 'four')}`,
    ],
    why: 'Battery, foot and knob cap are sold as parts. We would rather sell you a foot than a new Detent.',
  },
  {
    part: 'Software',
    spec: [spec('SDK').split(';')[0]!, `Firmware: ${spec('Firmware').split(',')[0]}`],
    why: 'No account, no cloud, no subscription. If we disappeared tomorrow, your Detent would keep working.',
  },
];
