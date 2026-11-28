export const CONFIGURATION_FILENAME = 'touro.config.js';

export const defaults = Object.freeze({
  scan: Object.freeze({ directory: '.', format: undefined }),
  optimize: Object.freeze({ directory: '.', format: undefined, quality: 80 }),
  output: Object.freeze({ verbose: false, json: false }),
  discovery: Object.freeze({
    recursive: true,
    excludedDirectories: Object.freeze(['node_modules', 'bower_components', 'vendor', 'build', 'dist', 'dist-exe']),
  }),
  encoding: Object.freeze({
    jpeg: Object.freeze({ background: '#ffffff' }),
    png: Object.freeze({ compressionLevel: 9 }),
  }),
});

export const qualityRange = Object.freeze({ min: 1, max: 100 });

export function isQuality(value) {
  return Number.isInteger(value) && value >= qualityRange.min && value <= qualityRange.max;
}

export const internal = Object.freeze({
  optimize: Object.freeze({
    keepIccProfile: true,
    maxFileBytes: 256 * 1024 ** 2,
    maxPngHeaderChunks: 4096,
    timeoutSeconds: 120,
    threads: 2,
  }),
  encoding: Object.freeze({
    input: Object.freeze({ failOn: 'warning', limitInputPixels: 64 * 1024 ** 2 }),
    jpeg: Object.freeze({ mozjpeg: true }),
    png: Object.freeze({ adaptiveFiltering: true }),
  }),
});
