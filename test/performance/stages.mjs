import { copyFile, lstat, mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { defaults } from '../../src/config/configuration.js';
import { configureEncoder, imageFormatFor } from '../../src/images/formats.js';
import { replaceImage } from '../../src/images/replace.js';

export async function createStageScenarios(batches) {
  const scenarios = [];
  for (const batch of batches) {
    const [filename] = await readdir(batch.template);
    const source = join(batch.template, filename);
    const destination = join(batch.directory, filename);
    const original = await readFile(source);
    const format = imageFormatFor(filename);
    await mkdir(batch.directory, { recursive: true });

    const encoder = async (input) => {
      const pipeline = sharp(input, { failOn: 'warning' });
      const metadata = await pipeline.metadata();
      pipeline.autoOrient().keepIccProfile();
      configureEncoder(format, pipeline, metadata, defaults.optimize.quality);
      return pipeline;
    };
    const encode = async () => (await encoder(original)).toBuffer();
    const optimized = await encode();
    const output = join(batch.directory, '.benchmark-output');

    const stages = [
      { label: 'Read', bytes: original.length, run: async () => {
        await lstat(source, { bigint: true });
        await readFile(source);
      } },
      { label: 'Encode buffer-to-buffer', bytes: original.length, run: encode },
      { label: 'Encode file-to-file', bytes: original.length, run: async () => {
        await (await encoder(source)).toFile(output);
        await unlink(output);
      } },
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
        run: () => replaceImage(destination, destination, stats, (path) => writeFile(path, optimized)),
      });
    }

    for (const { label, bytes, run, beforeEach } of stages) {
      scenarios.push({ name: `${label} ${batch.name}`, count: 1, bytes, run, beforeEach });
    }
  }
  return scenarios;
}
