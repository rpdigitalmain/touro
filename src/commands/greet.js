import { InvalidArgumentError } from 'commander';

function parseTimes(value) {
  const times = Number(value);
  if (!Number.isInteger(times) || times < 1) {
    throw new InvalidArgumentError(`--times must be a positive integer, got "${value}"`);
  }
  return times;
}

export function registerGreet(program, context) {
  program
    .command('greet')
    .alias('hello')
    .description('Print a greeting (example command)')
    .argument('[name]', 'Name to greet', 'world')
    .option('-s, --shout', 'Uppercase the greeting')
    .option('-t, --times <n>', 'Repeat the greeting n times', parseTimes, 1)
    .action((name, { shout, times }) => {
      const { logger } = context();
      logger.debug(`greeting ${name} ${times} time(s)`);

      let message = `Hello, ${name}!`;
      if (shout) message = message.toUpperCase();
      for (let i = 0; i < times; i++) logger.out(message);
    });
}
