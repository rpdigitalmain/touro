import { constants } from 'node:fs';
import { link, lstat, mkdtemp, open, realpath, rename, rm, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { PLATFORM } from '../constants/application.js';
import { rethrowAfterCleanup, TouroError } from '../errors/errors.js';
import { IMAGE_ERROR, targetExistsError } from './errors.js';
import { checkSource, sameFile } from './file-state.js';

async function checkSourcePath(source, original) {
  if (await realpath(dirname(source)) !== dirname(source)) {
    throw new TouroError(IMAGE_ERROR.SOURCE_CHANGED, { context: { source } });
  }
  checkSource(source, original, await lstat(source, { bigint: true }));
}

export async function replaceImage(source, target, original, encode) {
  await checkSourcePath(source, original);
  const staging = await mkdtemp(join(dirname(source), '.touro-'));
  const temporary = join(staging, 'output');
  const staged = await lstat(staging, { bigint: true });
  const cleanup = async () => {
    if (await realpath(staging) !== staging || !sameFile(await lstat(staging, { bigint: true }), staged)) {
      throw new TouroError(IMAGE_ERROR.SOURCE_CHANGED, { context: { source: staging } });
    }
    await rm(staging, { recursive: true, force: true });
  };
  let finalSize;
  try {
    await encode(temporary);
    const output = await lstat(temporary, { bigint: true });
    if (!output.isFile()) throw new TouroError(IMAGE_ERROR.NOT_REGULAR, { context: { source: temporary } });
    const converted = source !== target;
    const unchanged = !converted && output.size >= original.size;
    if (!unchanged) await publishImage(source, target, original, temporary, output);
    finalSize = unchanged ? null : Number(output.size);
  } catch (cause) {
    await rethrowAfterCleanup(cause, cleanup);
  }
  await cleanup();
  return finalSize;
}

async function publishImage(source, target, original, temporary, output) {
  const flags = constants.O_RDWR | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0);
  const file = await open(temporary, flags);
  try {
    checkSource(temporary, output, await file.stat({ bigint: true }));
    if (process.platform !== PLATFORM.WINDOWS) await file.chmod(Number(original.mode & 0o777n));
    await file.sync();
  } catch (cause) {
    await rethrowAfterCleanup(cause, () => file.close());
  }
  await file.close();
  await checkSourcePath(source, original);
  if (source === target) {
    await rename(temporary, source);
    return;
  }

  // Publish the complete conversion atomically without replacing an existing path.
  try {
    await link(temporary, target);
  } catch (error) {
    if (error.code === 'EEXIST') throw targetExistsError(target, error);
    throw error;
  }
  try {
    await checkSourcePath(source, original);
    await unlink(source);
  } catch (cause) {
    await rethrowAfterCleanup(cause, async () => {
      if (await realpath(dirname(target)) !== dirname(target)) return;
      const current = await lstat(target, { bigint: true }).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
      if (current && sameFile(current, output)) await unlink(target);
    });
  }
}
