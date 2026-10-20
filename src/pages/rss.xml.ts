import rss from '@astrojs/rss';
import { publicPosts } from '../lib/posts';
import { site, absoluteUrl } from '../lib/site.mjs';
export async function GET() {
  const posts = await publicPosts();
  return rss({
    title: site.title, description: site.description, site: absoluteUrl(),
    items: posts.map(post => ({ title: post.data.title, pubDate: new Date(`${post.data.date}T00:00:00+09:00`), description: post.data.summary, link: absoluteUrl(`posts/${post.data.slug}/`) })),
    customData: '<language>ko</language>',
  });
}
