import { lstat, readdir, realpath } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { imageFormatFor } from './formats.js';
import { IMAGE_ERROR } from './errors.js';
import { TouroError } from '../errors/errors.js';
import { defaults } from '../config/configuration.js';

class ImageFile {
  #path;
  constructor(path) {
    this.#path = path;
  }

  async *images(root, { format, includeSize = true }) {
    const imageFormat = imageFormatFor(this.#path);
    if (!imageFormat || (format && format !== imageFormat)) return;

    const image = { path: relative(root, this.#path), format: imageFormat };
    if (!includeSize) {
      yield image;
      return;
    }

    const stats = await lstat(this.#path);
    if (stats.isFile()) yield { ...image, size: stats.size };
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
        if (!options.recursive || entry.name.startsWith('.') || options.excludedDirectories.has(entry.name.toLowerCase())) continue;
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

  static async open(path) {
    const input = resolve(path);
    const stats = await lstat(input);
    if (stats.isDirectory()) {
      const root = await realpath(input);
      return new ImageSource(root, new ImageDirectory(root));
    }
    throw new TouroError(IMAGE_ERROR.INVALID_SOURCE, { context: { path: input } });
  }

  get root() {
    return this.#root;
  }

  async listImages({
    excludedDirectories = defaults.discovery.excludedDirectories,
    recursive = defaults.discovery.recursive,
    ...options
  } = {}) {
    const excluded = new Set(excludedDirectories.map((name) => name.toLowerCase()));
    const images = await Array.fromAsync(this.#node.images(this.#root, { ...options, recursive, excludedDirectories: excluded }));
    return images.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  }
}
