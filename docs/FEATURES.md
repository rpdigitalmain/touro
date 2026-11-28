# Features

Touro supports recursive discovery, in-place optimization, and format conversion for JPEG, PNG, and WebP. See the [README](../README.md#usage) for installation and basic CLI usage.

## Image Discovery

Touro discovers JPEG, PNG, and WebP images recursively. Scanning and optimization skip symbolic links and directories whose names start with a dot. The default exclusion list also skips `node_modules`, `bower_components`, `vendor`, `build`, `dist`, and `dist-exe`. Override it with `discovery.excludedDirectories` in [Project Configuration](../README.md#project-configuration).

`touro scan [directory]` defaults to the current directory. It lists relative paths, formats, and sizes based on the file extension. Use `touro scan --format webp` to list only WebP files. Set `discovery.recursive` to `false` to limit both commands to the target directory.

## In-Place Optimization

`touro [directory]` optimizes images recursively. It uses the current directory when the argument is omitted. You can pass a relative path such as `touro ./assets`, an absolute path such as `touro /home/user/images`, or quote a path with spaces such as `touro "C:\Users\User\My Pictures"`. Pass `--` before a directory name that starts with a dash or matches a subcommand.

Same-format optimization keeps the original filename, including the case of its extension, and replaces the file only when the result is smaller. Touro writes the complete result to a temporary file in the image's directory, then atomically replaces the original.

`--quality <number>` sets JPEG and WebP quality from 1 to 100 and defaults to 80. PNG compression is lossless.

## Format Conversion

Use `--format jpeg|png|webp` to convert images. The result uses the new extension in the same directory. Touro removes the original after publishing the result successfully. Publication requires hard-link support on the filesystem.

Touro skips conversions with occupied target paths or conflicting inputs. JPEG conversion uses a white background for transparency by default. Set `encoding.jpeg.background` to choose another opaque color.

## Optimization Report

The report shows original and final sizes, bytes saved, and percentage reduction for each successful file and the batch. If a conversion increases the size, the file's reduction is negative and any net increase is reported as bytes added in the summary.

The total includes conversions, optimizations, unchanged files, and failures. Touro reports invalid images, unsupported animations, and path conflicts per file and continues the batch. It returns exit code `1` if any file fails.
