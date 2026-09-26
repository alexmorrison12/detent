/**
 * JSON-LD builders for the launch pages. Built from the same config and
 * data the UI reads. Offers are emitted only when MODE === 'live' so the
 * concept demo never claims a real sale.
 */
import { SITE } from '@/config/site';
import { MODE, LAUNCH } from '@/config/launch';
import { EDITIONS, FINISHES, type Faq } from '@/data/product';
import { absoluteUrl } from '@/lib/url';

type Ld = Record<string, unknown>;

export function faqLd(faqs: Faq[]): Ld {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

export function productLd(site: URL | undefined, pageUrl: string): Ld {
  const one = EDITIONS.find((e) => e.id === 'one')!;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: SITE.product,
    sku: one.sku,
    description: SITE.description,
    brand: { '@type': 'Brand', name: SITE.name },
    material: '6061-T6 aluminum',
    color: FINISHES.filter((f) => !f.foundersOnly).map((f) => f.name),
    url: pageUrl,
    image: absoluteUrl('/og/default.png', site),
    ...(MODE === 'live'
      ? {
          offers: EDITIONS.map((e) => ({
            '@type': 'Offer',
            name: e.name,
            sku: e.sku,
            price: e.launchPriceUsd,
            priceCurrency: 'USD',
            availability: 'https://schema.org/PreOrder',
            availabilityStarts: LAUNCH.launchDate,
            url: pageUrl,
          })),
        }
      : {}),
  };
}

export function eventLd(opts: {
  name: string;
  description: string;
  start: string;
  end?: string;
  url: string;
  site: URL | undefined;
}): Ld {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: opts.name,
    description: opts.description,
    startDate: opts.start,
    ...(opts.end ? { endDate: opts.end } : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    location: { '@type': 'VirtualLocation', url: opts.url },
    organizer: { '@type': 'Organization', name: SITE.legalName, url: absoluteUrl('/', opts.site) },
    image: absoluteUrl('/og/default.png', opts.site),
  };
}
