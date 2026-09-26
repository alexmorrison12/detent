/**
 * The feel station's workbench, loaded off the critical path (station.ts
 * imports it when the builder, the file view or an export button comes near,
 * or on the first change of feel): the "Make your own" builder, the profile
 * file on the sheet, and the export actions (Feel Link, share, JSON).
 *
 * It only talks to the station through `Station`: it reads the state, writes
 * it with origin 'builder', and repaints its own views on every change.
 */
import { PROFILES, type ProfileId } from '@/data/product';
import { clampSpec, sanitizeName, type FeelPhysics, type FeelSpec } from '@/lib/feel-link';
import { PROFILE_AUTHORED_EVENT } from '@/lib/achievements';
import { track } from '@/lib/analytics';
import { builderText, trackFill, type BuilderKey } from './builder-text';
import { highlightJson, profileFileName, profileJson, type ProfileDoc } from './json';
import type { Station, State } from './station';

export type ToolAction = 'copy-link' | 'share' | 'copy-json' | 'download-json';

export function attach(station: Station, pendingInput: EventTarget | null) {
  const { root } = station;
  const form = root.querySelector<HTMLFormElement>('[data-builder]');
  const ctl = (key: string) => form?.querySelector<HTMLInputElement>(`[data-b="${key}"]`) ?? null;
  const b = {
    name: ctl('name'),
    detents: ctl('detents'),
    strength: ctl('strength'),
    accent: ctl('accent'),
    damping: ctl('damping'),
    spring: ctl('spring'),
    stopsOn: ctl('stopsOn'),
    stops: ctl('stops'),
    snaps: ctl('snaps'),
  };
  const readoutList = root.querySelector('[data-readouts]');
  const fileName = root.querySelector('[data-file-name]');
  const fileCode = root.querySelector('[data-file-code]');
  const colorOf = (base: ProfileId) => PROFILES.find((p) => p.id === base)?.color ?? PROFILES[0]!.color;

  let nameEdited = false;
  let builderTouched = false;

  /* ---- The profile file ------------------------------------------------- */
  function docFor(s: State): ProfileDoc {
    const base = { name: s.spec.name, base: s.spec.base, color: colorOf(s.spec.base), physics: s.spec.physics };
    if (s.source.kind === 'library') {
      const e = s.source.entry;
      return { ...base, id: e.id, author: e.author, app: e.kind === 'community' ? e.app : undefined };
    }
    return base;
  }
  const fileNameOf = (s: State) => (s.source.kind === 'library' ? `${s.source.entry.id}.detent.json` : profileFileName(s.spec.name));

  function paintFile() {
    const s = station.state();
    if (fileName) fileName.textContent = fileNameOf(s);
    if (fileCode) fileCode.innerHTML = highlightJson(profileJson(docFor(s)));
  }

  /* ---- Builder ---------------------------------------------------------- */
  const pct = (el: HTMLInputElement | null) => (el ? Number(el.value) / 100 : 0);

  function evenSnaps(n: number, stops: [number, number] | null): number[] {
    if (n <= 0) return [];
    if (stops) {
      const span = stops[1] - stops[0];
      return Array.from({ length: n }, (_, i) => Math.round(stops[0] + ((i + 0.5) * span) / n));
    }
    return Array.from({ length: n }, (_, i) => Math.round(wrap((i * 360) / n)));
  }

  function readBuilder(): FeelSpec {
    const cur = station.state().spec;
    const prev = cur.physics;
    const stops: [number, number] | null = b.stopsOn?.checked ? [-Number(b.stops?.value ?? 135), Number(b.stops?.value ?? 135)] : null;
    const snapCount = Number(b.snaps?.value ?? 0);
    let snaps = prev.snaps ?? [];
    const outside = stops && snaps.some((s) => s < stops[0] || s > stops[1]);
    if (snapCount !== snaps.length || outside) snaps = evenSnaps(snapCount, stops);
    let accents = (prev.accents ?? []).filter((a) => a !== 0);
    if (b.accent?.checked) accents = [0, ...accents];
    const base = (form?.querySelector<HTMLInputElement>('[data-b="base"]:checked')?.value as ProfileId) ?? cur.base;
    const physics: FeelPhysics = {
      detents: Number(b.detents?.value ?? 0),
      strength: pct(b.strength),
      damping: pct(b.damping),
      spring: pct(b.spring),
      stops,
      accents,
      snaps,
    };
    return clampSpec({ name: b.name?.value ?? '', base, physics });
  }

  function syncBuilder() {
    if (!form) return;
    const { spec } = station.state();
    const p = spec.physics;
    if (b.name) b.name.value = spec.name;
    form.querySelectorAll<HTMLInputElement>('[data-b="base"]').forEach((r) => (r.checked = r.value === spec.base));
    if (b.detents) b.detents.value = String(p.detents);
    if (b.strength) b.strength.value = String(Math.round(p.strength * 100));
    if (b.accent) b.accent.checked = (p.accents ?? []).includes(0);
    if (b.damping) b.damping.value = String(Math.round(p.damping * 100));
    if (b.spring) b.spring.value = String(Math.round(p.spring * 100));
    if (b.stopsOn) b.stopsOn.checked = !!p.stops;
    if (b.stops) {
      b.stops.disabled = !p.stops;
      if (p.stops) b.stops.value = String(Math.max(-p.stops[0], p.stops[1]));
    }
    if (b.snaps) b.snaps.value = String((p.snaps ?? []).length);
  }

  function paintOutputs() {
    if (!form) return;
    const text = builderText(station.state().spec.physics);
    // Only touch what changed. The outputs are aria-live="off" (the slider's own
    // aria-valuetext speaks the value), and rewriting all six every keypress is churn.
    for (const key of Object.keys(text) as BuilderKey[]) {
      const o = form.querySelector<HTMLOutputElement>(`[data-out="${key}"]`);
      const input = b[key];
      if (o && o.textContent !== text[key]) o.textContent = text[key];
      if (!input) continue;
      if (input.getAttribute('aria-valuetext') !== text[key]) input.setAttribute('aria-valuetext', text[key]);
      input.style.setProperty('--fill', trackFill(Number(input.value), Number(input.min || 0), Number(input.max || 100)));
    }
  }

  function builderChanged(target: EventTarget | null) {
    const el = target as HTMLInputElement;
    if (el === b.stopsOn && b.stops) b.stops.disabled = !b.stopsOn.checked;
    const s = station.state();
    const src = s.source;
    const from = src.kind === 'library' ? src.entry.name : src.kind === 'custom' ? src.from : s.spec.name;
    if (el === b.name) nameEdited = true;
    else if (!nameEdited && src.kind !== 'custom' && b.name) b.name.value = sanitizeName(`${from ?? 'Ratchet'} remix`);
    station.setState({ spec: readBuilder(), source: { kind: 'custom', from } }, 'builder');
    if (el !== b.name && el.type !== 'radio') flashReadout(el.dataset.b);
    if (!builderTouched) {
      builderTouched = true;
      track('feel_builder_edit', { from: from ?? '' });
    }
  }

  let flashTimer = 0;
  function flashReadout(key: string | undefined) {
    const map: Record<string, string> = { stopsOn: 'range', stops: 'range', accent: 'accents' };
    const k = key ? (map[key] ?? key) : '';
    readoutList?.querySelectorAll('[data-changed]').forEach((n) => n.removeAttribute('data-changed'));
    readoutList?.querySelector(`[data-key="${k}"]`)?.setAttribute('data-changed', '');
    clearTimeout(flashTimer);
    flashTimer = window.setTimeout(() => readoutList?.querySelectorAll('[data-changed]').forEach((n) => n.removeAttribute('data-changed')), 900);
  }

  /* ---- Export ----------------------------------------------------------- */
  async function copyText(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;inset-block-start:-100px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      ta.remove();
      return ok;
    }
  }

  function download(text: string, name: string, type = 'application/json') {
    const blob = new Blob([text], { type });
    const href = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  /** Saving a feel you made in the builder (link, share or file) is authoring one. */
  function authored() {
    const s = station.state();
    if (s.source.kind !== 'custom') return;
    window.dispatchEvent(new CustomEvent(PROFILE_AUTHORED_EVENT, { detail: { name: s.spec.name } }));
  }

  async function act(action: ToolAction, el: Element) {
    const s = station.state();
    const name = fileNameOf(s);
    switch (action) {
      case 'copy-link': {
        const { url, payload } = await station.link();
        const ok = await copyText(url);
        station.status(
          ok
            ? s.source.kind === 'library'
              ? `Link copied. It opens ${s.spec.name} on the dial.`
              : `Feel Link copied. ${payload.length} characters, and the whole feel is in them.`
            : `Couldn’t reach the clipboard. The address bar has the same link.`,
          el,
        );
        if (ok) authored();
        track('feel_link_copy', { kind: s.source.kind });
        break;
      }
      case 'share': {
        const { url } = await station.link();
        try {
          await navigator.share({ title: `${s.spec.name} · Detent feel`, text: `Turn this: ${s.spec.name}, a Detent feel.`, url });
          authored();
          track('feel_share', { kind: s.source.kind });
        } catch {
          /* dismissed */
        }
        break;
      }
      case 'copy-json': {
        const ok = await copyText(profileJson(docFor(s)));
        station.status(ok ? `${name} copied.` : `Couldn’t reach the clipboard. Try Download instead.`, el);
        if (ok) authored();
        track('feel_export', { how: 'copy' });
        break;
      }
      case 'download-json': {
        download(profileJson(docFor(s)) + '\n', name);
        station.status(`Saved ${name}.`, el);
        authored();
        track('feel_export', { how: 'download' });
        break;
      }
    }
  }

  /* ---- Wire up ---------------------------------------------------------- */
  form?.addEventListener('input', (ev) => builderChanged(ev.target));
  station.onState((origin) => {
    if (origin !== 'builder') {
      nameEdited = false;
      syncBuilder();
    }
    paintOutputs();
    paintFile();
  });

  // Bring the form up to what's on the dial. If someone was already editing a
  // control while this loaded, keep that edit and apply it on top.
  const pending = pendingInput instanceof HTMLInputElement && form?.contains(pendingInput) ? pendingInput : null;
  const kept = pending && { value: pending.value, checked: pending.checked };
  syncBuilder();
  if (pending && kept) {
    pending.value = kept.value;
    pending.checked = kept.checked;
    builderChanged(pending);
  } else {
    paintOutputs();
    paintFile();
  }

  return { act };
}

function wrap(deg: number): number {
  return ((((deg + 180) % 360) + 360) % 360) - 180;
}
