# Architecture

## CLI Execution Flow

The npm launcher and the standalone executable share `src/run.js`. Commander dispatches `scan`, `info`, and `init` or runs the root optimization action with a directory argument. The CLI handles uncaught errors and chooses the process exit code.

Commands call the image modules for discovery and processing. The `scan` command reads file sizes during discovery. The batch optimizer discovers paths and formats, plans target paths, and processes images sequentially. Sharp reads directly from the source path and writes the encoded output into a staging directory beside the source. Publication uses an atomic rename for same-format output and an exclusive hard link for conversions.

Presenters turn structured results and errors into terminal messages. The logger sends results to stdout and diagnostics to stderr. See [Features](../reference/features.md) for command behavior and supported formats.

## Configuration

When a command runs, the CLI calls `resolveConfiguration()`, the configuration facade. It composes three independent provider functions in order of increasing priority: built-in defaults, the optional `touro.config.js` in the working directory, and explicit CLI inputs. The resolver merges nested settings by key, replaces arrays as whole values, and freezes the result, including nested sections and arrays.

The project provider discovers, loads, and validates the file. It uses Node.js `createRequire()` to execute CommonJS and synchronous ES modules with the user's permissions. This applies to scans as well as optimization. With `--no-config`, the provider skips filesystem access and module loading. A missing file contributes no settings. An invalid file stops the command with a diagnostic. Help and version are available without loading the file.

`init` creates a starter file using exclusive write access and selects its syntax from the nearest package's module type. It runs independently of configuration resolution.

The project provider's schema defines the public settings. Internal policies such as ICC profile preservation, adaptive PNG filtering, and MozJPEG stay in `src/config/configuration.js`. Commands receive the resolved settings through their shared context. Scan and optimization share discovery settings, and the image processor receives the resolved encoding settings. Direct calls to the image modules use built-in defaults. See the [configuration guide](../guides/configuration.md) for public options and examples.

## Standalone Runtime Cache

The build embeds the native runtime assets and a digest of their names and file hashes. Extraction uses a unique staging directory and publishes it with a rename. If another process publishes first, the losing process cleans up its own staging directory and checks the winning cache. Before loading Sharp, the executable checks the cache path and asset inventory, rejects links, verifies trusted ownership and write access, and streams the asset hashes.

Linux uses ownership and POSIX mode bits. Windows uses a single Windows PowerShell invocation for access-control checks on a warm cache. The checks treat the current account and privileged system identities as trusted. They do not isolate the cache from other processes running with the same user identity.

## Technologies

| Technology | Role |
|---|---|
| JavaScript ES modules and Node.js | Run the npm CLI on Node.js 24 or 26 on Linux and Windows. Node.js also provides filesystem, module-loading, and terminal APIs. |
| Commander | Parses CLI arguments and options, dispatches commands, and provides help and usage diagnostics. |
| Sharp and libvips | Decode and encode JPEG, PNG, and WebP images. |
| esbuild and Node.js Single Executable Applications (SEA) | Bundle the CLI and build a standalone executable for the host platform using Node.js 26. |
| Vitest | Runs unit, integration, and end-to-end tests. |
| Tinybench | Measures performance of image workflows and processing stages. |
| ESLint | Checks JavaScript source, tests, and scripts. |
| GitHub Actions, npm audit, and CodeQL | Run checks on Linux and Windows, audit dependencies, and scan JavaScript for security issues. |

## Continuous Integration

The [CI workflow](../../.github/workflows/ci.yml) runs on pull requests and pushes to `main` and `develop`. It lints, tests, and checks the packaged CLI on Linux and Windows with Node.js 24 and 26. The Node.js 26 jobs also build and exercise the standalone binaries. Vitest uses the Node.js environment and discovers `*.test.js` files under `test/`.

The dependency audit checks runtime and development packages in `package-lock.json` against the npm registry. It reports all severities and fails on high or critical findings.

CodeQL runs on Ubuntu after the test jobs pass for pull requests and pushes to `main`. Results appear under **Security → Code scanning**. This workflow uses advanced setup, which requires disabling the repository's default setup if it is enabled. Private repositories require GitHub Code Security. [GitHub CodeQL setup](https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/configure-code-scanning/configuring-advanced-setup-for-code-scanning).

## Performance Benchmarks

Run `npm run bench` with Node.js 24 or 26. Benchmarks run separately from the test suite and publish measurements without pass/fail thresholds. The [performance workflow](../../.github/workflows/performance.yml) also runs on Mondays at 04:23 UTC and supports manual runs.

| Scenario | Measurement |
|---|---|
| Startup | A fresh Node.js process for each `--help` or `--version` sample |
| Discovery | Trees of 100, 500, and 2,000 images, with a path-only comparison for the largest tree |
| Optimization | Batches of three JPEG, PNG, or WebP images at 256×256 and 1,024×1,024 |
| Processing stages | Reading, buffer-to-buffer encoding, file-to-file encoding, and atomic replacement for larger fixtures. File-to-file timing includes writing and removing the output. |
| Concurrency and memory | One or two independent sub-batches totaling 48 images, with RSS and V8 heap sampled every 10 ms during discovery and three rounds per concurrency level |

Tinybench warms up each scenario and reports mean, median, standard deviation, and images per second. Fixture generation and restoration are outside the timed measurements. Temporary fixtures are removed after execution.

Compare results on the same machine, Node.js version, and filesystem. RSS includes native allocations, and sampling may miss short-lived peaks. The concurrency benchmark runs independent sub-batches in the same process, while a CLI invocation processes its batch sequentially.

## Project Layout

```text
touro/
├── bin/
│   └── touro.js           npm command entry point
├── src/
│   ├── run.js             Entry point shared by npm and the executable
│   ├── cli.js             Global options, command dispatch, and errors
│   ├── commands/          Commander subcommands and registration
│   ├── config/            Built-in settings and project configuration loading
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
