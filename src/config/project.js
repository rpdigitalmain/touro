import { lstat, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { INVALID_CONFIGURATION } from '../constants/application.js';
import { IMAGE_FORMATS } from '../constants/images.js';
import { TouroError } from '../errors/errors.js';
import { CONFIGURATION_FILENAME, isQuality, pngCompressionRange, qualityRange } from './configuration.js';

// The standalone executable needs a filesystem-backed loader for external modules.
const requireConfig = createRequire(import.meta.url);

const directory = [(value) => typeof value === 'string' && value.trim().length > 0, 'a non-empty string'];
const format = [(value) => IMAGE_FORMATS.includes(value), IMAGE_FORMATS.join(', ')];
const boolean = [(value) => typeof value === 'boolean', 'a boolean'];
const directoryNames = [
  (value) => Array.isArray(value) && [...value].every((name) =>
    directory[0](name) && name !== '.' && name !== '..' &&
    !name.includes('/') && !name.includes('\\') && !name.includes('\0')),
  'an array of directory names',
];
const { min: minPngCompression, max: maxPngCompression } = pngCompressionRange;
const schema = {
  scan: { directory, format },
  optimize: {
    directory,
    format,
    quality: [isQuality, `an integer from ${qualityRange.min} to ${qualityRange.max}`],
  },
  output: { verbose: boolean, json: boolean },
  discovery: { excludedDirectories: directoryNames, recursive: boolean },
  encoding: {
    jpeg: {
      background: [(value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value), 'a hex color in #RRGGBB format'],
    },
    png: {
      compressionLevel: [
        (value) => Number.isInteger(value) && value >= minPngCompression && value <= maxPngCompression,
        `an integer from ${minPngCompression} to ${maxPngCompression}`,
      ],
    },
  },
};

function validate(value, rules, path = []) {
  if (value === null || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new TypeError(`${path.join('.') || 'The configuration export'} must be a plain object.`);
  }

  for (const [key, entry] of Object.entries(value)) {
    const field = [...path, key];
    if (!Object.hasOwn(rules, key)) throw new TypeError(`Unknown setting "${field.join('.')}".`);

    const rule = rules[key];
    if (Array.isArray(rule)) {
      const [isValid, expected] = rule;
      if (!isValid(entry)) throw new TypeError(`"${field.join('.')}" must be ${expected}.`);
    } else {
      validate(entry, rule, field);
    }
  }
}

export async function projectConfiguration({ cwd = process.cwd(), useProjectConfig = true } = {}) {
  if (!useProjectConfig) return {};
  const path = resolve(cwd, CONFIGURATION_FILENAME);
  let configuration;
  try {
    let stats;
    try {
      stats = await lstat(path);
    } catch (error) {
      if (error.code === 'ENOENT') return {};
      throw error;
    }
    if (stats.isSymbolicLink()) stats = await stat(path);
    if (!stats.isFile()) throw new TypeError('Expected a regular configuration file.');
    configuration = requireConfig(path);
    if (configuration?.[Symbol.toStringTag] === 'Module') configuration = configuration.default;
  } catch (cause) {
    throw new TouroError(INVALID_CONFIGURATION, {
      cause, context: { path, reason: 'Check the file and its imports. Rerun with --verbose for details.' },
    });
  }

  try {
    validate(configuration, schema);
  } catch (cause) {
    throw new TouroError(INVALID_CONFIGURATION, { cause, context: { path, reason: cause.message } });
  }
  return configuration;
}
