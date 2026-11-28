import assert from 'node:assert/strict';
import { it } from 'vitest';
import { presentScan } from '../../src/terminal/presenters/inventory.js';
import { presentOptimization } from '../../src/terminal/presenters/optimization.js';
import { IMAGE_ERROR } from '../../src/images/errors.js';
import { TouroError } from '../../src/errors/errors.js';

it('widens the scan size column to align values and preserve full paths', () => {
  const lines = [];
  presentScan({ out: (line) => lines.push(line), columns: 100 }, [
    { format: 'jpeg', size: 3, path: 'cover.JPG' },
    { format: 'png', size: 1_234_560_000_000, path: 'assets/gallery/banner.png' },
  ]);

  assert.deepEqual(lines, [
    'FORMAT          SIZE  PATH',
    'JPEG             3 B  cover.JPG',
    'PNG       1234.56 GB  assets/gallery/banner.png',
    '',
    '2 images found · 1234.56 GB total',
  ]);
});

it('lists scan fields vertically when the table does not fit', () => {
  const lines = [];
  const path = 'assets/long folder/very long filename.png';
  presentScan({ out: (line) => lines.push(line), columns: 20 }, [
    { format: 'png', size: 2500, path },
  ]);

  assert.deepEqual(lines, [
    'FORMAT  PNG', 'SIZE  2.50 KB', 'PATH', path, '',
    '1 image found · 2.50 KB total',
  ]);
});

it('uses the scan table when it fits the terminal exactly', () => {
  const image = { format: 'jpeg', size: 3, path: 'cover.JPG' };
  const tableRow = 'JPEG            3 B  cover.JPG';
  const exact = [];
  const narrow = [];

  presentScan({ out: (line) => exact.push(line), columns: tableRow.length }, [image]);
  presentScan({ out: (line) => narrow.push(line), columns: tableRow.length - 1 }, [image]);

  assert.deepEqual(exact, [
    'FORMAT         SIZE  PATH', tableRow, '', '1 image found · 3 B total',
  ]);
  assert.deepEqual(narrow, [
    'FORMAT  JPEG', 'SIZE  3 B', 'PATH  cover.JPG', '', '1 image found · 3 B total',
  ]);
});

it('preserves optimization metrics in narrow terminals and reports size increases', () => {
  const lines = [];
  const errors = [];
  const debug = [];
  const failure = new TouroError(IMAGE_ERROR.ANIMATED);
  const path = 'assets/converted image.webp';
  presentOptimization({
    out: (line) => lines.push(line),
    error: (...args) => errors.push(args),
    debugError: (error) => debug.push(error),
    columns: 24,
  }, {
    results: [{
      inputFormat: 'png', outputFormat: 'webp', status: 'converted',
      originalSize: 100, finalSize: 125, targetPath: path,
    }],
    failures: [{ path: 'broken.png', error: failure }],
    summary: { optimized: 0, converted: 1, unchanged: 0, originalSize: 100, finalSize: 125 },
  });

  assert.deepEqual(lines, [
    'FORMAT  PNG → WEBP', 'ORIGINAL  100 B', 'FINAL  125 B', 'SAVED  -25 B',
    'REDUCTION  -25.0%', 'PATH', path, '',
    '2 images processed', '0 optimized · 1 converted · 0 unchanged · 1 failed',
    '', '100 B → 125 B · 25 B added (25.0%)',
  ]);
  assert.deepEqual(errors, [['Could not process "broken.png": animated images are not supported.']]);
  assert.deepEqual(debug, [failure]);
});
