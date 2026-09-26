/**
 * Real-time launch film player. Plays SHOTS against a live <detent-dial>:
 * one rAF loop while playing, nothing while paused. Autoplays (silently;
 * sound is opt-in) only when on screen and motion is allowed; pauses off
 * screen and in background tabs. Paused, the dial becomes interactive:
 * the film hands you the knob.
 *
 * Reduced motion: no autoplay. Chapters jump straight to each shot's final
 * frame; Play is still there if you ask for it.
 */
import { track } from '@/lib/analytics';
import type { DetentDialElement } from '@/scripts/dial/types';
import { FILM_LENGTH, SHOTS, clock, shotAt, type Shot } from './film-script';
import { prefersReducedMotion } from './feedback';

export async function mountFilm(root: HTMLElement): Promise<void> {
  const dial = root.querySelector('detent-dial') as DetentDialElement | null;
  if (!dial) return;
  await customElements.whenDefined('detent-dial');

  const reduced = prefersReducedMotion();
  const playBtn = root.querySelector<HTMLButtonElement>('[data-film-play]')!;
  const playLabel = playBtn.querySelector<HTMLElement>('[data-label]')!;
  const scrub = root.querySelector<HTMLInputElement>('[data-film-scrub]')!;
  const time = root.querySelector<HTMLElement>('[data-film-time]')!;
  const caption = root.querySelector<HTMLElement>('[data-film-caption]')!;
  const chapterTitle = root.querySelector<HTMLElement>('[data-film-chapter]')!;
  const chapters = [...root.querySelectorAll<HTMLButtonElement>('[data-film-seek]')];
  const hint = root.querySelector<HTMLElement>('[data-film-hint]');
  const prev = root.querySelector<HTMLButtonElement>('[data-film-prev]');
  const next = root.querySelector<HTMLButtonElement>('[data-film-next]');

  root.dataset.ready = '';
  let t = 0;
  let playing = false;
  let userPaused = reduced;
  let inView = false;
  let last = 0;
  let raf = 0;
  let shown: Shot | null = null;
  let watchedTo = 0;

  const finishOf = (s: Shot, p: number) =>
    typeof s.finish === 'function' ? s.finish(p) : s.finish;

  function render(at: number) {
    t = Math.min(FILM_LENGTH, Math.max(0, at));
    const s = shotAt(t === FILM_LENGTH ? FILM_LENGTH - 0.001 : t);
    const p = Math.min(1, (t - s.start) / (s.end - s.start));
    if (dial!.getAttribute('camera') !== s.camera) dial!.setAttribute('camera', s.camera);
    if (dial!.profile !== s.profile) dial!.profile = s.profile;
    const f = finishOf(s, p);
    if (dial!.finish !== f) dial!.finish = f;
    dial!.explode = s.explode?.(p) ?? 0;
    dial!.setAngle(s.angle(p), { instant: true });
    const d = s.display(p);
    if (dial!.getAttribute('display') !== d) dial!.setAttribute('display', d);
    if (shown !== s) {
      shown = s;
      caption.textContent = s.caption;
      chapterTitle.textContent = s.title;
      root.style.setProperty('--shot', String(SHOTS.indexOf(s)));
      chapters.forEach((c) => c.setAttribute('aria-current', String(c.dataset.filmSeek === s.id)));
      caption.animate?.([{ opacity: 0 }, { opacity: 1 }], {
        duration: reduced ? 1 : 420,
        easing: 'ease-out',
      });
    }
    scrub.value = String(Math.round(t * 10));
    scrub.setAttribute('aria-valuetext', `${Math.round(t)} of ${FILM_LENGTH} seconds, ${s.title}`);
    time.textContent = `${clock(t)} / ${clock(FILM_LENGTH)}`;
    root.style.setProperty('--progress', (t / FILM_LENGTH).toFixed(4));
    if (t > watchedTo + 5) {
      watchedTo = Math.floor(t / 5) * 5;
      track('film_progress', { seconds: watchedTo });
    }
  }

  function setInteractive(on: boolean) {
    if (on) {
      dial!.physics = null;
      dial!.setAttribute('interactive', '');
      if (hint) hint.hidden = t === 0 && !reduced;
    } else {
      dial!.removeAttribute('interactive');
      if (hint) hint.hidden = true;
    }
  }

  function loop(now: number) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    render(t + dt);
    if (t >= FILM_LENGTH) {
      stop(true);
      root.dataset.ended = '';
      playLabel.textContent = 'Replay';
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  function play() {
    if (playing) return;
    if (t >= FILM_LENGTH) {
      t = 0;
      delete root.dataset.ended;
    }
    playing = true;
    root.dataset.playing = '';
    playBtn.setAttribute('aria-label', 'Pause the film');
    playLabel.textContent = 'Pause';
    setInteractive(false);
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  function stop(byEnd = false) {
    if (!playing) return;
    playing = false;
    cancelAnimationFrame(raf);
    delete root.dataset.playing;
    playBtn.setAttribute('aria-label', byEnd ? 'Replay the film' : 'Play the film');
    playLabel.textContent = 'Play';
    setInteractive(true);
  }

  playBtn.addEventListener('click', () => {
    if (playing) {
      userPaused = true;
      stop();
      track('film_pause', { at: Math.round(t) });
    } else {
      userPaused = false;
      play();
      track('film_play', { at: Math.round(t) });
    }
  });

  scrub.addEventListener('input', () => {
    render(Number(scrub.value) / 10);
  });

  const seekTo = (s: Shot) => {
    // Reduced motion lands on the shot's settled final frame; otherwise its first.
    render(reduced && !playing ? s.end - 0.05 : s.start);
    if (!playing) setInteractive(true);
  };
  chapters.forEach((c) =>
    c.addEventListener('click', () => {
      const s = SHOTS.find((x) => x.id === c.dataset.filmSeek);
      if (s) seekTo(s);
    }),
  );
  const step = (dir: 1 | -1) => {
    const i = SHOTS.indexOf(shotAt(t === FILM_LENGTH ? FILM_LENGTH - 0.001 : t));
    const s = SHOTS[Math.min(SHOTS.length - 1, Math.max(0, i + dir))];
    if (s) seekTo(s);
  };
  prev?.addEventListener('click', () => step(-1));
  next?.addEventListener('click', () => step(1));

  new IntersectionObserver(
    ([en]) => {
      inView = !!en?.isIntersecting;
      if (inView && !userPaused && !reduced && root.dataset.ended === undefined) play();
      else if (!inView) stop();
    },
    { threshold: 0.55 },
  ).observe(root.querySelector('[data-film-stage]') ?? root);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (inView && !userPaused && !reduced && root.dataset.ended === undefined) play();
  });

  render(reduced ? SHOTS[0]!.end - 0.05 : 0);
  setInteractive(true);
  if (reduced) playLabel.textContent = 'Play';
}
