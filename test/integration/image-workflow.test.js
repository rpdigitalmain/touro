import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it } from 'node:test';
import { writeImageOutput } from '../../src/lib/image-output.js';
import { optimizeBatch } from '../../src/lib/optimize-batch.js';
import { openImageSource } from '../../src/lib/scan-images.js';

it('returns the same image record for a file and its parent directory', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'touro-image-source-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const image = join(root, 'cover.JPG');
  await writeFile(image, 'abc');

  const file = await openImageSource(image, { allowFile: true });
  const directory = await openImageSource(root);
  const records = [{ path: 'cover.JPG', format: 'jpeg', size: 3 }];
  assert.equal(file.root, directory.root);
  assert.deepEqual(await file.listImages({ format: 'jpeg' }), records);
  assert.deepEqual(await directory.listImages({ format: 'jpeg' }), records);
  assert.deepEqual(await file.listImages({ format: 'png' }), []);
  assert.deepEqual(await directory.listImages({ format: 'png' }), []);
});

it('protects an existing output when invoked directly', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'touro-image-output-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join('nested', 'cover.png');
  const original = Buffer.from('original');
  await writeImageOutput(root, path, original);

  await assert.rejects(writeImageOutput(root, path, Buffer.from('replacement')), /Output already exists/);
  assert.deepEqual(await readFile(join(root, path)), original);
});

it('plans a batch and aggregates results with an injected processor', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'touro-image-batch-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const name of ['cover.jpg', 'cover.png', 'hero.jpeg', 'icon.png']) {
    await writeFile(join(root, name), 'abc');
  }

  const processed = [];
  const batch = await optimizeBatch(root, {
    format: 'webp',
    createProcessor: async () => async (_root, _output, job) => {
      processed.push(job.targetPath);
      if (job.image.path === 'icon.png') throw new Error('Test encoder failed.');
      return { status: 'converted', originalSize: 3, finalSize: 2 };
    },
  });

  assert.deepEqual(processed, ['hero.webp', 'icon.webp']);
  assert.deepEqual(batch.failures.map(({ path }) => path), ['cover.jpg', 'cover.png', 'icon.png']);
  assert.equal(batch.results.length, 1);
  assert.deepEqual(batch.summary, { converted: 1, optimized: 0, unchanged: 0, originalSize: 3, finalSize: 2 });
});
