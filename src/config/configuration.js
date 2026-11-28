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
  optimize: Object.freeze({ keepIccProfile: true }),
  encoding: Object.freeze({
    input: Object.freeze({ failOn: 'warning' }),
    jpeg: Object.freeze({ mozjpeg: true }),
    png: Object.freeze({ adaptiveFiltering: true }),
  }),
});
