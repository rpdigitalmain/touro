import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { appPaths } from '../../src/lib/paths.js';

// path.join uses the host separator, so expectations are built with it too.
describe('appPaths', () => {
  const home = join('/', 'home', 'u');

  it('uses APPDATA / LOCALAPPDATA on Windows', () => {
    const p = appPaths('app', 'win32', { APPDATA: 'R', LOCALAPPDATA: 'L' }, home);
    assert.equal(p.config, join('R', 'app', 'Config'));
    assert.equal(p.cache, join('L', 'app', 'Cache'));
  });

  it('rejects unsupported platforms', () => {
    assert.throws(() => appPaths('app', 'freebsd', {}, home), /Unsupported platform: freebsd/);
  });

  it('honors XDG variables on Linux', () => {
    const p = appPaths('app', 'linux', { XDG_CONFIG_HOME: '/xdg' }, home);
    assert.equal(p.config, join('/xdg', 'app'));
    assert.equal(p.cache, join(home, '.cache', 'app'));
  });
});
