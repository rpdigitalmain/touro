import { OPERATION_FAILED } from '../constants/application.js';
import { TouroError } from '../errors/errors.js';

export async function runOperation(operation, path, execute) {
  try {
    return await execute();
  } catch (cause) {
    throw new TouroError(OPERATION_FAILED, { cause, context: { operation, path } });
  }
}
