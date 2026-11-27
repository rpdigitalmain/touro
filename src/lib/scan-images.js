import { lstat, readdir, realpath } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { imageFormatFor } from './image-formats.js';

function imageFile(path, knownStats) {
  return {
    async *images(root, { format }) {
      const imageFormat = imageFormatFor(path);
      if (!imageFormat || (format && format !== imageFormat)) return;

      const stats = knownStats ?? await lstat(path);
      if (stats.isFile()) {
        yield { path: relative(root, path), format: imageFormat, size: stats.size };
      }
    },
  };
}

function imageDirectory(path) {
  return {
    async *images(root, options) {
      if (options.excludedDirectory && relative(options.excludedDirectory, path) === '') return;

      for (const entry of await readdir(path, { withFileTypes: true })) {
        const childPath = join(path, entry.name);
        if (entry.isDirectory()) {
          yield* imageDirectory(childPath).images(root, options);
        } else if (entry.isFile()) {
          yield* imageFile(childPath).images(root, options);
        }
      }
    },
  };
}

export async function openImageSource(path, { allowFile = false } = {}) {
  const input = resolve(path);
  const stats = await lstat(input);
  const directory = stats.isDirectory();
  if (!directory && !(allowFile && stats.isFile() && imageFormatFor(input))) {
    throw new Error(allowFile ? 'Expected a directory or a JPEG, PNG, or WebP file.' : 'Expected a directory.');
  }

  const root = await realpath(directory ? input : dirname(input));
  const source = directory ? imageDirectory(root) : imageFile(join(root, basename(input)), stats);
  return {
    root,
    async listImages(options = {}) {
      const images = await Array.fromAsync(source.images(root, options));
      return images.sort((a, b) => a.path.localeCompare(b.path, 'en'));
    },
  };
}
