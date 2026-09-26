/**
 * Feel Pass UI (lazy-loaded by the waitlist page). Draws the pass on the
 * page, keeps both export sizes pre-rendered as Files so navigator.share()
 * runs synchronously inside the click (Safari drops the user activation if
 * we await toBlob first), and wires the referral link.
 *
 * Share fallbacks: share({files}) -> share({url}) -> clipboard image -> download.
 */
import {
  byFinish,
  byProfile,
  EDITIONS,
  formatUsd,
  type FinishId,
  type ProfileId,
} from '@/data/product';
import { LAUNCH, PHASES } from '@/config/launch';
import {
  getEntry,
  referralUrl,
  sanitizeHandle,
  updateEntry,
  type WaitlistEntry,
} from '@/lib/waitlist';
import { track } from '@/lib/analytics';
import {
  drawPass,
  passFontsReady,
  renderPng,
  PASS_SIZE,
  type PassData,
  type PassLayout,
} from './pass-draw';
import { dotDate, passId } from './format';
import { downloadIcs } from './ics';
import { prefersReducedMotion } from './feedback';

const one = EDITIONS.find((e) => e.id === 'one')!;
const OFFER = `${formatUsd(one.launchPriceUsd)} on the list · reservations ${dotDate(PHASES.reserve.starts)}`;

export interface PassController {
  setMine(entry: WaitlistEntry): void;
  previewProfile(profile: ProfileId): void;
}

