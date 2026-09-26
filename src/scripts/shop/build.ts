/**
 * The configurator's build model. Pure functions only (no DOM), so the page
 * frontmatter, the configurator, the cart drawer and checkout all agree on
 * what a build is, what it costs in each launch phase, and which cart lines
 * it becomes.
 *
 * URL contract (shareable, agent-friendly):
 *   /shop/?edition=one&finish=raw&feel=magnet&engrave=SHIP%20IT&acc=plinth,cable&qty=2
 */
import {
  ACCESSORIES,
  EDITIONS,
  FINISHES,
  PROFILES,
  byEdition,
  byFinish,
  byProfile,
  formatUsd,
  type EditionId,
  type FinishId,
  type ProfileId,
} from '@/data/product';
import { BUILD_PHASE, LAUNCH, PHASE_ORDER, type Phase } from '@/config/launch';
import { launchPriceEndsLabel, sanitizeEngraving } from '@/data/shop';
import type { CartLine } from '@/lib/cart';

export interface Build {
  edition: EditionId;
  finish: FinishId;
  engrave: string;
  feel: ProfileId;
  acc: string[];
  qty: number;
}

export const MAX_QTY = 9;

export const DEFAULT_BUILD: Build = {
  edition: 'one',
  finish: 'graphite',
  engrave: '',
  feel: 'ratchet',
  acc: [],
  qty: 1,
};

/** Accessories that come in the box with an edition (never charged twice). */
export function includedAccessories(edition: EditionId): string[] {
  return edition === 'founders' ? ['plinth'] : [];
}

const isEdition = (v: unknown): v is EditionId => EDITIONS.some((e) => e.id === v);
const isFinish = (v: unknown): v is FinishId => FINISHES.some((f) => f.id === v);
const isProfile = (v: unknown): v is ProfileId => PROFILES.some((p) => p.id === v);

/**
 * Enforce the coupling rules. Founders is the only edition in Tally, so the
 * two fields move together. `changed` says which one the visitor just set,
 * so that one wins a conflict.
 */
export function normalize(
  b: Build,
  changed: 'edition' | 'finish' = 'finish',
  lastOneFinish: FinishId = 'graphite',
): Build {
  let { edition, finish } = b;
  const ed = byEdition(edition);
  if (!ed.finishes.includes(finish)) {
    if (changed === 'finish') {
      edition = EDITIONS.find((e) => e.finishes.includes(finish))?.id ?? edition;
    } else {
      finish = ed.finishes.includes(lastOneFinish) ? lastOneFinish : ed.finishes[0]!;
    }
  }
  const included = includedAccessories(edition);
  const acc = [...new Set(b.acc)].filter(
    (id) => ACCESSORIES.some((a) => a.id === id) && !included.includes(id),
  );
  const qty = Math.min(MAX_QTY, Math.max(1, Math.round(Number.isFinite(b.qty) ? b.qty : 1)));
  return { edition, finish, engrave: sanitizeEngraving(b.engrave), feel: b.feel, acc, qty };
}

/** Read a build from query params. Unknown or hostile values fall back to defaults. */
export function parseBuild(params: URLSearchParams): Build {
  const edition = params.get('edition');
  const finish = params.get('finish');
  const feel = params.get('feel');
  const acc = params
    .getAll('acc')
    .flatMap((v) => v.split(','))
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  const draft: Build = {
    edition: isEdition(edition) ? edition : DEFAULT_BUILD.edition,
    finish: isFinish(finish) ? finish : edition === 'founders' ? 'tally' : DEFAULT_BUILD.finish,
    engrave: (params.get('engrave') ?? '').slice(0, 64),
    feel: isProfile(feel) ? feel : DEFAULT_BUILD.feel,
    acc,
    qty: Number(params.get('qty') ?? 1),
  };
  // A shared link that names a finish wins (finish=tally implies Founders).
  return normalize(draft, isFinish(finish) ? 'finish' : 'edition');
}

export function hasBuildParams(params: URLSearchParams): boolean {
  return ['edition', 'finish', 'feel', 'engrave', 'acc', 'qty'].some((k) => params.has(k));
}

/** Compact, readable query string for a build. */
export function serializeBuild(b: Build): string {
  const p = new URLSearchParams();
  p.set('edition', b.edition);
  p.set('finish', b.finish);
  p.set('feel', b.feel);
  if (b.engrave) p.set('engrave', b.engrave);
  if (b.acc.length) p.set('acc', b.acc.join(','));
  if (b.qty > 1) p.set('qty', String(b.qty));
  // Keep commas readable in shared links.
  return p.toString().replace(/%2C/g, ',');
}

/**
 * A shareable link query for just the device on a cart line: edition,
 * finish and first feel. Never quantity, accessories or engraving, which are
 * the buyer's own (a friend should not open a build for two with someone
 * else's name on it). Null for an accessory.
 */
