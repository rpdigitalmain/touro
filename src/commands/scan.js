import { Option } from 'commander';
import { imageFormats } from '../images/formats.js';
import { ImageSource } from '../images/source.js';
import { escapeControls } from '../terminal/format.js';
import { presentScan } from '../terminal/presenters/inventory.js';

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
        images = await source.listImages({ format: format ?? program.opts().format });
      } catch (error) {
        command.error(`error: Could not scan "${escapeControls(path)}". ${escapeControls(error.message)}`, {
          code: 'touro.operationFailed',
        });
      }

      presentScan(context().logger, images);
    });
}
