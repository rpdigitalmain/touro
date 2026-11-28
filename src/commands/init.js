import { resolve } from 'node:path';
import { CONFIGURATION_FILENAME } from '../config/configuration.js';
import { writeStarterConfiguration } from '../config/init.js';
import { createLogger } from '../terminal/logger.js';
import { runOperation } from './operation.js';

export function registerInit(program) {
  program
    .command('init')
    .description('Create a project configuration file in the current directory')
    .action(async () => {
      const path = resolve(CONFIGURATION_FILENAME);
      await runOperation('create configuration', path, () => writeStarterConfiguration(path));
      createLogger().out(`Created ${CONFIGURATION_FILENAME}.`);
    });
}
