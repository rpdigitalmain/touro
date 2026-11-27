<p align="center">
  <img
    src="https://pub-5cb1d207265c4c5484fbf2e19765e499.r2.dev/images/touro-banner.png"
    alt="Touro Banner"
    width="100%"
    style="max-height: 300px; object-fit: cover;"
  />
</p>

# Touro

![Node.js](https://img.shields.io/badge/Node.js-24%20%7C%2026-339933?logo=node.js&logoColor=white)
![Platforms](https://img.shields.io/badge/platforms-Linux%20%7C%20Windows-555555)
![CLI](https://img.shields.io/badge/type-CLI-222222)
[![License](https://img.shields.io/github/license/rpdigitalmain/touro?color=blue)](LICENSE)
[![CI](https://github.com/rpdigitalmain/touro/actions/workflows/ci.yml/badge.svg)](https://github.com/rpdigitalmain/touro/actions/workflows/ci.yml)

Touro is a Node.js CLI that optimizes images in place on Linux and Windows. Use `scan` to inventory the images in a project.

## Local installation

Use Node.js 24 or 26 and run the commands below from the root of your local Touro checkout.

### Windows (PowerShell)

```powershell
npm ci
npm run dev -- --help
npm run dev -- scan "C:\path\to\images" --format webp
```

To make the CLI available from other directories, link it locally.

```powershell
npm link
touro --version
touro scan "C:\path\to\images"
```

If PowerShell blocks the `.ps1` launchers, use `npm.cmd` and `touro.cmd`.

### Linux

```sh
npm ci
npm run dev -- --help
npm run dev -- scan ./assets
```

To make the CLI available from other directories, link it locally.

```sh
npm link
touro --version
touro scan ./assets
```

Replace the example image path with the directory you want to scan. After linking, `touro scan` scans your current directory. The command links to your checkout and uses its source files directly.

## Usage

```sh
touro
touro --quality 80
touro --format webp
touro scan
touro --help
touro --version
```

Use `--verbose` for debug output, including error stack traces and their causes. Use `--no-color` to disable colored diagnostics. Results go to stdout and diagnostics go to stderr. Exit codes are `0` for success, `1` for failure or an unknown command, and `2` for invalid arguments or options.

`touro` recursively optimizes JPEG, PNG, and WebP images in the current directory. Same-format optimization keeps the original filename, including the case of its extension, and replaces the file only when the result is smaller. Use `touro optimize <path>` to select a specific image or directory.

Use `--format jpeg|png|webp` to convert images. Touro writes the complete result to a temporary file in the image's directory. It atomically replaces the original for same-format optimization. Conversion publishes the new extension in the same directory and removes the original after publication succeeds. This step requires hard-link support on the filesystem. Touro skips conversions with occupied target paths or conflicting inputs. Successful runs leave only the final image files.

`--quality <number>` sets JPEG and WebP quality from 1 to 100 and defaults to 80. PNG compression is lossless. JPEG conversion uses a white background for transparency.

`touro scan [path]` defaults to the current directory. It lists relative paths, formats, and sizes based on the file extension. Both commands skip symbolic links, directories whose names start with a dot, and directories named `node_modules`, `bower_components`, `vendor`, `build`, `dist`, or `dist-exe`.

The optimization report shows original and final sizes, bytes saved, and percentage change for each successful file and the batch. The file count includes conversions, optimizations, unchanged files, and failures. Touro reports invalid images, unsupported animations, and path conflicts per file and continues the batch. It returns exit code `1` if any file fails.

## Project layout

```text
bin/touro.js           npm command entry point
src/run.js             Process entry point shared by npm and the executable
src/cli.js             Global options, command dispatch, and errors
src/commands/          Commander subcommands and registration
src/images/            Image discovery, encoding, and file replacement
src/terminal/          Logging and shared console formatting
src/terminal/presenters/  Optimization and scan reports
src/runtime/           Sharp loading, platform paths, and package metadata
src/shared/constants/  Shared application and image definitions
scripts/build-exe.mjs  Standalone executable build
test/unit/             Isolated module tests
test/integration/      Command dispatch and argument handling
test/e2e/               CLI invoked as a separate process
```

## Development checks

`npm run lint` checks the JavaScript source, scripts, and tests. Use `npm run lint:fix` to apply automatic fixes.

`npm test` runs all tests. Run a single group with `npm run test:unit`, `npm run test:integration`, or `npm run test:e2e`.

`npm run audit:deps` checks `package-lock.json` against the npm registry for known vulnerabilities in runtime and development dependencies. It reports all severities and fails on high or critical findings. CI runs this check on pushes to `main` and `develop`, and on pull requests.

## Standalone executables

Use Node.js 26 to build the standalone executable.

```sh
npm ci
npm run build:exe
```

The build creates `dist-exe/touro` (`dist-exe/touro.exe` on Windows) for the current platform. The executable includes Node.js and unpacks its image runtime into the local Touro cache when it first optimizes an image. Set `CLI_EXE` to the executable path when running `npm run test:e2e` to test the binary.

CI runs on Linux and Windows and tests the standalone executable on Node.js 26.
