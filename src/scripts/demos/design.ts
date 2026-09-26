/**
 * Design demo controller. Fluid: the layer follows the knob with weight
 * (critically damped), readout to 0.1°, press for 10:1 fine gearing.
 * Ratchet: 15° per click. Wall: brush size, hard stops at 1 and 400 px,
 * bump at 20 px. The rotation field is a real input and drives the knob back.
 */
import { Jog, loop, pulse, type Mount } from './core';
import {
  START_BRUSH,
  START_ROTATION,
  angleToSize,
  formatDeg,
  normDeg,
  parseDeg,
  sizeToAngle,
} from './design-model';

const TAU = 110; // ms, Fluid's visual lag
const BUMP_CATCH = 1.6;

const mount: Mount = (ctx) => {
  const root = ctx.ref('design');
  const layer = ctx.ref('layer');
  const tip = ctx.ref('tip');
  const input = ctx.ref<HTMLInputElement>('rot');
  const sizeOut = ctx.ref('size');
  const brush = ctx.ref('brush');
  const fineTag = ctx.ref('fine');

  let mode = 'rotate';
  let shown = Number(root.dataset.rot ?? START_ROTATION);
  let target = shown;
  let size = START_BRUSH;
  let fine = false;
  // Fluid is absolute from a base: target = base + (angle - angleBase) * gear.
  let base = target;
  let angleBase = ctx.dial.angle;
  const jog = new Jog(15, ctx.dial.angle);

  const gear = () => (fine ? 0.1 : 1);

  function paintRotation() {
    layer.style.setProperty('--rot', `${shown.toFixed(2)}deg`);
    const label = formatDeg(target);
    tip.textContent = label;
    if (document.activeElement !== input) input.value = label;
    if (mode !== 'brush') ctx.display(label);
  }

  const ease = loop((dt) => {
    const k = ctx.reduced() ? 1 : 1 - Math.exp(-dt / TAU);
    shown += (target - shown) * k;
    const done = Math.abs(target - shown) < 0.02;
    if (done) shown = target;
    paintRotation();
    return !done;
  });

  function setTarget(v: number, instant = false) {
    target = v;
    if (instant) {
      shown = v;
      paintRotation();
    } else ease.start();
  }

  function rebase() {
    base = target;
    angleBase = ctx.dial.angle;
  }

  function paintSize() {
    brush.style.setProperty('--size', String(size));
    sizeOut.textContent = `${size} px`;
    if (mode === 'brush') ctx.display(`${size} px`);
  }

  input.addEventListener('change', () => {
    const v = parseDeg(input.value);
    if (v === null) {
      input.value = formatDeg(target);
      return;
    }
    setTarget(normDeg(v), true);
    rebase();
    ctx.announce(`Rotation set to ${formatDeg(target).replace('−', 'minus ')}.`);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.dispatchEvent(new Event('change'));
  });

  paintRotation();

  return {
    enter(next) {
      mode = next;
      root.dataset.tool = mode === 'brush' ? 'brush' : 'move';
      if (mode !== 'rotate' && fine) {
        fine = false;
        fineTag.hidden = true;
      }
      if (mode === 'rotate') rebase();
      else if (mode === 'step') {
        setTarget(Math.round(target / 15) * 15);
        jog.reset(ctx.dial.angle, 15);
      } else {
        ctx.setAngle(sizeToAngle(size));
        paintSize();
      }
      if (mode !== 'brush') paintRotation();
    },

    change({ angle }) {
      if (mode === 'rotate') {
        setTarget(base + (angle - angleBase) * gear());
        ctx.announce(`Rotation ${formatDeg(target).replace('−', 'minus ')}.`);
      } else if (mode === 'step') {
        const n = jog.read(angle);
        if (!n) return;
        setTarget(target + n * 15);
        ctx.announce(`Rotation ${formatDeg(target).replace('−', 'minus ')}.`);
      } else {
        const before = size;
        size = Math.abs(angle) < BUMP_CATCH ? START_BRUSH : angleToSize(angle);
        if (size === before) return;
        if ((size === 1 || size === 400) && before !== size) pulse(brush, 'stop');
        else if (size === START_BRUSH) pulse(brush, 'bump');
        paintSize();
        const edge = size === 1 ? ', hard stop' : size === 400 ? ', hard stop' : '';
        ctx.announce(`Brush ${size} pixels${edge}.`);
      }
    },

    press() {
      if (mode !== 'rotate') return;
      fine = !fine;
      fineTag.hidden = !fine;
      rebase();
      ctx.announce(
        fine ? 'Fine control on: ten degrees of dial per degree of rotation.' : 'Fine control off.',
      );
    },
  };
};

export default mount;