export async function mountPass(section: HTMLElement): Promise<PassController> {
  const card = section.querySelector<HTMLElement>('[data-pass-card]')!;
  const canvas = section.querySelector<HTMLCanvasElement>('[data-pass-canvas]')!;
  const ctx = canvas.getContext('2d')!;
  const status = section.querySelector<HTMLElement>('[data-share-status]');
  const reduced = prefersReducedMotion();

  let entry: WaitlistEntry | null = getEntry();
  let previewProfileId: ProfileId = 'ratchet';
  let layout: PassLayout = 'landscape';
  const files: Partial<Record<PassLayout, File>> = {};

  const data = (): PassData => {
    if (!entry) {
      return {
        handle: 'you',
        finish: byFinish('graphite'),
        profile: byProfile(previewProfileId),
        code: `SAMPLE-${previewProfileId}`,
        passId: 'Issued on join',
        url: `${location.host}${location.pathname}`,
        since: 'sample',
        offer: OFFER,
        sample: true,
      };
    }
    const profile = byProfile(entry.profile ?? 'ratchet');
    return {
      handle: entry.handle ?? '',
      finish: byFinish(entry.finish ?? 'graphite'),
      profile,
      code: entry.code,
      passId: passId(entry.code),
      url: referralUrl(entry).replace(/^https?:\/\//, ''),
      since: `joined ${dotDate(new Date(entry.joinedAt).toISOString().slice(0, 10))}`,
      offer: OFFER,
    };
  };

  /* ---- On-screen render ---------------------------------------------- */
  const paint = () => {
    const w = card.clientWidth;
    layout = w < 520 ? 'story' : 'landscape';
    card.dataset.layout = layout;
    const [W, H] = PASS_SIZE[layout];
    const dpr = Math.min(2, devicePixelRatio || 1);
    const cssH = (w * H) / W;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform((w * dpr) / W, 0, 0, (cssH * dpr) / H, 0, 0);
    const d = data();
    drawPass(ctx, layout, d);
    canvas.setAttribute(
      'aria-label',
      d.sample
        ? `Sample Feel Pass: a ${d.profile.name} feel signature ring, Graphite finish.`
        : `Your Feel Pass: @${d.handle || 'you'}, ${d.finish.name} finish, ${d.profile.name} feel, pass ID ${d.passId}.`,
    );
  };

  let regenTimer = 0;
  const regenerate = () => {
    clearTimeout(regenTimer);
    if (!entry) return;
    regenTimer = window.setTimeout(async () => {
      const d = data();
      for (const l of ['landscape', 'story'] as const) {
        const blob = await renderPng(l, d);
        if (blob)
          files[l] = new File([blob], `detent-feel-pass${l === 'story' ? '-story' : ''}.png`, {
            type: 'image/png',
          });
      }
    }, 220);
  };

  await passFontsReady();
  new ResizeObserver(() => paint()).observe(card);
  paint();

  /* ---- Controls (mine state) ------------------------------------------ */
  const handleInput = section.querySelector<HTMLInputElement>('[data-pass-handle]');
  const finishInputs = [...section.querySelectorAll<HTMLInputElement>('input[name="pass-finish"]')];
  const profileInputs = [
    ...section.querySelectorAll<HTMLInputElement>('input[name="pass-profile"]'),
  ];
  const refInput = section.querySelector<HTMLInputElement>('[data-ref-link]');

  const syncControls = () => {
    if (!entry) return;
    if (handleInput) handleInput.value = entry.handle ?? '';
    finishInputs.forEach((i) => (i.checked = i.value === (entry!.finish ?? 'graphite')));
    profileInputs.forEach((i) => (i.checked = i.value === (entry!.profile ?? 'ratchet')));
    if (refInput) refInput.value = referralUrl(entry);
  };

  let handleTimer = 0;
  handleInput?.addEventListener('input', () => {
    const clean = sanitizeHandle(handleInput.value);
    if (clean !== handleInput.value.replace(/^@+/, '')) handleInput.value = clean;
    clearTimeout(handleTimer);
    handleTimer = window.setTimeout(() => {
      entry = updateEntry({ handle: clean }) ?? entry;
      paint();
      regenerate();
    }, 90);
  });
  finishInputs.forEach((i) =>
    i.addEventListener('change', () => {
      entry = updateEntry({ finish: i.value as FinishId }) ?? entry;
      paint();
      regenerate();
    }),
  );
  profileInputs.forEach((i) =>
    i.addEventListener('change', () => {
      entry = updateEntry({ profile: i.value as ProfileId }) ?? entry;
      paint();
      regenerate();
    }),
  );

  /* ---- Share, download, copy ------------------------------------------ */
  const say = (msg: string) => {
    if (status) status.textContent = msg;
  };
  const download = (l: PassLayout) => {
    const f = files[l];
    const go = (blob: Blob) => {
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `detent-feel-pass${l === 'story' ? '-story' : ''}.png`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 4000);
      track('pass_download', { size: l === 'story' ? '1080x1920' : '1200x630' });
      say(`Saved ${PASS_SIZE[l].join(' × ')} PNG.`);
    };
    if (f) go(f);
    else void renderPng(l, data()).then((b) => b && go(b));
  };
  const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

  section.querySelector('[data-share-pass]')?.addEventListener('click', () => {
    if (!entry) return;
    const url = referralUrl(entry);
    const text = 'I’m on the list for Detent One, a dial whose feel changes with every app.';
    const file = files[layout] ?? files.landscape;
    if (file && navigator.canShare?.({ files: [file] })) {
      navigator
        .share({ files: [file], title: 'My Detent Feel Pass', text: `${text} ${url}` })
        .then(() => {
          track('referral_share', { method: 'share_file' });
          say('Shared. Referrals count when your friend confirms their email.');
        })
        .catch((e) => !isAbort(e) && download(layout));
      return;
    }
    if (typeof navigator.share === 'function') {
      navigator
        .share({ title: 'My Detent Feel Pass', text, url })
        .then(() => track('referral_share', { method: 'share_url' }))
        .catch((e) => !isAbort(e) && download(layout));
      return;
    }
    if (file && navigator.clipboard?.write && 'ClipboardItem' in window) {
      navigator.clipboard
        .write([new ClipboardItem({ 'image/png': file })])
        .then(() => {
          track('referral_share', { method: 'clipboard_image' });
          say('Pass image copied. Paste it into a post; your link is on the image.');
        })
        .catch(() => download(layout));
      return;
    }
    download(layout);
  });

  section
    .querySelectorAll<HTMLButtonElement>('[data-download]')
    .forEach((b) =>
      b.addEventListener('click', () =>
        download(b.dataset.download === 'story' ? 'story' : 'landscape'),
      ),
    );

  const copyRef = async () => {
    if (!entry || !refInput) return;
    try {
      await navigator.clipboard.writeText(refInput.value);
      say('Link copied.');
    } catch {
      refInput.select();
      say('Link selected. Copy it with your keyboard.');
    }
    track('referral_share', { method: 'copy_link' });
  };
  section.querySelector('[data-copy-ref]')?.addEventListener('click', copyRef);
  section.querySelector('[data-share-ref]')?.addEventListener('click', () => {
    if (!entry) return;
    const url = referralUrl(entry);
    if (typeof navigator.share === 'function') {
      navigator
        .share({
          title: 'Detent One waitlist',
          text: 'Get on the Detent One list with my link:',
          url,
        })
        .then(() => track('referral_share', { method: 'share_link' }))
        .catch((e) => !isAbort(e) && void copyRef());
    } else void copyRef();
  });

  section.querySelector('[data-ics-reserve]')?.addEventListener('click', () => {
    downloadIcs(
      'detent-reservations-open.ics',
      {
        start: PHASES.reserve.starts,
        title: 'Detent One: reservations open',
        description: `Reserve for ${formatUsd(LAUNCH.depositUsd)}, fully refundable. ${location.origin}${location.pathname.replace(/waitlist\/?$/, 'reserve/')}`,
        url: `${location.origin}${location.pathname.replace(/waitlist\/?$/, 'reserve/')}`,
        alarm: 9,
      },
      'reservations_open',
    );
  });

  /* ---- Foil: pointer and (Android) device tilt -------------------------- */
  if (!reduced) {
    let raf = 0;
    const tilt = (x: number, y: number) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        card.style.setProperty('--rx', `${((0.5 - y) * 9).toFixed(2)}deg`);
        card.style.setProperty('--ry', `${((x - 0.5) * 12).toFixed(2)}deg`);
        card.style.setProperty('--foil-x', `${(x * 100).toFixed(1)}%`);
        card.style.setProperty('--foil-y', `${(y * 100).toFixed(1)}%`);
        card.style.setProperty('--foil-angle', `${(x * 220 + y * 140).toFixed(1)}deg`);
      });
    };
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.dataset.live = '';
      tilt((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    });
    card.addEventListener('pointerleave', () => {
      delete card.dataset.live;
      tilt(0.5, 0.5);
    });
    const needsPermission =
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown })
        .requestPermission === 'function';
    if (!needsPermission && matchMedia('(pointer: coarse)').matches) {
      let inView = false;
      new IntersectionObserver(([en]) => (inView = !!en?.isIntersecting)).observe(card);
      addEventListener('deviceorientation', (e) => {
        if (!inView || e.gamma === null || e.beta === null) return;
        const x = 0.5 + Math.max(-1, Math.min(1, e.gamma / 30)) / 2;
        const y = 0.5 + Math.max(-1, Math.min(1, (e.beta - 45) / 30)) / 2;
        tilt(x, y);
      });
    }
  }

  const controller: PassController = {
    setMine(next) {
      entry = next;
      section.dataset.state = 'mine';
      syncControls();
      paint();
      regenerate();
    },
    previewProfile(p) {
      previewProfileId = p;
      if (!entry) paint();
    },
  };
  if (entry) controller.setMine(entry);
  return controller;
}
