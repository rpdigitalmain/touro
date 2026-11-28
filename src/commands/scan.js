import { Option } from 'commander';
import { IMAGE_FORMATS } from '../constants/images.js';
import { ImageSource } from '../images/source.js';
import { presentScan } from '../terminal/presenters/inventory.js';
import { runOperation } from './operation.js';

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
      const images = await runOperation('scan', path, async () => {
        const source = await ImageSource.open(path);
        return source.listImages({ format: configuration.scan.format, ...configuration.discovery });
      });

      presentScan(logger, images);
    });
}
