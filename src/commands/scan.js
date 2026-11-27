import { sep } from 'node:path';
import { Option } from 'commander';
import { imageFormats, scanImages } from '../lib/scan-images.js';

function formatSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unit = 0;
  while (bytes >= 1000 && unit < units.length - 1) {
    bytes /= 1000;
    unit += 1;
  }
  return unit === 0 ? `${bytes} B` : `${bytes.toFixed(2)} ${units[unit]}`;
}

function escapeControls(text) {
  return text.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, (char) =>
    `\\u{${char.codePointAt(0).toString(16)}}`,
  );
}

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
          code: 'touro.scanFailed',
        });
      }

      const { logger } = context();
      let totalSize = 0;
      if (images.length > 0) logger.out('FORMAT  SIZE        PATH');
      for (const image of images) {
        totalSize += image.size;
        const format = image.format.toUpperCase().padEnd(8);
        const size = formatSize(image.size).padEnd(12);
        const path = escapeControls(image.path.split(sep).join('/'));
        logger.out(`${format}${size}${path}`);
      }

      const label = images.length === 1 ? 'image' : 'images';
      logger.out(`Found ${images.length} ${label} · ${formatSize(totalSize)} total`);
    });
}
