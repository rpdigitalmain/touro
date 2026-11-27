// Bundles the CLI as ESM and builds a Node.js single executable for the host platform.
//
// Usage: node scripts/build-exe.mjs [--out <path>]
// SEA can't cross-compile: run this on each target OS/arch (CI does).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { Command } from 'commander';
import { build } from 'esbuild';

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
if (Number(process.versions.node.split('.')[0]) < 26) {
  console.error('Building the standalone executable requires Node.js 26 or later.');
  process.exit(1);
}

const out = resolve(root, options.out);

const work = join(root, 'build', 'sea');
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
mkdirSync(dirname(out), { recursive: true });

const bundle = join(work, 'run.mjs');
const seaConfig = join(work, 'sea-config.json');

// Keep the installed image packages in their original layout for native loading.
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
const assets = {};
for (const [path, dependency] of Object.entries(lock.packages)) {
  if (!path || path === 'node_modules/commander' || dependency.dev) continue;
  const directory = join(root, path);
  if (!existsSync(directory)) continue;
  for (const entry of readdirSync(directory, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const file = join(entry.parentPath, entry.name);
    const relativePath = file.slice(directory.length + 1).split(sep);
    if (relativePath[0] === 'node_modules') continue;
    assets[`${path}/${relativePath.join('/')}`] = file;
  }
}

const runtimeHash = createHash('sha256');
for (const key of Object.keys(assets).sort()) {
  runtimeHash.update(key).update('\0').update(createHash('sha256').update(readFileSync(assets[key])).digest());
}

console.log('bundling...');
await build({
  entryPoints: [join(root, 'src', 'run.js')],
  outfile: bundle,
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['sharp'],
  target: 'node26',
  // Commander 14's bundled internals load Node built-ins through require().
  banner: {
    js: "import { createRequire as createDependencyRequire } from 'node:module';\nconst require = createDependencyRequire(import.meta.url);",
  },
  define: {
    __PACKAGE_INFO__: JSON.stringify({ name: pkg.name, version: pkg.version, os: pkg.os }),
    __NATIVE_RUNTIME_ID__: JSON.stringify(runtimeHash.digest('hex')),
  },
});

writeFileSync(
  seaConfig,
  JSON.stringify({
    main: bundle,
    mainFormat: 'module',
    output: out,
    assets,
    disableExperimentalSEAWarning: true,
  }),
);

console.log(`creating ${out}...`);
execFileSync(process.execPath, ['--build-sea', seaConfig], { stdio: 'inherit' });

console.log(`done: ${out}`);
