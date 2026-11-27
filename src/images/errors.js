import { TouroError } from '../errors/errors.js';

export const IMAGE_ERROR = Object.freeze({
  INVALID_SOURCE: 'touro.image.invalidSource',
  NOT_REGULAR: 'touro.image.notRegular',
  FORMAT_MISMATCH: 'touro.image.formatMismatch',
  ANIMATED: 'touro.image.animated',
  SOURCE_CHANGED: 'touro.image.sourceChanged',
  TARGET_CONFLICT: 'touro.image.targetConflict',
  TARGET_EXISTS: 'touro.image.targetExists',
});

export function targetExistsError(target, cause) {
  return new TouroError(IMAGE_ERROR.TARGET_EXISTS, { cause, context: { target } });
}
