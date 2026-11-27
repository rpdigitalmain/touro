import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

// Set CLI_EXE to a standalone executable (npm run build:exe) to test it instead.
const exe = process.env.CLI_EXE;
const cli = fileURLToPath(new URL('../../bin/touro.js', import.meta.url));

/** Runs the CLI in a child process, exactly as a user would. */
function run(...args) {
  const [command, argv] = exe ? [exe, args] : [process.execPath, [cli, ...args]];
  const result = spawnSync(command, argv, {
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
