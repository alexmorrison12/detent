/**
 * When an order or reservation ships, per launch phase, from PHASES[p].ships
 * in src/config/launch.ts (reservations fill Batch 1; launch-day and later
 * orders go to Batch 2). Pages never write a batch number themselves: they
 * render one span per group with data-phase-only, so the right batch shows
 * in every phase and a batch that fills or slips is one edit in launch.ts.
 */
import { PHASES, PHASE_ORDER, type Phase } from '@/config/launch';

export interface ShipsGroup {
  /** Space-separated phases for data-phase-only, e.g. 'tease waitlist reserve'. */
  phases: string;
  /** PHASES[p].ships, e.g. 'Batch 1, February 2027'. */
  ships: string;
  /** 'Batch 1' */
  batch: string;
  /** 'February 2027' */
  when: string;
}

/** 'Batch 2, April 2027' -> { batch: 'Batch 2', when: 'April 2027' }; anything else stays whole. */
export function splitShips(ships: string): { batch: string; when: string } {
  const at = ships.indexOf(', ');
  return at > 0
    ? { batch: ships.slice(0, at), when: ships.slice(at + 2) }
    : { batch: ships, when: '' };
}

/** The given phases grouped by when they ship, in phase order. */
export function shipsByPhase(phases: readonly Phase[] = PHASE_ORDER): ShipsGroup[] {
  const groups = new Map<string, Phase[]>();
  for (const p of PHASE_ORDER) {
    if (!phases.includes(p)) continue;
    const ships = PHASES[p].ships;
    groups.set(ships, [...(groups.get(ships) ?? []), p]);
  }
  return [...groups].map(([ships, ps]) => ({ phases: ps.join(' '), ships, ...splitShips(ships) }));
}

/** The phases whose orders ship in the batch dated `when` (e.g. LAUNCH.secondShipBatch). */
export function phasesShippingIn(when: string): Phase[] {
  return PHASE_ORDER.filter((p) => PHASES[p].ships.includes(when));
}

/** 'February 2027' -> 'Feb 2027'. */
export const shortMonth = (when: string) => when.replace(/^(\w{3})\w*/, '$1');
