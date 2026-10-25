import { siteUrl, basePath } from '../lib/data';
export function GET() {
  return new Response(
    basePath !== '/'
      ? 'User-agent: *\nDisallow: /\n'
      : `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nDisallow: /preview/\n${siteUrl ? `Sitemap: ${siteUrl}/sitemap.xml\n` : ''}`,
    { headers: { 'Content-Type': 'text/plain' } },
  );
}
