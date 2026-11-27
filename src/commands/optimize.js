import { lstat, mkdir, realpath } from 'node:fs/promises';
import { basename, dirname, relative, resolve } from 'node:path';
import { CommanderError, InvalidArgumentError, Option } from 'commander';
import { loadSharp } from '../lib/load-sharp.js';
import { optimizeImage } from '../lib/optimize-image.js';
import { imageFormatFor, imageFormats, scanImages } from '../lib/scan-images.js';
import { displayPath, escapeControls, formatSize } from '../lib/terminal-format.js';

function parseQuality(value) {
  const quality = Number(value);
  if (!/^\d+$/.test(value) || quality < 1 || quality > 100) {
    throw new InvalidArgumentError('Quality must be an integer from 1 to 100.');
  }
  return quality;
}

function report(logger, results, failed, output) {
  if (results.length > 0) logger.out('FORMAT       ORIGINAL       FINAL        SAVED   CHANGE  PATH');
  const counts = { converted: 0, optimized: 0, unchanged: 0 };
  let original = 0;
  let final = 0;
  for (const result of results) {
    original += result.originalSize;
    final += result.finalSize;
    counts[result.status] += 1;
    const from = result.inputFormat.toUpperCase();
    const format = result.status === 'converted' ? `${from} → ${result.outputFormat.toUpperCase()}` : from;
    const saved = result.originalSize - result.finalSize;
    const size = `${saved < 0 ? '-' : ''}${formatSize(Math.abs(saved))}`;
    const change = ((-saved / result.originalSize) * 100).toFixed(1);
    logger.out([
      format.padEnd(11),
      formatSize(result.originalSize).padStart(10),
      formatSize(result.finalSize).padStart(10),
      size.padStart(11),
      `${saved < 0 ? '+' : ''}${change}%`.padStart(8),
      displayPath(result.path),
    ].join('  '));
  }

  const total = results.length + failed;
  logger.out(`${total} ${total === 1 ? 'file' : 'files'} · ${counts.converted} converted · ${counts.optimized} optimized · ${counts.unchanged} unchanged · ${failed} failed`);
  if (results.length === 0) return;

  const saved = original - final;
  const comparison = `${formatSize(original)} → ${formatSize(final)}`;
  const difference = `${formatSize(Math.abs(saved))} (${(Math.abs(saved) / original * 100).toFixed(1)}%)`;
  logger.out(saved === 0 ? `${comparison} · Same size` :
    `${comparison} · Output is ${difference} ${saved > 0 ? 'smaller' : 'larger'}`);
  logger.out(`Output: ${displayPath(output)}`);
}

export function registerOptimize(program, context) {
  program
    .command('optimize')
    .description('Optimize images and compare original and final sizes')
    .argument('<path>', 'Image file or directory to process recursively')
    .addOption(new Option('--format <format>', 'Convert images to this format').choices(imageFormats))
    .option('-o, --output <directory>', 'Output directory (default: touro-output inside the input directory)')
    .option('-q, --quality <number>', 'JPEG and WebP quality from 1 to 100', parseQuality, 80)
    .action(async (path, options, command) => {
      const { logger } = context();
      let root;
      let output;
      let images;
      let sharp;
      try {
        const input = resolve(path);
        const stats = await lstat(input);
        const format = imageFormatFor(input);
        if (!stats.isDirectory() && !(stats.isFile() && format)) {
          throw new Error('Expected a directory or a JPEG, PNG, or WebP file.');
        }
        root = await realpath(stats.isDirectory() ? input : dirname(input));
        output = options.output === undefined ? resolve(root, 'touro-output') : resolve(options.output);
        const existingOutput = await lstat(output).catch((error) => {
          if (error.code !== 'ENOENT') throw error;
        });
        if (existingOutput) {
          if (!existingOutput.isDirectory()) throw new Error('Output must be a real directory.');
          output = await realpath(output);
        }
        if (relative(root, output) === '') {
          throw new Error('Choose an output directory separate from the input directory.');
        }
        images = stats.isDirectory() ? await scanImages(root, undefined, output) : [{ path: basename(input), format }];
        if (images.length > 0) {
          sharp = await loadSharp();
          await mkdir(output, { recursive: true });
          if (!(await lstat(output)).isDirectory()) throw new Error('Output must be a real directory.');
          output = await realpath(output);
          if (relative(root, output) === '') {
            throw new Error('Choose an output directory separate from the input directory.');
          }
        }
      } catch (error) {
        command.error(`error: Could not optimize "${escapeControls(path)}". ${escapeControls(error.message)}`, {
          code: 'touro.operationFailed',
        });
      }

      const results = [];
      let failed = 0;
      for (const image of images) {
        try {
          results.push(await optimizeImage(sharp, root, image, output, options.format, options.quality));
        } catch (error) {
          failed += 1;
          logger.error(`Failed: ${displayPath(image.path)} (${escapeControls(error.message)})`);
        }
      }
      report(logger, results, failed, output);
      if (failed > 0) throw new CommanderError(1, 'touro.operationFailed', 'Some images failed.');
    });
}
