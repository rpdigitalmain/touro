import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Bench } from 'tinybench';
import { formatSize } from '../../src/terminal/format.js';
import { prepareFixtures } from './fixtures.mjs';
import { runMemoryScenarios } from './memory.mjs';
import { createScenarios } from './scenarios.mjs';
import { createStageScenarios } from './stages.mjs';

function timingRow(bench, { name, count, bytes }) {
  const { result, runs } = bench.getTask(name);
  if (result?.state === 'errored') throw new Error(`Benchmark failed: ${name}`, { cause: result.error });
  if (result?.state !== 'completed') throw new Error(`Benchmark did not complete: ${name}`);
  const { latency } = result;
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
}

async function run(root) {
  const fixtures = await prepareFixtures(root);
  const scenarios = await createScenarios(root, fixtures);
  const stages = await createStageScenarios(fixtures.optimization.filter(({ size }) => size === 1024));
  const timings = [
    ...scenarios.startup,
    ...scenarios.discovery,
    ...scenarios.optimization,
    ...stages,
    ...scenarios.mixed,
  ];

  const bench = new Bench({
    time: 300,
    iterations: 8,
    warmup: true,
    warmupTime: 100,
    warmupIterations: 2,
    concurrency: null,
  });
  for (const { name, run, async: isAsync = true, beforeEach } of timings) {
    bench.add(name, run, { async: isAsync, beforeEach });
  }
  await bench.run();

  console.log(`Touro benchmarks | Node ${process.version} | ${process.platform}/${process.arch}`);
  console.table(timings.map((scenario) => timingRow(bench, scenario)));

  const memory = await runMemoryScenarios(scenarios);
  console.log('Memory samples (RSS and V8 heap)');
  console.table(memory);
}

const root = await mkdtemp(join(tmpdir(), 'touro-bench-'));
try {
  await run(root);
} finally {
  await rm(root, { recursive: true, force: true });
}
