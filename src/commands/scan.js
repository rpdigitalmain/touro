import { Option } from 'commander';
import { imageFormats } from '../images/formats.js';
import { ImageSource } from '../images/source.js';
import { createTable, displayPath, escapeControls, formatSize } from '../terminal/format.js';

export function registerScan(program, context) {
  program
    .command('scan')
    .description('Find image files recursively by extension')
    .argument('[path]', 'Directory to scan', '.')
    .addOption(new Option('--format <format>', 'Only list images of this format').choices(imageFormats))
    .action(async (path, { format }, command) => {
      let images;
      try {
        const source = await ImageSource.open(path);
        images = await source.listImages({ format });
      } catch (error) {
        command.error(`error: Could not scan "${escapeControls(path)}". ${escapeControls(error.message)}`, {
          code: 'touro.operationFailed',
        });
      }

      const { logger } = context();
      let totalSize = 0;
      const row = createTable(logger.out, [{ width: 6 }, { width: 10 }, {}]);
      if (images.length > 0) row(['FORMAT', 'SIZE', 'PATH']);
      for (const image of images) {
        totalSize += image.size;
        row([image.format.toUpperCase(), formatSize(image.size), displayPath(image.path)]);
      }

      const label = images.length === 1 ? 'image' : 'images';
      logger.out(`Found ${images.length} ${label} · ${formatSize(totalSize)} total`);
    });
}
