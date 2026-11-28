import { lstat, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { configureEncoder } from './formats.js';
import { validateImageHeader } from './header.js';
import { replaceImage } from './replace.js';
import { loadSharp } from '../runtime/load-sharp.js';
import { IMAGE_STATUS } from '../constants/images.js';
import { INFRASTRUCTURE_ERROR, TouroError } from '../errors/errors.js';
import { IMAGE_ERROR } from './errors.js';
import { defaults, internal } from '../config/configuration.js';

export class ImageProcessor {
  #sharp;
  #encoding;

  constructor(sharp, encoding = defaults.encoding) {
    this.#sharp = sharp;
    this.#encoding = encoding;
  }

  static async create(encoding) {
    let sharp;
    try {
      sharp = await loadSharp();
      sharp.concurrency(Math.min(sharp.concurrency(), internal.optimize.threads));
      // Cached libvips operations can retain open input files and block replacement on Windows.
      sharp.cache(false);
    } catch (cause) {
      throw new TouroError(INFRASTRUCTURE_ERROR.RUNTIME_LOAD_FAILED, { cause });
    }
    return new ImageProcessor(sharp, encoding);
  }

  async optimize(root, { image, format, targetPath }, quality) {
    const source = join(root, image.path);
    const stats = await lstat(source, { bigint: true });
    if (!stats.isFile()) throw new TouroError(IMAGE_ERROR.NOT_REGULAR, { context: { source } });
    if (await realpath(source) !== source) throw new TouroError(IMAGE_ERROR.SOURCE_CHANGED, { context: { source } });
    if (stats.size > BigInt(internal.optimize.maxFileBytes)) {
      throw new TouroError(IMAGE_ERROR.INPUT_LIMIT, { context: { source, limit: 'file size (256 MiB)' } });
    }

    await validateImageHeader(source, stats, image.format);
    const pipeline = this.#sharp(source, internal.encoding.input);
    let metadata;
    try {
      metadata = await pipeline.metadata();
    } catch (cause) {
      if (cause?.message === 'Input image exceeds pixel limit') {
        throw new TouroError(IMAGE_ERROR.INPUT_LIMIT, {
          cause, context: { source, limit: 'image dimensions (67,108,864 pixels)' },
        });
      }
      throw new TouroError(INFRASTRUCTURE_ERROR.DECODE_FAILED, { cause, context: { source } });
    }
    if (metadata.format !== image.format) {
      throw new TouroError(IMAGE_ERROR.FORMAT_MISMATCH, {
        context: { source, expected: image.format, actual: metadata.format },
      });
    }
    if (metadata.pages > 1) {
      throw new TouroError(IMAGE_ERROR.ANIMATED, { context: { source } });
    }

    const converted = format !== image.format;
    const finalSize = await replaceImage(source, join(root, targetPath), stats, async (temporary) => {
      try {
        pipeline.autoOrient().timeout({ seconds: internal.optimize.timeoutSeconds });
        if (internal.optimize.keepIccProfile) pipeline.keepIccProfile();
        configureEncoder(format, pipeline, metadata, quality, this.#encoding);
        await pipeline.toFile(temporary);
      } catch (cause) {
        throw new TouroError(INFRASTRUCTURE_ERROR.ENCODE_FAILED, { cause, context: { source, format } });
      }
    });
    const originalSize = Number(stats.size);

    return {
      path: image.path,
      targetPath,
      inputFormat: image.format,
      outputFormat: format,
      originalSize,
      finalSize: finalSize ?? originalSize,
      status: converted ? IMAGE_STATUS.CONVERTED : finalSize === null ? IMAGE_STATUS.UNCHANGED : IMAGE_STATUS.OPTIMIZED,
    };
  }
}
