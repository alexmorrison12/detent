/**
 * Edit demo controller. Ratchet: one frame per detent. Magnet: glide, then
 * snap to the six markers (one per snap point on the knob). Spring: shuttle,
 * deflection sets speed from −4× to 4×; letting go stops playback.
 */
import { byProfile } from '@/data/product';
import { Jog, clamp, loop, magnet, pulse, sortedSnaps, wrap180, type Mount } from './core';
import {
  BALL_RADIUS,
  FPS,
  GROUND_Y,
  MARKERS,
  START_FRAME,
  TOTAL,
  VIDEO,
  duration,
  nearestMarker,
  scene,
  sweepPath,
  timecode,
} from './edit-scene';

const SNAPS = sortedSnaps(byProfile('magnet').physics.snaps);
const SPEEDS: [number, number][] = [
  [10, 0],
  [35, 0.5],
  [60, 1],
  [90, 2],
  [Infinity, 4],
];

const speedLabel = (v: number) => {
  if (v === 0) return 'Stopped';
  const mag = Math.abs(v) === 0.5 ? '½' : String(Math.abs(v));
  return `${v > 0 ? '▶' : '◀'} ${mag}×`;
};
const speedWords = (v: number) =>
  v === 0 ? 'Stopped' : `Playing ${v > 0 ? 'forward' : 'in reverse'} at ${Math.abs(v)} times`;

