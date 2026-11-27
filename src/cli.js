import { Command, CommanderError } from 'commander';
import { registerCommands } from './commands/index.js';
import { createLogger } from './terminal/logger.js';
import { readPackageInfo } from './runtime/package-info.js';

export async function main(argv) {
  const pkg = readPackageInfo();
  if (!pkg.os.includes(process.platform)) {
    createLogger().error(`Unsupported platform: ${process.platform}. Touro supports Linux and Windows.`);
    return 1;
  }

  const program = new Command()
    .name(pkg.name)
    .version(pkg.version, '-v, --version', 'Show version')
    .helpOption('-h, --help', 'Show help')
    .option('--verbose', 'Print debug output')
    .option('--no-color', 'Disable colored output (or set NO_COLOR=1)')
    .addHelpText('before', `${pkg.name} v${pkg.version}\n`)
    .exitOverride();

  registerCommands(program, () => ({
    pkg,
    logger: createLogger(program.opts()),
  }));

  if (argv.length === 0) {
    program.outputHelp();
    return 1;
  }

  try {
    await program.parseAsync(argv, { from: 'user' });
    return 0;
  } catch (error) {
    if (!(error instanceof CommanderError)) throw error;
    if (error.exitCode === 0) return 0;
    if (['commander.unknownCommand', 'commander.help', 'touro.operationFailed'].includes(error.code)) return 1;
    return 2;
  }
}
