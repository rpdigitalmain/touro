import { lstat, mkdir, open, unlink } from 'node:fs/promises';
import { dirname, join, sep } from 'node:path';

async function ensureSubdirectories(output, path) {
  const folder = dirname(path);
  if (folder === '.') return;

  let current = output;
  for (const component of folder.split(sep)) {
    current = join(current, component);
    try {
      await mkdir(current);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (!(await lstat(current)).isDirectory()) {
        throw new Error(`Output path is not a real directory: ${current}`, { cause: error });
      }
    }
  }
}

async function writeNewFile(path, bytes) {
  let file;
  try {
    file = await open(path, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`Output already exists: ${path}`, { cause: error });
    throw error;
  }

  try {
    try {
      await file.writeFile(bytes);
    } finally {
      await file.close();
    }
  } catch (error) {
    await unlink(path);
    throw error;
  }
}

export async function writeImageOutput(output, targetPath, bytes) {
  await ensureSubdirectories(output, targetPath);
  await writeNewFile(join(output, targetPath), bytes);
}
