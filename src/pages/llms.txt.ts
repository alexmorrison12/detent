/**
 * /llms.txt (llmstxt.org): a plain-Markdown briefing for assistants and
 * coding agents. H1, a blockquote summary, fact sections without headings,
 * then H2 link lists. Generated from @/data and @/config at build, so a
 * price or date change in one place changes it here too.
 */
import type { APIRoute } from 'astro';
import { SITE, FOOTER_NAV } from '@/config/site';
import { BUILD_PHASE, LAUNCH, MODE, PHASES, PHASE_ORDER } from '@/config/launch';
import { OG_PAGES } from '@/config/og';
import {
  ACCESSORIES,
  AUDIENCES,
  EDITIONS,
  FAQS,
  FINISHES,
  INTEGRATIONS,
  PAYMENT,
  PROFILES,
  SPECS,
  byFinish,
  formatUsd,
} from '@/data/product';
import { absoluteUrl } from '@/lib/url';
import { spec } from '@/lib/agent/catalog';

/** What each page is for, in one line. Falls back to the page's social card title. */
const NOTES: Record<string, string> = {
  '/': 'Turn the interactive dial and feel each profile.',
  '/shop/':
    'Pick an edition and finish, see what is included, and check out (a demo while Detent is a concept).',
  '/specs/': 'Every measurement, material and interface.',
  '/profiles/': 'Try each haptic profile and share your own.',
  '/integrations/': 'Supported apps and exactly what the dial does in each.',
  '/story/': 'Why a knob, and who is building it.',
  '/changelog/': 'What changed, and when.',
  '/press/': 'Fact sheet, images and press contacts.',
  '/support/': 'FAQ, shipping, returns, warranty and repair.',
  '/crack/': 'A daily safecracking game played by feel.',
  '/daily/': 'Identify the day’s hidden feel in five tries.',
  '/legal/privacy/': 'What the site stores (in your browser only) and what it never collects.',
  '/legal/terms/': 'Terms of use for the site and the launch plan.',
};

const slugFor = (href: string): string => {
  const parts = href.split('/').filter(Boolean);
  if (!parts.length) return 'home';
  if (parts[0] === 'l') return parts[1] ?? 'default';
  return parts.join('-');
};

function note(href: string): string {
  if (NOTES[href]) return NOTES[href]!;
  const og = (OG_PAGES as Record<string, { title: string }>)[slugFor(href)];
  return og?.title ?? '';
}

