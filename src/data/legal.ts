/**
 * /legal/*: dates and the exact list of what this site stores in a browser.
 * Keep STORED_KEYS in sync with every read()/write() in src/lib and features:
 * the privacy page shows it next to a live readout of the visitor's storage.
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
  { key: 'detent:cart', area: 'localStorage', what: 'What is in the demo cart, so it survives a reload.' },
  { key: 'detent:waitlist', area: 'localStorage', what: 'Your demo waitlist entry: the email you typed and a random referral code.' },
  { key: 'detent:reservation', area: 'localStorage', what: 'Your demo reservation: email, edition, finish and a random id.' },
  { key: 'detent:ref', area: 'localStorage', what: 'A referral code from a friend’s link, if you arrived through one.' },
  { key: 'detent:integration-requests', area: 'localStorage', what: 'Integration requests you filed on the integrations page.' },
  { key: 'detent:mm-scale', area: 'localStorage', what: 'Your screen calibration from the actual-size tool on the specs page.' },
  { key: 'detent:phase', area: 'sessionStorage', what: 'A launch phase you previewed from a preview link. Gone when you close the tab.' },
];
