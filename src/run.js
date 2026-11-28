// Shared by bin/touro.js and the standalone executable's ESM bundle.
import { main } from './cli.js';

process.exitCode = await main(process.argv.slice(2));
