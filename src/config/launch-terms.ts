/**
 * The launch's fixed terms: dates, ship batches, the numbered run, deposits.
 *
 * A leaf module (no imports) so both @/data/product (FAQ copy) and
 * @/config/launch (phase copy, which quotes prices from @/data/product) can
 * read it without importing each other. Import it as `LAUNCH` from
 * '@/config/launch'; it is re-exported there.
 */
export const LAUNCH = {
  /** Launch day (orders open). */
  launchDate: '2026-12-01T17:00:00Z',
  /** Launch pricing window closes. */
  launchPriceEnds: '2026-12-04T17:00:00Z',
  firstShipBatch: 'February 2027',
  secondShipBatch: 'April 2027',
  /** Numbered Founders Edition run. */
  foundersRun: 2000,
  depositUsd: 20,
  foundersDepositUsd: 50,
} as const;
