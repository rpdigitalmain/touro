import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, symlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';
import sharp from 'sharp';
import { createTemporaryDirectory } from '../shared/temporary-directory.js';

// Set CLI_EXE to a standalone executable (npm run build:exe) to test it instead.
const exe = process.env.CLI_EXE ? resolve(process.env.CLI_EXE) : undefined;
const cli = fileURLToPath(new URL('../../bin/touro.js', import.meta.url));

/** Runs the CLI in a child process, exactly as a user would. */
function run(...args) {
  return runIn(process.cwd(), ...args);
}

function runIn(cwd, ...args) {
  const [command, argv] = exe ? [exe, args] : [process.execPath, [cli, ...args]];
  const result = spawnSync(command, argv, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      LOCALAPPDATA: join(cwd, '.cache'),
      XDG_CACHE_HOME: join(cwd, '.cache'),
    },
  });
  if (result.error) throw result.error;
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe('cli', () => {
  it('prints the version', () => {
    const { code, stdout } = run('--version');
    assert.equal(code, 0);
    assert.match(stdout.trim(), /^\d+\.\d+\.\d+/);
  });

  it('prints help and lists commands', () => {
    const { code, stdout } = run('--help');
    assert.equal(code, 0);
    assert.match(stdout, /^touro v/);
    assert.match(stdout, /^Usage: touro \[options\] \[directory\]/m);
    assert.match(stdout, /Optimize JPEG, PNG, and WebP images in place/);
    assert.match(stdout, /--format/);
    assert.match(stdout, /--quality/);
    assert.doesNotMatch(stdout, /--output/);
    assert.match(stdout, /Commands:/);
    assert.match(stdout, /\bscan\b/);
    assert.match(stdout, /^\s+info \[options\]/m);
    assert.doesNotMatch(stdout, /^\s+(optimize|greet|hello) \[options\]/m);
  });

  it('reports an empty optimization run without arguments', async (t) => {
    const root = await createTemporaryDirectory(t, 'touro-empty-');
    const result = runIn(root);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stdout, [
      '0 images processed',
      '0 optimized · 0 converted · 0 unchanged · 0 failed',
      '',
      '0 B → 0 B · 0 B saved (0.0%)',
      '',
    ].join('\n'));
    assert.deepEqual(await readdir(root), []);
  });

  it('rejects the retired optimize subcommand syntax', () => {
    const { code, stdout, stderr } = run('optimize', './assets');
    assert.equal(code, 2);
    assert.equal(stdout, '');
    assert.match(stderr, /too many arguments/i);
  });

  it('reports unknown options with exit code 2', () => {
    const { code, stderr } = run('info', '--bogus');
    assert.equal(code, 2);
    assert.match(stderr, /bogus/);
    assert.equal(run('--output', 'obsolete').code, 2);
    assert.equal(run('--no-color').code, 2);
    assert.equal(run('--quality', '101').code, 2);
  });

  it('prints info as JSON', () => {
    const { code, stdout } = run('info', '--json');
    assert.equal(code, 0);
    const data = JSON.parse(stdout);
    assert.equal(data.name, 'touro');
    assert.equal(data.platform, process.platform);
    assert.ok(data.paths.config);
  });
});

