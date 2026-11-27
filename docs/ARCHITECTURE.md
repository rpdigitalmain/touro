# Architecture

## CLI Execution Flow

The npm launcher and the standalone executable share `src/run.js`. Commander dispatches `scan` and `info` or runs the root optimization action with a directory argument. The CLI handles uncaught errors and chooses the process exit code.

Commands call the image modules for discovery and processing. The `scan` command reads file sizes during discovery. The batch optimizer discovers paths and formats, plans target paths, and aggregates results as it processes images sequentially. The processor reads each image, encodes it with Sharp, and delegates safe file replacement to the image replacement module.

Presenters turn structured results and errors into terminal messages. The logger sends results to stdout and diagnostics to stderr. See [Features](FEATURES.md) for command behavior and supported formats.

## Project Layout

```text
touro/
├── bin/
│   └── touro.js           npm command entry point
├── src/
│   ├── run.js             Entry point shared by npm and the executable
│   ├── cli.js             Global options, command dispatch, and errors
│   ├── commands/          Commander subcommands and registration
│   ├── images/            Image discovery, encoding, and file replacement
│   ├── terminal/          Logging and shared console formatting
│   │   └── presenters/    Command reports and error messages
│   ├── runtime/           Sharp loading, platform paths, and package metadata
│   ├── constants/         Shared application and image definitions
│   └── errors/            Shared error model and cleanup handling
├── scripts/
│   └── build-exe.mjs      Standalone executable build
└── test/
    ├── unit/              Isolated module tests
    ├── integration/       Command dispatch and image workflows
    ├── e2e/               CLI invoked as a separate process
    ├── performance/       Tinybench benchmarks
    └── shared/            Reusable test helpers
```
