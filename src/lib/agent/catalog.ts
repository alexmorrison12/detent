/**
 * The machine-readable view of Detent One: one builder shared by
 * /products.json and /llms.txt so agents, assistants and the site can never
 * disagree. Everything is derived from @/data/product and @/config.
 *
 * Honesty rules (docs/research/BUILD_BRIEF.md, "Mode"): in demo mode nothing
 * is purchasable, the schema.org graph carries no Offer objects, and every
 * document says plainly that Detent is a concept.
 */
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { SITE } from '@/config/site';
import { BUILD_PHASE, LAUNCH, MODE, PHASES, PHASE_ORDER, type Phase } from '@/config/launch';
import {
  ACCESSORIES,
  AUDIENCES,
  EDITIONS,
  FAQS,
  INTEGRATIONS,
  PAYMENT,
  PROFILES,
  SPECS,
  byFinish,
  type Edition,
  type FinishId,
} from '@/data/product';
import { absoluteUrl } from '@/lib/url';
import { ogPath } from '@/config/og';

type Site = URL | string | undefined;

export type Stage = 'announced' | 'waitlist' | 'reservable' | 'orderable';

export interface Availability {
  phase: Phase;
  stage: Stage;
  /** Can an order or deposit actually be placed right now? False in demo mode. */
  purchasable: boolean;
  /** schema.org availability for this phase, or null before anything can be ordered. */
  schemaOrg: string | null;
  /** The price a buyer pays in this phase, or null when nothing is on sale. */
  currentPriceUsd: number | null;
  deposit: { usd: number; refundable: true; creditedToOrder: true } | null;
  ships: string;
  action: { label: string; url: string; note: string };
}

export const STAGE: Record<Phase, Stage> = {
  tease: 'announced',
  waitlist: 'waitlist',
  reserve: 'reservable',
  launch: 'orderable',
  live: 'orderable',
};

const SCHEMA: Record<Stage, string | null> = {
  announced: null,
  waitlist: null,
  reservable: 'https://schema.org/PreOrder',
  orderable: 'https://schema.org/PreOrder',
};

export const spec = (label: string): string =>
  SPECS.flatMap((g) => g.rows).find((r) => r.label === label)?.value ?? '';

export function availability(
  edition: Edition,
  site: Site,
  phase: Phase = BUILD_PHASE,
): Availability {
  const stage = STAGE[phase];
  const cta = PHASES[phase].primary;
  const founders = edition.id === 'founders';
  const price =
    stage === 'reservable' || phase === 'launch'
      ? edition.launchPriceUsd
      : phase === 'live'
        ? edition.priceUsd
        : null;
  return {
    phase,
    stage,
    purchasable: MODE === 'live' && (stage === 'reservable' || stage === 'orderable'),
    // Every phase starts before Batch 1 ships, so orders are pre-orders; claiming
    // InStock would promise a ship date the launch plan doesn't have.
    schemaOrg: SCHEMA[stage],
    currentPriceUsd: price,
    deposit:
      stage === 'reservable'
        ? {
            usd: founders ? LAUNCH.foundersDepositUsd : LAUNCH.depositUsd,
            refundable: true,
            creditedToOrder: true,
          }
        : null,
    ships: `Batch 1 ships ${LAUNCH.firstShipBatch}; Batch 2 ${LAUNCH.secondShipBatch}`,
    action: { label: cta.label, url: absoluteUrl(cta.href, site), note: cta.note },
  };
}

/**
 * Product imagery: whatever renders the dial feature publishes under
 * public/renders/ whose file name starts with the finish id, scraper-friendly
 * formats first. The shop's social card is always there as a fallback.
 */
export function imagesFor(finish: FinishId, site: Site): string[] {
  const dir = resolve(process.cwd(), 'public/renders');
  const rank = (f: string) =>
    ['.png', '.jpg', '.jpeg', '.webp', '.avif'].findIndex((e) => f.endsWith(e));
  const files = existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.startsWith(`${finish}`) && rank(f) > -1)
        .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    : [];
  return [
    ...files.map((f) => absoluteUrl(`/renders/${f}`, site)),
    absoluteUrl(ogPath('shop'), site),
  ];
}

