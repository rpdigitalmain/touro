// Shared by bin/touro.js and the standalone executable's ESM bundle.
import { main } from './cli.js';

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    console.error(err);
    process.exitCode = 1;
  },
);
