import { copyFile, lstat, mkdir, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { OPTIMIZATION_QUALITY } from '../../src/constants/images.js';
import { configureEncoder, imageFormatFor } from '../../src/images/formats.js';
import { replaceImage } from '../../src/images/replace.js';

export async function addStageBenchmarks(bench, workloads, batches) {
  for (const batch of batches) {
    const [filename] = await readdir(batch.template);
    const source = join(batch.template, filename);
    const destination = join(batch.directory, filename);
    const original = await readFile(source);
    const format = imageFormatFor(filename);
    await mkdir(batch.directory, { recursive: true });

    const encode = async () => {
      const pipeline = sharp(original, { failOn: 'warning' });
      const metadata = await pipeline.metadata();
      pipeline.autoOrient().keepIccProfile();
      configureEncoder(format, pipeline, metadata, OPTIMIZATION_QUALITY.DEFAULT);
      return pipeline.toBuffer();
    };
    const optimized = await encode();

    const stages = [
      { label: 'Read', bytes: original.length, run: async () => {
        await lstat(source, { bigint: true });
        await readFile(source);
      } },
      { label: 'Encode', bytes: original.length, run: encode },
    ];
    if (optimized.length < original.length) {
      let stats;
      stages.push({
        label: 'Replace',
        bytes: optimized.length,
        beforeEach: async () => {
          await copyFile(source, destination);
          stats = await lstat(destination, { bigint: true });
        },
        run: () => replaceImage(destination, destination, optimized, stats),
      });
    }

    for (const { label, bytes, run, beforeEach } of stages) {
      const name = `${label} ${batch.name}`;
      workloads.set(name, { count: 1, bytes });
      bench.add(name, run, { async: true, beforeEach });
    }
  }
}
