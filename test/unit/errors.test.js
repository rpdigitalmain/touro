import assert from 'node:assert/strict';
import { it, vi } from 'vitest';
import { INFRASTRUCTURE_ERROR, rethrowAfterCleanup, TouroError } from '../../src/errors/errors.js';
import { createLogger } from '../../src/terminal/logger.js';
import { presentImageFailure } from '../../src/terminal/presenters/errors.js';

it('writes plain diagnostics even when the terminal requests colors', (t) => {
  vi.stubEnv('NO_COLOR', undefined);
  vi.stubEnv('FORCE_COLOR', '1');
  t.onTestFinished(() => vi.unstubAllEnvs());

  const lines = [];
  const stderr = { isTTY: true, write: (line) => lines.push(line) };
  const logger = createLogger({ stderr, verbose: true });
  logger.warn('warning message');
  logger.error('error message');
  logger.debug('debug message');
  logger.debugError({ code: 42 });

  assert.deepEqual(lines, [
    'warning: warning message\n',
    'error: error message\n',
    'debug: debug message\n',
    'debug: { code: 42 }\n',
  ]);
});

it('keeps the error code, context and native cause', () => {
  const cause = new Error('Decoder failure');
  const context = { source: 'broken.png' };
  const error = new TouroError(INFRASTRUCTURE_ERROR.DECODE_FAILED, { cause, context });

  assert.ok(error instanceof Error);
  assert.ok(error instanceof TouroError);
  assert.equal(error.code, 'touro.io.decodeFailed');
  assert.equal(error.cause, cause);
  assert.equal(error.context, context);
});

it('preserves the primary error even when cleanup also fails', async () => {
  const cause = new Error('Write failed');
  const cleanupError = new Error('Could not remove temporary file');

  await assert.rejects(rethrowAfterCleanup(cause, async () => {}), (error) => error === cause);
  await assert.rejects(rethrowAfterCleanup(cause, async () => { throw cleanupError; }), (error) => {
    assert.ok(error instanceof TouroError);
    assert.equal(error.code, INFRASTRUCTURE_ERROR.CLEANUP_FAILED);
    assert.equal(error.cause, cause);
    assert.equal(error.context.cleanupError, cleanupError);
    return true;
  });
});

it('presents both failures clearly and reserves technical details for verbose mode', async () => {
  const cause = Object.assign(new Error('ENOSPC from fs.write at .touro-temp'), { code: 'ENOSPC' });
  const cleanupError = Object.assign(new Error('EACCES from fs.unlink at .touro-temp'), { code: 'EACCES' });
  const lines = [];
  const stderr = { write: (line) => lines.push(line) };

  await assert.rejects(rethrowAfterCleanup(cause, async () => { throw cleanupError; }), (error) => {
    const failure = { path: 'cover.png', error };
    presentImageFailure(createLogger({ stderr }), failure);
    assert.deepEqual(lines, [
      'error: Could not process "cover.png": there is no space left on the device. Temporary-file cleanup also failed: permission denied.\n',
    ]);

    lines.length = 0;
    presentImageFailure(createLogger({ stderr, verbose: true }), failure);
    assert.match(lines[1], /debug: TouroError: touro\.io\.cleanupFailed/);
    assert.match(lines[1], /\[cause\]: Error: ENOSPC from fs\.write/);
    assert.match(lines[1], /cleanupError: Error: EACCES from fs\.unlink/);
    assert.match(lines[1], /\n\s+at /);
    return true;
  });
});
