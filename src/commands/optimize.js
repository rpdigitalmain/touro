import { CommanderError, InvalidArgumentError, Option } from 'commander';
import { imageFormats } from '../lib/image-formats.js';
import { optimizeBatch } from '../lib/optimize-batch.js';
import { createImageProcessor } from '../lib/optimize-image.js';
import { createTable, displayPath, escapeControls, formatSize } from '../lib/terminal-format.js';

function parseQuality(value) {
  const quality = Number(value);
  if (!/^\d+$/.test(value) || quality < 1 || quality > 100) {
    throw new InvalidArgumentError('Quality must be an integer from 1 to 100.');
  }
  return quality;
}

function report(logger, { results, failures, summary, output }) {
  for (const { path, message } of failures) {
    logger.error(`Failed: ${displayPath(path)} (${escapeControls(message)})`);
  }

  const { originalSize: original, finalSize: final } = summary;
  const row = createTable(logger.out, [
    { width: 11 },
    { width: 10, align: 'right' },
    { width: 10, align: 'right' },
    { width: 11, align: 'right' },
    { width: 8, align: 'right' },
    {},
  ]);
  if (results.length > 0) row(['FORMAT', 'ORIGINAL', 'FINAL', 'SAVED', 'CHANGE', 'PATH']);
  for (const result of results) {
    const from = result.inputFormat.toUpperCase();
    const format = result.status === 'converted' ? `${from} → ${result.outputFormat.toUpperCase()}` : from;
    const saved = result.originalSize - result.finalSize;
    const size = `${saved < 0 ? '-' : ''}${formatSize(Math.abs(saved))}`;
    const change = ((-saved / result.originalSize) * 100).toFixed(1);
    row([
      format,
      formatSize(result.originalSize),
      formatSize(result.finalSize),
      size,
      `${saved < 0 ? '+' : ''}${change}%`,
      displayPath(result.path),
    ]);
  }

  const total = results.length + failures.length;
  logger.out(`${total} ${total === 1 ? 'file' : 'files'} · ${summary.converted} converted · ${summary.optimized} optimized · ${summary.unchanged} unchanged · ${failures.length} failed`);
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
      let batch;
      try {
        batch = await optimizeBatch(path, { ...options, createProcessor: createImageProcessor });
      } catch (error) {
        command.error(`error: Could not optimize "${escapeControls(path)}". ${escapeControls(error.message)}`, {
          code: 'touro.operationFailed',
        });
      }

      report(context().logger, batch);
      if (batch.failures.length > 0) {
        throw new CommanderError(1, 'touro.operationFailed', 'Some images failed.');
      }
    });
}
