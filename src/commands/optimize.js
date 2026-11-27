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

export function registerOptimization(program, context) {
  const optimizer = new BatchOptimizer(ImageProcessor.create);
  const { MIN, MAX, DEFAULT } = OPTIMIZATION_QUALITY;

  program
    .argument('[directory]', 'Directory to optimize recursively', DEFAULT_SOURCE)
    .addOption(new Option('--format <format>', 'Convert images to this format').choices(IMAGE_FORMATS))
    .option('-q, --quality <number>', `JPEG and WebP quality from ${MIN} to ${MAX} (default: ${DEFAULT})`, parseQuality)
    .action(async (path, options) => {
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
    });
}
