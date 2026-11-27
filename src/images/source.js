import { lstat, readdir, realpath } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { imageFormatFor } from './formats.js';
import { IMAGE_ERROR } from './errors.js';
import { TouroError } from '../shared/errors.js';

const excludedDirectories = new Set(['node_modules', 'bower_components', 'vendor', 'build', 'dist', 'dist-exe']);

class ImageFile {
  #path;
  #knownStats;

  constructor(path, knownStats) {
    this.#path = path;
    this.#knownStats = knownStats;
  }

  async *images(root, { format }) {
    const imageFormat = imageFormatFor(this.#path);
    if (!imageFormat || (format && format !== imageFormat)) return;

    const stats = this.#knownStats ?? await lstat(this.#path);
    if (stats.isFile()) {
      yield { path: relative(root, this.#path), format: imageFormat, size: stats.size };
    }
  }
}

class ImageDirectory {
  #path;

  constructor(path) {
    this.#path = path;
  }

  async *images(root, options) {
    for (const entry of await readdir(this.#path, { withFileTypes: true })) {
      const childPath = join(this.#path, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || excludedDirectories.has(entry.name.toLowerCase())) continue;
        yield* new ImageDirectory(childPath).images(root, options);
      } else if (entry.isFile()) {
        yield* new ImageFile(childPath).images(root, options);
      }
    }
  }
}

export class ImageSource {
  #root;
  #node;

  constructor(root, node) {
    this.#root = root;
    this.#node = node;
  }

  static async open(path, { allowFile = false } = {}) {
    const input = resolve(path);
    const stats = await lstat(input);
    if (stats.isDirectory()) {
      const root = await realpath(input);
      return new ImageSource(root, new ImageDirectory(root));
    }
    if (allowFile && stats.isFile() && imageFormatFor(input)) {
      const root = await realpath(dirname(input));
      const file = new ImageFile(join(root, basename(input)), stats);
      return new ImageSource(root, file);
    }
    throw new TouroError(IMAGE_ERROR.INVALID_SOURCE, { context: { allowFile, path: input } });
  }

  get root() {
    return this.#root;
  }

  async listImages(options = {}) {
    const images = await Array.fromAsync(this.#node.images(this.#root, options));
    return images.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  }
}
