export const PLATFORM = Object.freeze({
  WINDOWS: 'win32',
  LINUX: 'linux',
});

export const EXIT_CODE = Object.freeze({
  SUCCESS: 0,
  FAILURE: 1,
  INVALID_USAGE: 2,
});

export const OPERATION_FAILED = 'touro.operationFailed';
export const PARTIAL_FAILURE = 'touro.batchPartialFailure';
export const UNSUPPORTED_PLATFORM = 'touro.unsupportedPlatform';
export const DEFAULT_SOURCE = '.';
