import { styleText } from 'node:util';

/**
 * stdout carries the command's result (pipeable); diagnostics go to stderr.
 * Color is only used on a TTY and honors NO_COLOR / FORCE_COLOR.
 */
export function createLogger(options = {}) {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const useColor = shouldUseColor(options.color ?? true, stderr.isTTY === true);

  const paint = (format, text) =>
    useColor ? styleText(format, text, { validateStream: false }) : text;

  // Always write "\n": Windows terminals handle it, and "\r\n" would corrupt piped output.
  return {
    out: (m) => void stdout.write(`${m}\n`),
    info: (m) => void stderr.write(`${m}\n`),
    warn: (m) => void stderr.write(`${paint('yellow', 'warning:')} ${m}\n`),
    error: (m) => void stderr.write(`${paint('red', 'error:')} ${m}\n`),
    debug: (m) => {
      if (options.verbose) stderr.write(`${paint('gray', `debug: ${m}`)}\n`);
    },
  };
}

function shouldUseColor(requested, isTTY) {
  if (!requested) return false;
  const env = process.env;
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== '') return false;
  if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== '0') return true;
  return isTTY && env.TERM !== 'dumb';
}
