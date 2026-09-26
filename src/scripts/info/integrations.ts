/**
 * /integrations/ directory: instant filtering (search, category, feel,
 * status) mirrored into the URL, a live results count, and the tester panel
 * whose dial takes on the chosen app's profile. A slow tour cycles through
 * visible apps until the visitor picks one (never under reduced motion).
 */
import type { ProfileId } from '@/data/product';
import { track } from '@/lib/analytics';

type Filters = { q: string; cat: string; feel: string; status: string };
const KEYS: (keyof Filters)[] = ['q', 'cat', 'feel', 'status'];
const TOUR_MS = 3200;

export function initDirectory(root: HTMLElement): void {
  const form = root.querySelector<HTMLFormElement>('[data-filters]');
  const items = [...root.querySelectorAll<HTMLLIElement>('[data-list] > li')];
  const countEl = root.querySelector<HTMLElement>('[data-count]');
  const status = root.querySelector<HTMLElement>('[data-count-status]');
  const empty = root.querySelector<HTMLElement>('[data-empty]');
  const total = Number(root.dataset.total);
  const profiles = JSON.parse(root.dataset.profiles ?? '{}') as Record<ProfileId, { name: string; feel: string }>;
  const tester = root.querySelector<HTMLElement>('[data-tester]');
  const dial = document.getElementById('dir-dial') as HTMLElementTagNameMap['detent-dial'] | null;
  const cycleBtn = root.querySelector<HTMLButtonElement>('[data-cycle]');
  if (!form || !countEl || !tester) return;

  const out = {
    cat: tester.querySelector<HTMLElement>('[data-t-cat]')!,
    name: tester.querySelector<HTMLElement>('[data-t-name]')!,
    profile: tester.querySelector<HTMLElement>('[data-t-profile]')!,
    profileName: tester.querySelector<HTMLElement>('[data-t-profile-name]')!,
    does: tester.querySelector<HTMLElement>('[data-t-does]')!,
    feel: tester.querySelector<HTMLElement>('[data-t-feel]')!,
    angle: tester.querySelector<HTMLElement>('[data-t-angle]'),
  };

  /* ---- Filters ---------------------------------------------------------- */

  function read(): Filters {
    const fd = new FormData(form!);
    return {
      q: String(fd.get('q') ?? '').trim(),
      cat: String(fd.get('cat') ?? ''),
      feel: String(fd.get('feel') ?? ''),
      status: String(fd.get('status') ?? ''),
    };
  }

  function write(f: Filters) {
    (form!.elements.namedItem('q') as HTMLInputElement).value = f.q;
    for (const k of ['cat', 'feel', 'status'] as const) {
      const input = form!.querySelector<HTMLInputElement>(`input[name="${k}"][value="${CSS.escape(f[k])}"]`);
      if (input) input.checked = true;
    }
  }

  // The visible count follows every keystroke; screen readers hear it once
  // typing pauses, not once per letter.
  let announceTimer = 0;
  function announce(text: string) {
    if (!status) return;
    clearTimeout(announceTimer);
    announceTimer = window.setTimeout(() => (status.textContent = text), 500);
  }

  function apply(f: Filters, pushUrl: boolean) {
    const terms = f.q.toLowerCase().split(/\s+/).filter(Boolean);
    // "System" is listed but is not an app: it is what every other app gets.
    let apps = 0;
    let system = false;
    for (const li of items) {
      const ok =
        (!f.cat || li.dataset.cat === f.cat) &&
        (!f.feel || li.dataset.feel === f.feel) &&
        (!f.status || li.dataset.status === f.status) &&
        terms.every((t) => (li.dataset.text ?? '').includes(t));
      li.hidden = !ok;
      if (ok && li.dataset.cat === 'System') system = true;
      else if (ok) apps++;
    }
    const n = (v: number) => `<span class="readout">${v}</span>`;
    const html =
      apps === total && system
        ? `${n(total)} apps, plus system controls everywhere`
        : !apps && system
          ? 'System controls, in every app'
          : `${n(apps)} of ${total} apps${system ? ', plus system controls' : ''}`;
    countEl!.innerHTML = html;
    if (empty) empty.hidden = apps > 0 || system;
    // pushUrl is false only for the initial render, which is not news.
    if (pushUrl) {
      announce(countEl!.textContent ?? '');
      const url = new URL(location.href);
      for (const k of KEYS) {
        if (f[k]) url.searchParams.set(k, f[k]);
        else url.searchParams.delete(k);
      }
      history.replaceState(history.state, '', url);
    }
  }

  const initial: Filters = { q: '', cat: '', feel: '', status: '' };
  const params = new URLSearchParams(location.search);
  for (const k of KEYS) initial[k] = params.get(k)?.slice(0, 80) ?? '';
  write(initial);
  apply(read(), false);

  let searchTimer = 0;
  form.addEventListener('input', (e) => {
    const isSearch = (e.target as HTMLElement).matches('input[type="search"]');
    clearTimeout(searchTimer);
    searchTimer = window.setTimeout(
      () => {
        const f = read();
        apply(f, true);
        if (!isSearch) track('integrations_filter', { cat: f.cat, feel: f.feel, status: f.status });
      },
      isSearch ? 120 : 0,
    );
  });
  form.addEventListener('submit', (e) => e.preventDefault());
  root.querySelector('[data-reset]')?.addEventListener('click', () => {
    write({ q: '', cat: '', feel: '', status: '' });
    apply(read(), true);
    (form.elements.namedItem('q') as HTMLInputElement).focus();
  });

  /* ---- Tester ----------------------------------------------------------- */

  let current: HTMLLIElement | null = null;

  function show(li: HTMLLIElement) {
    const feel = li.dataset.feel as ProfileId;
    const p = profiles[feel];
    current?.removeAttribute('data-current');
    current = li;
    li.setAttribute('data-current', '');
    out.cat.textContent = li.dataset.cat ?? '';
    out.name.textContent = li.dataset.name ?? '';
    out.profile.style.setProperty('--feel', `var(--feel-${feel})`);
    out.profileName.textContent = p?.name ?? feel;
    out.does.textContent = li.dataset.does ?? '';
    out.feel.textContent = p?.feel ?? '';
    if (dial) {
      dial.setAttribute('profile', feel);
      dial.setAttribute('display', li.dataset.display ?? '');
      dial.setAttribute('label', `Try the ${li.dataset.name} feel: ${p?.name}. Turn to feel it.`);
    }
  }

  root.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('[data-try]');
    if (!btn) return;
    const li = btn.closest<HTMLLIElement>('li');
    if (!li) return;
    stopTour();
    show(li);
    track('integration_try', { app: li.dataset.name, profile: li.dataset.feel });
    const r = tester.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) {
      tester.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }
  });

  dial?.addEventListener('detent:change', (e) => {
    if (out.angle) out.angle.textContent = `${Math.round(e.detail.angle)}°`;
  });

  /* ---- Tour: cycles visible apps until someone picks one ---------------- */

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let touring = !reduce.matches;
  let visible = false;
  /** A pointer is resting on the card: hold the current app until it leaves. */
  let hovering = false;
  let timer = 0;

  function next() {
    const shown = items.filter((li) => !li.hidden);
    if (!shown.length) return;
    const i = current ? shown.indexOf(current) : -1;
    show(shown[(i + 1) % shown.length]!);
  }
  function schedule() {
    clearInterval(timer);
    if (touring && visible && !hovering && !document.hidden) timer = window.setInterval(next, TOUR_MS);
  }
  function stopTour() {
    touring = false;
    schedule();
    syncCycle();
  }
  // A plain action button: its name says what pressing it does next.
  function syncCycle() {
    if (cycleBtn) cycleBtn.textContent = touring ? 'Pause tour' : 'Play tour';
  }

  cycleBtn?.addEventListener('click', () => {
    touring = !touring;
    if (touring) next();
    schedule();
    syncCycle();
  });
  // Any hands-on use of the dial holds the current app, including keyboard
  // focus: the dial's name and feel must not change under a screen reader.
  tester.addEventListener('pointerdown', (e) => {
    if (!(e.target as Element).closest('[data-cycle]')) stopTour();
  });
  tester.addEventListener('focusin', (e) => {
    if ((e.target as Element).closest('detent-dial')) stopTour();
  });
  tester.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'mouse') return;
    hovering = true;
    schedule();
  });
  tester.addEventListener('pointerleave', () => {
    hovering = false;
    schedule();
  });
  reduce.addEventListener('change', () => {
    if (reduce.matches) stopTour();
  });
  new IntersectionObserver(([entry]) => {
    visible = !!entry?.isIntersecting;
    schedule();
  }).observe(tester);
  document.addEventListener('visibilitychange', schedule);

  show(items.find((li) => !li.hidden) ?? items[0]!);
  syncCycle();
}
