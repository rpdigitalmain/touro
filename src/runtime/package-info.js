import { readFileSync } from 'node:fs';

let cached;

/** Reads package.json relative to the source tree. */
export function readPackageInfo() {
  // Inlined when building the standalone executable.
  if (typeof __PACKAGE_INFO__ !== 'undefined') return __PACKAGE_INFO__;
  if (!cached) {
    const url = new URL('../../package.json', import.meta.url);
    const json = JSON.parse(readFileSync(url, 'utf8'));
    cached = { name: Object.keys(json.bin)[0], version: json.version ?? '0.0.0', os: json.os };
  }
  return cached;
}
