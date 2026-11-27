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
    assert.match(stdout, /Commands:/);
    assert.match(stdout, /greet/);
  });

  it('exits non-zero without a command', () => {
    assert.equal(run().code, 1);
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
    assert.match(all.stdout, /^FORMAT +SIZE +PATH/m);
    assert.match(all.stdout, /JPEG +3 B +cover\.JPG/);
    assert.match(all.stdout, /PNG +5 B +client assets\/gallery\/icon\.PNG/);
    assert.match(all.stdout, /WEBP +6 B +client assets\/gallery\/thumb\.webp/);
    assert.match(all.stdout, /Found 4 images · 18 B total/);
    assert.doesNotMatch(all.stdout, /notes|linked gallery/);

    const jpeg = run('scan', root, '--format', 'jpeg');
    assert.equal(jpeg.code, 0, jpeg.stderr);
    assert.match(jpeg.stdout, /JPEG +4 B +client assets\/gallery\/portrait\.jpeg/);
    assert.match(jpeg.stdout, /Found 2 images · 7 B total/);
  });

  it('returns an empty summary or a clear error for an invalid input', async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'touro-scan-'));
    t.after(() => rm(root, { recursive: true, force: true }));

    const empty = run('scan', root);
    assert.equal(empty.code, 0, empty.stderr);
    assert.match(empty.stdout, /Found 0 images · 0 B total/);

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
  it('converts one file, preserves its original, and measures the written output', async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'touro-optimize-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const input = join(root, 'original.png');
    const original = await sharp({
      create: { width: 70, height: 70, channels: 4, background: '#ff550080' },
    }).png().toBuffer();
    await writeFile(input, original);

    const result = runIn(root, 'optimize', input, '--format', 'webp');
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(await readFile(input), original);
    const output = await readFile(join(root, 'touro-output', 'original.webp'));
    const metadata = await sharp(output).metadata();
    assert.equal(metadata.format, 'webp');
    assert.equal(metadata.hasAlpha, true);
    assert.match(result.stdout, /FORMAT +ORIGINAL +FINAL +SAVED +CHANGE +PATH/);
    assert.match(result.stdout, new RegExp(`PNG → WEBP +${original.length} B +${output.length} B`));
    assert.match(result.stdout, /1 file · 1 converted · 0 optimized · 0 unchanged · 0 failed/);
  });

  it('continues after invalid images and protects existing batch outputs on retry', async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'touro-optimize-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const nested = join(root, 'assets', 'nested');
    await mkdir(nested, { recursive: true });
    const original = await sharp({
      create: { width: 100, height: 100, channels: 3, background: '#117799' },
    }).png({ compressionLevel: 0 }).toBuffer();
    await writeFile(join(nested, 'photo.PNG'), original);
    await writeFile(join(root, 'assets', 'invalid.jpg'), 'invalid');

    const result = runIn(root, 'optimize', './assets');
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Failed: invalid\.jpg/);
    assert.match(result.stdout, /2 files · 0 converted · 1 optimized · 0 unchanged · 1 failed/);
    const destination = join(root, 'assets', 'touro-output', 'nested');
    const optimized = await readFile(join(destination, 'photo.PNG'));
    assert.ok(optimized.length < original.length);
    assert.deepEqual(await readFile(join(nested, 'photo.PNG')), original);

    const retry = runIn(root, 'optimize', './assets');
    assert.equal(retry.code, 1);
    assert.match(retry.stdout, /2 files · 0 converted · 0 optimized · 0 unchanged · 2 failed/);
    assert.match(retry.stderr, /Output already exists/);
    assert.deepEqual(await readdir(destination), ['photo.PNG']);
    assert.deepEqual(await readFile(join(destination, 'photo.PNG')), optimized);
  });
});
