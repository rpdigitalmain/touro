import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { configureEncoder, isAnimatedImage } from './image-formats.js';
import { writeImageOutput } from './image-output.js';
import { loadSharp } from './load-sharp.js';

export class ImageProcessor {
  #sharp;

  constructor(sharp) {
    this.#sharp = sharp;
  }

  static async create() {
    return new ImageProcessor(await loadSharp());
  }

  async optimize(root, output, { image, format, targetPath }, quality) {
    const original = await readFile(join(root, image.path));
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
    const bytes = unchanged ? original : optimized;
    await writeImageOutput(output, targetPath, bytes);

    return {
      path: image.path,
      inputFormat: image.format,
      outputFormat: format,
      originalSize: original.length,
      finalSize: bytes.length,
      status: converted ? 'converted' : unchanged ? 'unchanged' : 'optimized',
    };
  }
}
