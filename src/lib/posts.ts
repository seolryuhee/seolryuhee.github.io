import { getCollection } from 'astro:content';
export async function publicPosts() {
  return (await allPosts()).filter(post => !post.data.draft);
}
async function allPosts() {
  return (await getCollection('posts')).sort((a, b) => b.data.date.localeCompare(a.data.date) || a.data.slug.localeCompare(b.data.slug));
}
export async function visiblePosts() {
  const posts = await allPosts();
  const slugs = new Set<string>();
  for (const post of posts) {
    if (slugs.has(post.data.slug)) throw new Error(`중복 slug: ${post.data.slug} (${post.id})`);
    slugs.add(post.data.slug);
  }
  return posts.filter(post => import.meta.env.DEV || !post.data.draft);
}
export const tagsFor = (posts: Awaited<ReturnType<typeof visiblePosts>>) => [...new Set(posts.flatMap(post => post.data.tags))].sort((a, b) => a.localeCompare(b, 'ko'));
export const formatDate = (date: string) => new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Seoul',
}).format(new Date(`${date}T00:00:00+09:00`));
