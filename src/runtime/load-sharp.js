import { lstatSync } from 'node:fs';
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import * as sea from 'node:sea';
import { appPaths } from './paths.js';
import { INFRASTRUCTURE_ERROR, rethrowAfterCleanup, TouroError } from '../errors/errors.js';

export async function loadSharp() {
  if (!sea.isSea()) return (await import('sharp')).default;

  // Native modules must be on disk before Node can load them.
  const cache = join(appPaths('touro').cache, 'standalone');
  const directory = join(cache, __NATIVE_RUNTIME_ID__);
  await mkdir(cache, { recursive: true, mode: 0o700 });
  const existing = lstatSync(directory, { throwIfNoEntry: false });
  if (!existing) {
    const staging = await mkdtemp(join(cache, 'runtime-'));
    const cleanup = () => rm(staging, { recursive: true, force: true });
    try {
      for (const key of sea.getAssetKeys()) {
        const path = join(staging, key);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, new Uint8Array(sea.getRawAsset(key)));
      }
      try {
        await rename(staging, directory);
      } catch (error) {
        if (!lstatSync(directory, { throwIfNoEntry: false })?.isDirectory()) throw error;
      }
    } catch (cause) {
      await rethrowAfterCleanup(cause, cleanup);
    }
    await cleanup();
  } else if (!existing.isDirectory()) {
    throw new TouroError(INFRASTRUCTURE_ERROR.RUNTIME_CACHE_INVALID, { context: { directory } });
  }
  // SEA's ESM loader cannot import packages from the extracted cache.
  return createRequire(join(directory, 'runtime.js'))('sharp');
}
