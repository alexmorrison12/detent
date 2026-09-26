/**
 * Design demo model: rotation formatting and the brush-size law.
 * Wall's travel is ±135°; brush size is logarithmic from 1 to 400 px, which
 * puts the Wall bump (0°, halfway) at exactly 20 px.
 */
export const START_ROTATION = -12.5;
export const START_BRUSH = 20;
export const BRUSH_MIN = 1;
export const BRUSH_MAX = 400;
export const STOPS = 135;

/** Wrap to (-180, 180] with one decimal, like a design tool's rotation field. */
export function normDeg(d: number): number {
  let v = ((d % 360) + 360) % 360;
  if (v > 180) v -= 360;
  const r = Math.round(v * 10) / 10;
  return Object.is(r, -0) ? 0 : r;
}

export function formatDeg(d: number): string {
  const s = normDeg(d).toFixed(1).replace(/\.0$/, '');
  return `${s.replace('-', '−')}°`;
}

export function angleToSize(angle: number): number {
  const t = Math.min(1, Math.max(0, (angle + STOPS) / (2 * STOPS)));
  return Math.round(BRUSH_MIN * Math.pow(BRUSH_MAX / BRUSH_MIN, t));
}

export function sizeToAngle(size: number): number {
  const t = Math.log(size / BRUSH_MIN) / Math.log(BRUSH_MAX / BRUSH_MIN);
  return t * 2 * STOPS - STOPS;
}

/** Parse "37.5°", "-12,5", "−90" and friends. */
export function parseDeg(input: string): number | null {
  const v = parseFloat(
    input
      .replace('−', '-')
      .replace(',', '.')
      .replace(/[^\d.+-]/g, ''),
  );
  return Number.isFinite(v) ? v : null;
}
