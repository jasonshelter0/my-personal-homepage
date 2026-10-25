import { entries, LOCALES, publicHref, entryHref, withoutBase, siteUrl } from '../lib/data';
import { allLearningPaths } from '../lib/learning-catalog';
const esc = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
export function GET() {
  const urls = LOCALES.flatMap((locale) =>
    ['', 'projects', 'posts', 'pages', 'resume', 'learn', ...allLearningPaths]
      .map((path) => publicHref(locale, path))
      .concat(entries.map((entry) => withoutBase(entryHref(locale, entry)))),
  );
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${siteUrl ? urls.map((url) => `<url><loc>${esc(siteUrl + url)}</loc></url>`).join('') : ''}</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}
