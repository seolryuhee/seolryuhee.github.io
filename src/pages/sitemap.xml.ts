import { publicPosts, tagsFor } from '../lib/posts';
import { absoluteUrl, tagKey } from '../lib/site.mjs';
const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
export async function GET() {
  const posts = await publicPosts();
  const routes = ['', 'posts/', 'tags/', 'about/', 'search/', ...posts.map(post => `posts/${post.data.slug}/`), ...tagsFor(posts).map(tag => `tags/${encodeURIComponent(tagKey(tag))}/`)];
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map(path => `<url><loc>${escape(absoluteUrl(path))}</loc></url>`).join('')}</urlset>`, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
