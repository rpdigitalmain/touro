import { readFile, writeFile } from 'node:fs/promises';
import { findPackageJSON } from 'node:module';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function writeStarterConfiguration(path) {
  const directory = dirname(path);
  const packagePath = findPackageJSON(pathToFileURL(directory));
  // Some Node versions return the queried directory when no package exists.
  const pkg = packagePath && packagePath !== directory
    ? JSON.parse((await readFile(packagePath, 'utf8')).trim())
    : {};
  const declaration = pkg?.type === 'module' ? 'export default' : 'module.exports =';
  const content = [
    '// Security: Touro runs this JavaScript with your permissions, even during scan.',
    '// Only use trusted configurations and projects. Use --no-config to skip this file.',
    '// Omitted settings use the built-in Touro defaults.',
    `${declaration} {`,
    '  // discovery: { recursive: false },',
    '  // optimize: { quality: 85 },',
    '};',
    '',
  ].join('\n');
  await writeFile(path, content, { flag: 'wx' });
}
