/**
 * Mix demo controller. Wall rides the selected fader through a console fader
 * law (hard stops at −∞ and +6 dB, the bump moved to unity). Clock steps the
 * channel selection one heavy click at a time. Press mutes.
 *
 * The meters play on their own for a few seconds each time the mixer comes
 * into view, then park until someone hovers, focuses, taps or turns the
 * dial (the same budget as the dial's autorotate). The transport button
 * overrides that either way: Pause stays paused, Play stays playing.
 */
import { Jog, loop, pulse, type Mount } from './core';
import {
  BPM,
  CHANNELS,
  START_BAR,
  START_CHANNEL,
  UNITY_ANGLE,
  UNITY_P,
  angleToP,
  dbToP,
  formatDb,
  meterPos,
  pToAngle,
  pToDb,
  signal,
  spokenDb,
} from './mix-model';

const RELEASE = 20 / 66; // meter fall: 20 dB per second, in meter units
const UNITY_CATCH = 1.6; // degrees either side of unity that read as exactly 0 dB
const METER_MS = 30; // meters repaint at ~30 fps (every other frame at 60 Hz); the ballistics read the same
const AUTO_MS = 5000; // unattended playback per view (WCAG 2.2.2), as for autorotate

/** auto: plays unattended for AUTO_MS, then parks until engaged. on/off: the user's choice. */
type Transport = 'auto' | 'on' | 'off';

