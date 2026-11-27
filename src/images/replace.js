import { randomUUID } from 'node:crypto';
import { link, lstat, open, rename, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { PLATFORM } from '../constants/application.js';
import { rethrowAfterCleanup, TouroError } from '../errors/errors.js';
import { IMAGE_ERROR, targetExistsError } from './errors.js';

async function checkSource(source, original) {
  const current = await lstat(source, { bigint: true });
  if (!current.isFile() || current.dev !== original.dev || current.ino !== original.ino ||
      current.size !== original.size || current.mtimeNs !== original.mtimeNs ||
      current.ctimeNs !== original.ctimeNs) {
    throw new TouroError(IMAGE_ERROR.SOURCE_CHANGED, { context: { source } });
  }
}

export async function replaceImage(source, target, bytes, original) {
  const temporary = join(dirname(source), `.touro-${randomUUID()}.tmp`);
  const file = await open(temporary, 'wx', 0o600);
  let temporaryExists = true;
  try {
    try {
      await file.writeFile(bytes);
      if (process.platform !== PLATFORM.WINDOWS) await file.chmod(Number(original.mode & 0o777n));
      await file.sync();
    } catch (cause) {
      await rethrowAfterCleanup(cause, () => file.close());
    }
    await file.close();

    await checkSource(source, original);
    if (source === target) {
      await rename(temporary, source);
      temporaryExists = false;
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
      await unlink(temporary);
      temporaryExists = false;
      await checkSource(source, original);
      await unlink(source);
    } catch (cause) {
      await rethrowAfterCleanup(cause, () => unlink(target));
    }
  } catch (cause) {
    if (temporaryExists) await rethrowAfterCleanup(cause, () => unlink(temporary));
    throw cause;
  }
}
