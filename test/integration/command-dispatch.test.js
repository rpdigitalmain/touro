import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { main } from '../../src/cli.js';

describe('CLI command dispatch', () => {
  it('rejects unknown commands', async ({ mock }) => {
    const stderr = mock.method(process.stderr, 'write', () => true);

    assert.equal(await main(['nope']), 1);
    assert.match(stderr.mock.calls[0].arguments[0], /unknown command.*nope/i);
  });

  it('accepts global flags after a command alias', async ({ mock }) => {
    const stdout = mock.method(process.stdout, 'write', () => true);
    const stderr = mock.method(process.stderr, 'write', () => true);

    assert.equal(await main(['hello', '--verbose', '--no-color']), 0);
    assert.equal(stdout.mock.calls[0].arguments[0], 'Hello, world!\n');
    assert.match(stderr.mock.calls[0].arguments[0], /debug: greeting world/);
  });

  it('reports bad option values with exit code 2', async ({ mock }) => {
    const stderr = mock.method(process.stderr, 'write', () => true);

    assert.equal(await main(['greet', '--times', 'zero']), 2);
    assert.match(stderr.mock.calls[0].arguments[0], /--times must be a positive integer/);
  });

  it('reports unexpected errors and shows the stack only with verbose output', async ({ mock }) => {
    mock.method(process.stdout, 'write', () => { throw new Error('Unexpected write failure'); });
    const stderr = mock.method(process.stderr, 'write', () => true);

    assert.equal(await main(['info', '--no-color']), 1);
    assert.deepEqual(stderr.mock.calls.map(({ arguments: args }) => args[0]), [
      'error: An unexpected error occurred. Rerun with --verbose for details.\n',
    ]);

    stderr.mock.resetCalls();
    assert.equal(await main(['info', '--no-color', '--verbose']), 1);
    assert.match(stderr.mock.calls[1].arguments[0], /debug: Error: Unexpected write failure\n\s+at /);
  });
});
