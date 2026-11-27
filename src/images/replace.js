import { randomUUID } from 'node:crypto';
import { link, lstat, open, rename, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';

async function checkSource(source, original) {
  const current = await lstat(source, { bigint: true });
  if (!current.isFile() || current.dev !== original.dev || current.ino !== original.ino ||
      current.size !== original.size || current.mtimeNs !== original.mtimeNs ||
      current.ctimeNs !== original.ctimeNs) {
    throw new Error('Source changed during optimization.');
  }
}

export async function replaceImage(source, target, bytes, original) {
  const temporary = join(dirname(source), `.touro-${randomUUID()}.tmp`);
  const file = await open(temporary, 'wx', 0o600);
  let temporaryExists = true;
  try {
    try {
      await file.writeFile(bytes);
      if (process.platform !== 'win32') await file.chmod(Number(original.mode & 0o777n));
      await file.sync();
    } finally {
      await file.close();
    }

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
      if (error.code === 'EEXIST') throw new Error(`Target already exists: ${target}`, { cause: error });
      throw error;
    }
    try {
      await unlink(temporary);
      temporaryExists = false;
      await checkSource(source, original);
      await unlink(source);
    } catch (error) {
      await unlink(target);
      throw error;
    }
  } finally {
    if (temporaryExists) await unlink(temporary);
  }
}
