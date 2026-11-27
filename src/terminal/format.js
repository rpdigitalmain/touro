import { sep } from 'node:path';

export function formatSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let unit = 0;
  while (bytes >= 1000 && unit < units.length - 1) {
    bytes /= 1000;
    unit += 1;
  }
  return unit === 0 ? `${bytes} B` : `${bytes.toFixed(2)} ${units[unit]}`;
}

export function escapeControls(text) {
  return text.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, (char) =>
    `\\u{${char.codePointAt(0).toString(16)}}`,
  );
}

export function displayPath(path) {
  return escapeControls(path.split(sep).join('/'));
}

export function formatPercent(part, total) {
  return `${(total === 0 ? 0 : part / total * 100).toFixed(1)}%`;
}

export function writeTable(logger, columns, rows) {
  if (rows.length === 0) return;

  const separator = '  ';
  const pathColumn = columns.length - 1;
  const widths = columns.map(({ label, minWidth = 0 }, index) =>
    index === pathColumn ? 0 : Math.max(label.length, minWidth),
  );
  let pathWidth = columns[pathColumn].label.length;
  for (const row of rows) {
    for (let index = 0; index < pathColumn; index++) {
      widths[index] = Math.max(widths[index], row[index].length);
    }
    // The path is never padded. UTF-8 bytes give a conservative width for Unicode paths.
    pathWidth = Math.max(pathWidth, Buffer.byteLength(row[pathColumn]));
  }

  const tableWidth = widths.reduce((total, width) => total + width, pathWidth) +
    pathColumn * separator.length;
  if (logger.columns > 0 && tableWidth > logger.columns) {
    for (const [index, row] of rows.entries()) {
      if (index > 0) logger.out('');
      for (const [column, cell] of row.entries()) {
        const label = columns[column].label;
        const line = `${label}  ${cell}`;
        if (Buffer.byteLength(line) > logger.columns) {
          logger.out(label);
          logger.out(cell);
        } else {
          logger.out(line);
        }
      }
    }
    return;
  }

  const writeRow = (cells) => logger.out(cells.map((cell, index) =>
    columns[index].align === 'right' ? cell.padStart(widths[index]) : cell.padEnd(widths[index]),
  ).join(separator));
  writeRow(columns.map(({ label }) => label));
  for (const row of rows) writeRow(row);
}
