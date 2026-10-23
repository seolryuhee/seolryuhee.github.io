export const site = {
  title: '배운 것과 지나온 날들',
  description: '배운 것과 지나온 날들을 천천히 기록합니다.',
  origin: 'https://seolryuhee.github.io',
};

// A project-site build can be checked locally with BLOG_BASE=/repository-name/.
export const base = `/${(process.env.BLOG_BASE || '').replace(/^\/+|\/+$/g, '')}/`.replace('//', '/');
if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base)) throw new Error('BLOG_BASE: 올바른 사이트 경로가 필요합니다.');
export const urlFor = (path = '') => base + path.replace(/^\/+/, '');
export const absoluteUrl = (path = '') => new URL(urlFor(path), site.origin).href;
// Preserve readable Korean names while keeping punctuation out of file paths.
export const tagKey = (tag) => [...tag].map(character => /[\p{L}\p{N} +_-]/u.test(character) ? character : `~${character.codePointAt(0).toString(16)}~`).join('');
export const tagPath = (tag) => urlFor(`tags/${encodeURIComponent(tagKey(tag))}/`);
