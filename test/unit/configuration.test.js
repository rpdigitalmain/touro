import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it, onTestFinished } from 'vitest';
import { defaults } from '../../src/config/configuration.js';
import { projectConfiguration } from '../../src/config/project.js';
import { createConfigurationResolver, resolveConfiguration } from '../../src/config/resolve.js';
import { createTemporaryDirectory } from '../shared/temporary-directory.js';

describe('configuration', () => {
  it('uses the built-in defaults when the file is absent', async (t) => {
    const cwd = await createTemporaryDirectory(t, 'touro-config-');
    assert.deepEqual(await resolveConfiguration({ cwd }), defaults);
  });

  it('merges settings by section with explicit overrides taking priority', async (t) => {
    const cwd = await createTemporaryDirectory(t, 'touro-config-');
    await writeFile(join(cwd, 'package.json'), '{"type":"module"}');
    await writeFile(join(cwd, 'touro.config.js'), `
      export default {
        scan: { format: 'png' },
        optimize: { quality: 60 },
        output: { verbose: true },
        encoding: { jpeg: { background: '#123ABC' } },
      };
    `);

    const result = await resolveConfiguration({
      cwd,
      cli: { scan: { format: undefined }, optimize: { quality: 90 }, output: { verbose: false } },
    });
    assert.deepEqual(result, {
      scan: { directory: '.', format: 'png' },
      optimize: { directory: '.', format: undefined, quality: 90 },
      output: { verbose: false, json: false },
      discovery: defaults.discovery,
      encoding: { jpeg: { background: '#123ABC' }, png: defaults.encoding.png },
    });
    assert.ok(Object.isFrozen(result.encoding.jpeg));
    assert.equal((await projectConfiguration({ cwd })).optimize.quality, 60);
  });

  it('accepts injected providers and returns an immutable snapshot', async () => {
    const base = { scan: { directory: '.', format: 'png' } };
    const resolve = createConfigurationResolver(
      () => base,
      async ({ format }) => ({ scan: { format } }),
    );

    const result = await resolve({ format: 'jpeg' });
    base.scan.directory = './assets';
    assert.deepEqual(result, { scan: { directory: '.', format: 'jpeg' } });
    assert.ok(Object.isFrozen(result));
    assert.ok(Object.isFrozen(result.scan));
    assert.equal((await resolve({ format: 'webp' })).scan.directory, './assets');
  });

  it('replaces exclusion lists and freezes a copy of the configured array', async () => {
    const excludedDirectories = ['generated'];
    const resolve = createConfigurationResolver(
      () => defaults,
      () => ({ discovery: { excludedDirectories } }),
    );

    const result = await resolve();
    excludedDirectories.push('drafts');
    assert.deepEqual(result.discovery.excludedDirectories, ['generated']);
    assert.ok(Object.isFrozen(result.discovery.excludedDirectories));

    excludedDirectories.length = 0;
    assert.deepEqual((await resolve()).discovery.excludedDirectories, []);
  });

  it.each([
    ['[]', 'The configuration export'],
    ['{ scan: null }', 'scan'],
    ['{ scan: { directory: " " } }', 'scan.directory'],
    ['{ scan: { format: "gif" } }', 'scan.format'],
    ['{ optimize: { quality: 101 } }', 'optimize.quality'],
    ['{ optimize: { quality: 80.5 } }', 'optimize.quality'],
    ['{ optimize: { quality: "80" } }', 'optimize.quality'],
    ['{ output: { verbose: 0 } }', 'output.verbose'],
    ['{ output: { color: true } }', 'output.color'],
    ['{ output: { unknown: true } }', 'output.unknown'],
    ['{ discovery: { excludedDirectories: "drafts" } }', 'discovery.excludedDirectories'],
    ['{ discovery: { excludedDirectories: ["assets/drafts"] } }', 'discovery.excludedDirectories'],
    ['{ discovery: { excludedDirectories: ["drafts", 42] } }', 'discovery.excludedDirectories'],
    ['{ discovery: { recursive: "false" } }', 'discovery.recursive'],
    ['{ encoding: { png: { compressionLevel: -1 } } }', 'encoding.png.compressionLevel'],
    ['{ encoding: { png: { compressionLevel: 10 } } }', 'encoding.png.compressionLevel'],
    ['{ encoding: { png: { compressionLevel: 1.5 } } }', 'encoding.png.compressionLevel'],
    ['{ encoding: { jpeg: { background: "#ff000080" } } }', 'encoding.jpeg.background'],
    ['{ encoding: { jpeg: { background: "#zzzzzz" } } }', 'encoding.jpeg.background'],
    ['{ encoding: { png: { adaptiveFiltering: false } } }', 'encoding.png.adaptiveFiltering'],
    ['{ encoding: { jpeg: { mozjpeg: false } } }', 'encoding.jpeg.mozjpeg'],
    ['{ optimize: { keepIccProfile: false } }', 'optimize.keepIccProfile'],
    ['{ unknown: {} }', 'unknown'],
  ])('rejects invalid settings in %s', async (source, field) => {
    const cwd = await createTemporaryDirectory({ onTestFinished }, 'touro-config-');
    await writeFile(join(cwd, 'touro.config.js'), `module.exports = ${source};`);
    await assert.rejects(projectConfiguration({ cwd }), (error) =>
      error.code === 'touro.invalidConfiguration' && error.context.reason.includes(field));
  });

  it('reports import errors from an existing config file', async (t) => {
    const cwd = await createTemporaryDirectory(t, 'touro-config-');
    const path = join(cwd, 'touro.config.js');
    await writeFile(path, 'module.exports = require("./missing.cjs");');
    await assert.rejects(projectConfiguration({ cwd }), (error) => {
      assert.equal(error.code, 'touro.invalidConfiguration');
      assert.equal(error.context.path, path);
      assert.equal(error.cause.code, 'MODULE_NOT_FOUND');
      return true;
    });
  });
});
