import { displayPath, formatSize, writeTable } from '../format.js';

const columns = [
  { label: 'FORMAT', minWidth: 8 },
  { label: 'SIZE', minWidth: 9, align: 'right' },
  { label: 'PATH' },
];

export function presentScan(logger, images) {
  let totalSize = 0;
  const rows = images.map((image) => {
    totalSize += image.size;
    return [image.format.toUpperCase(), formatSize(image.size), displayPath(image.path)];
  });
  writeTable(logger, columns, rows);

  const label = images.length === 1 ? 'image' : 'images';
  if (images.length > 0) logger.out('');
  logger.out(`${images.length} ${label} found · ${formatSize(totalSize)} total`);
}
