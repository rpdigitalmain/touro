# touro

Touro is a Node.js CLI for image optimization on Linux and Windows, written in JavaScript. Use `scan` to inventory the images in a project.

## Local installation

Use Node.js 22 or later and run the commands below from the root of your local Touro checkout.

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
npm run dev -- scan ./assets --format webp
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
touro --help
touro scan
touro scan ./assets --format webp
touro greet Ada --shout --times 2
touro greet --help
touro info --json
```

Use `--verbose` for debug output and `--no-color` to disable colored diagnostics. Results go to stdout and diagnostics go to stderr. Exit codes are `0` for success, `1` for failure or an unknown command, and `2` for invalid arguments or options.

`touro scan [path]` defaults to the current directory. It lists relative paths, formats, and file sizes for `.jpg`, `.jpeg`, `.png`, and `.webp` files, including uppercase extensions. It searches subdirectories, skips symbolic links, and reports the image count and total size. Format detection is based on the file extension.

## Project layout

```text
bin/touro.js           npm command entry point
src/run.js             Process entry point shared by npm and the executable
src/cli.js             Global options, command dispatch, and errors
src/commands/          Commander subcommands registered in index.js
src/lib/               Logging, platform paths, and package metadata
scripts/build-exe.mjs  Standalone executable build
test/unit/             Isolated module tests
test/integration/      Command dispatch and argument handling
test/e2e/              CLI invoked as a separate process
```

## Tests

`npm test` runs all tests. Run a single group with `npm run test:unit`, `npm run test:integration`, or `npm run test:e2e`.

## Standalone executables

Use Node.js 24 to build the standalone executable.

```sh
npm ci
npm run build:exe
```

The build creates `dist-exe/touro` (`dist-exe/touro.exe` on Windows) for the current platform. The executable includes Node.js. Set `CLI_EXE` to the executable path when running `npm run test:e2e` to test the binary.

CI runs on Linux and Windows and tests the standalone executable on Node.js 24.
