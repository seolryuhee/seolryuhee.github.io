import { readPosts } from './lib/content.mjs';
const posts = await readPosts();
console.log(`콘텐츠 검증 완료: ${posts.length}개 (공개 ${posts.filter(post => !post.data.draft).length}개)`);
