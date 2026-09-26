/**
 * Client side of <TorqueCompare>: profile chips redraw the Detent curve, the
 * range input moves a playhead and reads out torque at that angle. Crossing
 * into a stable detent (torque sign flips from + to −) clicks, if sound is on.
 */
import type { FeelProfile, ProfileId } from '@/data/product';
import { torqueAt, mechanicalTorqueAt, torquePath } from './torque';
import { click } from './click';
import { track } from '@/lib/analytics';

type ProfileInfo = { name: string; feel: string; physics: FeelProfile['physics'] };

const W = 1000;
const H = 400;
const fmt = (n: number, unit: string) => `${n < 0 ? '−' : n > 0 ? '+' : ''}${Math.abs(n).toFixed(1)}${unit}`;

export function initTorque(root: HTMLElement): void {
  const peak = Number(root.dataset.peak);
  const mech = JSON.parse(root.dataset.mech ?? '{}') as { detents: number; torque: number };
  const profiles = JSON.parse(root.dataset.profiles ?? '{}') as Record<ProfileId, ProfileInfo>;
  const plot = root.querySelector<HTMLElement>('[data-plot]')!;
  const path = root.querySelector<SVGPathElement>('[data-detent-path]')!;
  const head = root.querySelector<HTMLElement>('[data-head]')!;
  const dotMech = root.querySelector<HTMLElement>('[data-dot-mech]')!;
  const dotDetent = root.querySelector<HTMLElement>('[data-dot-detent]')!;
  const range = root.querySelector<HTMLInputElement>('[data-angle]')!;
  const outAngle = root.querySelector<HTMLElement>('[data-out-angle]')!;
  const outMech = root.querySelector<HTMLElement>('[data-out-mech]')!;
  const outDetent = root.querySelector<HTMLElement>('[data-out-detent]')!;
  const legend = root.querySelector<HTMLElement>('[data-legend]')!;
  const nameEl = root.querySelector<HTMLElement>('[data-profile-name]')!;
  const feelName = root.querySelector<HTMLElement>('[data-feel-name]')!;
  const feelText = root.querySelector<HTMLElement>('[data-feel-text]')!;

  let current: ProfileId = 'ratchet';
  let lastTau = 0;
  let hitTimer = 0;

  const detentTau = (theta: number) => torqueAt(theta, profiles[current].physics, { peak });
  const yPct = (tau: number) => 50 - (tau / peak) * 50;

  function update(fromUser: boolean) {
    const theta = Number(range.value);
    const tm = mechanicalTorqueAt(theta, mech.detents, mech.torque);
    const td = detentTau(theta);
    const x = ((theta + 180) / 360) * 100;
    head.style.insetInlineStart = `${x}%`;
    dotMech.style.top = `${yPct(tm)}%`;
    dotDetent.style.top = `${yPct(td)}%`;
    outAngle.textContent = fmt(theta, '°');
    outMech.textContent = `${fmt(tm, '')} mN·m`;
    const atStop = Math.abs(td) >= peak - 0.01;
    outDetent.textContent = `${fmt(td, '')} mN·m${atStop ? ', end stop' : ''}`;
    // A stable detent is where restoring torque flips from pushing + to pushing −.
    if (fromUser && lastTau > 0.4 && td <= 0) hit();
    else if (fromUser && lastTau < -0.4 && td >= 0) hit();
    lastTau = td;
  }

  function hit() {
    click(profiles[current].physics.detents === 12 ? 2000 : 3400, 0.45);
    dotDetent.setAttribute('data-hit', '');
    clearTimeout(hitTimer);
    hitTimer = window.setTimeout(() => dotDetent.removeAttribute('data-hit'), 90);
  }

  function setProfile(id: ProfileId) {
    current = id;
    const p = profiles[id];
    path.setAttribute('d', torquePath(detentTau, W, H, peak));
    plot.style.setProperty('--feel', `var(--feel-${id})`);
    legend.style.setProperty('--feel', `var(--feel-${id})`);
    nameEl.textContent = p.name;
    feelName.textContent = `${p.name}.`;
    feelText.textContent = p.feel;
    lastTau = detentTau(Number(range.value));
    update(false);
  }

  root.querySelectorAll<HTMLInputElement>('input[name="torque-profile"]').forEach((input) => {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      setProfile(input.value as ProfileId);
      track('torque_profile', { profile: input.value });
    });
  });
  range.addEventListener('input', () => update(true));
  update(false);
}
