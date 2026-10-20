import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { load } from 'cheerio';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { chromium } from 'playwright';
import { walk, readPosts } from './lib/content.mjs';
import { site, absoluteUrl, urlFor } from '../src/lib/site.mjs';

const output = path.resolve('.local/deployment');
await mkdir(output, { recursive: true });
const artifact = path.resolve(process.env.DEPLOY_ARTIFACT_DIR || 'dist');
const posts = await readPosts();
const published = posts.filter(post => !post.data.draft);
const report = { site: absoluteUrl(), artifact, checkedAt: new Date().toISOString(), files: [], pages: [], browser: [], errors: [] };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function get(url) {
  const request = new URL(url);
  request.searchParams.set('verify', process.env.DEPLOY_COMMIT || Date.now().toString());
  return fetch(request, { headers: { 'Cache-Control': 'no-cache' } });
}
let browser;
try {
  // Compare the uploaded CI artifact, not a fresh local rebuild, with the public site.
  for (const file of await walk(artifact)) {
    const relative = path.relative(artifact, file).replaceAll('\\', '/');
    if (relative.startsWith('.')) continue;
    const local = await readFile(file);
    const url = new URL(relative.split('/').map(encodeURIComponent).join('/'), absoluteUrl());
    const response = await get(url);
    assert.equal(response.status, 200, `${relative}: HTTP ${response.status}`);
    const remote = Buffer.from(await response.arrayBuffer());
    assert.equal(digest(remote), digest(local), `${relative}: 공개 파일과 업로드 결과물이 다릅니다.`);
    report.files.push({ path: relative, status: response.status, sha256: digest(local) });
  }
  const parser = new XMLParser({ ignoreAttributes: false });
  const rssText = await (await get(absoluteUrl('rss.xml'))).text();
  const sitemapText = await (await get(absoluteUrl('sitemap.xml'))).text();
  assert.equal(XMLValidator.validate(rssText), true);
  assert.equal(XMLValidator.validate(sitemapText), true);
  const array = value => value == null || value === '' ? [] : Array.isArray(value) ? value : [value];
  const feed = parser.parse(rssText).rss.channel;
  assert.equal(feed.language, 'ko');
  assert.deepEqual(array(feed.item).map(item => item.link).sort(), published.map(post => absoluteUrl(`posts/${post.data.slug}/`)).sort());
  for (const item of array(parser.parse(sitemapText).urlset.url)) {
    const response = await get(item.loc);
    assert.equal(response.status, 200, `사이트맵 링크: ${item.loc}`);
  }
  const entry = await (await get(absoluteUrl('pagefind/pagefind-entry.json'))).json();
  assert.equal(Object.values(entry.languages || {}).reduce((sum, lang) => sum + lang.page_count, 0), published.length);
  for (const post of posts.filter(post => post.data.draft)) {
    const response = await get(absoluteUrl(`posts/${post.data.slug}/`));
    assert.equal(response.status, 404, `초안 주소 노출: ${post.data.slug}`);
    assert.ok(!(await response.text()).includes(post.data.title));
    report.pages.push({ path: `posts/${post.data.slug}/`, status: 404 });
  }
  const checkedLinks = new Set();
  for (const route of ['', 'posts/', 'tags/', 'about/', 'search/']) {
    const response = await get(absoluteUrl(route));
    assert.equal(response.status, 200);
    const $ = load(await response.text());
    assert.equal($('html').attr('lang'), 'ko');
    assert.equal($('link[rel=canonical]').attr('href'), absoluteUrl(route));
    for (const el of $('[href], [src]').toArray()) for (const attribute of ['href', 'src']) {
      const value = $(el).attr(attribute);
      if (!value || value.startsWith('#')) continue;
      const url = new URL(value, absoluteUrl(route));
      if (url.origin !== site.origin || checkedLinks.has(url.href)) continue;
      checkedLinks.add(url.href);
      assert.equal((await get(url)).status, 200, `내부 링크/자산: ${url.href}`);
    }
    report.pages.push({ path: route, status: response.status });
  }
  browser = await chromium.launch(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {});
  for (const [width, theme] of [[1440, 'light'], [390, 'dark']]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, extraHTTPHeaders: { 'Cache-Control': 'no-cache' } });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`); });
    for (const route of ['', 'posts/', 'tags/', 'about/', 'search/']) {
      assert.equal((await page.goto(absoluteUrl(route))).status(), 200);
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      if (published.length === 0 && route === 'posts/') assert.equal(await page.locator('.post-row').count(), 0);
    }
    if (published.length === 0) {
      for (const query of ['없는검색어123', 'Optional', '산책']) {
        await page.locator('#search-input').fill(query);
        await page.getByRole('button', { name: '찾기', exact: true }).click();
        assert.match(await page.getByRole('status').textContent(), /아직 게시된 글이 없습니다/);
        assert.equal(await page.locator('#search-results li').count(), 0);
      }
    }
    const moduleUrl = urlFor('pagefind/pagefind.js');
    assert.equal(await page.evaluate(async url => typeof (await import(url)).search, moduleUrl), 'function');
    const images = await page.evaluate(async url => {
      const image = new Image(); image.src = url; await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight };
    }, absoluteUrl('social.png'));
    assert.deepEqual(images, { width: 1200, height: 630 });
    if (width === 390) {
      await page.locator('.menu-toggle').focus(); await page.keyboard.press('Enter');
      assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'true');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'false');
    }
    await page.screenshot({ path: path.join(output, `live-search-${width}-${theme}.png`), fullPage: true });
    await page.goto(absoluteUrl());
    await page.screenshot({ path: path.join(output, `live-home-${width}-${theme}.png`), fullPage: true });
    report.browser.push({ width, theme, publicPosts: published.length, image: images, result: 'passed' });
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  report.publicPosts = published.length;
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.errors.push(error.message); throw error;
} finally {
  if (browser) await browser.close();
  await writeFile(path.join(output, 'live-report.json'), JSON.stringify(report, null, 2));
}
console.log(`공개 검증 성공: 파일 ${report.files.length}개 SHA-256 일치, 공개 글 ${published.length}개, 페이지/링크/이미지/검색/RSS/사이트맵 정상`);
