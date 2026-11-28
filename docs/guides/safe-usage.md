# Safe Usage

Touro optimizes images in place. Same-format optimization replaces an original only when the encoded result is smaller. A successful format conversion writes a file with the new extension and removes the original, even when the converted image is larger.

## Before Processing a Batch

1. Keep a separate copy of the originals outside the target directory. Start with a small set of representative copies.
2. Review the target and project settings. **Security:** Touro executes `touro.config.js` with your user permissions, even during `scan`. Load configurations only from trusted projects. Add `--no-config` to both commands when you want to use built-in defaults and explicit CLI options.
3. Scan the directory you intend to process. Confirm the paths, formats, and exclusions before running optimization.

```sh
touro scan ./sample-copy
touro ./sample-copy
```

Scan identifies candidates by extension. It does not decode images, simulate conversion, or check whether a conversion destination is available. A scan format filter limits the listing, while an optimization format option sets the destination format. Review separate `scan` and `optimize` settings if the listings and processing scope differ. See the [configuration guide](configuration.md).

## After Processing

Review successful files for visual changes, especially transparency when converting to JPEG. Check the report and any diagnostics before repeating the operation on the full set. A batch can modify some files and still exit with an error if other files fail. See the [troubleshooting guide](troubleshooting.md).

Work on a local copy when another application or user could modify the source files at the same time. Touro checks for changes before publication and source removal, but portable filesystem operations cannot make the check and the following rename or removal atomic together.
