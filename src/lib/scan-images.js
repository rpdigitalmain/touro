import { lstat, readdir } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';

const formatsByExtension = new Map([
  ['.jpg', 'jpeg'],
  ['.jpeg', 'jpeg'],
  ['.png', 'png'],
  ['.webp', 'webp'],
]);

export const imageFormats = [...new Set(formatsByExtension.values())];

export function imageFormatFor(path) {
  return formatsByExtension.get(extname(path).toLowerCase());
}

export async function scanImages(path, format, excludedDirectory) {
  const root = resolve(path);
  if (!(await lstat(root)).isDirectory()) {
    throw new Error('Expected a directory.');
  }

  const images = [];
  const directories = [root];
  while (directories.length > 0) {
    const directory = directories.pop();
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const entryPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!excludedDirectory || relative(excludedDirectory, entryPath) !== '') {
          directories.push(entryPath);
        }
        continue;
      }

      const imageFormat = imageFormatFor(entry.name);
      if (!entry.isFile() || !imageFormat || (format && format !== imageFormat)) continue;

      const stats = await lstat(entryPath);
      if (stats.isFile()) {
        images.push({ path: relative(root, entryPath), format: imageFormat, size: stats.size });
      }
    }
  }

  return images.sort((a, b) => a.path.localeCompare(b.path, 'en'));
}
