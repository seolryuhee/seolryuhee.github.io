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
const report = { site: absoluteUrl(), artifact, commit: process.env.DEPLOY_COMMIT || null, checkedAt: new Date().toISOString(), files: [], pages: [], browser: [], search: [], errors: [] };
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
  for (const route of ['', 'posts/', 'tags/', 'about/', 'search/', ...published.map(post => `posts/${post.data.slug}/`)]) {
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
  for (const width of [1440, 390, 320]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, extraHTTPHeaders: { 'Cache-Control': 'no-cache' } });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`); });
    for (const route of ['', 'posts/', 'tags/', 'about/', 'search/']) {
      assert.equal((await page.goto(absoluteUrl(route))).status(), 200);
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      if (published.length === 0 && route === 'posts/') assert.equal(await page.locator('.post-row').count(), 0);
      assert.equal(await page.locator('.brand-title').textContent(), site.title);
      assert.equal(await page.locator('.brand-mark svg').count(), 1);
      assert.equal(await page.locator('.site-footer > span').textContent(), site.title);
      assert.equal(await page.locator('.site-footer > a').textContent(), 'RSS');
    }
    for (const post of published) {
      assert.equal((await page.goto(absoluteUrl(`posts/${post.data.slug}/`))).status(), 200);
      assert.equal((await page.reload()).status(), 200);
      assert.equal(await page.locator('.article-header h1').textContent(), post.data.title);
      assert.equal(await page.locator('.article-summary').textContent(), post.data.summary);
      assert.equal(await page.locator('.draft-notice').count(), 0);
      assert.equal(await page.locator('meta[name=robots]').count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      for (const toc of [width <= 900 ? '.mobile-toc' : '.desktop-toc']) {
        if (await page.locator(`${toc} a`).count()) {
          if (width <= 900) await page.locator(`${toc} summary`).click();
          await page.locator(`${toc} a`).first().click();
          const fragment = new URL(page.url()).hash.slice(1);
          assert.ok(await page.evaluate(id => Boolean(document.getElementById(decodeURIComponent(id))), fragment));
        }
      }
      if (post.data.slug === 'korean-ime-fix-mod') {
        assert.deepEqual(await page.locator('.prose h2').allTextContents(), ['1. 문제 발견', '2. 기존 해결 방법 조사', '3. 기존 해결 방법 적용 실패', '4. 문제 분석 및 재정의', '5. 해결 방안 설계', '6. AI를 활용한 모드 구현', '7. 적용 결과 및 결론']);
        assert.equal(await page.getByRole('link', { name: 'Korean IME Fix Mod (Steam 창작마당)', exact: true }).getAttribute('href'), 'https://steamcommunity.com/sharedfiles/filedetails/?id=3660423434');
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(output, `live-${post.data.slug}-${width}-${theme}.png`), fullPage: true });
    }
    await page.goto(absoluteUrl('search/'));
    if (published.length === 0) {
      for (const query of ['없는검색어123', 'Optional', '산책']) {
        await page.locator('#search-input').fill(query);
        await page.getByRole('button', { name: '찾기', exact: true }).click();
        assert.match(await page.getByRole('status').textContent(), /아직 게시된 글이 없습니다/);
        assert.equal(await page.locator('#search-results li').count(), 0);
      }
    } else {
      const firstRecord = published.find(post => post.data.slug === 'korean-ime-fix-mod');
      const cases = [
        ...(firstRecord ? ['한영키', '해결기', '히라가나', 'Korean IME Fix Mod'].map(query => ({ query, includes: firstRecord.data.slug })) : published.map(post => ({ query: post.data.title, includes: post.data.slug }))),
        ...['없는검색어123', 'Optional', '산책'].map(query => ({ query, empty: true })),
      ];
      for (const test of cases) {
        await page.locator('#search-input').fill(test.query);
        await page.getByRole('button', { name: '찾기', exact: true }).click();
        await page.waitForFunction(() => /개의 기록을 찾았습니다|일치하는 글이 없습니다|검색을 불러오지 못했습니다/.test(document.querySelector('#search-status').textContent));
        assert.doesNotMatch(await page.getByRole('status').textContent(), /불러오지 못/);
        const actual = await page.locator('#search-results a').evaluateAll(links => links.map(link => link.pathname.split('/').filter(Boolean).at(-1)).sort());
        if (test.empty) assert.deepEqual(actual, [], test.query);
        else assert.ok(actual.includes(test.includes), `${test.query}: ${JSON.stringify(actual)}`);
        report.search.push({ width, theme, query: test.query, expected: test.empty ? [] : { includes: test.includes }, actual });
        if (test.includes && published.length === 1) assert.deepEqual(actual, [test.includes]);
        if (test.includes) {
          if (test.query === '한영키') await page.screenshot({ path: path.join(output, `live-positive-search-${width}-${theme}.png`), fullPage: true });
          await page.locator(`#search-results a[href="${urlFor(`posts/${test.includes}/`)}"]`).click();
          assert.equal(new URL(page.url()).pathname, urlFor(`posts/${test.includes}/`));
          assert.equal((await page.reload()).status(), 200);
          assert.equal(await page.locator('h1').textContent(), published.find(post => post.data.slug === test.includes).data.title);
          await page.goto(absoluteUrl('search/'));
        }
      }
    }
    const moduleUrl = urlFor('pagefind/pagefind.js');
    assert.equal(await page.evaluate(async url => typeof (await import(url)).search, moduleUrl), 'function');
    const images = await page.evaluate(async url => {
      const image = new Image(); image.src = url; await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight };
    }, absoluteUrl('social.png'));
    assert.deepEqual(images, { width: 1200, height: 630 });
    if (width <= 600) {
      await page.locator('.menu-toggle').focus(); await page.keyboard.press('Enter');
      assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'true');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'false');
    }
    await page.locator('.theme-toggle').click(); await page.reload();
    assert.equal(await page.locator('html').getAttribute('data-theme'), theme === 'dark' ? 'light' : 'dark');
    await page.locator('.theme-toggle').click();
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
