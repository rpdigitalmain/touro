import { execFileSync } from 'node:child_process';
import { cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { BatchOptimizer } from '../../src/images/batch-optimizer.js';
import { ImageProcessor } from '../../src/images/processor.js';
import { ImageSource } from '../../src/images/source.js';

const cli = fileURLToPath(new URL('../../bin/touro.js', import.meta.url));

async function discover({ directory, count }, includeSize = true) {
  const source = await ImageSource.open(directory);
  const images = await source.listImages({ includeSize });
  if (images.length !== count) throw new Error(`Expected ${count} discovered images, got ${images.length}.`);
}

async function optimize(optimizer, { directory, count }) {
  const { results, failures } = await optimizer.run(directory);
  if (failures.length > 0) {
    throw new AggregateError(failures.map(({ error }) => error), 'Benchmark optimization failed.');
  }
  if (results.length !== count) throw new Error(`Expected ${count} processed images, got ${results.length}.`);
}

function restoreBatch({ template, directory }) {
  return cp(template, directory, { recursive: true });
}

async function processPartitions(optimizer, partitions, parallelism) {
  if (parallelism === 1) {
    for (const part of partitions) await optimize(optimizer, part);
    return;
  }

  // Each runner owns the source and destination paths in its own directory.
  const outcomes = await Promise.allSettled(partitions.map((part) => optimize(optimizer, part)));
  const errors = outcomes.filter(({ status }) => status === 'rejected').map(({ reason }) => reason);
  if (errors.length > 0) throw new AggregateError(errors, 'Partitioned benchmark failed.');
}

export async function createScenarios(root, fixtures) {
  const processor = await ImageProcessor.create();
  const optimizer = new BatchOptimizer(() => processor);
  const { largeBatch, partitions } = fixtures;
  const largestTree = fixtures.discovery.at(-1);
  const largestDiscovery = {
    name: `Discover ${largestTree.count} images`,
    run: () => discover(largestTree),
  };

  const startup = ['--help', '--version'].map((flag) => ({
    name: `Startup ${flag}`,
    async: false,
    run: () => { execFileSync(process.execPath, [cli, flag], { cwd: root, timeout: 15_000 }); },
  }));
  const discovery = fixtures.discovery.map((tree) => ({
    name: `Discover ${tree.count} images (with size)`,
    count: tree.count,
    run: () => discover(tree),
  }));
  discovery.push({
    name: `Discover ${largestTree.count} images (paths only)`,
    count: largestTree.count,
    run: () => discover(largestTree, false),
  });
  const optimization = fixtures.optimization.map((batch) => ({
    name: `Optimize ${batch.name}`,
    count: batch.count,
    bytes: batch.bytes,
    beforeEach: () => restoreBatch(batch),
    run: () => optimize(optimizer, batch),
  }));
  const mixed = [1, 2].map((parallelism) => ({
    name: `Optimize ${largeBatch.count} mixed images (sub-batch concurrency ${parallelism})`,
    count: largeBatch.count,
    bytes: largeBatch.bytes,
    parallelism,
    beforeEach: () => restoreBatch(largeBatch),
    run: () => processPartitions(optimizer, partitions, parallelism),
  }));

  return { startup, discovery, optimization, mixed, largestDiscovery };
}
