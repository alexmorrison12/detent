/**
 * RSS 2.0 feed of RELEASES at /changelog/rss.xml. Static: generated at build.
 */
import type { APIRoute } from 'astro';
import { SITE } from '@/config/site';
import { RELEASES, releaseId, releaseName } from '@/data/changelog';
import { absoluteUrl } from '@/lib/url';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rfc822 = (iso: string) => new Date(`${iso}T16:00:00Z`).toUTCString();

export const GET: APIRoute = ({ site }) => {
  const page = absoluteUrl('/changelog/', site);
  const items = RELEASES.map((r) => {
    const link = `${page}#${releaseId(r)}`;
    const html =
      `<p>${esc(r.summary)}</p><ul>` + r.changes.map((c) => `<li><strong>${esc(c.kind)}:</strong> ${esc(c.text)}</li>`).join('') + '</ul>';
    return `    <item>
      <title>${esc(`${releaseName(r)}: ${r.title}`)}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="true">${esc(link)}</guid>
      <pubDate>${rfc822(r.date)}</pubDate>
      <category>${esc(r.stream)}</category>
      <description><![CDATA[${html}]]></description>
    </item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(`${SITE.product} changelog`)}</title>
    <link>${esc(page)}</link>
    <description>Firmware, Detent Studio and SDK release notes for ${esc(SITE.product)}.</description>
    <language>en-us</language>
    <lastBuildDate>${rfc822(RELEASES[0]!.date)}</lastBuildDate>
    <atom:link href="${esc(absoluteUrl('/changelog/rss.xml', site))}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