export function deviceQuery(l: Pick<CartLine, 'edition' | 'finish' | 'feel'>): string | null {
  if (!l.edition || !l.finish) return null;
  return serializeBuild({
    ...DEFAULT_BUILD,
    edition: l.edition,
    finish: l.finish,
    feel: l.feel ?? DEFAULT_BUILD.feel,
  });
}

/* -------------------------------------------------------------------------- */
/* Pricing                                                                    */
/* -------------------------------------------------------------------------- */

/** Phases in which the launch price is what you actually pay. */
export const LAUNCH_PRICE_PHASES: Phase[] = ['reserve', 'launch'];

export function devicePrice(edition: EditionId, phase: Phase): number {
  const e = byEdition(edition);
  return LAUNCH_PRICE_PHASES.includes(phase) ? e.launchPriceUsd : e.priceUsd;
}

/**
 * Whether an edition has a launch price below its regular one. Founders
 * Edition does not: it is one price in every phase, so no copy may promise
 * it a launch price or a lock.
 */
export function hasLaunchPrice(edition: EditionId): boolean {
  const e = byEdition(edition);
  return e.launchPriceUsd < e.priceUsd;
}

/** The regular (post-launch) unit price of a cart line, when it is below it today. */
export function regularUnitPrice(line: CartLine): number | null {
  if (line.kind !== 'device' || !line.edition) return null;
  const regular = byEdition(line.edition).priceUsd;
  return regular > line.unitPriceUsd ? regular : null;
}

/** What the launch price saves across a cart (0 outside launch pricing). */
export function launchSaving(lines: CartLine[]): number {
  return lines.reduce((n, l) => {
    const regular = regularUnitPrice(l);
    return regular === null ? n : n + (regular - l.unitPriceUsd) * l.qty;
  }, 0);
}

/**
 * The launch-week line for a cart holding launch-priced devices: the dated
 * deadline (never a countdown) and the real saving. Empty otherwise.
 */
export function launchNote(lines: CartLine[]): string {
  const saving = launchSaving(lines);
  return saving > 0
    ? `Launch price until ${launchPriceEndsLabel()}. You save ${formatUsd(saving)}.`
    : '';
}

export function depositFor(edition: EditionId): number {
  return edition === 'founders' ? LAUNCH.foundersDepositUsd : LAUNCH.depositUsd;
}

export interface QuoteLine {
  label: string;
  /** Second line under the label (e.g. the engraving text). */
  detail?: string;
  /** Price in USD, or null when the right column shows `note` instead. */
  amount: number | null;
  note?: string;
  qty?: number;
}

export interface Quote {
  lines: QuoteLine[];
  /** Everything in the build at this phase's price. */
  total: number;
  /** Regular (post-launch) total, for the struck-through comparison. */
  regularTotal: number;
  /** Refundable deposit due today (reserve phase), else 0. */
  deposit: number;
}

export function quote(b: Build, phase: Phase): Quote {
  const e = byEdition(b.edition);
  const f = byFinish(b.finish);
  const unit = devicePrice(b.edition, phase);
  const lines: QuoteLine[] = [
    { label: `${e.name}, ${f.name}`, amount: unit * b.qty, qty: b.qty },
    b.engrave
      ? { label: 'Engraving', detail: `“${b.engrave}”`, amount: null, note: 'Free' }
      : { label: 'Engraving', amount: null, note: 'None' },
    { label: 'First feel', amount: null, note: byProfile(b.feel).name },
  ];
  for (const id of includedAccessories(b.edition)) {
    const a = ACCESSORIES.find((x) => x.id === id);
    if (a) lines.push({ label: a.name, amount: null, note: 'Included' });
  }
  let accTotal = 0;
  for (const id of b.acc) {
    const a = ACCESSORIES.find((x) => x.id === id);
    if (!a) continue;
    accTotal += a.priceUsd * b.qty;
    lines.push({ label: a.name, amount: a.priceUsd * b.qty, qty: b.qty });
  }
  const total = unit * b.qty + accTotal;
  const regularTotal = e.priceUsd * b.qty + accTotal;
  const deposit = phase === 'reserve' ? depositFor(b.edition) * b.qty : 0;
  return { lines, total, regularTotal, deposit };
}

export const buildTitle = (b: Pick<Build, 'edition' | 'finish'>) =>
  `${byEdition(b.edition).name} in ${byFinish(b.finish).name}`;

/* -------------------------------------------------------------------------- */
/* Cart lines                                                                 */
/* -------------------------------------------------------------------------- */

export type NewCartLine = Omit<CartLine, 'qty'> & { qty: number };

function key(b: Build): string {
  return [b.edition, b.finish, b.feel, b.engrave || '-'].join(':');
}

