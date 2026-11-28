import { createRequire } from 'node:module';
import { join } from 'node:path';
import * as sea from 'node:sea';
import { appPaths } from './paths.js';
import { prepareRuntimeCache } from './runtime-cache.js';

export async function loadSharp() {
  if (!sea.isSea()) return (await import('sharp')).default;

  const directory = await prepareRuntimeCache(join(appPaths('touro').cache, 'standalone'), __NATIVE_RUNTIME_ID__, {
    keys: sea.getAssetKeys(),
    read: (key) => new Uint8Array(sea.getRawAsset(key)),
  });
  // SEA's ESM loader cannot import packages from the extracted cache.
  return createRequire(join(directory, 'runtime.js'))(join(directory, 'node_modules', 'sharp'));
}
