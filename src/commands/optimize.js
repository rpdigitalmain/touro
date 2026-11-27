import { InvalidArgumentError, Option } from 'commander';
import { DEFAULT_SOURCE, OPERATION_FAILED, PARTIAL_FAILURE } from '../constants/application.js';
import { IMAGE_FORMATS, OPTIMIZATION_QUALITY } from '../constants/images.js';
import { BatchOptimizer } from '../images/batch-optimizer.js';
import { ImageProcessor } from '../images/processor.js';
import { TouroError } from '../errors/errors.js';
import { presentOptimization } from '../terminal/presenters/optimization.js';

function parseQuality(value) {
  const quality = Number(value);
  if (!/^\d+$/.test(value) || quality < OPTIMIZATION_QUALITY.MIN || quality > OPTIMIZATION_QUALITY.MAX) {
    throw new InvalidArgumentError(`Quality must be an integer from ${OPTIMIZATION_QUALITY.MIN} to ${OPTIMIZATION_QUALITY.MAX}.`);
  }
  return quality;
}

function addOptions(command) {
  const { MIN, MAX, DEFAULT } = OPTIMIZATION_QUALITY;
  return command
    .addOption(new Option('--format <format>', 'Convert images to this format').choices(IMAGE_FORMATS))
    .option('-q, --quality <number>', `JPEG and WebP quality from ${MIN} to ${MAX} (default: ${DEFAULT})`, parseQuality);
}

export function registerOptimize(program, context) {
  const optimizer = new BatchOptimizer(ImageProcessor.create);
  async function optimize(path, options) {
    let batch;
    try {
      batch = await optimizer.run(path, options);
    } catch (cause) {
      throw new TouroError(OPERATION_FAILED, {
        cause,
        context: { operation: 'optimize', path },
      });
    }

    presentOptimization(context().logger, batch);
    if (batch.failures.length > 0) {
      throw new TouroError(PARTIAL_FAILURE, { context: { failed: batch.failures.length } });
    }
  }

  addOptions(program)
    .allowExcessArguments()
    .action((options, command) => {
      if (command.args.length > 0) command.unknownCommand();
      return optimize(DEFAULT_SOURCE, options);
    });

  addOptions(program.command('optimize'))
    .description('Optimize images in place')
    .argument('[path]', 'Image file or directory to process recursively', DEFAULT_SOURCE)
    .action((path, options) => optimize(path, { ...program.opts(), ...options }));
}
