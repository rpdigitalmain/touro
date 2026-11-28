import { InvalidArgumentError, Option } from 'commander';
import { OPERATION_FAILED, PARTIAL_FAILURE } from '../constants/application.js';
import { IMAGE_FORMATS } from '../constants/images.js';
import { defaults, isQuality, qualityRange } from '../config/configuration.js';
import { BatchOptimizer } from '../images/batch-optimizer.js';
import { ImageProcessor } from '../images/processor.js';
import { TouroError } from '../errors/errors.js';
import { presentOptimization } from '../terminal/presenters/optimization.js';

function parseQuality(value) {
  const quality = Number(value);
  if (!/^\d+$/.test(value) || !isQuality(quality)) {
    throw new InvalidArgumentError(`Quality must be an integer from ${qualityRange.min} to ${qualityRange.max}.`);
  }
  return quality;
}

export function registerOptimization(program, context) {
  const optimizer = new BatchOptimizer(ImageProcessor.create);
  const { min, max } = qualityRange;

  program
    .argument('[directory]', 'Directory to optimize recursively')
    .addOption(new Option('--format <format>', 'Convert images to this format').choices(IMAGE_FORMATS))
    .option('-q, --quality <number>', `JPEG and WebP quality from ${min} to ${max} (default: ${defaults.optimize.quality})`, parseQuality)
    .action(async (directory, { format, quality }) => {
      const { configuration, logger } = await context({ optimize: { directory, format, quality } });
      const { directory: path } = configuration.optimize;
      let batch;
      try {
        batch = await optimizer.run(path, {
          ...configuration.optimize,
          ...configuration.discovery,
          encoding: configuration.encoding,
        });
      } catch (cause) {
        throw new TouroError(OPERATION_FAILED, {
          cause,
          context: { operation: 'optimize', path },
        });
      }

      presentOptimization(logger, batch);
      if (batch.failures.length > 0) {
        throw new TouroError(PARTIAL_FAILURE, { context: { failed: batch.failures.length } });
      }
    });
}
