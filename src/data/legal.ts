/**
 * /legal/*: dates and the exact list of what this site stores in a browser.
 * STORED_KEYS must list every key that read()/write() from @/lib/storage (and
 * the two inline scripts in BaseLayout) can touch: the privacy page shows it
 * next to a live readout of the visitor's storage, and its build fails with
 * the missing key's name if a feature writes one that is not listed here.
 */

export const LEGAL_UPDATED = '2026-09-26';

export interface StoredKey {
  /** Key as it appears in storage (lib/storage prefixes "detent:"). */
  key: string;
  area: 'localStorage' | 'sessionStorage';
  what: string;
}

export const STORED_KEYS: StoredKey[] = [
  { key: 'detent:sound', area: 'localStorage', what: 'Whether you turned the click sound on.' },
  { key: 'detent:haptics', area: 'localStorage', what: 'Whether the dial may vibrate your phone.' },
  { key: 'detent:cart', area: 'localStorage', what: 'What is in the demo cart, so it survives a reload.' },
  { key: 'detent:shop:build', area: 'localStorage', what: 'Your last build in the configurator, including any engraving text you typed.' },
  { key: 'detent:shop:last-order', area: 'sessionStorage', what: 'The demo order the thanks page shows: lines, country and delivery window. No name or address.' },
  { key: 'detent:waitlist', area: 'localStorage', what: 'Your demo waitlist entry: the email you typed and a random referral code.' },
  { key: 'detent:reservation', area: 'localStorage', what: 'Your demo reservation: email, edition, finish and a random id.' },
  { key: 'detent:ref', area: 'localStorage', what: 'A referral code from a friend’s link, if you arrived through one.' },
  { key: 'detent:home-capture-shown', area: 'sessionStorage', what: 'That the home page already offered the sign-up prompt in this tab, so it asks once.' },
  { key: 'detent:home-capture-dismissed', area: 'localStorage', what: 'When you closed that prompt, so it stays quiet for 30 days.' },
  { key: 'detent:integration-requests', area: 'localStorage', what: 'Integration requests you filed on the integrations page.' },
  { key: 'detent:mm-scale', area: 'localStorage', what: 'Your screen calibration from the actual-size tool on the specs page.' },
  { key: 'detent:games:crack', area: 'localStorage', what: 'Crack the Safe: today’s attempt, your streak and your best time.' },
  { key: 'detent:games:daily', area: 'localStorage', what: 'Daily Detent: today’s attempt, your streak and your results so far.' },
  { key: 'detent:achievements', area: 'localStorage', what: 'What you have found for the Studio log, and when.' },
  { key: 'detent:phase', area: 'sessionStorage', what: 'A launch phase you previewed from a preview link. Gone when you close the tab.' },
];
