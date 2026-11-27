// Builds a standalone executable (no Node.js install needed) for the current
// platform using Node's Single Executable Applications feature:
//   1. bundle src/run.js into one CommonJS file (SEA requires CJS)
//   2. turn it into a SEA blob with `node --experimental-sea-config`
//   3. copy the running `node` binary and inject the blob with postject
//
// Usage: node scripts/build-exe.mjs [--out <path>]
// SEA can't cross-compile: run this on each target OS/arch (CI does).
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Command } from 'commander';
import { build } from 'esbuild';
import { inject } from 'postject';

const root = resolve(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
if (!pkg.os.includes(process.platform)) {
  console.error(`Unsupported platform: ${process.platform}. Touro supports Linux and Windows.`);
  process.exit(1);
}

const binName = Object.keys(pkg.bin)[0];
const exeSuffix = process.platform === 'win32' ? '.exe' : '';

const options = new Command()
  .name('build-exe')
  .description('Build a standalone Touro executable')
  .option('--out <path>', 'Executable output path', join('dist-exe', binName + exeSuffix))
  .parse()
  .opts();
const out = resolve(root, options.out);

const work = join(root, 'build', 'sea');
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
mkdirSync(dirname(out), { recursive: true });

const bundle = join(work, 'run.cjs');
const blob = join(work, 'sea-prep.blob');
const seaConfig = join(work, 'sea-config.json');

console.log('bundling...');
await build({
  entryPoints: [join(root, 'src', 'run.js')],
  outfile: bundle,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  define: {
    __PACKAGE_INFO__: JSON.stringify({ name: pkg.name, version: pkg.version, os: pkg.os }),
  },
  // package.js only touches import.meta when __PACKAGE_INFO__ is undefined.
  logOverride: { 'empty-import-meta': 'silent' },
});

console.log('generating SEA blob...');
writeFileSync(
  seaConfig,
  JSON.stringify({
    main: bundle,
    output: blob,
    disableExperimentalSEAWarning: true,
    useCodeCache: true,
  }),
);
execFileSync(process.execPath, ['--experimental-sea-config', seaConfig], { stdio: 'inherit' });

console.log(`creating ${out}...`);
rmSync(out, { force: true });
copyFileSync(process.execPath, out);

await inject(out, 'NODE_SEA_BLOB', readFileSync(blob), {
  sentinelFuse: 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
});

console.log(`done: ${out}`);