/** Deterministic, crawlable configurator link an agent can hand to a person. */
export const configureUrl = (edition: string, finish: string, site: Site) =>
  absoluteUrl(`/shop/?edition=${edition}&finish=${finish}`, site);

export const variantSku = (edition: Edition, finish: FinishId) =>
  `${edition.sku}-${finish.toUpperCase()}`;

const material = spec('Material').split(',')[0]!.trim();
const grams = Number(spec('Weight').match(/(\d+)\s*g/)?.[1] ?? 0);

/* -------------------------------------------------------------------------- */
/* products.json                                                              */
/* -------------------------------------------------------------------------- */

export function buildCatalog(site: Site) {
  const abs = (p: string) => absoluteUrl(p, site);
  const live = MODE === 'live';

  const products = EDITIONS.map((e) => {
    const avail = availability(e, site);
    return {
      id: e.id,
      sku: e.sku,
      name: e.name,
      summary: e.summary,
      url: abs('/shop/'),
      priceUsd: e.priceUsd,
      launchPriceUsd: e.launchPriceUsd,
      currency: 'USD',
      installments: {
        count: PAYMENT.installments,
        label: PAYMENT.installmentLabel(avail.currentPriceUsd ?? e.priceUsd),
      },
      limitedTo: e.limited ?? null,
      includes: e.includes,
      availability: avail,
      variants: e.finishes.map((fid) => {
        const f = byFinish(fid);
        return {
          id: `${e.id}-${fid}`,
          sku: variantSku(e, fid),
          name: `${e.name}, ${f.name}`,
          finish: { id: f.id, name: f.name, description: f.line, color: f.body },
          url: configureUrl(e.id, fid, site),
          images: imagesFor(fid, site),
        };
      }),
    };
  });

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    mode: MODE,
    concept: !live,
    notice: SITE.conceptNotice,
    seller: { name: SITE.legalName, brand: SITE.name, url: abs('/'), email: SITE.email },
    currency: 'USD',
    launch: {
      phase: BUILD_PHASE,
      phaseName: PHASES[BUILD_PHASE].name,
      phases: PHASE_ORDER.map((p) => ({
        id: p,
        name: PHASES[p].name,
        starts: PHASES[p].starts,
        landing: abs(PHASES[p].landing),
        stage: STAGE[p],
        current: p === BUILD_PHASE,
      })),
      launchDate: LAUNCH.launchDate,
      launchPriceEnds: LAUNCH.launchPriceEnds,
      shipBatches: [LAUNCH.firstShipBatch, LAUNCH.secondShipBatch],
      deposit: { usd: LAUNCH.depositUsd, foundersUsd: LAUNCH.foundersDepositUsd, refundable: true },
      foundersRun: LAUNCH.foundersRun,
    },
    products,
    accessories: ACCESSORIES.map((a) => ({
      id: a.id,
      name: a.name,
      priceUsd: a.priceUsd,
      description: a.line,
      url: abs('/shop/'),
    })),
    policies: {
      trialDays: PAYMENT.trialDays,
      warrantyYears: PAYMENT.warrantyYears,
      freeShipping: PAYMENT.freeShippingOverUsd === 0,
      installments: PAYMENT.installments,
      trial: spec('Trial'),
      warranty: spec('Warranty'),
      repair: spec('Repair'),
      shipping: FAQS.filter((f) => f.topic === 'Shipping').map((f) => ({ q: f.q, a: f.a })),
      buying: FAQS.filter((f) => f.topic === 'Buying' || f.topic === 'Launch').map((f) => ({
        q: f.q,
        a: f.a,
      })),
      privacy: abs('/legal/privacy/'),
      terms: abs('/legal/terms/'),
    },
    specs: SPECS.flatMap((g) =>
      g.rows.map((r) => ({ group: g.title, label: r.label, value: r.value })),
    ),
    profiles: PROFILES.map((p) => ({
      id: p.id,
      name: p.name,
      feel: p.feel,
      use: p.use,
      physics: p.physics,
    })),
    integrations: INTEGRATIONS.map((i) => ({
      app: i.name,
      category: i.category,
      does: i.does,
      profile: i.profile,
      status: i.status,
    })),
    audiences: AUDIENCES.map((a) => ({
      id: a.id,
      label: a.label,
      headline: a.headline,
      url: abs(`/for/${a.id}/`),
    })),
    links: {
      home: abs('/'),
      shop: abs('/shop/'),
      specs: abs('/specs/'),
      profiles: abs('/profiles/'),
      integrations: abs('/integrations/'),
      support: abs('/support/'),
      llms: abs('/llms.txt'),
      sitemap: abs('/sitemap-index.xml'),
    },
    schemaOrg: schemaGraph(site),
  };
}

