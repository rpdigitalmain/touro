import { Option } from 'commander';
import { OPERATION_FAILED } from '../constants/application.js';
import { IMAGE_FORMATS } from '../constants/images.js';
import { ImageSource } from '../images/source.js';
import { TouroError } from '../errors/errors.js';
import { presentScan } from '../terminal/presenters/inventory.js';

export function registerScan(program, context) {
  program
    .command('scan')
    .description('Find image files recursively by extension')
    .argument('[directory]', 'Directory to scan')
    .addOption(new Option('--format <format>', 'Only list images of this format').choices(IMAGE_FORMATS))
    .action(async (directory, options) => {
      const format = options.format ?? program.opts().format;
      const { logger, configuration } = await context({ scan: { directory, format } });
      const path = configuration.scan.directory;
      let images;
      try {
        const source = await ImageSource.open(path);
        images = await source.listImages({ format: configuration.scan.format, ...configuration.discovery });
      } catch (cause) {
        throw new TouroError(OPERATION_FAILED, {
          cause,
          context: { operation: 'scan', path },
        });
      }

      presentScan(logger, images);
    });
}
