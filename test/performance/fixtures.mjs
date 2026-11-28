import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { IMAGE_EXTENSIONS, IMAGE_FORMAT } from '../../src/constants/images.js';

const formats = [
  { name: IMAGE_FORMAT.JPEG, options: { quality: 100, chromaSubsampling: '4:4:4' } },
  { name: IMAGE_FORMAT.PNG, options: { compressionLevel: 0 } },
  { name: IMAGE_FORMAT.WEBP, options: { lossless: true } },
];

async function discoveryTree(root, count) {
  const directory = join(root, `discovery-${count}`);
  for (let start = 0; start < count; start += 25) {
    const folder = join(directory, `album-${Math.floor(start / 100)}`, `folder-${start / 25}`);
    await mkdir(folder, { recursive: true });
    for (let index = start; index < Math.min(count, start + 25); index++) {
      const format = formats[index % formats.length].name;
      await writeFile(join(folder, `image-${index}${IMAGE_EXTENSIONS[format][0]}`), '');
    }
    await writeFile(join(folder, 'notes.txt'), 'not an image');
  }
  return { directory, count };
}

function imagePixels(size) {
  const pixels = Buffer.alloc(size * size * 3);
  let noise = 1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const offset = (y * size + x) * 3;
      // Use fixed-seed grain so input stays reproducible without being trivially compressible.
      noise = (Math.imul(noise, 1664525) + 1013904223) >>> 0;
      const grain = noise >>> 28;
      pixels[offset] = (3 * x + y + grain) % 256;
      pixels[offset + 1] = (x + 2 * y + grain) % 256;
      pixels[offset + 2] = ((x ^ y) + grain) % 256;
    }
  }
  return pixels;
}

async function imageBatch(root, tag, images, copies) {
  const template = join(root, 'templates', tag);
  const directory = join(root, 'work', tag);
  await mkdir(template, { recursive: true });
  let bytes = 0;
  for (const { name, data } of images) {
    const extension = IMAGE_EXTENSIONS[name][0];
    for (let index = 0; index < copies; index++) {
      await writeFile(join(template, `image-${index}${extension}`), data);
      bytes += data.length;
    }
  }
  return { template, directory, count: images.length * copies, bytes };
}

export async function prepareFixtures(root) {
  const discovery = [];
  for (const count of [100, 500, 2000]) {
    discovery.push(await discoveryTree(root, count));
  }

  const optimization = [];
  const smallImages = [];
  for (const size of [256, 1024]) {
    const pixels = imagePixels(size);
    for (const { name, options } of formats) {
      const data = await sharp(pixels, { raw: { width: size, height: size, channels: 3 } })
        .toFormat(name, options)
        .toBuffer();
      const image = { name, data };
      if (size === 256) smallImages.push(image);
      const tag = `${name}-${size}`;
      const batch = await imageBatch(root, tag, [image], 3);
      optimization.push({ ...batch, size, name: `${name.toUpperCase()} ${size}x${size}` });
    }
  }
  const partitions = [];
  for (const part of ['part-a', 'part-b']) {
    partitions.push(await imageBatch(root, join('mixed', part), smallImages, 8));
  }
  const largeBatch = {
    template: join(root, 'templates', 'mixed'),
    directory: join(root, 'work', 'mixed'),
    count: partitions.reduce((total, part) => total + part.count, 0),
    bytes: partitions.reduce((total, part) => total + part.bytes, 0),
  };
  return { discovery, optimization, largeBatch, partitions };
}
