import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import { load } from 'cheerio';
import { postSchema } from '../../src/lib/content-schema.mjs';

export async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(file));
    else files.push(file);
  }
  return files;
}
export async function readPosts(root = process.cwd()) {
  const directory = path.join(root, 'src/content/posts');
  const files = (await walk(directory)).filter(file => /\.mdx?$/.test(file));
  const posts = [];
  const slugs = new Set();
  for (const file of files) {
    const relative = path.relative(directory, file).replaceAll('\\', '/');
    if (!/^[^/]+\/index\.mdx?$/.test(relative)) throw new Error(`${file}: <slug>/index.md 또는 index.mdx 위치에 작성해 주세요.`);
    const text = await readFile(file, 'utf8');
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!match) throw new Error(`${file}: YAML 메타데이터가 필요합니다.`);
    let raw;
    try { raw = parseYaml(match[1], { uniqueKeys: true }); }
    catch (error) { throw new Error(`${file}: 메타데이터 YAML 오류: ${error.message}`); }
    const result = postSchema.safeParse(raw);
    if (!result.success) throw new Error(`${file}: ${result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
    const data = result.data;
    if (slugs.has(data.slug)) throw new Error(`${file}: 중복 slug: ${data.slug}`);
    slugs.add(data.slug);
    if (relative.split('/')[0] !== data.slug) throw new Error(`${file}: 폴더 이름과 slug(${data.slug})가 일치해야 합니다.`);
    const body = text.slice(match[0].length);
    const parser = unified().use(remarkParse);
    if (file.endsWith('.mdx')) parser.use(remarkMdx);
    let tree;
    try { tree = parser.parse(body); } catch (error) { throw new Error(`${file}: 본문 문법 오류: ${error.message}`); }
    const references = [];
    const definitions = new Map();
    function visit(node) {
      if (node.type === 'definition') definitions.set(node.identifier.toLowerCase(), node.url);
      if (node.type === 'image') {
        if (!node.alt?.trim()) throw new Error(`${file}: 이미지 대체 텍스트가 필요합니다.`);
        references.push(node.url);
      }
      if (node.type === 'imageReference') references.push({ identifier: node.identifier.toLowerCase(), alt: node.alt });
      if (node.type === 'html') {
        const $ = load(node.value);
        $('img').each((_, el) => {
          if (!$(el).attr('alt')?.trim()) throw new Error(`${file}: 이미지 대체 텍스트가 필요합니다.`);
          if ($(el).attr('src')) references.push($(el).attr('src'));
        });
      }
      if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
        if (node.name === 'img' || node.name === 'Image') {
          const attrs = new Map(node.attributes.filter(attr => attr.type === 'mdxJsxAttribute').map(attr => [attr.name, attr.value]));
          if (!attrs.get('alt')) throw new Error(`${file}: 이미지 대체 텍스트가 필요합니다.`);
          if (typeof attrs.get('src') === 'string') references.push(attrs.get('src'));
        }
      }
      if (node.type === 'mdxjsEsm') {
        for (const statement of node.data?.estree?.body || []) {
          if (statement.type === 'ImportDeclaration' && statement.source.value.startsWith('.')) references.push(statement.source.value);
        }
      }
      for (const child of node.children || []) visit(child);
    }
    visit(tree);
    for (let reference of references) {
      if (typeof reference === 'object') {
        if (!reference.alt?.trim()) throw new Error(`${file}: 이미지 대체 텍스트가 필요합니다.`);
        reference = definitions.get(reference.identifier);
        if (!reference) throw new Error(`${file}: 이미지 참조 정의를 찾을 수 없습니다.`);
      }
      if (/^(?:https?:|data:|\/\/|#)/i.test(reference)) continue;
      const local = decodeURIComponent(reference.split(/[?#]/)[0]);
      const target = local.startsWith('/') ? path.join(root, 'public', local) : path.resolve(path.dirname(file), local);
      if (!await stat(target).then(result => result.isFile()).catch(() => false)) throw new Error(`${file}: 누락 이미지/가져오기: ${reference}`);
    }
    posts.push({ file, data, body });
  }
  return posts;
}
