# touro

Touro is a Node.js CLI for image optimization on Linux and Windows, written in JavaScript. The current commands, `greet` and `info`, serve as examples while image optimization is under development.

## Getting started

Use Node.js 22 or later.

```sh
npm ci
npm run dev -- --help
npm run dev -- greet Ada --shout
npm run dev -- info --json
npm test
npm link
touro --version
```

The CLI and tests run directly from the source files. Commander handles command registration, argument parsing, and generated help.

## Usage

```sh
touro --help
touro greet Ada --shout --times 2
touro greet --help
touro info --json
```

Use `--verbose` for debug output and `--no-color` to disable colored diagnostics. Results go to stdout and diagnostics go to stderr. Exit codes are `0` for success, `1` for failure or an unknown command, and `2` for invalid arguments or options.

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
