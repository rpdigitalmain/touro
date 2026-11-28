import { arch, platform, release } from 'node:os';
import { appPaths } from '../runtime/paths.js';

export function registerInfo(program, context) {
  program
    .command('info')
    .description('Show environment and app directory information')
    .option('--json', 'Print machine-readable JSON')
    .action(async ({ json }) => {
      const { configuration, logger, pkg } = await context({ output: { json } });
      const data = {
        name: pkg.name,
        version: pkg.version,
        node: process.version,
        platform: platform(),
        arch: arch(),
        osRelease: release(),
        paths: appPaths(pkg.name),
      };

      if (configuration.output.json) {
        logger.out(JSON.stringify(data, null, 2));
        return;
      }

      logger.out(
        [
          `${data.name} v${data.version}`,
          `node      ${data.node}`,
          `platform  ${data.platform} (${data.arch}, ${data.osRelease})`,
          `config    ${data.paths.config}`,
          `data      ${data.paths.data}`,
          `cache     ${data.paths.cache}`,
        ].join('\n'),
      );
    });
}
