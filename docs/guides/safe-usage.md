# Safe Usage

Touro optimizes images in place. Same-format optimization replaces an original only when the encoded result is smaller. A successful format conversion writes a file with the new extension and removes the original, even when the converted image is larger.

**Security.** Touro runs `touro.config.js` with your user permissions, including during `scan`. Only load configurations from projects you trust. The commands below skip the configuration file.

## Before Processing a Batch

1. Keep a separate copy of the originals outside the target directory. Start with a small set of representative copies.
2. Review the target and any project settings you plan to use. Work on a local copy if someone else or a sync service could modify the source files during processing.
3. Scan the directory you intend to process. Confirm the paths, formats, and exclusions before running optimization.

```sh
touro scan --no-config ./sample-copy
touro --no-config ./sample-copy
```

Scan identifies candidates by extension. It leaves decoding, output sizing, and destination checks to the optimization run. If you load project settings, review both `scan` and `optimize` before using the scan listing to check the scope. See the [configuration guide](configuration.md).

## After Processing

Review successful files for visual changes, especially transparency when converting to JPEG. Check the report and any diagnostics before repeating the operation on the full set. A batch can modify some files and still exit with an error if other files fail. See the [troubleshooting guide](troubleshooting.md).

Touro checks for changes before publishing the result and removing the original. Another process can still change a file between the last check and the filesystem operation.
