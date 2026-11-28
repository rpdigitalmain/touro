# Troubleshooting

Read the diagnostic on stderr first. Add `--verbose` when you need the underlying error or stack trace. See the [command reference](../reference/commands.md#output-and-exit-codes) for exit codes.

| Symptom | What to check |
|---|---|
| Configuration fails to load | Run the command from the intended working directory. Check the diagnostic for an unknown key, invalid value, or module-loading error. Use `--no-config` to skip the file. See the [configuration guide](configuration.md). |
| `touro init` reports that the path already exists | Open the existing `touro.config.js` and edit it. The command preserves the existing file. |
| The target is missing or invalid | Pass an existing directory. Quote names with spaces and use `--` before a directory whose name starts with a dash or matches a command. |
| Scan finds fewer files than expected | Check the selected directory, the scan format filter, recursiveness, and the exclusion list. Discovery skips symbolic links and dot-prefixed subdirectories. |
| Conversion reports a destination conflict | Check for an existing file with the target name or source files that would produce the same target. Move the conflicting files or process a separate copy. |
| Writing fails | Check write permissions and available space on the target volume. Format conversion also requires filesystem support for hard links. |
| An image fails to process | Check whether the file opens, whether its contents match its extension, and whether it is animated. Animated images are unsupported. |
| Standalone image processing cache could not be trusted | Use a local cache location controlled by your account. If permissions are correct and the error reports corrupt cached files, close running Touro processes and remove that Touro runtime cache so the executable can extract it again. Use `touro info --no-config` to find the cache path. |

An optimization run can report successful changes and failures together. Review the batch summary and individual paths before retrying, because successful changes remain in place. See the [safe usage guide](safe-usage.md).
