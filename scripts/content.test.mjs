import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { readPosts } from './lib/content.mjs';

const valid = { title: '검증 제목', date: '2026-10-20', summary: '검증 요약', slug: 'first', draft: true, tags: ['한국어', 'Java'] };
async function fixture(fn) {
  await mkdir('.local', { recursive: true });
  const root = await mkdtemp(path.resolve('.local/content-test-'));
  const add = async (folder, data = valid, body = '정상 본문', extension = 'md') => {
    const directory = path.join(root, 'src/content/posts', folder);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, `index.${extension}`), `---\n${Object.entries(data).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n')}\n---\n${body}\n`);
  };
  try { await fn({ root, add }); } finally { await rm(root, { recursive: true, force: true }); }
}
test('Markdown and MDX share validation and defaults', () => fixture(async ({ root, add }) => {
  const { tags, ...withoutTags } = valid;
  await add('first', withoutTags);
  await add('second', { ...valid, slug: 'second', draft: false }, '## 정상 MDX 본문', 'mdx');
  const posts = await readPosts(root);
  assert.equal(posts.length, 2); assert.deepEqual(posts[0].data.tags, []);
}));
test('required metadata and wrong types identify the file and field', () => fixture(async ({ root, add }) => {
  const { title, ...missing } = valid;
  await add('first', missing);
  await assert.rejects(readPosts(root), /index.md: title:/);
  await add('first', { ...valid, draft: 'false' });
  await assert.rejects(readPosts(root), /draft:/);
}));
test('calendar dates must exist', () => fixture(async ({ root, add }) => {
  await add('first', { ...valid, date: '2026-02-30' });
  await assert.rejects(readPosts(root), /실제로 존재/);
}));
test('duplicate slug fails across Markdown and MDX', () => fixture(async ({ root, add }) => {
  await add('first'); await add('second', valid, '본문', 'mdx');
  await assert.rejects(readPosts(root), /중복 slug/);
}));
test('folder must match the stable slug', () => fixture(async ({ root, add }) => {
  await add('wrong'); await assert.rejects(readPosts(root), /폴더 이름과 slug/);
}));
test('missing image and missing alt fail even in drafts', () => fixture(async ({ root, add }) => {
  await add('first', valid, '![설명](./missing.png)');
  await assert.rejects(readPosts(root), /누락 이미지/);
  await add('first', valid, '![](./missing.png)');
  await assert.rejects(readPosts(root), /대체 텍스트/);
}));
test('missing MDX imports and malformed MDX fail', () => fixture(async ({ root, add }) => {
  await add('first', valid, "import img from './missing.png';\n\n본문", 'mdx');
  await assert.rejects(readPosts(root), /누락 이미지\/가져오기/);
  await add('first', valid, '<div>닫히지 않은 JSX', 'mdx');
  await assert.rejects(readPosts(root), /본문 문법 오류/);
}));
test('reference images require an existing definition and file', () => fixture(async ({ root, add }) => {
  await add('first', valid, '![설명][asset]\n\n[asset]: ./missing.png');
  await assert.rejects(readPosts(root), /누락 이미지/);
}));
test('programming tags allow C++ and C# without allowing path separators', () => fixture(async ({ root, add }) => {
  await add('first', { ...valid, tags: ['C++', 'C#'] });
  assert.deepEqual((await readPosts(root))[0].data.tags, ['C++', 'C#']);
  await add('first', { ...valid, tags: ['bad/path'] });
  await assert.rejects(readPosts(root), /tags/);
}));
