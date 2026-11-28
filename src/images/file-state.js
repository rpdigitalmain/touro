import { TouroError } from '../errors/errors.js';
import { IMAGE_ERROR } from './errors.js';

export function sameFile(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

export function checkSource(source, original, current) {
  if (!current.isFile() || !sameFile(current, original) ||
      current.size !== original.size || current.mtimeNs !== original.mtimeNs ||
      current.ctimeNs !== original.ctimeNs) {
    throw new TouroError(IMAGE_ERROR.SOURCE_CHANGED, { context: { source } });
  }
}
