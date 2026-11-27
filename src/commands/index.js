import { registerGreet } from './greet.js';
import { registerInfo } from './info.js';
import { registerOptimize } from './optimize.js';
import { registerScan } from './scan.js';

/** Register new commands here; order controls `--help` output. */
export function registerCommands(program, context) {
  registerGreet(program, context);
  registerInfo(program, context);
  registerScan(program, context);
  registerOptimize(program, context);
}
