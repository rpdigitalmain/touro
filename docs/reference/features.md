# Features

Touro supports recursive discovery, in-place optimization, and format conversion for JPEG, PNG, and WebP. See the [command reference](commands.md) for CLI syntax and options.

## Image Discovery

Touro discovers JPEG, PNG, and WebP images recursively. Scanning and optimization skip symbolic links and directories whose names start with a dot. The default exclusion list also skips `node_modules`, `bower_components`, `vendor`, `build`, `dist`, and `dist-exe`. Override it with `discovery.excludedDirectories`. See the [configuration guide](../guides/configuration.md).

Scan identifies candidates by file extension. Set `discovery.recursive` to `false` to limit both scan and optimization to files directly inside the target directory.

## In-Place Optimization

Same-format optimization keeps the original filename, including the case of its extension, and replaces the file only when the result is smaller. Touro stages the complete result beside the source and uses an atomic rename to replace the original.

`--quality <number>` sets JPEG and WebP quality from 1 to 100 and defaults to 80. PNG compression is lossless.

### Processing Limits

The CLI processes one image at a time and caps libvips concurrency at two threads per image.

| Limit | Maximum |
|---|---|
| Input file size | 256 MiB |
| Input dimensions | 67,108,864 pixels |
| PNG chunks through the first image-data chunk | 4,096 |
| Sharp processing time | 120 seconds per image, measured from when libvips opens the input |

## Format Conversion

Use `--format jpeg|png|webp` to convert images. The result uses the new extension in the same directory. Touro removes the original after publishing the result successfully. Publication requires hard-link support on the filesystem.

Touro skips conversions with occupied target paths or conflicting inputs. JPEG conversion uses a white background for transparency by default. Set `encoding.jpeg.background` to choose another opaque color.

## Optimization Report

The report shows original and final sizes, bytes saved, and percentage reduction for each successful file and the batch. If a conversion increases the size, the file's reduction is negative and any net increase is reported as bytes added in the summary.

The total includes conversions, optimizations, unchanged files, and failures. Touro reports invalid images, unsupported animations, and path conflicts per file and continues the batch. It returns exit code `1` if any file fails.
