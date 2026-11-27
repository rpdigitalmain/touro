import { lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { outputPathFor } from './formats.js';
import { ImageSource } from './source.js';
import { DEFAULT_SOURCE, PLATFORM } from '../constants/application.js';
import { IMAGE_STATUS, OPTIMIZATION_QUALITY } from '../constants/images.js';
import { TouroError } from '../errors/errors.js';
import { IMAGE_ERROR, targetExistsError } from './errors.js';

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

  async run(path = DEFAULT_SOURCE, { format, quality = OPTIMIZATION_QUALITY.DEFAULT } = {}) {
    const source = await ImageSource.open(path, { allowFile: true });
    const { root } = source;
    const images = await source.listImages();
    const destinations = new Map();
    for (const image of images) {
      const outputFormat = format ?? image.format;
      const targetPath = outputPathFor(image, outputFormat);
      // Windows destinations are generally case-insensitive.
      const key = process.platform === PLATFORM.WINDOWS ? targetPath.toLowerCase() : targetPath;
      if (!destinations.has(key)) destinations.set(key, []);
      destinations.get(key).push({ image, format: outputFormat, targetPath });
    }

    const results = [];
    const failures = [];
    const summary = {
      [IMAGE_STATUS.CONVERTED]: 0,
      [IMAGE_STATUS.OPTIMIZED]: 0,
      [IMAGE_STATUS.UNCHANGED]: 0,
      originalSize: 0,
      finalSize: 0,
    };
    const ready = [];
    for (const group of destinations.values()) {
      for (const job of group) {
        try {
          const target = join(root, job.targetPath);
          if (group.length > 1) {
            throw new TouroError(IMAGE_ERROR.TARGET_CONFLICT, { context: { target } });
          }
          if (job.format !== job.image.format && await targetExists(target)) {
            throw targetExistsError(target);
          }
          ready.push(job);
        } catch (error) {
          failures.push({ path: job.image.path, error });
        }
      }
    }

    if (ready.length > 0) {
      const processor = await this.#createProcessor();
      for (const job of ready) {
        let result;
        try {
          result = await processor.optimize(root, job, quality);
        } catch (error) {
          failures.push({ path: job.image.path, error });
          continue;
        }
        results.push(result);
        summary[result.status] += 1;
        summary.originalSize += result.originalSize;
        summary.finalSize += result.finalSize;
      }
    }

    return { results, failures, summary };
  }
}