/* -------------------------------------------------------------------------- */
/* schema.org graph (Offers only when MODE === 'live')                        */
/* -------------------------------------------------------------------------- */

export function schemaGraph(site: Site) {
  const abs = (p: string) => absoluteUrl(p, site);
  const live = MODE === 'live';
  const org = {
    '@type': 'Organization',
    '@id': abs('/#org'),
    name: SITE.legalName,
    url: abs('/'),
    email: SITE.email,
    logo: abs('/favicon.svg'),
  };
  const brand = { '@type': 'Brand', name: SITE.name };

  const returns = {
    '@type': 'MerchantReturnPolicy',
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: PAYMENT.trialDays,
    returnMethod: 'https://schema.org/ReturnByMail',
    returnFees: 'https://schema.org/FreeReturn',
  };

  const offer = (e: Edition, fid: FinishId) => {
    const a = availability(e, site);
    if (!live || a.currentPriceUsd === null || !a.schemaOrg) return {};
    return {
      offers: {
        '@type': 'Offer',
        url: configureUrl(e.id, fid, site),
        price: a.currentPriceUsd.toFixed(2),
        priceCurrency: 'USD',
        availability: a.schemaOrg,
        itemCondition: 'https://schema.org/NewCondition',
        seller: { '@id': org['@id'] },
        hasMerchantReturnPolicy: returns,
        shippingDetails: {
          '@type': 'OfferShippingDetails',
          shippingRate: { '@type': 'MonetaryAmount', value: 0, currency: 'USD' },
        },
      },
    };
  };

  const common = {
    brand,
    material,
    ...(grams ? { weight: { '@type': 'QuantitativeValue', value: grams, unitCode: 'GRM' } } : {}),
    additionalProperty: SPECS.flatMap((g) =>
      g.rows.map((r) => ({
        '@type': 'PropertyValue',
        name: `${g.title}: ${r.label}`,
        value: r.value,
      })),
    ),
    ...(live ? {} : { disambiguatingDescription: SITE.conceptNotice }),
  };

  const [one, founders] = [
    EDITIONS.find((e) => e.id === 'one')!,
    EDITIONS.find((e) => e.id === 'founders')!,
  ];

  const group = {
    '@type': 'ProductGroup',
    '@id': abs('/shop/#detent-one'),
    name: one.name,
    description: SITE.description,
    url: abs('/shop/'),
    productGroupID: one.sku,
    variesBy: ['https://schema.org/color'],
    ...common,
    hasVariant: one.finishes.map((fid) => {
      const f = byFinish(fid);
      return {
        '@type': 'Product',
        sku: variantSku(one, fid),
        name: `${one.name}, ${f.name}`,
        color: f.name,
        description: f.line,
        url: configureUrl(one.id, fid, site),
        image: imagesFor(fid, site),
        ...offer(one, fid),
      };
    }),
  };

  const foundersFinish = founders.finishes[0]!;
  const foundersProduct = {
    '@type': 'Product',
    '@id': abs('/shop/#founders-edition'),
    sku: variantSku(founders, foundersFinish),
    name: founders.name,
    description: founders.summary,
    color: byFinish(foundersFinish).name,
    url: configureUrl(founders.id, foundersFinish, site),
    image: imagesFor(foundersFinish, site),
    isRelatedTo: { '@id': group['@id'] },
    ...common,
    ...offer(founders, foundersFinish),
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [org, group, foundersProduct],
  };
}
