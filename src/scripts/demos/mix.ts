/**
 * Mix demo controller. Wall rides the selected fader through a console fader
 * law (hard stops at −∞ and +6 dB, the bump moved to unity). Clock steps the
 * channel selection one heavy click at a time. Press mutes.
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
  let playing = !ctx.reduced();
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

  const meters = loop((dt) => {
    if (!playing || !ctx.onScreen()) return false;
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

  function setPlaying(on: boolean) {
    playing = on;
    transport.setAttribute('aria-pressed', String(on));
    transportLabel.textContent = on ? 'Pause meters' : 'Play meters';
    if (on) meters.start();
    else {
      meters.stop();
      paintStatic();
    }
  }

  // Direct controls work with or without the dial.
  selects.forEach((b, i) =>
    b.addEventListener('click', () => {
      select(i);
      if (mode === 'fader') ctx.setAngle(pToAngle(dbToP(gain[sel]!)));
    }),
  );
  mutes.forEach((b, i) => b.addEventListener('click', () => toggleMute(i)));
  transport.hidden = false;
  transport.addEventListener('click', () => setPlaying(!playing));
  setPlaying(playing);

  let lastP = dbToP(gain[sel]!);

  return {
    physics(m) {
      return m === 'fader' ? { accents: [UNITY_ANGLE] } : null;
    },

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
      toggleMute(sel);
    },

    visibility(on) {
      if (on && playing) meters.start();
    },
  };
};

export default mount;
