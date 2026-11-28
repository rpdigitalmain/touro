import { inspect } from 'node:util';
import { escapeControls } from './format.js';
import { defaults } from '../config/configuration.js';

/**
 * stdout carries the command's result (pipeable); diagnostics go to stderr.
 */
export function createLogger(options = {}) {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const verbose = options.verbose ?? defaults.output.verbose;

  // Always write "\n": Windows terminals handle it, and "\r\n" would corrupt piped output.
  return {
    columns: stdout.columns,
    out: (m) => void stdout.write(`${m}\n`),
    info: (m) => void stderr.write(`${m}\n`),
    warn: (m) => void stderr.write(`warning: ${m}\n`),
    error: (m) => void stderr.write(`error: ${m}\n`),
    debug: (m) => {
      if (verbose) stderr.write(`debug: ${m}\n`);
    },
    debugError: (error) => {
      if (verbose) {
        const details = inspect(error, { colors: false, customInspect: false, depth: null })
          .split('\n').map(escapeControls).join('\n');
        stderr.write(`debug: ${details}\n`);
      }
    },
  };
}
