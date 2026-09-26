/**
 * Global site identity. Anything a visitor or crawler sees about "who we are"
 * comes from here so it stays consistent across pages, JSON-LD and feeds.
 */
export const SITE = {
  name: 'Detent',
  legalName: 'Detent Labs',
  product: 'Detent One',
  tagline: 'Software you can feel.',
  description:
    'Detent One is a machined aluminum dial with software-defined haptics. It clicks, glides, springs back or stops dead, depending on the app you are in.',
  locale: 'en_US',
  lang: 'en',
  themeColor: '#0f0d0e',
  email: 'hello@detent.example',
  pressEmail: 'press@detent.example',
  social: {
    x: 'https://x.com/',
    youtube: 'https://www.youtube.com/',
    discord: 'https://discord.com/',
    github: 'https://github.com/',
  },
  /**
   * Detent is a concept product. The site says so in the footer and in every
   * form, so nobody mistakes a demo for a real store.
   */
  conceptNotice:
    'Detent is a concept product. This site is a design and engineering demonstration; nothing is for sale and no payment or personal data is collected.',
} as const;

export interface NavItem {
  label: string;
  href: string; // path relative to site root, without base, e.g. '/shop/'
}

export const PRIMARY_NAV: NavItem[] = [
  { label: 'Feel', href: '/profiles/' },
  { label: 'Specs', href: '/specs/' },
  { label: 'Integrations', href: '/integrations/' },
  { label: 'Story', href: '/story/' },
  { label: 'Shop', href: '/shop/' },
];

export const FOOTER_NAV: { title: string; items: NavItem[] }[] = [
  {
    title: 'Product',
    items: [
      { label: 'Detent One', href: '/' },
      { label: 'Shop', href: '/shop/' },
      { label: 'Tech specs', href: '/specs/' },
      { label: 'Feel library', href: '/profiles/' },
      { label: 'Integrations', href: '/integrations/' },
    ],
  },
  {
    title: 'Made for',
    items: [
      { label: 'Video editors', href: '/for/editors/' },
      { label: 'Music producers', href: '/for/musicians/' },
      { label: 'Designers', href: '/for/designers/' },
      { label: 'Developers', href: '/for/developers/' },
    ],
  },
  {
    title: 'Company',
    items: [
      { label: 'Story', href: '/story/' },
      { label: 'Changelog', href: '/changelog/' },
      { label: 'Press kit', href: '/press/' },
      { label: 'Launch plan', href: '/launch-plan/' },
    ],
  },
  {
    title: 'Help',
    items: [
      { label: 'Support & FAQ', href: '/support/' },
      { label: 'Crack the safe', href: '/crack/' },
      { label: 'Privacy', href: '/legal/privacy/' },
      { label: 'Terms', href: '/legal/terms/' },
    ],
  },
];
