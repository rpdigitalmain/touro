import { Command, CommanderError } from 'commander';
import { registerCommands } from './commands/index.js';
import { createLogger } from './terminal/logger.js';
import { readPackageInfo } from './runtime/package-info.js';
import { EXIT_CODE, PARTIAL_FAILURE, UNSUPPORTED_PLATFORM } from './shared/constants/application.js';
import { TouroError } from './shared/errors.js';
import { presentError } from './terminal/presenters/errors.js';

function handleCliError(logger, error) {
  if (error instanceof CommanderError) {
    if (error.exitCode === EXIT_CODE.SUCCESS) return EXIT_CODE.SUCCESS;
    // Commander already wrote its diagnostic.
    logger.debugError(error);
    if (['commander.unknownCommand', 'commander.help'].includes(error.code)) return EXIT_CODE.FAILURE;
    return EXIT_CODE.INVALID_USAGE;
  }
  if (error instanceof TouroError && error.code === PARTIAL_FAILURE) {
    // The optimization report already presented each failure.
    return EXIT_CODE.FAILURE;
  }
  presentError(logger, error);
  return EXIT_CODE.FAILURE;
}

export async function main(argv) {
  let program;
  try {
    const pkg = readPackageInfo();
    if (!pkg.os.includes(process.platform)) {
      throw new TouroError(UNSUPPORTED_PLATFORM, { context: { platform: process.platform } });
    }

    program = new Command()
      .name(pkg.name)
      .description('Optimize JPEG, PNG, and WebP images in place, recursively from the current directory')
      .version(pkg.version, '-v, --version', 'Show version')
      .helpOption('-h, --help', 'Show help')
      .option('--verbose', 'Print debug output')
      .option('--no-color', 'Disable colored output (or set NO_COLOR=1)')
      .addHelpText('before', `${pkg.name} v${pkg.version}\n`)
      .showHelpAfterError(`Run "${pkg.name} --help" for usage.`)
      .exitOverride();

    registerCommands(program, () => ({
      pkg,
      logger: createLogger(program.opts()),
    }));
    await program.parseAsync(argv, { from: 'user' });
    return EXIT_CODE.SUCCESS;
  } catch (error) {
    const options = program?.opts() ?? (Array.isArray(argv) ? {
      verbose: argv.includes('--verbose'),
      color: !argv.includes('--no-color'),
    } : {});
    return handleCliError(createLogger(options), error);
  }
}
