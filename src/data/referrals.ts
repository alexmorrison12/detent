/**
 * Waitlist referral rewards: the single source for the waitlist page's
 * ladder, the launch plan and the docs. Rewards are craft and identity,
 * never discounts. A referral counts when the friend confirms their email.
 */
import { PHASES } from '@/config/launch';

export const PRIORITY_WINDOW_HOURS = 72;

/** The three-friend window opens with reservations. */
export const PRIORITY_WINDOW = {
  opens: PHASES.reserve.starts,
  closesMs: Date.parse(PHASES.reserve.starts) + PRIORITY_WINDOW_HOURS * 3_600_000,
} as const;

export interface ReferralReward {
  /** Confirmed friends needed. */
  n: number;
  name: string;
  detail: string;
  /** Short form for one-line summaries ("three get …"). */
  short: string;
}

export const REFERRAL_REWARDS: ReferralReward[] = [
  {
    n: 1,
    name: 'Referral Ratchet',
    detail: 'A feel profile you can’t get any other way: Ratchet with a heavier click every fifth detent.',
    short: 'the Referral Ratchet profile',
  },
  {
    n: 3,
    name: 'Founders priority window',
    detail: `Reserve a numbered Founders Edition ${PRIORITY_WINDOW_HOURS} hours before everyone else.`,
    short: `the ${PRIORITY_WINDOW_HOURS}-hour Founders priority window`,
  },
  {
    n: 10,
    name: 'Your handle at first boot',
    detail: 'The display greets you by your handle the first time your Detent powers on.',
    short: 'their handle on the display at first boot',
  },
  {
    n: 25,
    name: 'Engraved knob ring',
    detail: 'Your mark, laser-engraved into the knurled ring.',
    short: 'an engraved knob ring',
  },
];

const words: Record<number, string> = { 1: 'One friend', 3: 'three', 10: 'ten', 25: '25' };

/** "One friend gets …, three get …, ten get …, 25 get …." */
export function referralSummary(): string {
  return REFERRAL_REWARDS.map((r, i) => `${words[r.n] ?? r.n} ${i === 0 ? 'gets' : 'get'} ${r.short}`).join(', ') + '.';
}