export const GET: APIRoute = ({ site }) => {
  const abs = (p: string) => absoluteUrl(p, site);
  const link = (label: string, href: string, text = note(href)) =>
    `- [${label}](${abs(href)})${text ? `: ${text}` : ''}`;
  const current = PHASES[BUILD_PHASE];
  const one = EDITIONS.find((e) => e.id === 'one')!;
  const nav = FOOTER_NAV.flatMap((c) => c.items);
  const inNav = (href: string) => nav.find((i) => i.href === href)?.label ?? href;
  const date = (iso: string) => iso.replace('T', ' ').replace(/:00(\.000)?Z$/, ' UTC');

  const out: string[] = [];
  const p = (...lines: string[]) => out.push(...lines);

  p(`# ${SITE.product}`, '');
  p(`> ${SITE.description} ${SITE.tagline}`, '');
  p(
    MODE === 'live'
      ? `Status: on sale through ${abs('/shop/')}. Prices below are in US dollars.`
      : `Status: ${SITE.conceptNotice} Prices, dates and availability below describe the concept's launch plan; no order, deposit or payment can be placed.`,
    '',
  );
  p(
    `Machine-readable catalog (editions, finishes, SKUs, prices, availability, specs, policies, schema.org graph): ${abs('/products.json')}`,
    '',
  );
  p(
    `This build is in the ${current.name} phase. Primary action: "${current.primary.label}" at ${abs(current.primary.href)}.${current.primary.note ? ` ${current.primary.note}` : ''}`,
    '',
  );

  // Editions and prices
  p('**Editions and prices**', '');
  for (const e of EDITIONS) {
    const finishes = e.finishes.map((f) => byFinish(f).name).join(', ');
    const launch =
      e.launchPriceUsd !== e.priceUsd ? ` (launch price ${formatUsd(e.launchPriceUsd)})` : '';
    p(
      `- ${e.name}, ${formatUsd(e.priceUsd)}${launch}. Finish${e.finishes.length > 1 ? 'es' : ''}: ${finishes}. ${e.summary}`,
    );
    p(`  - In the box and included: ${e.includes.join('; ')}.`);
    if (e.limited) p(`  - Limited to ${e.limited.toLocaleString('en-US')} numbered units.`);
  }
  p(
    `- Accessories: ${ACCESSORIES.map((a) => `${a.name} ${formatUsd(a.priceUsd)} (${a.line})`).join('; ')}`,
  );
  p(
    `- Reservation deposit: ${formatUsd(LAUNCH.depositUsd)} (Founders Edition ${formatUsd(LAUNCH.foundersDepositUsd)}), fully refundable, credited to the order.`,
  );
  p(
    `- Pay over time: ${PAYMENT.installmentLabel(one.priceUsd).replace(/^or /, '')} for ${one.name} at list price.`,
    '',
  );

  // Timeline
  p('**Launch timeline**', '');
  for (const id of PHASE_ORDER) {
    const ph = PHASES[id];
    p(
      `- ${ph.name}, from ${ph.starts}${id === BUILD_PHASE ? ' (this build)' : ''}: ${ph.banner} ${abs(ph.landing)}`,
    );
  }
  p(
    `- Orders open ${date(LAUNCH.launchDate)}; launch pricing ends ${date(LAUNCH.launchPriceEnds)}.`,
  );
  p(
    `- Shipping: Batch 1 in ${LAUNCH.firstShipBatch}, Batch 2 in ${LAUNCH.secondShipBatch}. Reservations are filled in order.`,
    '',
  );

  // Finishes
  p('**Finishes**', '');
  for (const f of FINISHES)
    p(`- ${f.name}${f.foundersOnly ? ' (Founders Edition only)' : ''}: ${f.line}`);
  p('');

  // Feel profiles
  p(`**Feel profiles** (software-defined haptics; ${spec('Profiles on device')})`, '');
  for (const pr of PROFILES) p(`- ${pr.name}: ${pr.feel} Use: ${pr.use}`);
  p('');

  // Specs
  p('**Specifications**', '');
  for (const g of SPECS) for (const r of g.rows) p(`- ${g.title}, ${r.label}: ${r.value}`);
  p('');

  // Integrations
  p(
    '**Integrations** (native: built into Detent Studio; plugin: official plugin; community: open-source profile)',
    '',
  );
  for (const i of INTEGRATIONS) p(`- ${i.name} (${i.category}, ${i.status}): ${i.does}`);
  p('');

  // Who it's for
  p('**Made for**', '');
  for (const a of AUDIENCES)
    p(`- ${a.label}: ${a.headline} ${a.subhead} Apps: ${a.apps.join(', ')}.`);
  p('');

  // Policies + FAQ
  p('**Policies**', '');
  p(`- Trial: ${spec('Trial')}.`);
  p(`- Warranty: ${spec('Warranty')}.`);
  p(`- Repair: ${spec('Repair')}.`);
  p(
    `- Shipping: ${PAYMENT.freeShippingOverUsd === 0 ? 'free on every order' : `free over ${formatUsd(PAYMENT.freeShippingOverUsd)}`}.`,
  );
  p(`- Account: ${spec('Account')}.`, '');

  p('**Questions people ask**', '');
  for (const f of FAQS) p(`- ${f.q} ${f.a}`);
  p('');

  // Link lists
  p('## Product', '');
  for (const href of ['/', '/shop/', '/specs/', '/profiles/', '/integrations/'])
    p(link(inNav(href), href));
  p('');

  p('## Made for', '');
  for (const a of AUDIENCES) p(link(a.label, `/for/${a.id}/`, a.headline));
  p('');

  p('## Launch', '');
  for (const id of PHASE_ORDER) {
    const ph = PHASES[id];
    if (ph.landing === '/') continue;
    p(
      link(`${ph.name} landing page`, ph.landing, `${ph.primary.label}. ${ph.primary.note}`.trim()),
    );
  }
  p('');

  p('## Help and policies', '');
  for (const href of ['/support/', '/legal/privacy/', '/legal/terms/']) p(link(inNav(href), href));
  p(`- [Email](mailto:${SITE.email}): ${SITE.email}. Press: ${SITE.pressEmail}.`, '');

  p('## Machine-readable', '');
  p(
    link(
      'products.json',
      '/products.json',
      'Catalog with editions, finishes, prices, availability by launch phase, specs, policies and a schema.org graph.',
    ),
  );
  p(link('Sitemap', '/sitemap-index.xml', 'Every public page.'));
  p('');

  p('## Optional', '');
  for (const href of ['/story/', '/changelog/', '/press/', '/crack/', '/daily/']) {
    const label = href === '/daily/' ? OG_PAGES.daily.kicker : inNav(href);
    p(link(label, href));
  }
  p('');

  return new Response(out.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
