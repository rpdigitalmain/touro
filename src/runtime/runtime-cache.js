import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, mkdir, mkdtemp, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, posix, resolve } from 'node:path';
import { PLATFORM } from '../constants/application.js';
import { INFRASTRUCTURE_ERROR, rethrowAfterCleanup, TouroError } from '../errors/errors.js';
import { verifyWindowsCacheAccess } from './windows-cache-access.js';

const windows = process.platform === PLATFORM.WINDOWS;

function invalidCache(path, reason, cause) {
  return new TouroError(INFRASTRUCTURE_ERROR.RUNTIME_CACHE_INVALID, { cause, context: { directory: path, reason } });
}

async function cacheStats(path, optional = false) {
  try {
    return await lstat(path);
  } catch (error) {
    if (optional && error.code === 'ENOENT') return undefined;
    throw error;
  }
}

function verifyMode(path, stats, ancestor) {
  if (windows) return;
  const uid = process.geteuid();
  const trustedOwner = stats.uid === uid || (ancestor && stats.uid === 0);
  // Sticky directories such as /tmp prevent other users from replacing a child they do not own.
  const stickyAncestor = ancestor && Boolean(stats.mode & 0o1000);
  if (!trustedOwner || ((stats.mode & 0o022) && !stickyAncestor)) {
    throw invalidCache(path, 'unexpected owner or write permissions');
  }
}

function verifyDirectory(path, stats, ancestor) {
  if (!stats.isDirectory() || stats.isSymbolicLink()) throw invalidCache(path, 'expected a real directory');
  verifyMode(path, stats, ancestor);
}

async function cacheAncestors(cache) {
  const ancestors = [];
  for (let path = cache; ; path = dirname(path)) {
    ancestors.unshift(path);
    if (path === dirname(path)) break;
  }
  const existing = [];
  for (const path of ancestors) {
    const stats = await cacheStats(path, true);
    if (!stats) break;
    verifyDirectory(path, stats, path !== cache);
    existing.push(path);
  }
  return { ancestors, existing };
}

async function verifyWindows(ancestors, cache, runtime) {
  if (!windows) return;
  try {
    await verifyWindowsCacheAccess(ancestors, cache, runtime);
  } catch (cause) {
    throw invalidCache(runtime ?? ancestors.at(-1), 'could not verify Windows ownership and write permissions', cause);
  }
}

async function verifyRuntime(directory, runtimeId, keys, assets, verifyAccess) {
  const files = new Set(keys);
  const directories = new Set(['.']);
  for (const key of keys) {
    for (let parent = posix.dirname(key); parent !== '.'; parent = posix.dirname(parent)) directories.add(parent);
  }

  async function visit(key) {
    const path = join(directory, key);
    const stats = await cacheStats(path);
    verifyMode(path, stats, false);
    if (directories.delete(key) && stats.isDirectory() && !stats.isSymbolicLink()) {
      for (const name of await readdir(path)) await visit(key === '.' ? name : `${key}/${name}`);
    } else if (!files.delete(key) || !stats.isFile() || stats.isSymbolicLink() || stats.nlink !== 1) {
      throw invalidCache(path, 'unexpected entry, link, or file type');
    } else if (stats.size !== assets.read(key).byteLength) {
      throw invalidCache(path, 'unexpected runtime asset size');
    }
  }

  await visit('.');
  if (directories.size || files.size) throw invalidCache(directory, 'missing runtime assets');
  await verifyAccess();

  const runtimeHash = createHash('sha256');
  for (const key of keys) {
    const hash = createHash('sha256');
    for await (const block of createReadStream(join(directory, key))) hash.update(block);
    runtimeHash.update(key).update('\0').update(hash.digest());
  }
  if (runtimeHash.digest('hex') !== runtimeId) throw invalidCache(directory, 'runtime assets failed the integrity check');
}

export async function prepareRuntimeCache(base, runtimeId, assets) {
  const cache = resolve(base);
  const directory = join(cache, runtimeId);
  const keys = [...assets.keys].sort();
  const { ancestors, existing } = await cacheAncestors(cache);
  if (!await cacheStats(directory, true)) {
    // A missing cache is safe to create only below an existing writable boundary
    // controlled by the current account or a privileged system identity.
    await verifyWindows(existing, existing.at(-1));
    for (const path of ancestors.slice(existing.length)) {
      try {
        await mkdir(path, { mode: 0o700 });
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
      }
      verifyDirectory(path, await cacheStats(path), path !== cache);
    }
    const staging = await mkdtemp(join(cache, 'runtime-'));
    const cleanup = () => rm(staging, { recursive: true, force: true });
    try {
      for (const key of keys) {
        const path = join(staging, key);
        await mkdir(dirname(path), { recursive: true, mode: 0o700 });
        await writeFile(path, assets.read(key), { flag: 'wx', mode: 0o600 });
      }
      try {
        await rename(staging, directory);
      } catch (error) {
        if (!['EEXIST', 'ENOTEMPTY', 'EPERM', 'EACCES'].includes(error.code) ||
            !(await cacheStats(directory, true))?.isDirectory()) throw error;
      }
    } catch (cause) {
      await rethrowAfterCleanup(cause, cleanup);
    }
    await cleanup();
  }
  await verifyRuntime(directory, runtimeId, keys, assets, () => verifyWindows(ancestors, cache, directory));
  return directory;
}
