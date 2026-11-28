import { extname } from 'node:path';
import { IMAGE_EXTENSIONS, IMAGE_FORMAT } from '../constants/images.js';
import { defaults, internal } from '../config/configuration.js';

function isAnimatedPng(bytes) {
  // APNG signals animation with an acTL chunk before the first image data chunk.
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (type === 'acTL') return true;
    if (type === 'IDAT') break;
    offset += bytes.readUInt32BE(offset) + 12;
  }
  return false;
}

const formats = {
  [IMAGE_FORMAT.JPEG]: {
    encode(pipeline, metadata, quality, { jpeg }) {
      if (metadata.hasAlpha) pipeline.flatten({ background: jpeg.background });
      pipeline.jpeg({ quality, mozjpeg: internal.encoding.jpeg.mozjpeg });
    },
  },
  [IMAGE_FORMAT.PNG]: {
    isAnimated: isAnimatedPng,
    encode(pipeline, metadata, _quality, { png }) {
      if (metadata.bitsPerSample === 16) pipeline.toColourspace('rgb16');
      pipeline.png({ compressionLevel: png.compressionLevel, adaptiveFiltering: internal.encoding.png.adaptiveFiltering });
    },
  },
  [IMAGE_FORMAT.WEBP]: {
    encode(pipeline, _metadata, quality) {
      pipeline.webp({ quality });
    },
  },
};

const formatsByExtension = new Map(Object.entries(IMAGE_EXTENSIONS).flatMap(([name, extensions]) =>
  extensions.map((extension) => [extension, name]),
));

export { IMAGE_FORMATS as imageFormats } from '../constants/images.js';

export function imageFormatFor(path) {
  return formatsByExtension.get(extname(path).toLowerCase());
}

export function outputPathFor(image, format) {
  if (format === image.format) return image.path;
  const [preferredExtension] = IMAGE_EXTENSIONS[format];
  return image.path.slice(0, -extname(image.path).length) + preferredExtension;
}

export function isAnimatedImage(bytes, metadata) {
  return metadata.pages > 1 || (formats[metadata.format].isAnimated?.(bytes) ?? false);
}

export function configureEncoder(format, pipeline, metadata, quality, encoding = defaults.encoding) {
  formats[format].encode(pipeline, metadata, quality, encoding);
}
