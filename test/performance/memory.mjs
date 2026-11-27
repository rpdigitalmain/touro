import { performance } from 'node:perf_hooks';

const toMiB = (bytes) => (bytes / (1024 ** 2)).toFixed(2);

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

export async function runMemoryScenarios({ largestDiscovery, mixed }) {
  const rows = [await measureMemory(largestDiscovery.name, largestDiscovery.run)];
  for (let round = 1; round <= 3; round++) {
    const order = round % 2 === 0 ? [...mixed].reverse() : mixed;
    for (const { count, parallelism, beforeEach, run } of order) {
      await beforeEach();
      rows.push(await measureMemory(
        `Optimize ${count} images (concurrency ${parallelism}, round ${round})`,
        run,
      ));
    }
  }
  return rows;
}
