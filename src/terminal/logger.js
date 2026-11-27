import { inspect, styleText } from 'node:util';
import { escapeControls } from './format.js';

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
    columns: stdout.columns,
    out: (m) => void stdout.write(`${m}\n`),
    info: (m) => void stderr.write(`${m}\n`),
    warn: (m) => void stderr.write(`${paint('yellow', 'warning:')} ${m}\n`),
    error: (m, { color = true } = {}) => void stderr.write(`${color ? paint('red', 'error:') : 'error:'} ${m}\n`),
    debug: (m) => {
      if (options.verbose) stderr.write(`${paint('gray', `debug: ${m}`)}\n`);
    },
    debugError: (error) => {
      if (options.verbose) {
        const details = inspect(error, { colors: false, customInspect: false, depth: null })
          .split('\n').map(escapeControls).join('\n');
        stderr.write(`${paint('gray', `debug: ${details}`)}\n`);
      }
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
