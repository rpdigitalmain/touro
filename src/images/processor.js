import { lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { configureEncoder, isAnimatedImage } from './formats.js';
import { replaceImage } from './replace.js';
import { loadSharp } from '../runtime/load-sharp.js';
import { IMAGE_STATUS } from '../shared/constants/images.js';
import { INFRASTRUCTURE_ERROR, TouroError } from '../shared/errors.js';
import { IMAGE_ERROR } from './errors.js';

export class ImageProcessor {
  #sharp;

  constructor(sharp) {
    this.#sharp = sharp;
  }

  static async create() {
    let sharp;
    try {
      sharp = await loadSharp();
    } catch (cause) {
      throw new TouroError(INFRASTRUCTURE_ERROR.RUNTIME_LOAD_FAILED, { cause });
    }
    return new ImageProcessor(sharp);
  }

  async optimize(root, { image, format, targetPath }, quality) {
    const source = join(root, image.path);
    const stats = await lstat(source, { bigint: true });
    if (!stats.isFile()) throw new TouroError(IMAGE_ERROR.NOT_REGULAR, { context: { source } });
    const original = await readFile(source);
    let pipeline;
    let metadata;
    try {
      pipeline = this.#sharp(original, { failOn: 'warning' });
      metadata = await pipeline.metadata();
    } catch (cause) {
      throw new TouroError(INFRASTRUCTURE_ERROR.DECODE_FAILED, { cause, context: { source } });
    }
    if (metadata.format !== image.format) {
      throw new TouroError(IMAGE_ERROR.FORMAT_MISMATCH, {
        context: { source, expected: image.format, actual: metadata.format },
      });
    }
    if (isAnimatedImage(original, metadata)) {
      throw new TouroError(IMAGE_ERROR.ANIMATED, { context: { source } });
    }

    let optimized;
    try {
      pipeline.autoOrient().keepIccProfile();
      configureEncoder(format, pipeline, metadata, quality);
      optimized = await pipeline.toBuffer();
    } catch (cause) {
      throw new TouroError(INFRASTRUCTURE_ERROR.ENCODE_FAILED, { cause, context: { source, format } });
    }
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
      status: converted ? IMAGE_STATUS.CONVERTED : unchanged ? IMAGE_STATUS.UNCHANGED : IMAGE_STATUS.OPTIMIZED,
    };
  }
}
