# Configuration

Run `touro init` to create an optional `touro.config.js` in the working directory. The command chooses the module syntax for your project and preserves any existing file. Uncomment or add settings to customize Touro.

**Security:** Touro executes `touro.config.js` and its imports with your user permissions, including when you run `touro scan`. Only load configurations from projects you trust. Use `--no-config` to skip the file entirely. For example, `touro scan --no-config ./assets` uses built-in defaults and the explicit directory argument.

## Precedence

Explicit CLI arguments and options take precedence over the file, and omitted settings fall back to the built-in defaults. Relative directories resolve from the working directory. Nested settings merge by key, and arrays are replaced as whole values. Scan and optimization have separate directory and format settings.

## Example

```js
// touro.config.js
module.exports = {
  discovery: {
    recursive: true,
    excludedDirectories: ['node_modules', 'bower_components', 'vendor', 'build', 'dist', 'dist-exe', 'drafts'],
  },
  encoding: {
    jpeg: { background: '#f5f5f5' },
    png: { compressionLevel: 6 },
  },
  scan: {
    directory: './assets',
    format: 'png',
  },
  optimize: {
    directory: './assets',
    format: 'webp',
    quality: 85,
  },
  output: {
    verbose: false,
  },
};
```

In an ES module project, replace `module.exports =` with `export default`. Config files and their imports load synchronously, so top-level `await` is unsupported.

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

PNG compression levels change encoding time and file size while preserving pixel values. Level `6` is a starting point for faster batches. Same-format optimization still replaces a file only when the result is smaller.

Unknown settings and invalid values stop command execution with a configuration error. Help and version are available independently of the file.
