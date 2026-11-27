import { lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { configureEncoder, isAnimatedImage } from './formats.js';
import { replaceImage } from './replace.js';
import { loadSharp } from '../runtime/load-sharp.js';

export class ImageProcessor {
  #sharp;

  constructor(sharp) {
    this.#sharp = sharp;
  }

  static async create() {
    return new ImageProcessor(await loadSharp());
  }

  async optimize(root, { image, format, targetPath }, quality) {
    const source = join(root, image.path);
    const stats = await lstat(source, { bigint: true });
    if (!stats.isFile()) throw new Error('Expected a regular image file.');
    const original = await readFile(source);
    const pipeline = this.#sharp(original, { failOn: 'warning' });
    const metadata = await pipeline.metadata();
    if (metadata.format !== image.format) {
      throw new Error(`File extension indicates ${image.format}, but the image is ${metadata.format}.`);
    }
    if (isAnimatedImage(original, metadata)) {
      throw new Error('Animated images are not supported.');
    }

    pipeline.autoOrient().keepIccProfile();
    configureEncoder(format, pipeline, metadata, quality);

    const optimized = await pipeline.toBuffer();
    const converted = format !== image.format;
    const unchanged = !converted && optimized.length >= original.length;
    if (!unchanged) await replaceImage(source, join(root, targetPath), optimized, stats);

    return {
      path: image.path,
      targetPath,
      inputFormat: image.format,
      outputFormat: format,
      originalSize: original.length,
      finalSize: unchanged ? original.length : optimized.length,
      status: converted ? 'converted' : unchanged ? 'unchanged' : 'optimized',
    };
  }
}
