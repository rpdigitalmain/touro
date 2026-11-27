import assert from 'node:assert/strict';
import { lstat, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it } from 'node:test';
import { replaceImage } from '../../src/images/replace.js';
import { BatchOptimizer } from '../../src/images/batch-optimizer.js';
import { ImageSource } from '../../src/images/source.js';
import { IMAGE_ERROR } from '../../src/images/errors.js';
import { TouroError } from '../../src/shared/errors.js';

it('returns the same image record for a file and its parent directory', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'touro-image-source-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const image = join(root, 'cover.JPG');
  await writeFile(image, 'abc');

  const file = await ImageSource.open(image, { allowFile: true });
  const directory = await ImageSource.open(root);
  const records = [{ path: 'cover.JPG', format: 'jpeg', size: 3 }];
  assert.equal(file.root, directory.root);
  assert.deepEqual(await file.listImages({ format: 'jpeg' }), records);
  assert.deepEqual(await directory.listImages({ format: 'jpeg' }), records);
  assert.deepEqual(await file.listImages({ format: 'png' }), []);
  assert.deepEqual(await directory.listImages({ format: 'png' }), []);
});

it('preserves both paths and removes the temporary file when publication collides', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'touro-image-output-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'cover.png');
  const target = join(root, 'cover.webp');
  const original = Buffer.from('original');
  await writeFile(source, original);
  const stats = await lstat(source, { bigint: true });
  await writeFile(target, 'occupied');

  await assert.rejects(replaceImage(source, target, Buffer.from('replacement'), stats), (error) => {
    assert.ok(error instanceof TouroError);
    assert.equal(error.code, IMAGE_ERROR.TARGET_EXISTS);
    assert.deepEqual(error.context, { target });
    assert.equal(error.cause.code, 'EEXIST');
    return true;
  });
  assert.deepEqual(await readFile(source), original);
  assert.equal(await readFile(target, 'utf8'), 'occupied');
  assert.deepEqual((await readdir(root)).sort(), ['cover.png', 'cover.webp']);
});

it('keeps a source edited during encoding and cleans up the temporary file', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'touro-image-replace-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'cover.png');
  await writeFile(source, 'original');
  const stats = await lstat(source, { bigint: true });
  await writeFile(source, 'updated content');

  await assert.rejects(replaceImage(source, source, Buffer.from('optimized'), stats), {
    code: IMAGE_ERROR.SOURCE_CHANGED,
    context: { source },
  });
  assert.equal(await readFile(source, 'utf8'), 'updated content');
  assert.deepEqual(await readdir(root), ['cover.png']);
});

it('plans a batch and aggregates results with an injected processor', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'touro-image-batch-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const name of ['cover.jpg', 'cover.png', 'hero.jpeg', 'icon.png']) {
    await writeFile(join(root, name), 'abc');
  }

  const processed = [];
  const encoderError = new Error('Test encoder failed.');
  const optimizer = new BatchOptimizer(async () => ({
    async optimize(_root, job) {
      processed.push(job.targetPath);
      if (job.image.path === 'icon.png') throw encoderError;
      return { status: 'converted', originalSize: 3, finalSize: 2 };
    },
  }));
  const batch = await optimizer.run(root, { format: 'webp' });

  assert.deepEqual(processed, ['hero.webp', 'icon.webp']);
  assert.deepEqual(batch.failures.map(({ path }) => path), ['cover.jpg', 'cover.png', 'icon.png']);
  assert.ok(batch.failures[0].error instanceof TouroError);
  assert.equal(batch.failures[0].error.code, IMAGE_ERROR.TARGET_CONFLICT);
  assert.equal(batch.failures[2].error, encoderError);
  assert.equal(batch.results.length, 1);
  assert.deepEqual(batch.summary, { converted: 1, optimized: 0, unchanged: 0, originalSize: 3, finalSize: 2 });
});
