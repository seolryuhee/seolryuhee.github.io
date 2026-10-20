import assert from 'node:assert/strict';
import { cp, mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { chromium } from 'playwright';
import { parse as parseYaml } from 'yaml';

const project = process.cwd();
const output = path.resolve('.local/final-review');
await mkdir(output, { recursive: true });
const workspace = path.resolve('.local/build-acceptance');
await mkdir(workspace, { recursive: true });
for (const name of ['src', 'public', 'scripts']) await rm(path.join(workspace, name), { recursive: true, force: true });
for (const name of ['src', 'public', 'scripts', 'astro.config.mjs', 'tsconfig.json', 'package.json', 'package-lock.json']) await cp(name, path.join(workspace, name), { recursive: true });
// Vite resolves real dependency paths; a Windows junction outside this root can
// accidentally transform Astro's own runtime. Use an independent physical copy.
const dependencyLock = await readFile('package-lock.json', 'utf8');
const lockMarker = path.join(workspace, '.dependency-lock');
if (await readFile(lockMarker, 'utf8').catch(() => '') !== dependencyLock || !await stat(path.join(workspace, 'node_modules')).then(() => true).catch(() => false)) {
  console.log('Preparing isolated dependency copy…');
  await rm(path.join(workspace, 'node_modules'), { recursive: true, force: true });
  await cp(path.join(project, 'node_modules'), path.join(workspace, 'node_modules'), { recursive: true, filter: source => !/[\\/]\.vite(?:[\\/]|$)/.test(source) });
  await writeFile(lockMarker, dependencyLock);
}
const report = { workspace, cases: [], search: [], errors: [] };
let server;
let browser;
function passed(name, details = {}) { report.cases.push({ name, result: 'passed', ...details }); console.log(`PASS ${name}`); }
async function build(name, { fail = false, pattern, base = '/' } = {}) {
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/build.mjs'], { cwd: workspace, env: { ...process.env, BLOG_BASE: base, ASTRO_TELEMETRY_DISABLED: '1' } });
    const logfile = createWriteStream(path.join(output, `${name}.log`));
    child.stdout.pipe(logfile, { end: false }); child.stderr.pipe(logfile, { end: false });
    let log = '';
    child.stdout.on('data', chunk => { log += chunk; }); child.stderr.on('data', chunk => { log += chunk; });
    child.on('error', reject); child.on('close', code => { logfile.end(); resolve({ code, log }); });
  });
  await writeFile(path.join(output, `${name}.log`), result.log);
  if (fail) {
    assert.notEqual(result.code, 0, `${name}: expected failure`);
    if (pattern) assert.match(result.log, pattern);
    assert.equal(await stat(path.join(workspace, 'dist')).then(() => true).catch(() => false), false, '실패한 빌드의 dist가 남음');
  } else assert.equal(result.code, 0, result.log);
  passed(name);
}
async function serve(base = '/') {
  if (server) await new Promise(resolve => server.close(resolve));
  server = http.createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      if (!pathname.startsWith(base)) { res.writeHead(404).end(); return; }
      let file = path.resolve(workspace, 'dist', decodeURIComponent(pathname.slice(base.length)));
      const root = path.join(workspace, 'dist');
      assert.ok(file === root || file.startsWith(root + path.sep));
      if (pathname.endsWith('/')) file = path.join(file, 'index.html');
      const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.wasm': 'application/wasm', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.xml': 'application/xml' };
      const bytes = await readFile(file);
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(bytes);
    } catch { res.writeHead(404).end('Not found'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}${base}`;
}
const fixtures = [
  { slug: 'verify-note', title: '별빛제목 Java 기록', summary: '연두요약 — 프로그래밍을 천천히 익히는 기록.', tags: ['한국어 검증', '노을태그전용', 'Java'], extension: 'md', body: '호수본문 트랜잭션 findPublishedPost\n\n## 내용 살펴보기\n\n```java\npublic Post findPublishedPost(String slug) {\n    return repository.findPublishedPost(slug);\n}\nString longLine = "긴 코드 확인을 위한 문장입니다. '.concat('아주 긴 코드 줄입니다. '.repeat(25), '";\n```\n\n| 비교 | 입력 | 결과 | 조건 | 검증 |\n| --- | --- | --- | --- | --- |\n| 선택 | 긴 입력 문자열 | 예상 결과 | 처리할 조건 | 확인 내용 |\n\n![검증용 노트 그림](./diagram.svg)') },
  { slug: 'verify-csharp', title: 'C# 은하노트', summary: 'C# 식별자와 MDX 이미지 확인.', tags: ['한국어 검증', '언어', 'C#'], extension: 'mdx', body: '## 본문\n\n은하본문 C#\n\n![MDX 이미지](./diagram.svg)' },
  { slug: 'verify-cpp', title: 'C++ 바다노트', summary: 'C++ 식별자를 구별합니다.', tags: ['언어', 'C++'], extension: 'md', body: '## 본문\n\n바다본문 C++' },
  { slug: 'verify-draft', title: '비공개별무리', summary: '숨은요약은 공개되지 않습니다.', tags: ['초안전용'], extension: 'mdx', draft: true, body: '숨은본문은 공개되지 않습니다.' },
];
async function addFixture(post) {
  const folder = path.join(workspace, 'src/content/posts', post.slug);
  await mkdir(folder, { recursive: true });
  const data = { title: post.title, summary: post.summary, slug: post.slug, date: '2026-10-20', draft: post.draft || false, tags: post.tags };
  await writeFile(path.join(folder, `index.${post.extension}`), `---\n${Object.entries(data).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n')}\n---\n\n${post.body}\n`);
  await cp(path.join(project, 'src/content/posts/sample-programming/notebook.svg'), path.join(folder, 'diagram.svg'));
}
try {
  // Validate deployment control locally, without calling Actions or changing Pages.
  const workflow = parseYaml(await readFile('.github/workflows/pages.yml', 'utf8'));
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.equal(workflow.on.workflow_dispatch.inputs.publish.default, false);
  assert.equal(workflow.jobs.build.steps.findIndex(step => step.run === 'npm run build') < workflow.jobs.build.steps.findIndex(step => step.uses?.startsWith('actions/upload-pages-artifact@')), true);
  assert.match(workflow.jobs.deploy.if, /inputs.publish/); assert.match(workflow.jobs.deploy.if, /refs\/heads\/main/);
  passed('workflow-manual-only-verified-upload-before-deploy');
  await build('zero-public-posts');
  browser = await chromium.launch(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {});
  let origin = await serve();
  const emptyContext = await browser.newContext();
  const empty = await emptyContext.newPage();
  for (const route of ['', 'posts/', 'tags/', 'about/', 'search/']) assert.equal((await empty.goto(origin + route)).status(), 200);
  await empty.locator('#search-input').fill('없는검색어'); await empty.getByRole('button', { name: '찾기', exact: true }).click();
  assert.match(await empty.getByRole('status').textContent(), /아직 게시된 글이 없습니다/);
  await empty.screenshot({ path: path.join(output, 'zero-search.png'), fullPage: true });
  assert.equal((await empty.request.get(origin + 'posts/sample-programming/')).status(), 404);
  assert.equal((await empty.request.get(origin + 'posts/sample-everyday/')).status(), 404);
  await emptyContext.close(); passed('zero-public-ui-and-draft-direct-404');
  for (const post of fixtures) await addFixture(post);
  await build('public-markdown-mdx');
  origin = await serve();
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(origin + 'search/');
  const cases = [
    ['별빛제목', ['verify-note'], '제목에만 있는 단어'],
    ['연두요약', ['verify-note'], '요약에만 있는 단어'],
    ['호수본문', ['verify-note'], '본문에만 있는 단어'],
    ['트랜잭션', ['verify-note'], '한국어 기술 용어'],
    ['findPublishedPost', ['verify-note'], '영문 식별자'],
    ['C++', ['verify-cpp'], '기호를 포함한 C++'],
    ['C#', ['verify-csharp'], '기호를 포함한 C#'],
    ['존재하지않는무지개123', [], '빈 결과'],
    ['비공개별무리', [], '초안 제목 제외'],
    ['산책', [], '일상 샘플 제외'],
    ['Optional', [], '프로그래밍 샘플 제외'],
    ['목차', [], '목차 UI 제외'],
    ['RSS', [], '푸터 제외'],
    ['복사', [], '복사 버튼 제외'],
    ['초안전용', [], '초안 태그 제외'],
    ['노을태그전용', [], '태그 UI 제외'],
  ];
  for (const [query, expected, scenario] of cases) {
    await page.locator('#search-input').fill(query); await page.getByRole('button', { name: '찾기', exact: true }).click();
    await page.waitForFunction(() => /개의 기록을 찾았습니다|일치하는 글이 없습니다|검색을 불러오지 못했습니다/.test(document.querySelector('#search-status').textContent));
    assert.doesNotMatch(await page.getByRole('status').textContent(), /불러오지 못/);
    const actual = await page.locator('#search-results a').evaluateAll(links => links.map(link => link.pathname.split('/').filter(Boolean).at(-1)).sort());
    report.search.push({ query, scenario, expected, actual });
    assert.deepEqual(actual, expected, `${scenario}: ${query}`);
    if (query === 'C++') await page.screenshot({ path: path.join(output, 'search-cpp.png'), fullPage: true });
  }
  passed('search-title-summary-body-korean-identifiers-symbols-empty-drafts-ui-exclusion', { queries: cases.length });
  await context.close();
  for (const width of [1440, 390]) for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, permissions: ['clipboard-read', 'clipboard-write'] });
    const p = await ctx.newPage();
    p.on('pageerror', error => report.errors.push(error.message));
    for (const route of ['', 'posts/', 'tags/', 'about/', 'search/', 'posts/verify-note/', 'posts/verify-csharp/']) {
      assert.equal((await p.goto(origin + route)).status(), 200); await p.evaluate(() => document.fonts.ready);
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${route} overflow at ${width}`);
      assert.equal(await p.locator('html').getAttribute('lang'), 'ko');
    }
    await p.goto(origin + 'tags/');
    await p.getByRole('link', { name: /^한국어 검증/ }).click();
    assert.equal(await p.locator('.post-row').count(), 2);
    await p.goto(origin + 'posts/verify-note/'); await p.reload();
    const img = p.locator('.prose img'); await img.scrollIntoViewIfNeeded(); await img.evaluate(image => image.decode());
    if (width === 390) {
      assert.equal(await p.locator('.table-scroll').evaluate(el => el.scrollWidth > el.clientWidth), true);
      assert.equal(await p.locator('pre').evaluate(el => el.scrollWidth > el.clientWidth), true);
      await p.locator('.mobile-toc summary').click(); await p.locator('.mobile-toc a').first().click();
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.locator('.menu-toggle').focus(); await p.keyboard.press('Enter');
      assert.equal(await p.locator('.menu-toggle').getAttribute('aria-expanded'), 'true');
      await p.keyboard.press('Escape'); assert.equal(await p.locator('.menu-toggle').getAttribute('aria-expanded'), 'false');
    } else await p.locator('.desktop-toc a').first().click();
    await p.getByRole('button', { name: '코드 복사' }).click();
    await p.getByRole('status').filter({ hasText: '코드를 복사했습니다.' }).waitFor();
    assert.equal((await p.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n'), await p.locator('pre code').textContent());
    await p.locator('.theme-toggle').click(); await p.reload();
    assert.equal(await p.locator('html').getAttribute('data-theme'), theme === 'dark' ? 'light' : 'dark');
    await p.locator('.theme-toggle').click();
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.screenshot({ path: path.join(output, `article-${width}-${theme}.png`), fullPage: true });
    await ctx.close(); passed(`navigation-article-controls-${width}-${theme}`);
  }
  assert.deepEqual(report.errors, []);
  await browser.close(); browser = null;
  const bad = fixtures[0];
  await addFixture({ ...bad, body: `${bad.body}\n\n[없는 내부 링크](/missing-destination/)` });
  await build('broken-internal-link-fails', { fail: true, pattern: /누락 자산\/내부 링크/ });
  await addFixture(bad);
  const indexScript = path.join(workspace, 'scripts/index-search.mjs');
  const original = await readFile(indexScript, 'utf8');
  await writeFile(indexScript, "throw new Error('검증용 검색 인덱스 생성 실패');");
  await build('index-failure-stops-build', { fail: true, pattern: /검색 인덱스 생성 실패/ });
  await writeFile(indexScript, original);
  await build('project-base-path', { base: '/test-blog/' });
  origin = await serve('/test-blog/');
  browser = await chromium.launch(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {});
  const basePage = await browser.newPage();
  await basePage.goto(origin + 'search/?q=findPublishedPost');
  await basePage.waitForFunction(() => document.querySelector('#search-results a'));
  const resultUrl = await basePage.locator('#search-results a').first().getAttribute('href');
  assert.ok(resultUrl.startsWith('/test-blog/posts/'), `잘못된 base 검색 결과: ${resultUrl}`);
  await basePage.locator('#search-results a').first().click(); await basePage.reload();
  assert.equal(await basePage.locator('.article-header h1').textContent(), bad.title);
  const baseImg = basePage.locator('.prose img'); await baseImg.scrollIntoViewIfNeeded(); await baseImg.evaluate(image => image.decode());
  passed('project-base-search-result-direct-article-and-image');
  await browser.close(); browser = null;
  await writeFile(path.join(workspace, 'dist/stale-artifact.html'), 'previous build');
  for (const post of fixtures) await rm(path.join(workspace, 'src/content/posts', post.slug), { recursive: true, force: true });
  await build('return-to-zero-clears-old-html-and-search');
  assert.equal(await stat(path.join(workspace, 'dist/posts/verify-note/index.html')).then(() => true).catch(() => false), false);
  assert.equal(await stat(path.join(workspace, 'dist/stale-artifact.html')).then(() => true).catch(() => false), false);
  passed('fixture-posts-never-touch-real-content');
} finally {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
}
console.log(`Acceptance complete: ${report.cases.length} groups; ${report.search.length} search scenarios. Report: ${output}`);
