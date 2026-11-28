import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, link, mkdir, mkdtemp, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { it } from 'vitest';
import { INFRASTRUCTURE_ERROR } from '../../src/errors/errors.js';
import { prepareRuntimeCache } from '../../src/runtime/runtime-cache.js';

const key = 'node_modules/example/index.js';
const content = Buffer.from('bundled content');
const assets = { keys: [key], read: () => content };
const runtimeId = createHash('sha256').update(key).update('\0')
  .update(createHash('sha256').update(content).digest()).digest('hex');
const invalid = { code: INFRASTRUCTURE_ERROR.RUNTIME_CACHE_INVALID };

async function cacheFixture(t) {
  const root = await mkdtemp(join(homedir(), '.touro-cache-test-'));
  t.onTestFinished(() => rm(root, { recursive: true, force: true }));
  return join(root, 'cache');
}

it('publishes one complete cache when extraction is concurrent and reuses it', async (t) => {
  const cache = await cacheFixture(t);
  const prepare = () => prepareRuntimeCache(cache, runtimeId, assets);
  const directory = join(cache, runtimeId);
  assert.deepEqual(await Promise.all([prepare(), prepare()]), [directory, directory]);
  assert.deepEqual(await readdir(cache), [runtimeId]);
  assert.equal(await prepare(), directory);
}, 15_000);

it('rejects modified cached bytes with the original length', async (t) => {
  const cache = await cacheFixture(t);
  const directory = await prepareRuntimeCache(cache, runtimeId, assets);
  await writeFile(join(directory, key), Buffer.alloc(content.length));
  await assert.rejects(prepareRuntimeCache(cache, runtimeId, assets), invalid);
}, 15_000);

it('rejects unexpected files and hard-linked assets', async (t) => {
  const cache = await cacheFixture(t);
  const directory = await prepareRuntimeCache(cache, runtimeId, assets);
  const extra = join(directory, 'unexpected.js');
  await writeFile(extra, '');
  await assert.rejects(prepareRuntimeCache(cache, runtimeId, assets), invalid);
  await rm(extra);
  await link(join(directory, key), join(cache, 'extra-link'));
  await assert.rejects(prepareRuntimeCache(cache, runtimeId, assets), invalid);
}, 15_000);

it('rejects linked cache directories and untrusted write permissions', async (t) => {
  const cache = await cacheFixture(t);
  const real = `${cache}-real`;
  await mkdir(real);
  await symlink(real, cache, 'junction');
  await assert.rejects(prepareRuntimeCache(cache, runtimeId, assets), invalid);
  await rm(cache);
  await rename(real, cache);

  if (process.platform === 'win32') {
    execFileSync('icacls.exe', [cache, '/grant', '*S-1-1-0:(M)'], { stdio: 'ignore' });
  } else {
    await chmod(cache, 0o777);
  }
  await assert.rejects(prepareRuntimeCache(cache, runtimeId, assets), invalid);
}, 15_000);
