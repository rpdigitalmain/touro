# Commands

| Command | Behavior |
|---|---|
| `touro [directory]` | Optimize images in place. Set `--format` to convert images. |
| `touro scan [directory]` | List images by file extension, including their relative paths, formats, and sizes. |
| `touro init` | Create `touro.config.js` in the working directory. An existing file is preserved and the command reports an error. |
| `touro info` | Show the Touro and Node.js versions, system information, and application paths. |

When you omit a target, Touro uses `scan.directory` or `optimize.directory` from the project configuration if set, and otherwise uses the working directory. Both commands accept relative and absolute paths. Quote paths that contain spaces. Use `--` before a directory name that starts with a dash or matches a command, as in `touro -- scan`. See [configuration precedence](../guides/configuration.md#precedence).

## Options

| Option | Applies to | Behavior |
|---|---|---|
| `--format <format>` | Optimization, scan | Convert images during optimization or filter by extension during a scan. Accepted values are `jpeg`, `png`, and `webp`. |
| `-q, --quality <number>` | Optimization | Set JPEG and WebP quality from `1` to `100`. The built-in default is `80`. |
| `--json` | `info` | Print system information as JSON. |
| `--verbose` | All commands | Include technical diagnostics, such as error causes and stack traces. |
| `--no-config` | Optimization, `scan`, `info` | Skip `touro.config.js` and use built-in defaults with explicit CLI inputs. |
| `-h, --help` | CLI and subcommands | Show help. For example, run `touro scan --help`. |
| `-v, --version` | CLI | Show the installed Touro version. |

## Output and Exit Codes

Command results go to stdout. Diagnostics go to stderr.

| Exit code | Meaning |
|---|---|
| `0` | Success |
| `1` | Operation failed, configuration could not be loaded, or one or more images failed during optimization |
| `2` | Invalid arguments or options |

For examples of safe in-place processing, see the [safe usage guide](../guides/safe-usage.md).