const mount: Mount = (ctx) => {
  const root = ctx.ref('edit');
  const els = {
    tc: ctx.ref('tc'),
    burnin: ctx.ref('burnin'),
    clip: ctx.ref('clip'),
    shuttle: ctx.ref('shuttle'),
    inout: ctx.ref('inout'),
    playhead: ctx.ref('playhead'),
    range: ctx.ref('range'),
    leader: ctx.ref<SVGGElement>('leader'),
    pop: ctx.ref<SVGGElement>('pop'),
    title: ctx.ref<SVGGElement>('title'),
    bounce: ctx.ref<SVGGElement>('bounce'),
    sweep: ctx.ref<SVGPathElement>('sweep'),
    count: ctx.ref<SVGTextElement>('count'),
    ball: ctx.ref<SVGGElement>('ball'),
    shadow: ctx.ref<SVGEllipseElement>('shadow'),
    markers: ctx.refs('mk'),
    rows: ctx.refs('mk-row'),
  };

  let mode = 'step';
  let frame = Number(root.dataset.frame ?? START_FRAME);
  let playF = frame;
  let speed = 0;
  let snappedTo = -1;
  let inPt: number | null = null;
  let outPt: number | null = null;
  let lastSceneFrame = -1;
  const jog = new Jog(15, ctx.dial.angle);

  const groups = { leader: els.leader, pop: els.pop, title: els.title, bounce: els.bounce };

  function paintScene(f: number) {
    const r = Math.round(f);
    if (r === lastSceneFrame) return;
    lastSceneFrame = r;
    const s = scene(r);
    const show = s.kind === 'black' ? null : s.kind;
    for (const [k, g] of Object.entries(groups)) g.toggleAttribute('data-on', k === show);
    if (s.kind === 'leader') {
      els.sweep.setAttribute('d', sweepPath(s.sweep));
      els.count.textContent = String(s.count);
    } else if (s.kind === 'title') {
      els.title.setAttribute('opacity', s.opacity.toFixed(2));
    } else if (s.kind === 'bounce') {
      const sy = s.squash;
      const sx = 1 / Math.sqrt(sy);
      const lift = BALL_RADIUS * (1 - sy);
      els.ball.setAttribute(
        'transform',
        `translate(${s.x.toFixed(2)} ${(s.y + lift).toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})`,
      );
      els.shadow.setAttribute('cx', s.x.toFixed(2));
      els.shadow.setAttribute('cy', String(GROUND_Y + 3));
      els.shadow.setAttribute('rx', (5 + 9 * s.shadow).toFixed(2));
      els.shadow.setAttribute('opacity', (0.25 + 0.75 * s.shadow).toFixed(2));
    }
  }

  function activeMarker(): number {
    if (mode === 'markers') return snappedTo;
    const r = Math.round(frame);
    return MARKERS.findIndex((m) => m.frame === r);
  }

  function paint() {
    const r = Math.round(frame);
    const code = timecode(r);
    els.playhead.style.setProperty('--p', (frame / TOTAL).toFixed(5));
    els.tc.textContent = code;
    els.burnin.textContent = code;
    els.clip.textContent = VIDEO.find((c) => r >= c.from && r < c.to)?.name ?? '';
    const act = activeMarker();
    els.markers.forEach((m, i) => m.toggleAttribute('data-active', i === act));
    els.rows.forEach((m, i) => m.toggleAttribute('data-active', i === act));
    paintScene(r);
    ctx.display(speed && mode === 'shuttle' ? speedLabel(speed) : code.slice(3));
  }

  function paintShuttle() {
    els.shuttle.textContent = speedLabel(speed);
  }

  function paintRange() {
    if (inPt === null) {
      els.range.hidden = true;
      els.inout.textContent = 'Press the dial';
      return;
    }
    const a = inPt;
    const b = outPt ?? inPt;
    els.range.hidden = false;
    els.range.style.setProperty('--a', (a / TOTAL).toFixed(5));
    els.range.style.setProperty('--b', ((b + 1) / TOTAL).toFixed(5));
    els.inout.textContent =
      outPt === null ? `${timecode(a).slice(3)} → …` : `${duration(b - a + 1)} long`;
  }

  const play = loop((dt) => {
    if (!speed || !ctx.onScreen()) return false;
    playF = clamp(playF + (speed * FPS * dt) / 1000, 0, TOTAL - 1);
    frame = Math.floor(playF);
    paint();
    const atEnd = (speed > 0 && playF >= TOTAL - 1) || (speed < 0 && playF <= 0);
    if (atEnd) {
      ctx.announce(`${speed > 0 ? 'End' : 'Start'} of the reel, ${timecode(frame)}.`);
      return false;
    }
    return true;
  });

  function describe(): string {
    const r = Math.round(frame);
    const clip = VIDEO.find((c) => r >= c.from && r < c.to)?.name ?? '';
    const act = activeMarker();
    const mk = act > -1 ? ` Marker: ${MARKERS[act]!.label}.` : '';
    return `Frame ${timecode(r)}, ${clip}.${mk}`;
  }

  paint();

  return {
    enter(next) {
      mode = next;
      play.stop();
      speed = 0;
      paintShuttle();
      if (mode === 'markers') {
        const i = nearestMarker(frame);
        snappedTo = i;
        frame = MARKERS[i]!.frame;
        ctx.setAngle(SNAPS[i] ?? 0);
      } else if (mode === 'shuttle') {
        snappedTo = -1;
        frame = Math.round(frame);
        playF = frame;
        ctx.setAngle(0);
      } else {
        snappedTo = -1;
        frame = Math.round(frame);
        jog.reset(ctx.dial.angle, 15);
      }
      paint();
    },

    change({ angle }) {
      if (mode === 'step') {
        const n = jog.read(angle);
        if (!n) return;
        frame = clamp(Math.round(frame) + n, 0, TOTAL - 1);
        paint();
        ctx.announce(describe());
      } else if (mode === 'markers') {
        const m = magnet(angle, SNAPS);
        const a = MARKERS[m.from]!.frame;
        const b = MARKERS[m.to]!.frame;
        if (m.snapped) {
          frame = MARKERS[m.nearest]!.frame;
          if (snappedTo !== m.nearest) {
            snappedTo = m.nearest;
            const el = els.markers[m.nearest];
            if (el) pulse(el);
          }
        } else {
          snappedTo = -1;
          frame = m.wrapped ? MARKERS[m.nearest]!.frame : a + (b - a) * m.t;
        }
        paint();
        ctx.announce(describe());
      } else {
        const d = clamp(wrap180(angle), -120, 120);
        const level = SPEEDS.find(([lim]) => Math.abs(d) < lim)![1];
        const next = Math.sign(d) * level;
        if (next === speed) return;
        speed = next;
        playF = frame;
        paintShuttle();
        paint();
        if (speed) play.start();
        else play.stop();
        ctx.announce(speed ? `${speedWords(speed)}.` : `Stopped at ${timecode(frame)}.`);
      }
    },

    press() {
      const r = Math.round(frame);
      if (inPt === null || outPt !== null) {
        inPt = r;
        outPt = null;
        ctx.announce(`In point set at ${timecode(r)}. Press again for the out point.`);
      } else {
        outPt = r;
        if (outPt < inPt) [inPt, outPt] = [outPt, inPt];
        ctx.announce(
          `Out point set at ${timecode(outPt)}. Selection is ${duration(outPt - inPt + 1)} long.`,
        );
      }
      paintRange();
    },

    visibility(on) {
      if (on && speed) play.start();
    },
  };
};

export default mount;
