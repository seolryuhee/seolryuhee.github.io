import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { load } from 'cheerio';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { readPosts, walk } from './lib/content.mjs';
import { site, base, urlFor, absoluteUrl, tagKey } from '../src/lib/site.mjs';

const root = path.resolve('dist');
const posts = await readPosts();
const published = posts.filter(post => !post.data.draft);
const tags = [...new Set(published.flatMap(post => post.data.tags))];
const routes = ['', 'posts/', 'tags/', 'about/', 'search/', ...published.map(post => `posts/${post.data.slug}/`), ...tags.map(tag => `tags/${encodeURIComponent(tagKey(tag))}/`)];
const expectedHtml = [...routes.map(route => `${decodeURIComponent(route)}index.html`), '404.html'].sort();
const files = await walk(root);
const htmlFiles = files.filter(file => file.endsWith('.html'));
assert.deepEqual(htmlFiles.map(file => path.relative(root, file).replaceAll('\\', '/')).sort(), expectedHtml, '생성된 HTML 경로가 공개 글/태그 목록과 다릅니다.');
const documents = new Map();
for (const file of htmlFiles) documents.set(file, load(await readFile(file, 'utf8')));

async function checkReference(reference, from, { anchor = true } = {}) {
  if (!reference || /^(?:data:|mailto:|tel:)/i.test(reference)) return;
  const relative = path.relative(root, from).replaceAll('\\', '/');
  const pageUrl = new URL(urlFor(relative.endsWith('index.html') ? relative.slice(0, -10) : relative), site.origin);
  const url = new URL(reference, pageUrl);
  if (url.origin !== site.origin) return;
  assert.ok(url.pathname.startsWith(base), `${relative}: base(${base})를 벗어난 내부 경로 ${reference}`);
  const local = decodeURIComponent(url.pathname.slice(base.length));
  let target = path.resolve(root, local);
  assert.ok(target === root || target.startsWith(root + path.sep), `결과물 밖을 가리키는 경로: ${reference}`);
  if (url.pathname.endsWith('/')) target = path.join(target, 'index.html');
  assert.ok(await stat(target).then(result => result.isFile()).catch(() => false), `${relative}: 누락 자산/내부 링크 ${reference}`);
  if (anchor && url.hash && documents.has(target)) {
    const id = decodeURIComponent(url.hash.slice(1));
    assert.ok(documents.get(target)('[id]').toArray().some(el => documents.get(target)(el).attr('id') === id), `${relative}: 없는 앵커 ${reference}`);
  }
}

for (const [file, $] of documents) {
  assert.equal($('html').attr('lang'), 'ko', `${file}: lang`);
  const relative = path.relative(root, file).replaceAll('\\', '/');
  assert.ok($('title').text().trim());
  assert.ok($('meta[name=description]').attr('content'));
  assert.equal($('link[rel=canonical]').attr('href'), absoluteUrl(relative.endsWith('index.html') ? relative.slice(0, -10) : relative));
  assert.equal($('meta[property="og:url"]').attr('content'), $('link[rel=canonical]').attr('href'));
  assert.equal($('meta[name="twitter:card"]').attr('content'), 'summary_large_image');
  if (relative === '404.html') assert.match($('meta[name=robots]').attr('content'), /noindex/);
  for (const element of $('[href], [src], [data-index-url]').toArray()) {
    for (const attr of ['href', 'src', 'data-index-url']) if ($(element).attr(attr)) await checkReference($(element).attr(attr), file);
    const srcset = $(element).attr('srcset');
    if (srcset) for (const item of srcset.split(',')) await checkReference(item.trim().split(/\s+/)[0], file);
  }
  for (const img of $('img').toArray()) assert.ok($(img).attr('alt')?.trim(), `${file}: 이미지 대체 텍스트`);
  await checkReference($('meta[property="og:image"]').attr('content'), file);
  const indexable = $('[data-pagefind-body]');
  const isArticle = published.some(post => relative === `posts/${post.data.slug}/index.html`);
  assert.equal(indexable.length, isArticle ? 1 : 0, `${file}: 잘못된 검색 범위`);
  if (isArticle) {
    assert.equal(indexable.find('h1[data-pagefind-meta=title]').length, 1);
    assert.equal(indexable.find('[data-pagefind-meta=description]').length, 1);
    assert.equal(indexable.find('.mobile-toc:not([data-pagefind-ignore])').length, 0);
  }
  for (const draft of posts.filter(post => post.data.draft)) {
    assert.equal($('a').toArray().some(el => $(el).attr('href') === urlFor(`posts/${draft.data.slug}/`)), false, `${file}: 초안 링크 노출`);
    assert.ok(!$('main').text().includes(draft.data.title), `${file}: 초안 제목 노출`);
  }
}
for (const file of files.filter(file => file.endsWith('.css'))) {
  const css = await readFile(file, 'utf8');
  for (const match of css.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g)) await checkReference(match[1], file, { anchor: false });
}
const parser = new XMLParser({ ignoreAttributes: false });
for (const name of ['rss.xml', 'sitemap.xml']) assert.equal(XMLValidator.validate(await readFile(path.join(root, name), 'utf8')), true, `${name}: 유효하지 않은 XML`);
const feed = parser.parse(await readFile(path.join(root, 'rss.xml'), 'utf8')).rss.channel;
const array = value => value == null || value === '' ? [] : Array.isArray(value) ? value : [value];
const items = array(feed.item);
assert.equal(feed.language, 'ko');
assert.equal(feed.link, absoluteUrl());
assert.equal(items.length, published.length);
assert.deepEqual(items.map(item => item.link).sort(), published.map(post => absoluteUrl(`posts/${post.data.slug}/`)).sort());
for (const item of items) { assert.ok(item.title && item.description && !Number.isNaN(Date.parse(item.pubDate))); await checkReference(item.link, path.join(root, 'rss.xml')); }
const sitemap = parser.parse(await readFile(path.join(root, 'sitemap.xml'), 'utf8')).urlset;
assert.equal(sitemap['@_xmlns'], 'http://www.sitemaps.org/schemas/sitemap/0.9');
assert.deepEqual(array(sitemap.url).map(item => item.loc).sort(), routes.map(absoluteUrl).sort());
const entry = JSON.parse(await readFile(path.join(root, 'pagefind/pagefind-entry.json'), 'utf8'));
const indexed = Object.values(entry.languages || {}).reduce((sum, lang) => sum + lang.page_count, 0);
assert.equal(indexed, published.length, '검색 인덱스 글 수가 다릅니다.');
for (const required of ['pagefind/pagefind.js', 'social.png', 'favicon.svg', 'robots.txt']) assert.ok(await stat(path.join(root, required)).then(result => result.size > 0));
assert.ok(files.some(file => file.endsWith('.woff2')), '자체 호스팅 글꼴 누락');
console.log(`최종 결과물 검증 완료: HTML ${htmlFiles.length}개, 공개 글 ${published.length}개, 내부 링크·자산·RSS·사이트맵·검색 인덱스 정상`);