const mount: Mount = (ctx) => {
  const strips = ctx.refs('strip');
  const caps = ctx.refs('cap');
  const dbs = ctx.refs('db');
  const lvls = ctx.refs('lvl');
  const peaks = ctx.refs('peak');
  const clips = ctx.refs('clip');
  const mutes = ctx.refs<HTMLButtonElement>('mute');
  const selects = ctx.refs<HTMLButtonElement>('select');
  const transport = ctx.ref<HTMLButtonElement>('transport');
  const transportLabel = ctx.ref('transport-label');
  const pos = ctx.ref('pos');
  const busLvls = ctx.refs('bus-lvl');
  const busDb = ctx.ref('bus-db');

  let mode = 'fader';
  let sel = START_CHANNEL;
  const gain = CHANNELS.map((c) => c.db);
  const muted = CHANNELS.map(() => false);
  const shown = CHANNELS.map(() => 0);
  const peak = CHANNELS.map(() => 0);
  const hold = CHANNELS.map(() => 0);
  const clipT = CHANNELS.map(() => 0);
  const busShown = [0, 0];
  let busPeak = -Infinity;
  let busText = 0;

  /** Power sum of the post-fader channels, minus bus headroom. */
  const busLevel = (levels: number[]) => {
    const p = levels.reduce((sum, l) => sum + (l === -Infinity ? 0 : Math.pow(10, l / 10)), 0);
    return p > 0 ? 10 * Math.log10(p) - 4 : -Infinity;
  };
  let t = 0;
  let lastBeat = -1;
  let transportMode: Transport = ctx.reduced() ? 'off' : 'auto';
  let playing = false;
  let attendedAt = 0; // when the unattended budget started (0: at the next frame)
  let pending = 0; // ms since the meters last repainted
  let hovering = false;
  let focused = false;
  const jog = new Jog(30, ctx.dial.angle);

  const name = (i: number) => CHANNELS[i]!.name;

  function paintStatic() {
    CHANNELS.forEach((c, i) => {
      const l = muted[i] ? 0 : meterPos(c.rms + gain[i]!);
      lvls[i]?.style.setProperty('--l', l.toFixed(3));
      peaks[i]?.style.setProperty('--l', l.toFixed(3));
      clips[i]?.removeAttribute('data-on');
    });
    const bus = busLevel(CHANNELS.map((c, i) => (muted[i] ? -Infinity : c.rms + gain[i]!)));
    busLvls.forEach((b) => b.style.setProperty('--l', meterPos(bus).toFixed(3)));
    busDb.textContent = formatDb(bus);
  }

  function paintFader(i: number) {
    caps[i]?.style.setProperty('--p', dbToP(gain[i]!).toFixed(4));
    if (dbs[i]) dbs[i]!.textContent = formatDb(gain[i]!);
    if (!playing) paintStatic();
  }

  function paintDisplay() {
    ctx.display(mode === 'fader' ? `${formatDb(gain[sel]!)} dB` : name(sel).toUpperCase());
  }

  /** Channels actually on screen (extra strips hide on narrow mixers). */
  const visible = () =>
    strips.map((s, i) => (s.offsetParent !== null ? i : -1)).filter((i) => i > -1);

  /** Step the selection by n visible channels, wrapping. */
  function step(n: number) {
    const v = visible();
    if (!v.length) return;
    const at = Math.max(0, v.indexOf(sel));
    select(v[(((at + n) % v.length) + v.length) % v.length]!);
  }

  function select(i: number, announce = true) {
    sel = ((i % CHANNELS.length) + CHANNELS.length) % CHANNELS.length;
    strips.forEach((s, j) => s.toggleAttribute('data-selected', j === sel));
    selects.forEach((b, j) => b.setAttribute('aria-pressed', String(j === sel)));
    const s = strips[sel];
    if (s) pulse(s);
    paintDisplay();
    if (announce)
      ctx.announce(`${name(sel)} selected, ${spokenDb(gain[sel]!)}${muted[sel] ? ', muted' : ''}.`);
  }

  function toggleMute(i: number) {
    muted[i] = !muted[i];
    mutes[i]?.setAttribute('aria-pressed', String(muted[i]));
    if (!playing) paintStatic();
    ctx.announce(`${name(i)} ${muted[i] ? 'muted' : 'unmuted'}.`);
  }

  const meters = loop((frameMs) => {
    if (!playing || !ctx.onScreen()) return false;
    // Wall clock from the first frame actually drawn: a slow start doesn't eat
    // the budget, and slow frames don't stretch it.
    const now = performance.now();
    attendedAt ||= now;
    if (transportMode === 'auto' && !hovering && !focused && now - attendedAt > AUTO_MS) {
      run(false);
      return false;
    }
    if ((pending += frameMs) < METER_MS) return true;
    const dt = pending;
    pending = 0;
    t += dt / 1000;
    const beat = Math.floor(t / (60 / BPM));
    if (beat !== lastBeat) {
      lastBeat = beat;
      pos.textContent = `Bar ${START_BAR + Math.floor(beat / 4)} · ${(beat % 4) + 1}`;
    }
    CHANNELS.forEach((c, i) => {
      const level = muted[i] ? -Infinity : signal(c.id, t) + gain[i]!;
      const target = meterPos(level);
      shown[i] = Math.max(target, shown[i]! - (RELEASE * dt) / 1000);
      if (shown[i]! >= peak[i]!) {
        peak[i] = shown[i]!;
        hold[i] = 900;
      } else if ((hold[i] = hold[i]! - dt) < 0) {
        peak[i] = Math.max(shown[i]!, peak[i]! - (0.35 * dt) / 1000);
      }
      if (level > 0) clipT[i] = 1500;
      else clipT[i] = Math.max(0, clipT[i]! - dt);
      lvls[i]?.style.setProperty('--l', shown[i]!.toFixed(3));
      peaks[i]?.style.setProperty('--l', peak[i]!.toFixed(3));
      clips[i]?.toggleAttribute('data-on', clipT[i]! > 0);
    });
    const bus = busLevel(
      CHANNELS.map((c, i) => (muted[i] ? -Infinity : signal(c.id, t) + gain[i]!)),
    );
    const sway = 0.8 * Math.sin(t * 2.3);
    [bus + sway, bus - sway].forEach((l, side) => {
      busShown[side] = Math.max(meterPos(l), busShown[side]! - (RELEASE * dt) / 1000);
      busLvls[side]?.style.setProperty('--l', busShown[side]!.toFixed(3));
    });
    busPeak = Math.max(busPeak, bus);
    if ((busText += dt) > 400) {
      busDb.textContent = formatDb(busPeak);
      busPeak = -Infinity;
      busText = 0;
    }
    return true;
  });

  function run(on: boolean) {
    playing = on;
    pending = 0;
    transport.setAttribute('aria-pressed', String(on));
    transportLabel.textContent = on ? 'Pause meters' : 'Play meters';
    if (on) meters.start();
    else {
      meters.stop();
      paintStatic();
    }
  }

  /** Someone is at the mixer: renew the unattended budget and bring parked meters back. */
  function wake() {
    attendedAt = 0;
    if (transportMode === 'auto' && !playing) run(true);
  }

  // The transport is excluded, so reaching for "Play" never flips it to "Pause" first.
  const atTransport = (e: Event) => e.target instanceof Node && transport.contains(e.target);
  const root = ctx.root;
  root.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'touch') hovering = true;
    if (!atTransport(e)) wake();
  });
  root.addEventListener('pointerdown', (e) => {
    if (!atTransport(e)) wake();
  });
  root.addEventListener('pointerleave', () => {
    hovering = false;
    attendedAt = 0;
  });
  root.addEventListener('focusin', (e) => {
    focused = true;
    if (!atTransport(e)) wake();
  });
  root.addEventListener('focusout', (e) => {
    if (e.relatedTarget instanceof Node && root.contains(e.relatedTarget)) return;
    focused = false;
    attendedAt = 0;
  });

  // Direct controls work with or without the dial.
  selects.forEach((b, i) =>
    b.addEventListener('click', () => {
      select(i);
      if (mode === 'fader') ctx.setAngle(pToAngle(dbToP(gain[sel]!)));
    }),
  );
  mutes.forEach((b, i) => b.addEventListener('click', () => toggleMute(i)));
  transport.hidden = false;
  transport.addEventListener('click', () => {
    transportMode = playing ? 'off' : 'on';
    run(transportMode === 'on');
  });
  run(transportMode === 'auto');

  let lastP = dbToP(gain[sel]!);

  return {
    enter(next) {
      mode = next;
      if (mode === 'fader') {
        lastP = dbToP(gain[sel]!);
        ctx.setAngle(pToAngle(lastP));
      } else {
        jog.reset(ctx.dial.angle, 30);
      }
      paintDisplay();
    },

    change({ angle }) {
      wake();
      if (mode === 'channel') {
        const n = jog.read(angle);
        if (n) step(n);
        return;
      }
      let p = angleToP(angle);
      if (Math.abs(angle - UNITY_ANGLE) < UNITY_CATCH) p = UNITY_P;
      const before = gain[sel]!;
      const db = pToDb(p);
      gain[sel] = db;
      const cap = caps[sel];
      if (cap) {
        const crossed = (before < 0 && db >= 0) || (before > 0 && db <= 0);
        if (crossed || (p === UNITY_P && lastP !== UNITY_P)) pulse(cap, 'unity');
        if ((p <= 0 && lastP > 0) || (p >= 1 && lastP < 1)) {
          cap.style.setProperty('--stop-dir', p <= 0 ? '1' : '-1');
          pulse(cap, 'stop');
        }
      }
      lastP = p;
      paintFader(sel);
      paintDisplay();
      const edge = p <= 0 ? ', hard stop' : p >= 1 ? ', hard stop at the top' : '';
      ctx.announce(`${name(sel)} fader ${spokenDb(db)}${edge}.`);
    },

    press() {
      wake();
      toggleMute(sel);
    },

    visibility(on) {
      if (!on) return;
      // Each time the mixer comes into view it gets a fresh unattended budget.
      attendedAt = 0;
      if (playing) meters.start();
      else if (transportMode === 'auto') run(true);
    },
  };
};

export default mount;
