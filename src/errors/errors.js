export class TouroError extends Error {
  constructor(code, { cause, context } = {}) {
    super(code, cause === undefined ? undefined : { cause });
    this.name = 'TouroError';
    this.code = code;
    this.context = context;
  }
}

export const INFRASTRUCTURE_ERROR = Object.freeze({
  DECODE_FAILED: 'touro.io.decodeFailed',
  ENCODE_FAILED: 'touro.io.encodeFailed',
  CLEANUP_FAILED: 'touro.io.cleanupFailed',
  RUNTIME_LOAD_FAILED: 'touro.io.runtimeLoadFailed',
  RUNTIME_CACHE_INVALID: 'touro.io.runtimeCacheInvalid',
});

export async function rethrowAfterCleanup(cause, cleanup) {
  try {
    await cleanup();
  } catch (cleanupError) {
    throw new TouroError(INFRASTRUCTURE_ERROR.CLEANUP_FAILED, { cause, context: { cleanupError } });
  }
  throw cause;
}
