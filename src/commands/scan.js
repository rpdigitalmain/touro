import { Option } from 'commander';
import { imageFormats, scanImages } from '../lib/scan-images.js';
import { displayPath, escapeControls, formatSize } from '../lib/terminal-format.js';

export function registerScan(program, context) {
  program
    .command('scan')
    .description('Find image files recursively by extension')
    .argument('[path]', 'Directory to scan', '.')
    .addOption(new Option('--format <format>', 'Only list images of this format').choices(imageFormats))
    .action(async (path, { format }, command) => {
      let images;
      try {
        images = await scanImages(path, format);
      } catch (error) {
        command.error(`error: Could not scan "${escapeControls(path)}". ${escapeControls(error.message)}`, {
          code: 'touro.operationFailed',
        });
      }

      const { logger } = context();
      let totalSize = 0;
      if (images.length > 0) logger.out('FORMAT  SIZE        PATH');
      for (const image of images) {
        totalSize += image.size;
        const format = image.format.toUpperCase().padEnd(8);
        const size = formatSize(image.size).padEnd(12);
        const path = displayPath(image.path);
        logger.out(`${format}${size}${path}`);
      }

      const label = images.length === 1 ? 'image' : 'images';
      logger.out(`Found ${images.length} ${label} · ${formatSize(totalSize)} total`);
    });
}
