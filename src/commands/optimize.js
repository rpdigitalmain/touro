import { CommanderError, InvalidArgumentError, Option } from 'commander';
import { imageFormats } from '../images/formats.js';
import { BatchOptimizer } from '../images/batch-optimizer.js';
import { ImageProcessor } from '../images/processor.js';
import { escapeControls } from '../terminal/format.js';
import { presentOptimization } from '../terminal/presenters/optimization.js';

function parseQuality(value) {
  const quality = Number(value);
  if (!/^\d+$/.test(value) || quality < 1 || quality > 100) {
    throw new InvalidArgumentError('Quality must be an integer from 1 to 100.');
  }
  return quality;
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

    presentOptimization(context().logger, batch);
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
