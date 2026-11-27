import { IMAGE_ERROR } from '../../images/errors.js';
import { OPERATION_FAILED, UNSUPPORTED_PLATFORM } from '../../constants/application.js';
import { INFRASTRUCTURE_ERROR, TouroError } from '../../errors/errors.js';
import { displayPath, escapeControls } from '../format.js';

const unexpected = 'an unexpected error occurred. Rerun with --verbose for details.';

function quotePath(path) {
  return `"${path.replaceAll('"', '\\"')}"`;
}

function describeError(error, fallback = unexpected) {
  if (!(error instanceof TouroError)) {
    if (!(error instanceof Error)) return fallback;
    switch (error.code) {
      case 'ENOENT':
        return 'the path does not exist.';
      case 'ENOTDIR':
        return 'a parent path is not a directory.';
      case 'EACCES':
      case 'EPERM':
        return 'permission denied.';
      case 'ENOSPC':
        return 'there is no space left on the device.';
      case 'EROFS':
        return 'the file system is read-only.';
      case 'EBUSY':
        return 'the file or directory is in use.';
      case 'EISDIR':
        return 'the path points to a directory.';
      case 'ENAMETOOLONG':
        return 'the path is too long.';
      case 'EIO':
        return 'the device could not read or write the file.';
      case 'ENOTSUP':
      case 'EOPNOTSUPP':
        return 'the file system does not support this operation.';
      default:
        return fallback;
    }
  }

  const { code, cause, context } = error;
  switch (code) {
    case IMAGE_ERROR.INVALID_SOURCE:
      return context.allowFile ? 'choose a directory or a JPEG, PNG, or WebP file.' : 'choose a directory.';
    case IMAGE_ERROR.NOT_REGULAR:
      return 'the path does not point to a regular image file.';
    case IMAGE_ERROR.FORMAT_MISMATCH:
      return `the extension indicates ${context.expected}, but the file contains a ${context.actual} image.`;
    case IMAGE_ERROR.ANIMATED:
      return 'animated images are not supported.';
    case IMAGE_ERROR.SOURCE_CHANGED:
      return 'the source file changed during optimization.';
    case IMAGE_ERROR.TARGET_CONFLICT:
      return `multiple images would produce the same file, ${quotePath(context.target)}.`;
    case IMAGE_ERROR.TARGET_EXISTS:
      return `the destination ${quotePath(context.target)} already exists.`;
    case INFRASTRUCTURE_ERROR.DECODE_FAILED:
      return 'the image is damaged or uses an unsupported format.';
    case INFRASTRUCTURE_ERROR.ENCODE_FAILED:
      return `the image could not be encoded as ${context.format}.`;
    case INFRASTRUCTURE_ERROR.RUNTIME_LOAD_FAILED:
      return `the image processing engine could not start: ${describeError(cause, 'rerun with --verbose for details.')}`;
    case INFRASTRUCTURE_ERROR.RUNTIME_CACHE_INVALID:
      return 'the image processing cache path is not a directory.';
    case INFRASTRUCTURE_ERROR.CLEANUP_FAILED:
      return `${describeError(cause)} Temporary-file cleanup also failed: ${describeError(context.cleanupError, 'rerun with --verbose for details.')}`;
    case UNSUPPORTED_PLATFORM:
      return `Touro supports Linux and Windows. The current platform is ${context.platform}.`;
    default:
      return fallback;
  }
}

function presentOperationFailure(logger, operation, path, error) {
  const message = `Could not ${operation} ${quotePath(path)}: ${describeError(error)}`;
  logger.error(escapeControls(message), { color: false });
}

export function presentError(logger, error) {
  if (error instanceof TouroError && error.code === OPERATION_FAILED) {
    presentOperationFailure(logger, error.context.operation, error.context.path, error.cause);
  } else {
    const message = describeError(error);
    logger.error(escapeControls(message[0].toUpperCase() + message.slice(1)));
  }
  logger.debugError(error);
}

export function presentImageFailure(logger, { path, error }) {
  presentOperationFailure(logger, 'process', displayPath(path), error);
  logger.debugError(error);
}
