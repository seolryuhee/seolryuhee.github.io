import { spawnSync } from 'node:child_process';
import { rm, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = await realpath(process.cwd());
const dist = path.resolve(root, 'dist');
// Delete only this workspace's generated artifact, never a caller-supplied path.
if (path.dirname(dist) !== root) throw new Error('잘못된 빌드 경로');
await rm(dist, { recursive: true, force: true });
function run(file, args = []) {
  const result = spawnSync(process.execPath, [file, ...args], { stdio: 'inherit', cwd: root });
  if (result.error || result.status !== 0) throw result.error || new Error(`빌드 단계 실패: ${file} (exit ${result.status})`);
}
try {
  run('scripts/validate-content.mjs');
  run(path.join(path.dirname(fileURLToPath(import.meta.resolve('astro/package.json'))), 'bin/astro.mjs'), ['build']);
  run('scripts/index-search.mjs');
  run('scripts/validate-dist.mjs');
} catch (error) {
  // A failed build must not leave an older, deployable artifact behind.
  await rm(dist, { recursive: true, force: true });
  console.error(error.message);
  process.exitCode = 1;
}
