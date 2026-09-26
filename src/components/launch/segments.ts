/**
 * Copy for "What would you turn?". Segment ids, labels and default profiles
 * live in @/lib/waitlist (SEGMENTS); this adds what the waitlist page says
 * and what the knob's display shows for each.
 */
import type { Segment } from '@/lib/waitlist';

export const SEGMENT_COPY: Record<Segment, { app: string; line: string }> = {
  editing: { app: 'RESOLVE', line: 'one click, one frame, in Resolve and Premiere.' },
  music: { app: 'LOGIC', line: 'hard stops at 0 and 100, and a bump at unity gain in Logic.' },
  design: { app: 'BLENDER', line: 'orbit Blender’s viewport with real weight behind it.' },
  code: { app: 'VS CODE', line: 'snaps to every hunk in your diff, then lets go.' },
  streaming: { app: 'OBS', line: 'twelve heavy clicks, one per OBS scene.' },
};

/** Short labels engraved on the selector arc (the chips carry the full names). */
export const SEGMENT_SHORT: Record<Segment, string> = {
  editing: 'Edit',
  music: 'Music',
  design: '3D',
  code: 'Code',
  streaming: 'Stream',
};

/** Dial angle for each segment on the waitlist selector (rest is -90). */
export const SEGMENT_ANGLE: Record<Segment, number> = {
  editing: -60,
  music: -30,
  design: 0,
  code: 30,
  streaming: 60,
};
export const REST_ANGLE = -90;
