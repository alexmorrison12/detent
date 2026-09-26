/**
 * Global sound preference. Off by default (autoplay rules and good manners);
 * the header toggle and the dial's first interaction can turn it on.
 * Anything that makes noise must check isSoundOn() and subscribe to changes.
 */
import { read, write } from './storage';

type Listener = (on: boolean) => void;
const listeners = new Set<Listener>();
let on = false;
let loaded = false;

function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  on = read<boolean>('sound', false);
}

export function isSoundOn(): boolean {
  load();
  return on;
}

export function setSound(next: boolean): void {
  load();
  if (next === on) return;
  on = next;
  write('sound', on);
  document.documentElement.dataset.sound = on ? 'on' : 'off';
  listeners.forEach((fn) => fn(on));
  window.dispatchEvent(new CustomEvent('detent:sound', { detail: { on } }));
}

export function onSoundChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
