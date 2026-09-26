/**
 * Client-side .ics (RFC 5545) for "add to calendar": a zero-account reminder
 * that beats web push. Generated from launch.ts dates, downloaded as a Blob.
 */
import { track } from '@/lib/analytics';

export interface IcsEvent {
  /** ISO date ('2026-10-20', all-day) or ISO date-time ('2026-12-01T17:00:00Z'). */
  start: string;
  /** Minutes; timed events only. Default 60. */
  durationMin?: number;
  title: string;
  description: string;
  url: string;
  /** Alarm: minutes before a timed event; for all-day events, hour of the day it fires. */
  alarm?: number;
}

const esc = (s: string) =>
  s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/([,;])/g, '\\$1');

/** Fold lines at 75 octets as the spec requires. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (new TextEncoder().encode(rest).length > 75) {
    let cut = 75;
    while (new TextEncoder().encode(rest.slice(0, cut)).length > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  out.push(rest);
  return out.join('\r\n');
}

const stamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

export function buildIcs(ev: IcsEvent): string {
  const allDay = /^\d{4}-\d{2}-\d{2}$/.test(ev.start);
  const uid = `${crypto.getRandomValues(new Uint32Array(2)).join('')}@detent`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Detent Labs//Launch//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
  ];
  lines.push(`UID:${uid}`, `DTSTAMP:${stamp(new Date())}`);
  if (allDay) {
    const d = ev.start.replace(/-/g, '');
    const next = new Date(`${ev.start}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    lines.push(
      `DTSTART;VALUE=DATE:${d}`,
      `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, '')}`,
    );
  } else {
    const s = new Date(ev.start);
    const e = new Date(s.getTime() + (ev.durationMin ?? 60) * 60_000);
    lines.push(`DTSTART:${stamp(s)}`, `DTEND:${stamp(e)}`);
  }
  lines.push(`SUMMARY:${esc(ev.title)}`, `DESCRIPTION:${esc(ev.description)}`, `URL:${ev.url}`);
  if (ev.alarm !== undefined) {
    const trigger = allDay ? `TRIGGER;RELATED=START:PT${ev.alarm}H` : `TRIGGER:-PT${ev.alarm}M`;
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(ev.title)}`,
      trigger,
      'END:VALARM',
    );
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function downloadIcs(filename: string, ev: IcsEvent, trackAs: string): void {
  const blob = new Blob([buildIcs(ev)], { type: 'text/calendar;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 4000);
  track('ics_download', { calendar: trackAs });
}
