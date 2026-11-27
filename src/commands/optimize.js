import { CommanderError, InvalidArgumentError, Option } from 'commander';
import { imageFormats } from '../images/formats.js';
import { BatchOptimizer } from '../images/batch-optimizer.js';
import { ImageProcessor } from '../images/processor.js';
import { createTable, displayPath, escapeControls, formatSize } from '../terminal/format.js';

function parseQuality(value) {
  const quality = Number(value);
  if (!/^\d+$/.test(value) || quality < 1 || quality > 100) {
    throw new InvalidArgumentError('Quality must be an integer from 1 to 100.');
  }
  return quality;
}

function report(logger, { results, failures, summary }) {
  for (const { path, message } of failures) {
    logger.error(`Failed: ${displayPath(path)} (${escapeControls(message)})`);
  }

  const { originalSize: original, finalSize: final } = summary;
  const row = createTable(logger.out, [
    { width: 11 },
    { width: 9, align: 'right' },
    { width: 9, align: 'right' },
    { width: 10, align: 'right' },
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
      displayPath(result.targetPath),
    ]);
  }

  const total = results.length + failures.length;
  if (results.length > 0) logger.out('');
  logger.out(`${total} ${total === 1 ? 'file' : 'files'} processed`);
  logger.out(`${summary.optimized} optimized · ${summary.converted} converted · ${summary.unchanged} unchanged · ${failures.length} failed`);
  logger.out('');
  const saved = original - final;
  const comparison = `${formatSize(original)} → ${formatSize(final)}`;
  const percent = original === 0 ? 0 : Math.abs(saved) / original * 100;
  logger.out(`${comparison} · ${formatSize(Math.abs(saved))} ${saved >= 0 ? 'saved' : 'added'} (${percent.toFixed(1)}%)`);
}

function addOptions(command) {
  return command
    .addOption(new Option('--format <format>', 'Convert images to this format').choices(imageFormats))
    .option('-q, --quality <number>', 'JPEG and WebP quality from 1 to 100 (default: 80)', parseQuality);
}

export function registerOptimize(program, context) {
  const optimizer = new BatchOptimizer(ImageProcessor.create);
  async function optimize(path, options, command) {
    let batch;
    try {
      batch = await optimizer.run(path, options);
    } catch (error) {
      command.error(`error: Could not optimize "${escapeControls(path)}". ${escapeControls(error.message)}`, {
        code: 'touro.operationFailed',
      });
    }

    report(context().logger, batch);
    if (batch.failures.length > 0) {
      throw new CommanderError(1, 'touro.operationFailed', 'Some images failed.');
    }
  }

  addOptions(program)
    .allowExcessArguments()
    .action((options, command) => {
      if (command.args.length > 0) command.unknownCommand();
      return optimize('.', options, command);
    });

  addOptions(program.command('optimize'))
    .description('Optimize images in place')
    .argument('[path]', 'Image file or directory to process recursively', '.')
    .action((path, options, command) => optimize(path, { ...program.opts(), ...options }, command));
}
