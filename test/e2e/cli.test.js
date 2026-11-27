import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import sharp from 'sharp';

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
      NO_COLOR: '1',
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
    assert.match(stdout, /Optimize JPEG, PNG, and WebP images in place/);
    assert.match(stdout, /--format/);
    assert.match(stdout, /--quality/);
    assert.doesNotMatch(stdout, /--output/);
    assert.match(stdout, /Commands:/);
    assert.match(stdout, /greet/);
  });

  it('reports an empty optimization run without arguments', async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'touro-empty-'));
    t.after(() => rm(root, { recursive: true, force: true }));
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

  it('runs a command with options', () => {
    const { code, stdout } = run('greet', 'Ada', '--shout', '-t', '2');
    assert.equal(code, 0);
    assert.equal(stdout, 'HELLO, ADA!\nHELLO, ADA!\n');
  });

  it('reports unknown options with exit code 2', () => {
    const { code, stderr } = run('greet', '--bogus');
    assert.equal(code, 2);
    assert.match(stderr, /bogus/);
    assert.equal(run('--output', 'obsolete').code, 2);
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

describe('scan', () => {
  it('scans the current directory recursively and filters by format', async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'touro-scan-'));
    t.after(() => rm(root, { recursive: true, force: true }));
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
    const root = await mkdtemp(join(tmpdir(), 'touro-scan-'));
    t.after(() => rm(root, { recursive: true, force: true }));

    const empty = run('scan', root);
    assert.equal(empty.code, 0, empty.stderr);
    assert.equal(empty.stdout, '0 images found · 0 B total\n');

    const missing = run('scan', join(root, 'missing'));
    assert.equal(missing.code, 1);
    assert.equal(missing.stdout, '');
    assert.match(missing.stderr, /Could not scan.*missing/);

    const invalid = run('scan', root, '--format', 'gif');
    assert.equal(invalid.code, 2);
    assert.match(invalid.stderr, /Allowed choices are jpeg, png, webp/);
  });
});

describe('optimize', () => {
  it('reports colliding destinations before reading image contents and processes the rest', async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'touro-optimize-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    await writeFile(join(root, 'cover.jpg'), 'invalid');
    await writeFile(join(root, 'cover.png'), 'invalid');
    await sharp({
      create: { width: 8, height: 8, channels: 3, background: '#117799' },
    }).png().toFile(join(root, 'logo.png'));

    const result = runIn(root, '--format', 'webp');
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Failed: cover\.jpg \(Multiple inputs map to the same target:/);
    assert.match(result.stderr, /Failed: cover\.png \(Multiple inputs map to the same target:/);
    assert.match(result.stdout, /3 images processed\n0 optimized · 1 converted · 0 unchanged · 2 failed/);
    assert.deepEqual((await readdir(root)).filter((name) => name !== '.cache').sort(),
      ['cover.jpg', 'cover.png', 'logo.webp']);
  });

  it('converts a nested image in its directory and reports its new path and sizes', async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'touro-optimize-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const nested = join(root, 'assets');
    await mkdir(nested);
    const name = 'a long image filename that extends beyond a typical terminal width';
    const input = join(nested, `${name}.png`);
    const original = await sharp({
      create: { width: 70, height: 70, channels: 4, background: '#ff550080' },
    }).png().toBuffer();
    await writeFile(input, original);

    const result = runIn(root, '--format', 'webp', '--quality', '80');
    assert.equal(result.code, 0, result.stderr);
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

  it('optimizes in place recursively, skipping internal directories and preserving invalid files', async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'touro-optimize-'));
    t.after(() => rm(root, { recursive: true, force: true }));
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
    assert.match(result.stderr, /Failed: assets\/invalid\.jpg/);
    assert.match(result.stdout, /2 images processed\n1 optimized · 0 converted · 0 unchanged · 1 failed/);
    const optimized = await readFile(join(nested, 'photo.PNG'));
    assert.ok(optimized.length < original.length);
    assert.equal(await readFile(join(root, 'assets', 'invalid.jpg'), 'utf8'), 'invalid');
    assert.equal(await readFile(join(root, 'notes.txt'), 'utf8'), 'notes');
    for (const name of ['.git', 'node_modules', 'dist']) {
      assert.deepEqual(await readFile(join(root, name, 'ignored.png')), original);
    }

    const retry = runIn(root, '--quality', '80');
    assert.equal(retry.code, 1);
    assert.match(retry.stdout, /2 images processed\n0 optimized · 0 converted · 1 unchanged · 1 failed/);
    assert.deepEqual(await readdir(nested), ['photo.PNG']);
    assert.deepEqual(await readFile(join(nested, 'photo.PNG')), optimized);
    assert.deepEqual((await readdir(join(root, 'assets'))).sort(), ['invalid.jpg', 'nested']);
  });
});
