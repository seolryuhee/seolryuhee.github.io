import * as pagefind from 'pagefind';
import { readPosts } from './lib/content.mjs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const platform = process.platform === 'win32' ? 'windows' : process.platform;
const executable = process.platform === 'win32' ? 'pagefind_extended.exe' : 'pagefind_extended';
// Require the pinned extended binary; never silently fall back to the basic build.
process.env.PAGEFIND_EXTENDED_BINARY_PATH = require.resolve(`@pagefind/${platform}-${process.arch}/bin/${executable}`);

const posts = (await readPosts()).filter(post => !post.data.draft);
try {
  const created = await pagefind.createIndex({ forceLanguage: 'ko', includeCharacters: '+#', keepIndexUrl: false });
  if (created.errors?.length || !created.index) throw new Error(JSON.stringify(created.errors));
  const { index } = created;
  // Only public article HTML can enter the index, even when there are no posts.
  for (const post of posts) {
    const { readFile } = await import('node:fs/promises');
    const result = await index.addHTMLFile({
      url: `/posts/${post.data.slug}/`,
      content: await readFile(`dist/posts/${post.data.slug}/index.html`, 'utf8'),
    });
    if (result.errors?.length) throw new Error(JSON.stringify(result.errors));
  }
  const result = await index.writeFiles({ outputPath: 'dist/pagefind' });
  if (result.errors?.length) throw new Error(JSON.stringify(result.errors));
  console.log(`Pagefind extended 검색 생성 완료: 공개 글 ${posts.length}개, 언어 ko, 보존 문자 +#`);
} finally { await pagefind.close(); }
