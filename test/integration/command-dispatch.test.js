import assert from 'node:assert/strict';
import { afterEach, describe, it, vi } from 'vitest';
import { main } from '../../src/cli.js';

describe('CLI command dispatch', () => {
  afterEach(() => vi.restoreAllMocks());

  it('rejects unknown commands', async () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    assert.equal(await main(['nope']), 1);
    assert.match(stderr.mock.calls[0][0], /unknown command.*nope/i);
  });

  it('reports bad option values with exit code 2', async () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    assert.equal(await main(['optimize', '--quality', 'zero']), 2);
    assert.match(stderr.mock.calls[0][0], /Quality must be an integer from 1 to 100/);
  });

  it('reports unexpected errors and shows the stack only with verbose output', async () => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => { throw new Error('Unexpected write failure'); });
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    assert.equal(await main(['info', '--no-color']), 1);
    assert.deepEqual(stderr.mock.calls.map(([line]) => line), [
      'error: An unexpected error occurred. Rerun with --verbose for details.\n',
    ]);

    stderr.mockClear();
    assert.equal(await main(['info', '--no-color', '--verbose']), 1);
    assert.match(stderr.mock.calls[1][0], /debug: Error: Unexpected write failure\n\s+at /);
  });
});
