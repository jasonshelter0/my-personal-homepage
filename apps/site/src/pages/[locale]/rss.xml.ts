import {
  snapshot,
  entries,
  LOCALES,
  localePath,
  href,
  entryHref,
  siteUrl,
  type Locale,
} from '../../lib/data';
const esc = (s: string) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
export function getStaticPaths() {
  return LOCALES.map((locale) => ({ params: { locale: localePath(locale) }, props: { locale } }));
}
export function GET({ props }: { props: { locale: Locale } }) {
  const locale = props.locale;
  const profile = snapshot.settings.profile[locale];
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(profile.name)}</title><link>${esc(siteUrl + href(locale))}</link><description>${esc(profile.seoDescription)}</description><language>${locale}</language>${entries
    .filter((entry) => entry.type === 'post')
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((entry) => {
      const content = entry.translations[locale];
      return `<item><title>${esc(content.title)}</title><link>${esc(siteUrl + entryHref(locale, entry))}</link><guid>${esc(siteUrl + entryHref(locale, entry))}</guid><description>${esc(content.summary)}</description>${entry.date && !Number.isNaN(Date.parse(entry.date)) ? `<pubDate>${new Date(entry.date).toUTCString()}</pubDate>` : ''}</item>`;
    })
    .join('')}</channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml' } });
}
