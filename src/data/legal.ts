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
  {
    key: 'detent:cart',
    area: 'localStorage',
    what: 'The demo cart, so it survives a reload: each line’s item, edition, finish, feel, engraving text, price and quantity.',
  },
  {
    key: 'detent:shop:build',
    area: 'localStorage',
    what: 'Your last build in the configurator: edition, finish, feel, accessories, quantity and any engraving text you typed.',
  },
  {
    key: 'detent:shop:last-order',
    area: 'sessionStorage',
    what: 'The demo order the thanks page shows: lines, totals, country, delivery window, gift or not, your own random referral code and a friend’s code if you arrived through one. No name, email or address.',
  },
  {
    key: 'detent:waitlist',
    area: 'localStorage',
    what: 'Your demo waitlist entry: the email you typed, your own random referral code, a friend’s code if you arrived through one, what you would turn it for, your Feel Pass handle, finish and feel, and when you joined.',
  },
  {
    key: 'detent:reservation',
    area: 'localStorage',
    what: 'Your demo reservations, one per build: the email you typed (a placeholder for demo-wallet checkouts), edition, finish, the feel a link picked for it, a random id, your own random referral code, a friend’s code if you arrived through one, and when you reserved.',
  },
  {
    key: 'detent:ref',
    area: 'localStorage',
    what: 'The referral code from a friend’s link, if you arrived through one. Only the first friend’s code is kept, and never one of your own.',
  },
  { key: 'detent:home-capture-shown', area: 'sessionStorage', what: 'That the home page already offered the sign-up prompt in this tab, so it asks once.' },
  { key: 'detent:home-capture-dismissed', area: 'localStorage', what: 'When you closed that prompt, so it stays quiet for 30 days.' },
  {
    key: 'detent:integration-requests',
    area: 'localStorage',
    what: 'Integration requests you filed on the integrations page: the app, what it should do, the feel you picked and when. The last 20 are kept.',
  },
  { key: 'detent:mm-scale', area: 'localStorage', what: 'Your screen calibration from the actual-size tool on the specs page: one scale factor.' },
  {
    key: 'detent:games:crack',
    area: 'localStorage',
    what: 'Crack the Safe: today’s attempt, your streak, your best time, and how many safes you have cracked and how many without a miss.',
  },
  {
    key: 'detent:games:daily',
    area: 'localStorage',
    what: 'Daily Detent: today’s guesses, your streak, games played and won, and how many guesses each win took.',
  },
  { key: 'detent:achievements', area: 'localStorage', what: 'What you have found for the Studio log and when, plus which feels you have turned by hand.' },
  { key: 'detent:phase', area: 'sessionStorage', what: 'A launch phase you previewed from a preview link. Gone when you close the tab.' },
];
