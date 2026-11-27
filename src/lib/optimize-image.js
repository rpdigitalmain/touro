import { lstat, mkdir, open, readFile, unlink } from 'node:fs/promises';
import { dirname, extname, join, sep } from 'node:path';

function isAnimatedPng(bytes) {
  // APNG signals animation with an acTL chunk before the first image data chunk.
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (type === 'acTL') return true;
    if (type === 'IDAT') break;
    offset += bytes.readUInt32BE(offset) + 12;
  }
  return false;
}

async function ensureSubdirectories(output, path) {
  const folder = dirname(path);
  if (folder === '.') return;

  let current = output;
  for (const component of folder.split(sep)) {
    current = join(current, component);
    try {
      await mkdir(current);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (!(await lstat(current)).isDirectory()) {
        throw new Error(`Output path is not a real directory: ${current}`);
      }
    }
  }
}

async function writeNewFile(path, bytes) {
  let file;
  try {
    file = await open(path, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`Output already exists: ${path}`, { cause: error });
    throw error;
  }

  try {
    try {
      await file.writeFile(bytes);
    } finally {
      await file.close();
    }
  } catch (error) {
    await unlink(path);
    throw error;
  }
}

export async function optimizeImage(sharp, root, image, output, targetFormat, quality) {
  const original = await readFile(join(root, image.path));
  const pipeline = sharp(original, { failOn: 'warning' });
  const metadata = await pipeline.metadata();
  if (metadata.format !== image.format) {
    throw new Error(`File extension indicates ${image.format}, but the image is ${metadata.format}.`);
  }
  if (metadata.pages > 1 || (image.format === 'png' && isAnimatedPng(original))) {
    throw new Error('Animated images are not supported.');
  }

  const format = targetFormat ?? image.format;
  pipeline.autoOrient().keepIccProfile();
  if (format === 'jpeg') {
    if (metadata.hasAlpha) pipeline.flatten({ background: '#ffffff' });
    pipeline.jpeg({ quality, mozjpeg: true });
  } else if (format === 'png') {
    if (metadata.bitsPerSample === 16) pipeline.toColourspace('rgb16');
    pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
  } else {
    pipeline.webp({ quality });
  }

  const optimized = await pipeline.toBuffer();
  const converted = format !== image.format;
  const unchanged = !converted && optimized.length >= original.length;
  const bytes = unchanged ? original : optimized;
  const extension = extname(image.path);
  const targetPath = converted ? `${image.path.slice(0, -extension.length)}.${format === 'jpeg' ? 'jpg' : format}` : image.path;
  await ensureSubdirectories(output, targetPath);
  await writeNewFile(join(output, targetPath), bytes);

  return {
    path: image.path,
    inputFormat: image.format,
    outputFormat: format,
    originalSize: original.length,
    finalSize: bytes.length,
    status: converted ? 'converted' : unchanged ? 'unchanged' : 'optimized',
  };
}
