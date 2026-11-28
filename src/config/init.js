import { readFile, writeFile } from 'node:fs/promises';
import { findPackageJSON } from 'node:module';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { IMAGE_FORMATS } from '../constants/images.js';
import { defaults, pngCompressionRange, qualityRange } from './configuration.js';

export async function writeStarterConfiguration(path) {
  const directory = dirname(path);
  const packagePath = findPackageJSON(pathToFileURL(directory));
  // Some Node versions return the queried directory when no package exists.
  const pkg = packagePath && packagePath !== directory
    ? JSON.parse((await readFile(packagePath, 'utf8')).trim())
    : {};
  const declaration = pkg?.type === 'module' ? 'export default' : 'module.exports =';
  const { discovery, scan, optimize, encoding, output } = defaults;
  const formats = IMAGE_FORMATS.join(', ');
  const content = [
    '// Security: Touro runs this JavaScript with your permissions, even during scan.',
    '// Only use trusted configurations and projects. Use --no-config to skip this file.',
    '// The values below are the built-in Touro defaults. Omitted settings use those same defaults.',
    '',
    `${declaration} {`,
    '  // Image discovery shared by scan and optimization.',
    '  discovery: {',
    '    // Search subdirectories. Set to false to search only the target directory.',
    `    recursive: ${discovery.recursive},`,
    '    // Directory names skipped at any depth, matched without regard to case.',
    '    // This list replaces the built-in list. Use [] to clear it.',
    '    excludedDirectories: [',
    ...discovery.excludedDirectories.map((name) => `      ${JSON.stringify(name)},`),
    '    ],',
    '    // Discovery also skips dot-prefixed subdirectories, symbolic links,',
    '    // and files without a supported image extension.',
    '  },',
    '',
    '  scan: {',
    '    // Directory to list. Relative paths start at the working directory.',
    `    directory: ${JSON.stringify(scan.directory)},`,
    `    // By default, scan lists all supported formats. Set format to filter: ${formats}.`,
    '  },',
    '',
    '  optimize: {',
    '    // Directory to optimize. Relative paths start at the working directory.',
    `    directory: ${JSON.stringify(optimize.directory)},`,
    `    // By default, images keep their original format. Set format to convert: ${formats}.`,
    '    // Successful conversions replace the original file.',
    `    // JPEG and WebP quality. Use an integer from ${qualityRange.min} to ${qualityRange.max}.`,
    `    quality: ${optimize.quality},`,
    '  },',
    '',
    '  encoding: {',
    '    jpeg: {',
    '      // Fill transparent areas with this opaque #RRGGBB color when encoding JPEG.',
    `      background: ${JSON.stringify(encoding.jpeg.background)},`,
    '    },',
    '    png: {',
    `      // Lossless PNG compression. Use an integer from ${pngCompressionRange.min} to ${pngCompressionRange.max}.`,
    `      compressionLevel: ${encoding.png.compressionLevel},`,
    '    },',
    '  },',
    '',
    '  output: {',
    '    // Include debug diagnostics.',
    `    verbose: ${output.verbose},`,
    '    // Print machine-readable JSON for info.',
    `    json: ${output.json},`,
    '  },',
    '};',
    '',
  ].join('\n');
  await writeFile(path, content, { flag: 'wx' });
}
