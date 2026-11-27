import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { Bench } from 'tinybench';
import { BatchOptimizer } from '../../src/images/batch-optimizer.js';
import { ImageProcessor } from '../../src/images/processor.js';
import { ImageSource } from '../../src/images/source.js';
import { formatSize } from '../../src/terminal/format.js';
import { prepareFixtures } from './fixtures.mjs';
import { addStageBenchmarks } from './stages.mjs';

const cli = fileURLToPath(new URL('../../bin/touro.js', import.meta.url));
const toMiB = (bytes) => (bytes / (1024 ** 2)).toFixed(2);

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

async function measureMemory(scenario, operation) {
  const start = process.memoryUsage();
  let peakRSS = start.rss;
  let peakHeap = start.heapUsed;
  const timer = setInterval(() => {
    const sample = process.memoryUsage();
    peakRSS = Math.max(peakRSS, sample.rss);
    peakHeap = Math.max(peakHeap, sample.heapUsed);
  }, 10);
  const startTime = performance.now();
  try {
    await operation();
  } finally {
    clearInterval(timer);
  }
  const duration = performance.now() - startTime;
  const end = process.memoryUsage();
  return {
    Scenario: scenario,
    'Time (ms)': duration.toFixed(2),
    'RSS start (MiB)': toMiB(start.rss),
    'RSS peak (MiB)': toMiB(Math.max(peakRSS, end.rss)),
    'RSS end (MiB)': toMiB(end.rss),
    'RSS delta (MiB)': toMiB(end.rss - start.rss),
    'Heap peak (MiB)': toMiB(Math.max(peakHeap, end.heapUsed)),
    'Heap delta (MiB)': toMiB(end.heapUsed - start.heapUsed),
  };
}

async function run(root) {
  const fixtures = await prepareFixtures(root);
  const processor = await ImageProcessor.create();
  const optimizer = new BatchOptimizer(() => processor);
  const { largeBatch, partitions } = fixtures;
  const processPartitions = async (parallelism) => {
    if (parallelism === 2) {
      // Separate directories ensure each runner owns all of its source and destination paths.
      const outcomes = await Promise.allSettled(partitions.map((part) => optimize(optimizer, part)));
      const errors = outcomes.filter(({ status }) => status === 'rejected').map(({ reason }) => reason);
      if (errors.length > 0) throw new AggregateError(errors, 'Partitioned benchmark failed.');
      return;
    }
    for (const part of partitions) await optimize(optimizer, part);
  };
  const bench = new Bench({
    time: 300,
    iterations: 8,
    warmup: true,
    warmupTime: 100,
    warmupIterations: 2,
    concurrency: null,
  });
  const workloads = new Map();

  for (const flag of ['--help', '--version']) {
    bench.add(`Startup ${flag}`, () => {
      execFileSync(process.execPath, [cli, flag], { cwd: root, timeout: 15_000 });
    }, { async: false });
  }
  for (const tree of fixtures.discovery) {
    const name = `Discover ${tree.count} images (with size)`;
    workloads.set(name, tree);
    bench.add(name, () => discover(tree), { async: true });
  }
  const largestTree = fixtures.discovery.at(-1);
  const pathsOnly = `Discover ${largestTree.count} images (paths only)`;
  workloads.set(pathsOnly, largestTree);
  bench.add(pathsOnly, () => discover(largestTree, false), { async: true });
  for (const batch of fixtures.optimization) {
    const name = `Optimize ${batch.name}`;
    workloads.set(name, batch);
    bench.add(name, () => optimize(optimizer, batch), {
      async: true,
      beforeEach: () => restoreBatch(batch),
    });
  }
  await addStageBenchmarks(bench, workloads, fixtures.optimization.filter(({ size }) => size === 1024));

  for (const parallelism of [1, 2]) {
    const name = `Optimize ${largeBatch.count} mixed images (sub-batch concurrency ${parallelism})`;
    workloads.set(name, largeBatch);
    bench.add(name, () => processPartitions(parallelism), {
      async: true,
      beforeEach: () => restoreBatch(largeBatch),
    });
  }

  await bench.run();
  console.log(`Touro benchmarks | Node ${process.version} | ${process.platform}/${process.arch}`);
  console.table(bench.tasks.map(({ name, result, runs }) => {
    if (result?.state === 'errored') throw new Error(`Benchmark failed: ${name}`, { cause: result.error });
    if (result?.state !== 'completed') throw new Error(`Benchmark did not complete: ${name}`);
    const { latency } = result;
    const { count, bytes } = workloads.get(name) ?? {};
    return {
      Scenario: name,
      Samples: runs,
      'Images/run': count ?? '-',
      'Input size': bytes === undefined ? '-' : formatSize(bytes),
      'Mean (ms)': latency.mean.toFixed(2),
      'Median (ms)': latency.p50.toFixed(2),
      'Std dev (ms)': latency.sd.toFixed(2),
      'Images/s': count === undefined ? '-' : (count * 1000 / latency.mean).toFixed(1),
    };
  }));

  const memory = [
    await measureMemory(`Discover ${largestTree.count} images`, () => discover(largestTree)),
  ];
  for (let round = 1; round <= 3; round++) {
    for (const parallelism of round % 2 === 0 ? [2, 1] : [1, 2]) {
      await restoreBatch(largeBatch);
      memory.push(await measureMemory(
        `Optimize ${largeBatch.count} images (concurrency ${parallelism}, round ${round})`,
        () => processPartitions(parallelism),
      ));
    }
  }
  console.log('Memory samples (RSS and V8 heap)');
  console.table(memory);
}

const root = await mkdtemp(join(tmpdir(), 'touro-bench-'));
try {
  await run(root);
} finally {
  await rm(root, { recursive: true, force: true });
}