/**
 * The lines a build becomes in the cart for a phase.
 * reserve: one refundable deposit per unit (accessories are chosen again when
 * the order is completed; the build link keeps them). launch/live: the device
 * plus each accessory. tease/waitlist: nothing is purchasable yet.
 */
/** The one line a build's device becomes: a deposit in reserve, else the device. */
function unitLine(b: Build, kind: 'device' | 'reservation', phase: Phase): NewCartLine {
  const e = byEdition(b.edition);
  const f = byFinish(b.finish);
  const shared = {
    edition: b.edition,
    finish: b.finish,
    engraving: b.engrave || undefined,
    feel: b.feel,
    build: serializeBuild(b),
    qty: b.qty,
  };
  return kind === 'reservation'
    ? {
        ...shared,
        id: `res:${key(b)}`,
        kind,
        name: `Reservation: ${e.name} in ${f.name}`,
        unitPriceUsd: depositFor(b.edition),
      }
    : {
        ...shared,
        id: `dev:${key(b)}`,
        kind,
        name: e.name,
        unitPriceUsd: devicePrice(b.edition, phase),
      };
}

export function cartLinesFor(b: Build, phase: Phase): NewCartLine[] {
  if (phase === 'reserve') return [unitLine(b, 'reservation', phase)];
  if (phase !== 'launch' && phase !== 'live') return [];
  const lines: NewCartLine[] = [unitLine(b, 'device', phase)];
  for (const id of b.acc) {
    const a = ACCESSORIES.find((x) => x.id === id);
    if (a)
      lines.push({
        id: `acc:${a.id}`,
        kind: 'accessory',
        accessoryId: a.id,
        name: a.name,
        unitPriceUsd: a.priceUsd,
        qty: b.qty,
      });
  }
  return lines;
}

export interface CartSync {
  lines: CartLine[];
  changed: boolean;
  /** One sentence per line that changed kind or price, for the drawer notice. */
  notes: string[];
}

/**
 * Bring stored cart lines in line with a phase. The cart lives in
 * localStorage, so it outlives the phase it was filled in. A line keeps what
 * was chosen (build, qty) but never a stale kind or price:
 * - reserve sells deposits; launch and live sell devices at that phase's
 *   price. An unpaid reservation left in the cart becomes an order when
 *   orders open (no deposit was taken, so there is nothing to credit).
 * - accessory prices are re-read from data.
 * Tease and waitlist sell nothing, so their carts are left alone.
 */
export function syncCartLines(lines: CartLine[], phase: Phase): CartSync {
  if (phase === 'tease' || phase === 'waitlist') return { lines, changed: false, notes: [] };
  const want = phase === 'reserve' ? 'reservation' : 'device';
  const out: CartLine[] = [];
  const notes: string[] = [];
  for (const l of lines) {
    let next: CartLine = { ...l };
    if (l.kind === 'accessory') {
      const a = ACCESSORIES.find((x) => x.id === l.accessoryId);
      if (a && a.priceUsd !== l.unitPriceUsd) {
        notes.push(`${a.name} is ${formatUsd(a.priceUsd)} now.`);
        next.unitPriceUsd = a.priceUsd;
      }
    } else if (l.edition && l.finish) {
      const b: Build = {
        ...DEFAULT_BUILD,
        edition: l.edition,
        finish: l.finish,
        feel: l.feel ?? DEFAULT_BUILD.feel,
        engrave: l.engraving ?? '',
        qty: l.qty,
      };
      const fresh = unitLine(b, want, phase);
      if (l.kind !== want) {
        notes.push(
          want === 'device'
            ? `Orders are open: ${buildTitle(b)} is now an order at ${formatUsd(fresh.unitPriceUsd)}.`
            : `${buildTitle(b)} is a ${formatUsd(fresh.unitPriceUsd)} refundable deposit for now.`,
        );
      } else if (fresh.unitPriceUsd !== l.unitPriceUsd) {
        notes.push(`${buildTitle(b)} is ${formatUsd(fresh.unitPriceUsd)} now.`);
      }
      next = {
        ...l,
        id: fresh.id,
        kind: fresh.kind,
        name: fresh.name,
        unitPriceUsd: fresh.unitPriceUsd,
      };
    }
    const dup = out.find((x) => x.id === next.id);
    if (dup) dup.qty = Math.min(MAX_QTY, dup.qty + next.qty);
    else out.push(next);
  }
  const changed = JSON.stringify(out) !== JSON.stringify(lines);
  return { lines: changed ? out : lines, changed, notes };
}

/* -------------------------------------------------------------------------- */
/* Phase                                                                      */
/* -------------------------------------------------------------------------- */

/** The phase the page is showing (build phase, or a ?phase= preview). */
export function currentPhase(): Phase {
  if (typeof document === 'undefined') return BUILD_PHASE;
  const p = document.documentElement.dataset.phase as Phase | undefined;
  return p && PHASE_ORDER.includes(p) ? p : BUILD_PHASE;
}
