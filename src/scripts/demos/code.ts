/**
 * Code demo controller. Magnet: six hunks on six snap points; the overview
 * ruler glides between them and the pane scrolls the focused hunk into view
 * (the pane, never the page). Ratchet: one line per click. Press: viewed.
 */
import { byProfile } from '@/data/product';
import { Jog, clamp, magnet, pulse, sortedSnaps, type Mount } from './core';

const SNAPS = sortedSnaps(byProfile('magnet').physics.snaps);

const mount: Mount = (ctx) => {
  const scroll = ctx.ref('scroll');
  const hunks = ctx.refs('hunk');
  const lines = ctx.refs('line');
  const marks = ctx.refs('mark');
  const thumb = ctx.ref('thumb');
  const viewedOut = ctx.ref('viewed');

  let mode = 'hunks';
  let focus = 0;
  let cursor = 0;
  const viewed = new Set<number>();
  const jog = new Jog(15, ctx.dial.angle);

  // Ruler positions from real layout (wrapped lines change them).
  let ys: number[] = [];
  const measure = () => {
    const h = scroll.scrollHeight || 1;
    ys = hunks.map((el) => el.offsetTop / h);
    marks.forEach((m, i) => m.style.setProperty('--y', (ys[i] ?? 0).toFixed(4)));
  };
  measure();
  new ResizeObserver(measure).observe(scroll);

  const behavior = (): ScrollBehavior => (ctx.reduced() ? 'auto' : 'smooth');

  function setThumb(y: number) {
    thumb.style.setProperty('--y', y.toFixed(4));
  }

  function focusHunk(i: number, scrollTo = true) {
    if (i !== focus) {
      focus = i;
      const el = hunks[i];
      if (el) pulse(el);
    }
    hunks.forEach((h, j) => h.toggleAttribute('data-focus', j === focus));
    marks.forEach((m, j) => m.toggleAttribute('data-focus', j === focus));
    if (scrollTo) {
      const el = hunks[focus];
      if (el) scroll.scrollTo({ top: Math.max(0, el.offsetTop - 6), behavior: behavior() });
    }
  }

  function describeHunk(i: number): string {
    const el = hunks[i];
    if (!el) return '';
    const add = el.dataset.add ?? '0';
    const del = el.dataset.del ?? '0';
    return `Hunk ${i + 1} of ${hunks.length}, from line ${el.dataset.from}: ${add} added, ${del} removed${viewed.has(i) ? ', viewed' : ''}.`;
  }

  function setCursor(i: number) {
    cursor = clamp(i, 0, lines.length - 1);
    lines.forEach((l, j) => l.toggleAttribute('data-cursor', j === cursor));
    const line = lines[cursor]!;
    const h = Number(line.dataset.h ?? 0);
    focusHunk(h, false);
    // Keep the cursor line inside the pane with a little air.
    const top = line.offsetTop;
    const pad = line.offsetHeight * 2;
    if (top < scroll.scrollTop + pad) scroll.scrollTo({ top: top - pad, behavior: behavior() });
    else if (top + line.offsetHeight > scroll.scrollTop + scroll.clientHeight - pad)
      scroll.scrollTo({
        top: top + line.offsetHeight + pad - scroll.clientHeight,
        behavior: behavior(),
      });
    setThumb((top / (scroll.scrollHeight || 1)) * 1);
    ctx.display(`L ${line.dataset.no ?? ''}`);
  }

  function paintViewed() {
    hunks.forEach((h, i) => h.toggleAttribute('data-viewed', viewed.has(i)));
    const done = viewed.size === hunks.length;
    viewedOut.textContent = done
      ? `${hunks.length} / ${hunks.length} viewed · ready to approve`
      : `${viewed.size} / ${hunks.length} viewed`;
    viewedOut.toggleAttribute('data-done', done);
  }

  return {
    enter(next) {
      mode = next;
      lines.forEach((l) => l.removeAttribute('data-cursor'));
      if (mode === 'hunks') {
        focusHunk(focus);
        setThumb(ys[focus] ?? 0);
        ctx.setAngle(SNAPS[focus] ?? 0);
        ctx.display(`HUNK ${focus + 1}/${hunks.length}`);
      } else {
        // Start on the first changed line of the focused hunk.
        const first = lines.findIndex(
          (l) => Number(l.dataset.h) === focus && l.dataset.kind !== 'ctx',
        );
        jog.reset(ctx.dial.angle, 15);
        setCursor(first > -1 ? first : cursor);
      }
    },

    change({ angle }) {
      if (mode === 'hunks') {
        const m = magnet(angle, SNAPS);
        if (m.snapped) {
          const changed = m.nearest !== focus;
          focusHunk(m.nearest, changed);
          setThumb(ys[m.nearest] ?? 0);
          if (changed) ctx.announce(describeHunk(m.nearest));
        } else if (m.wrapped) {
          setThumb(ys[m.nearest] ?? 0);
        } else {
          const a = ys[m.from] ?? 0;
          const b = ys[m.to] ?? 0;
          setThumb(a + (b - a) * m.t);
        }
        ctx.display(`HUNK ${focus + 1}/${hunks.length}`);
      } else {
        const n = jog.read(angle);
        if (!n) return;
        setCursor(cursor + n);
        const line = lines[cursor]!;
        const kind =
          line.dataset.kind === 'add'
            ? 'added'
            : line.dataset.kind === 'del'
              ? 'removed'
              : 'unchanged';
        const text = (line.querySelector('code')?.textContent ?? '')
          .replace(/^(Added|Removed): /, '')
          .trim();
        ctx.announce(`Line ${line.dataset.no}, ${kind}: ${text || 'blank'}`);
      }
    },

    press() {
      if (viewed.has(focus)) viewed.delete(focus);
      else viewed.add(focus);
      paintViewed();
      const done = viewed.size === hunks.length;
      ctx.announce(
        done
          ? `All ${hunks.length} hunks viewed. Ready to approve.`
          : `Hunk ${focus + 1} ${viewed.has(focus) ? 'marked viewed' : 'unmarked'}. ${viewed.size} of ${hunks.length} viewed.`,
      );
    },
  };
};

export default mount;
