# Configuration

Run `touro init` to create an optional `touro.config.js` in the working directory. The command chooses the module syntax for your project and preserves any existing file. Uncomment or add settings to customize Touro.

**Security.** Touro executes `touro.config.js` and its imports with your user permissions, including during `scan`. Only load configurations from projects you trust. Run `touro scan --no-config ./assets` to use built-in defaults and the explicit target.

## Precedence

Explicit CLI arguments and options override the project file. Omitted settings fall back to built-in defaults. Nested settings merge by key, and arrays are replaced in full. Relative paths resolve from the working directory, even when you pass a different image directory.

## Example

```js
// touro.config.js
module.exports = {
  discovery: {
    excludedDirectories: ['node_modules', 'bower_components', 'vendor', 'build', 'dist', 'dist-exe', 'drafts'],
  },
  encoding: {
    png: { compressionLevel: 6 },
  },
  scan: {
    directory: './assets',
  },
  optimize: {
    directory: './assets',
    quality: 85,
  },
};
```

In an ES module project, replace `module.exports =` with `export default`. Config files and their imports load synchronously, so top-level `await` is unsupported.

With this file, `touro scan` and `touro` both target `./assets`. Run `touro --quality 90` to override the configured quality for one invocation. Scan and optimization have separate format settings. A scan format filters the listing, while an optimization format converts images and removes originals after successful publication. See [safe usage](safe-usage.md).

## Public Settings

| Setting | Built-in default | Accepted values |
|---|---|---|
| `scan.directory` | `.` | Directory to scan |
| `scan.format` | All supported formats | `jpeg`, `png`, or `webp` |
| `optimize.directory` | `.` | Directory to optimize |
| `optimize.format` | Keep each image's format | `jpeg`, `png`, or `webp` |
| `optimize.quality` | `80` | Integer from `1` to `100` for JPEG and WebP |
| `discovery.excludedDirectories` | `['node_modules', 'bower_components', 'vendor', 'build', 'dist', 'dist-exe']` | Array of directory names shared by scan and optimization |
| `discovery.recursive` | `true` | Boolean. Set to `false` to process only files directly inside the target directory |
| `encoding.jpeg.background` | `'#ffffff'` | Opaque hex color in `#RRGGBB` format for transparent areas when encoding JPEG |
| `encoding.png.compressionLevel` | `9` | Integer from `0` to `9`. Lower levels can encode faster and may produce larger files |
| `output.verbose` | `false` | Boolean. Enables debug diagnostics |
| `output.json` | `false` | Boolean. Controls JSON output for `info` |

Directory exclusions match names case-insensitively at every level below the target. The configured array replaces the built-in list. Use `[]` to clear the list. Hidden directories are still skipped during recursive discovery.

PNG compression levels affect encoding time and file size while preserving pixel values. Try level `6` when tuning for speed and compare the results on representative files.

Unknown settings and invalid values stop command execution with a configuration error. Help and version are available independently of the file.
