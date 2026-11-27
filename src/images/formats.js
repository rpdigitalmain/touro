import { extname } from 'node:path';

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
  jpeg: {
    extensions: ['.jpg', '.jpeg'],
    encode(pipeline, metadata, quality) {
      if (metadata.hasAlpha) pipeline.flatten({ background: '#ffffff' });
      pipeline.jpeg({ quality, mozjpeg: true });
    },
  },
  png: {
    extensions: ['.png'],
    isAnimated: isAnimatedPng,
    encode(pipeline, metadata) {
      if (metadata.bitsPerSample === 16) pipeline.toColourspace('rgb16');
      pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
    },
  },
  webp: {
    extensions: ['.webp'],
    encode(pipeline, _metadata, quality) {
      pipeline.webp({ quality });
    },
  },
};

const formatsByExtension = new Map(Object.entries(formats).flatMap(([name, { extensions }]) =>
  extensions.map((extension) => [extension, name]),
));

export const imageFormats = Object.keys(formats);

export function imageFormatFor(path) {
  return formatsByExtension.get(extname(path).toLowerCase());
}

export function outputPathFor(image, format) {
  if (format === image.format) return image.path;
  const [preferredExtension] = formats[format].extensions;
  return image.path.slice(0, -extname(image.path).length) + preferredExtension;
}

export function isAnimatedImage(bytes, metadata) {
  return metadata.pages > 1 || (formats[metadata.format].isAnimated?.(bytes) ?? false);
}

export function configureEncoder(format, pipeline, metadata, quality) {
  formats[format].encode(pipeline, metadata, quality);
}
