import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { internal } from '../config/configuration.js';
import { IMAGE_FORMAT } from '../constants/images.js';
import { INFRASTRUCTURE_ERROR, TouroError } from '../errors/errors.js';
import { IMAGE_ERROR } from './errors.js';
import { checkSource } from './file-state.js';

const pngSignature = Buffer.from('89504e470d0a1a0a', 'hex');

function signatureFormat(header, length) {
  if (length >= 2 && header.readUInt16BE(0) === 0xffd8) return IMAGE_FORMAT.JPEG;
  if (length >= 8 && header.subarray(0, 8).equals(pngSignature)) return IMAGE_FORMAT.PNG;
  if (length >= 12 && header.toString('latin1', 0, 4) === 'RIFF' && header.toString('latin1', 8, 12) === 'WEBP') {
    return IMAGE_FORMAT.WEBP;
  }
  return undefined;
}

export async function validateImageHeader(source, original, expected) {
  const flags = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0);
  const file = await open(source, flags);
  try {
    checkSource(source, original, await file.stat({ bigint: true }));
    const header = Buffer.alloc(12);
    const { bytesRead } = await file.read(header, 0, header.length, 0);
    const actual = signatureFormat(header, bytesRead);
    if (!actual) {
      throw new TouroError(INFRASTRUCTURE_ERROR.DECODE_FAILED, {
        cause: new Error('Unrecognized JPEG, PNG, or WebP file signature.'),
        context: { source },
      });
    }
    if (actual !== expected) {
      throw new TouroError(IMAGE_ERROR.FORMAT_MISMATCH, { context: { source, expected, actual } });
    }
    if (actual === IMAGE_FORMAT.PNG) await checkPngChunks(file, source, Number(original.size), header);
  } finally {
    await file.close();
  }
}

async function checkPngChunks(file, source, size, header) {
  // APNG signals animation with an acTL chunk before the first image data chunk.
  let offset = pngSignature.length;
  for (let count = 0; offset + 12 <= size; count++) {
    if (count === internal.optimize.maxPngHeaderChunks) {
      throw new TouroError(IMAGE_ERROR.INPUT_LIMIT, { context: { source, limit: 'PNG header chunks' } });
    }
    const { bytesRead } = await file.read(header, 0, 8, offset);
    if (bytesRead < 8) return;
    const type = header.toString('latin1', 4, 8);
    if (type === 'acTL') throw new TouroError(IMAGE_ERROR.ANIMATED, { context: { source } });
    if (type === 'IDAT' || type === 'IEND') return;
    offset += header.readUInt32BE(0) + 12;
  }
}
