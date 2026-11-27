import { displayPath, escapeControls, formatPercent, formatSize, writeTable } from '../format.js';

const columns = [
  { label: 'FORMAT', minWidth: 11 },
  { label: 'ORIGINAL', minWidth: 9, align: 'right' },
  { label: 'FINAL', minWidth: 9, align: 'right' },
  { label: 'SAVED', minWidth: 10, align: 'right' },
  { label: 'REDUCTION', align: 'right' },
  { label: 'PATH' },
];

export function presentOptimization(logger, { results, failures, summary }) {
  for (const { path, message } of failures) {
    logger.error(`Failed: ${displayPath(path)} (${escapeControls(message)})`, { color: false });
  }

  const { originalSize: original, finalSize: final } = summary;
  const rows = results.map((result) => {
    const from = result.inputFormat.toUpperCase();
    const format = result.status === 'converted' ? `${from} → ${result.outputFormat.toUpperCase()}` : from;
    const saved = result.originalSize - result.finalSize;
    const size = `${saved < 0 ? '-' : ''}${formatSize(Math.abs(saved))}`;
    return [
      format,
      formatSize(result.originalSize),
      formatSize(result.finalSize),
      size,
      formatPercent(saved, result.originalSize),
      displayPath(result.targetPath),
    ];
  });
  writeTable(logger, columns, rows);

  const total = results.length + failures.length;
  if (results.length > 0) logger.out('');
  logger.out(`${total} ${total === 1 ? 'image' : 'images'} processed`);
  logger.out(`${summary.optimized} optimized · ${summary.converted} converted · ${summary.unchanged} unchanged · ${failures.length} failed`);
  logger.out('');
  const saved = original - final;
  const comparison = `${formatSize(original)} → ${formatSize(final)}`;
  const percent = formatPercent(Math.abs(saved), original);
  logger.out(`${comparison} · ${formatSize(Math.abs(saved))} ${saved >= 0 ? 'saved' : 'added'} (${percent})`);
}
