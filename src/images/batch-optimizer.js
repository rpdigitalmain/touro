import { lstat, mkdir, realpath } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { outputPathFor } from './formats.js';
import { ImageSource } from './source.js';

async function existingStats(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function checkOutput(root, output) {
  const stats = await existingStats(output);
  if (stats) {
    if (!stats.isDirectory()) throw new Error('Output must be a real directory.');
    output = await realpath(output);
  }
  if (relative(root, output) === '') {
    throw new Error('Choose an output directory separate from the input directory.');
  }
  return output;
}

export class BatchOptimizer {
  #createProcessor;

  constructor(createProcessor) {
    this.#createProcessor = createProcessor;
  }

  async run(path, { output: destination, format, quality = 80 } = {}) {
    const source = await ImageSource.open(path, { allowFile: true });
    const { root } = source;
    let output = await checkOutput(root, destination === undefined ? join(root, 'touro-output') : resolve(destination));
    const images = await source.listImages({ excludedDirectory: output });
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
          const target = join(output, job.targetPath);
          if (group.length > 1) throw new Error(`Multiple inputs map to the same output: ${target}`);
          if (await existingStats(target)) throw new Error(`Output already exists: ${target}`);
          ready.push(job);
        } catch (error) {
          failures.push({ path: job.image.path, message: error.message });
        }
      }
    }

    if (ready.length > 0) {
      const processor = await this.#createProcessor();
      await mkdir(output, { recursive: true });
      output = await checkOutput(root, output);
      for (const job of ready) {
        try {
          const result = await processor.optimize(root, output, job, quality);
          results.push(result);
          summary[result.status] += 1;
          summary.originalSize += result.originalSize;
          summary.finalSize += result.finalSize;
        } catch (error) {
          failures.push({ path: job.image.path, message: error.message });
        }
      }
    }

    return { output, results, failures, summary };
  }
}