describe('project configuration', () => {
  it('limits both commands to the target directory and uses the configured JPEG background', async (t) => {
    const root = await createTemporaryDirectory(t, 'touro-config-');
    await writeFile(join(root, 'touro.config.js'), `
      module.exports = { discovery: { recursive: false }, encoding: { jpeg: { background: '#00ff00' } } };
    `);
    const image = await sharp({
      create: { width: 16, height: 16, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).png().toBuffer();
    await mkdir(join(root, 'nested'));
    await writeFile(join(root, 'top.png'), image);
    await writeFile(join(root, 'nested', 'nested.png'), image);

    const scan = runIn(root, 'scan');
    assert.equal(scan.code, 0, scan.stderr);
    assert.match(scan.stdout, /top\.png/);
    assert.doesNotMatch(scan.stdout, /nested/);

    const optimize = runIn(root, '--format', 'jpeg');
    assert.equal(optimize.code, 0, optimize.stderr);
    assert.deepEqual(await readdir(join(root, 'nested')), ['nested.png']);
    const [red, green, blue] = await sharp(join(root, 'top.jpg')).raw().toBuffer();
    assert.ok(red < 5 && green > 250 && blue < 5);
  });

  it('uses the configured PNG level without changing pixels or stripping the ICC profile', async (t) => {
    const root = await createTemporaryDirectory(t, 'touro-config-');
    const input = await sharp({
      create: { width: 64, height: 64, channels: 4, background: { r: 50, g: 100, b: 150, alpha: 0.5 } },
    }).withIccProfile('srgb').webp({ lossless: true }).toBuffer();
    const expected = await sharp(input).metadata();
    assert.ok(expected.icc);

    const sizes = [];
    for (const level of [0, 9]) {
      const cwd = join(root, String(level));
      await mkdir(cwd);
      await writeFile(join(cwd, 'touro.config.js'), `
        module.exports = { encoding: { png: { compressionLevel: ${level} } } };
      `);
      await writeFile(join(cwd, 'source.webp'), input);

      const result = runIn(cwd, '--format', 'png');
      assert.equal(result.code, 0, result.stderr);
      const output = await readFile(join(cwd, 'source.png'));
      sizes.push(output.length);
      assert.deepEqual(await sharp(output).raw().toBuffer(), await sharp(input).raw().toBuffer());
      assert.deepEqual((await sharp(output).metadata()).icc, expected.icc);
    }
    assert.ok(sizes[0] > sizes[1]);
  });

  it('uses configured directory exclusions for both scan and optimization', async (t) => {
    const root = await createTemporaryDirectory(t, 'touro-config-');
    await writeFile(join(root, 'touro.config.js'), `
      module.exports = { discovery: { excludedDirectories: ['Drafts'] } };
    `);
    const image = await sharp({
      create: { width: 16, height: 16, channels: 3, background: '#ff8000' },
    }).png().toBuffer();
    for (const directory of ['assets/drafts', 'build', '.hidden']) {
      await mkdir(join(root, directory), { recursive: true });
      await writeFile(join(root, directory, 'image.png'), image);
    }

    const scan = runIn(root, 'scan');
    assert.equal(scan.code, 0, scan.stderr);
    assert.match(scan.stdout, /build\/image\.png/);
    assert.doesNotMatch(scan.stdout, /drafts|\.hidden/);

    const optimize = runIn(root, '--format', 'webp');
    assert.equal(optimize.code, 0, optimize.stderr);
    assert.deepEqual(await readdir(join(root, 'build')), ['image.webp']);
    assert.deepEqual(await readdir(join(root, 'assets', 'drafts')), ['image.png']);
    assert.deepEqual(await readdir(join(root, '.hidden')), ['image.png']);
  });

  it('applies CommonJS settings from the working directory and lets scan arguments override them', async (t) => {
    const root = await createTemporaryDirectory(t, 'touro-config-');
    const assets = join(root, 'assets');
    await mkdir(assets);
    await writeFile(join(root, 'outside.png'), '1');
    await writeFile(join(assets, 'inside.png'), '2');
    await writeFile(join(assets, 'inside.webp'), '3');
    await writeFile(join(root, 'touro.config.js'), `
      module.exports = { scan: { directory: 'assets', format: 'png' }, output: { json: true } };
    `);

    const configured = runIn(root, 'scan');
    assert.equal(configured.code, 0, configured.stderr);
    assert.match(configured.stdout, /inside\.png/);
    assert.doesNotMatch(configured.stdout, /outside|inside\.webp/);

    const overridden = runIn(root, 'scan', '.', '--format', 'webp');
    assert.equal(overridden.code, 0, overridden.stderr);
    assert.match(overridden.stdout, /assets\/inside\.webp/);
    assert.doesNotMatch(overridden.stdout, /\.png/);

    const info = runIn(root, 'info');
    assert.equal(info.code, 0, info.stderr);
    assert.equal(JSON.parse(info.stdout).name, 'touro');
  });

  it('reports invalid configuration before scanning and keeps help available', async (t) => {
    const root = await createTemporaryDirectory(t, 'touro-config-');
    await writeFile(join(root, 'touro.config.js'), 'module.exports = { optimize: { quality: 0 } };');

    const result = runIn(root, 'scan');
    assert.equal(result.code, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /touro\.config\.js.*optimize\.quality.*1 to 100/);
    assert.equal(runIn(root, '--help').code, 0);
  });

  it('uses ES module optimization settings and honors an explicit format override', async (t) => {
    const root = await createTemporaryDirectory(t, 'touro-config-');
    await writeFile(join(root, 'package.json'), '{"type":"module"}');
    await writeFile(join(root, 'touro.config.js'), `
      export default { optimize: { directory: 'assets', format: 'webp', quality: 65 } };
    `);
    const assets = join(root, 'assets');
    await mkdir(assets);
    const image = await sharp({
      create: { width: 16, height: 16, channels: 3, background: '#ff8000' },
    }).png().toBuffer();

    await writeFile(join(assets, 'configured.png'), image);
    const configured = runIn(root);
    assert.equal(configured.code, 0, configured.stderr);
    assert.deepEqual(await readdir(assets), ['configured.webp']);

    await mkdir(join(root, 'other'));
    await writeFile(join(root, 'other', 'overridden.png'), image);
    const overridden = runIn(root, 'other', '--format', 'jpeg', '--quality', '90');
    assert.equal(overridden.code, 0, overridden.stderr);
    assert.deepEqual(await readdir(join(root, 'other')), ['overridden.jpg']);
  });
});

describe('scan', () => {
  it('scans the current directory recursively and filters by format', async (t) => {
    const root = await createTemporaryDirectory(t, 'touro-scan-');
    const nested = join(root, 'client assets', 'gallery');
    await mkdir(nested, { recursive: true });
    await writeFile(join(root, 'cover.JPG'), '123');
    await writeFile(join(root, 'notes.jpg.txt'), 'ignored');
    await writeFile(join(nested, 'portrait.jpeg'), '4567');
    await writeFile(join(nested, 'icon.PNG'), '89012');
    await writeFile(join(nested, 'thumb.webp'), '345678');
    await symlink(nested, join(root, 'linked gallery'), 'junction');

    const all = runIn(root, 'scan');
    assert.equal(all.code, 0, all.stderr);
    const lines = all.stdout.trimEnd().split('\n');
    assert.equal(lines[0], 'FORMAT         SIZE  PATH');
    assert.ok(lines.includes('JPEG            3 B  cover.JPG'));
    assert.ok(lines.includes('PNG             5 B  client assets/gallery/icon.PNG'));
    assert.ok(lines.includes('WEBP            6 B  client assets/gallery/thumb.webp'));
    assert.deepEqual(lines.slice(-2), ['', '4 images found · 18 B total']);
    assert.doesNotMatch(all.stdout, /notes|linked gallery/);

    const jpeg = run('scan', root, '--format', 'jpeg');
    assert.equal(jpeg.code, 0, jpeg.stderr);
    assert.match(jpeg.stdout, /JPEG +4 B +client assets\/gallery\/portrait\.jpeg/);
    assert.match(jpeg.stdout, /2 images found · 7 B total/);
  });

  it('returns an empty summary or a clear error for an invalid input', async (t) => {
    const root = await createTemporaryDirectory(t, 'touro-scan-');

    const empty = run('scan', root);
    assert.equal(empty.code, 0, empty.stderr);
    assert.equal(empty.stdout, '0 images found · 0 B total\n');

    const missing = run('scan', join(root, 'missing'));
    assert.equal(missing.code, 1);
    assert.equal(missing.stdout, '');
    assert.equal(missing.stderr, `error: Could not scan "${join(root, 'missing')}": the path does not exist.\n`);
    assert.doesNotMatch(missing.stderr, /\n\s+at /);

    const verbose = run('scan', join(root, 'missing'), '--verbose');
    assert.equal(verbose.code, 1);
    assert.match(verbose.stderr, /debug: TouroError: touro\.operationFailed/);
    assert.match(verbose.stderr, /\[cause\]: Error: ENOENT/);
    assert.match(verbose.stderr, /\n\s+at /);

    const invalid = run('scan', root, '--format', 'gif');
    assert.equal(invalid.code, 2);
    assert.match(invalid.stderr, /Allowed choices are jpeg, png, webp/);
    assert.match(invalid.stderr, /Run "touro --help" for usage\./);
  });
});

describe('optimize', () => {
  it('reports colliding destinations before reading image contents and processes the rest', async (t) => {
    const root = await createTemporaryDirectory(t, 'touro-optimize-');
    await writeFile(join(root, 'cover.jpg'), 'invalid');
    await writeFile(join(root, 'cover.png'), 'invalid');
    await sharp({
      create: { width: 8, height: 8, channels: 3, background: '#117799' },
    }).png().toFile(join(root, 'logo.png'));

    const result = runIn(root, '--format', 'webp');
    assert.equal(result.code, 1);
    assert.match(result.stderr, /error: Could not process "cover\.jpg": multiple images would produce the same file,/);
    assert.match(result.stderr, /error: Could not process "cover\.png": multiple images would produce the same file,/);
    assert.match(result.stdout, /3 images processed\n0 optimized · 1 converted · 0 unchanged · 2 failed/);
    assert.deepEqual((await readdir(root)).filter((name) => name !== '.cache').sort(),
      ['cover.jpg', 'cover.png', 'logo.webp']);
  });

  it('converts a nested image in its directory and reports its new path and sizes', async (t) => {
    const root = await createTemporaryDirectory(t, 'touro-optimize-');
    const directory = 'client assets';
    const nested = join(root, directory, 'assets');
    await mkdir(nested, { recursive: true });
    await writeFile(join(root, 'outside.png'), 'outside');
    const name = 'a long image filename that extends beyond a typical terminal width';
    const input = join(nested, `${name}.png`);
    const original = await sharp({
      create: { width: 70, height: 70, channels: 4, background: '#ff550080' },
    }).png().toBuffer();
    await writeFile(input, original);

    const result = runIn(root, `./${directory}`, '--format', 'webp', '--quality', '80');
    assert.equal(result.code, 0, result.stderr);
    assert.equal(await readFile(join(root, 'outside.png'), 'utf8'), 'outside');
    assert.deepEqual(await readdir(nested), [`${name}.webp`]);
    const output = await readFile(join(nested, `${name}.webp`));
    const metadata = await sharp(output).metadata();
    assert.equal(metadata.format, 'webp');
    assert.equal(metadata.hasAlpha, true);
    const saved = original.length - output.length;
    const percent = (saved / original.length * 100).toFixed(1);
    const [header, row, separator, count, breakdown, totalsSeparator, totals] = result.stdout.split('\n');
    const pathColumn = header.indexOf('PATH');
    assert.equal(header, 'FORMAT        ORIGINAL      FINAL       SAVED  REDUCTION  PATH');
    assert.equal(row.slice(0, pathColumn).trim().split(/ {2,}/).join('|'),
      `PNG → WEBP|${original.length} B|${output.length} B|${saved} B|${percent}%`);
    assert.equal(row.slice(pathColumn), `assets/${name}.webp`);
    assert.equal(separator, '');
    assert.equal(count, '1 image processed');
    assert.equal(breakdown, '0 optimized · 1 converted · 0 unchanged · 0 failed');
    assert.equal(totalsSeparator, '');
    assert.equal(totals, `${original.length} B → ${output.length} B · ${saved} B saved (${percent}%)`);
  });

  it('optimizes an absolute directory path', async (t) => {
    const root = await createTemporaryDirectory(t, 'touro-absolute-');
    const directory = join(root, 'absolute assets');
    await mkdir(directory);
    const file = join(directory, 'logo.png');
    const original = await sharp({
      create: { width: 32, height: 32, channels: 3, background: '#117799' },
    }).png({ compressionLevel: 0 }).toBuffer();
    await writeFile(file, original);

    const result = runIn(root, directory);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /1 optimized/);
    assert.ok((await readFile(file)).length < original.length);
  });

  it('reports missing directories and rejects files as a target', async (t) => {
    const root = await createTemporaryDirectory(t, 'touro-invalid-directory-');
    await writeFile(join(root, 'logo.png'), 'unchanged');

    const missing = runIn(root, 'missing');
    assert.equal(missing.code, 1);
    assert.equal(missing.stdout, '');
    assert.equal(missing.stderr, 'error: Could not optimize "missing": the path does not exist.\n');

    const file = runIn(root, 'logo.png');
    assert.equal(file.code, 1);
    assert.equal(file.stdout, '');
    assert.equal(file.stderr, 'error: Could not optimize "logo.png": choose a directory.\n');
    assert.equal(await readFile(join(root, 'logo.png'), 'utf8'), 'unchanged');
  });

  it('treats names after -- as directories even when they match a command or an option', async (t) => {
    const root = await createTemporaryDirectory(t, 'touro-literal-directory-');
    await writeFile(join(root, 'outside.png'), 'outside');
    for (const name of ['--help', 'scan', 'info']) {
      await mkdir(join(root, name));
      const result = runIn(root, '--', name);
      assert.equal(result.code, 0, result.stderr);
      assert.match(result.stdout, /^0 images processed/m);
    }
    const scan = runIn(root, 'scan', '--', 'scan');
    assert.equal(scan.code, 0, scan.stderr);
    assert.equal(scan.stdout, '0 images found · 0 B total\n');
  });

  it('optimizes in place recursively, skipping internal directories and preserving invalid files', async (t) => {
    const root = await createTemporaryDirectory(t, 'touro-optimize-');
    const nested = join(root, 'assets', 'nested');
    await mkdir(nested, { recursive: true });
    const original = await sharp({
      create: { width: 100, height: 100, channels: 3, background: '#117799' },
    }).png({ compressionLevel: 0 }).toBuffer();
    await writeFile(join(nested, 'photo.PNG'), original);
    await writeFile(join(root, 'assets', 'invalid.jpg'), 'invalid');
    await writeFile(join(root, 'notes.txt'), 'notes');
    for (const name of ['.git', 'node_modules', 'dist']) {
      await mkdir(join(root, name));
      await writeFile(join(root, name, 'ignored.png'), original);
    }

    const result = runIn(root);
    assert.equal(result.code, 1);
    assert.equal(result.stderr,
      'error: Could not process "assets/invalid.jpg": the image is damaged or uses an unsupported format.\n');
    assert.match(result.stdout, /2 images processed\n1 optimized · 0 converted · 0 unchanged · 1 failed/);
    const optimized = await readFile(join(nested, 'photo.PNG'));
    assert.ok(optimized.length < original.length);
    assert.equal(await readFile(join(root, 'assets', 'invalid.jpg'), 'utf8'), 'invalid');
    assert.equal(await readFile(join(root, 'notes.txt'), 'utf8'), 'notes');
    for (const name of ['.git', 'node_modules', 'dist']) {
      assert.deepEqual(await readFile(join(root, name, 'ignored.png')), original);
    }

    const retry = runIn(root, '--quality', '80', '--verbose');
    assert.equal(retry.code, 1);
    assert.match(retry.stdout, /2 images processed\n0 optimized · 0 converted · 1 unchanged · 1 failed/);
    assert.match(retry.stderr, /debug: TouroError: touro\.io\.decodeFailed/);
    assert.match(retry.stderr, /\[cause\]: Error:/);
    assert.deepEqual(await readdir(nested), ['photo.PNG']);
    assert.deepEqual(await readFile(join(nested, 'photo.PNG')), optimized);
    assert.deepEqual((await readdir(join(root, 'assets'))).sort(), ['invalid.jpg', 'nested']);
  });
});
