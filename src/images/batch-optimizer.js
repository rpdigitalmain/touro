import { lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { outputPathFor } from './formats.js';
import { ImageSource } from './source.js';

async function targetExists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

export class BatchOptimizer {
  #createProcessor;

  constructor(createProcessor) {
    this.#createProcessor = createProcessor;
  }

  async run(path = '.', { format, quality = 80 } = {}) {
    const source = await ImageSource.open(path, { allowFile: true });
    const { root } = source;
    const images = await source.listImages();
    const destinations = new Map();
    for (const image of images) {
      const outputFormat = format ?? image.format;
      const targetPath = outputPathFor(image, outputFormat);
      // Windows destinations are generally case-insensitive.
      const key = process.platform === 'win32' ? targetPath.toLowerCase() : targetPath;
      if (!destinations.has(key)) destinations.set(key, []);
      destinations.get(key).push({ image, format: outputFormat, targetPath });
    }

    const results = [];
    const failures = [];
    const summary = { converted: 0, optimized: 0, unchanged: 0, originalSize: 0, finalSize: 0 };
    const ready = [];
    for (const group of destinations.values()) {
      for (const job of group) {
        try {
          const target = join(root, job.targetPath);
          if (group.length > 1) throw new Error(`Multiple inputs map to the same target: ${target}`);
          if (job.format !== job.image.format && await targetExists(target)) {
            throw new Error(`Target already exists: ${target}`);
          }
          ready.push(job);
        } catch (error) {
          failures.push({ path: job.image.path, message: error.message });
        }
      }
    }

    if (ready.length > 0) {
      const processor = await this.#createProcessor();
      for (const job of ready) {
        try {
          const result = await processor.optimize(root, job, quality);
          results.push(result);
          summary[result.status] += 1;
          summary.originalSize += result.originalSize;
          summary.finalSize += result.finalSize;
        } catch (error) {
          failures.push({ path: job.image.path, message: error.message });
        }
      }
    }

    return { results, failures, summary };
  }
}
