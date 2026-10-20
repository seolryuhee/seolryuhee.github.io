import { absoluteUrl, base } from '../lib/site.mjs';
export function GET() { return new Response(`User-agent: *\nAllow: ${base}\nSitemap: ${absoluteUrl('sitemap.xml')}\n`); }
