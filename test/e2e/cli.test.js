import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

// Set CLI_EXE to a standalone executable (npm run build:exe) to test it instead.
const exe = process.env.CLI_EXE;
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
    env: { ...process.env, NO_COLOR: '1' },
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
