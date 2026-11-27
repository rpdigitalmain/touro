import { sep } from 'node:path';

export function formatSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
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

export function createTable(writeLine, columns) {
  return (cells) => {
    const row = cells.map((cell, index) => {
      const { width = 0, align } = columns[index];
      return align === 'right' ? cell.padStart(width) : cell.padEnd(width);
    });
    writeLine(row.join('  '));
  };
}
