import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Per-user directories following each platform's conventions:
 *  - Windows: %APPDATA% / %LOCALAPPDATA%
 *  - Linux:   $XDG_CONFIG_HOME, $XDG_DATA_HOME, $XDG_CACHE_HOME (with defaults)
 */
export function appPaths(
  appName,
  platform = process.platform,
  env = process.env,
  home = homedir(),
) {
  if (platform === 'win32') {
    const roaming = env.APPDATA ?? join(home, 'AppData', 'Roaming');
    const local = env.LOCALAPPDATA ?? join(home, 'AppData', 'Local');
    return {
      config: join(roaming, appName, 'Config'),
      data: join(local, appName, 'Data'),
      cache: join(local, appName, 'Cache'),
    };
  }

  if (platform !== 'linux') {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  return {
    config: join(env.XDG_CONFIG_HOME || join(home, '.config'), appName),
    data: join(env.XDG_DATA_HOME || join(home, '.local', 'share'), appName),
    cache: join(env.XDG_CACHE_HOME || join(home, '.cache'), appName),
  };
}
