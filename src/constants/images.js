export const IMAGE_FORMAT = Object.freeze({
  JPEG: 'jpeg',
  PNG: 'png',
  WEBP: 'webp',
});

export const IMAGE_EXTENSIONS = Object.freeze({
  [IMAGE_FORMAT.JPEG]: Object.freeze(['.jpg', '.jpeg']),
  [IMAGE_FORMAT.PNG]: Object.freeze(['.png']),
  [IMAGE_FORMAT.WEBP]: Object.freeze(['.webp']),
});

export const IMAGE_FORMATS = Object.freeze(Object.keys(IMAGE_EXTENSIONS));

export const OPTIMIZATION_QUALITY = Object.freeze({
  MIN: 1,
  MAX: 100,
  DEFAULT: 80,
});

export const IMAGE_STATUS = Object.freeze({
  CONVERTED: 'converted',
  OPTIMIZED: 'optimized',
  UNCHANGED: 'unchanged',
});
