import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function createTemporaryDirectory(test, prefix) {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  test.onTestFinished(() => rm(directory, { recursive: true, force: true }));
  return directory;
}
