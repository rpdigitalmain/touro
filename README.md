<p align="center">
  <img
    src="https://pub-5cb1d207265c4c5484fbf2e19765e499.r2.dev/images/touro-banner.png"
    alt="Touro Banner"
    width="100%"
  />
</p>

<h1 align="center">Touro</h1>

<p align="center">
  A Node.js CLI for image optimization on Linux and Windows.
  <br />
  Optimize images in place, recursively, with clear processing reports.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-24%20%7C%2026-339933?logo=node.js&logoColor=white" alt="Node.js 24 and 26" />
  <img src="https://img.shields.io/badge/platforms-Linux%20%7C%20Windows-555555" alt="Linux and Windows" />
  <img src="https://img.shields.io/badge/type-CLI-222222" alt="CLI" />
  <a href="LICENSE"><img src="https://img.shields.io/github/license/rpdigitalmain/touro?color=blue" alt="License" /></a>
  <a href="https://github.com/rpdigitalmain/touro/actions/workflows/ci.yml"><img src="https://github.com/rpdigitalmain/touro/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
</p>

<p align="center">
  🇧🇷 <strong>Proudly made in Brazil.</strong>
  <br />
  <sub>Touro is a Brazilian image optimization CLI, built in Brazil.</sub>
</p>

---

## Overview

Touro optimizes JPEG, PNG, and WebP images directly in their original locations. It supports recursive discovery, format conversion, configurable quality, and processing reports.

## Contents

- [Local Installation](#local-installation)
- [Usage](#usage)
- [Project Configuration](#project-configuration)
- [Features](#features)
- [Architecture](#architecture)
- [Development](#development)
- [Performance Benchmarks](#performance-benchmarks)
- [Code Scanning](#code-scanning)
- [Report a Security Vulnerability](docs/SECURITY.md)
- [Standalone Executables](#standalone-executables)

---

## Local Installation

Requires Node.js 24 or 26.

Clone the repository and install its dependencies:

### Windows (PowerShell)

```powershell
npm ci
npm run dev -- --help
npm run dev -- scan "C:\path\to\images" --format webp
```

To make the CLI available globally from your local checkout:

```powershell
npm link

touro --version
touro scan "C:\path\to\images"
```

If PowerShell blocks `.ps1` launchers, use `npm.cmd` and `touro.cmd`.

### Linux

```sh
npm ci
npm run dev -- --help
npm run dev -- scan ./assets
```

To make the CLI available globally from your local checkout:

```sh
npm link

touro --version
touro scan ./assets
```

After linking, `touro scan` operates on the current directory by default. The linked command uses your local checkout and its source files directly.

---

## Usage

Scan the target directory first. Optimization modifies files in place, so keep a backup and review the [safe usage guide](docs/guides/safe-usage.md) before processing originals. These examples skip the optional project configuration.

```sh
touro scan --no-config ./assets
touro --no-config ./assets
```

See the [command reference](docs/reference/commands.md) for syntax, options, and exit codes. If an operation fails, see the [troubleshooting guide](docs/guides/troubleshooting.md).

---

## Project Configuration

Run `touro init` in your project directory to create an optional `touro.config.js`. The starter file contains commented examples and keeps the built-in behavior until you add overrides. See the [configuration guide](docs/guides/configuration.md) for options, precedence, and examples.

**Security:** Touro executes `touro.config.js` as JavaScript with your user permissions, including during `scan`. Only load configurations from projects you trust. Use `touro scan --no-config ./assets` to skip the external file and use built-in defaults plus explicit CLI options.

---

## Features

Touro provides:

- Recursive image discovery.
- JPEG, PNG, and WebP optimization.
- In-place image optimization.
- Format conversion.
- Configurable image quality.
- Processing statistics and size reduction reports.
- Linux and Windows compatibility.

See [Features](docs/reference/features.md) for supported formats, directory discovery, file replacement, and processing reports.

---

## Architecture

Touro follows a modular architecture with separated responsibilities for image processing, filesystem operations, application logic, and terminal presentation.

See [Architecture](docs/development/architecture.md) for the CLI execution flow, module responsibilities, and project structure.

---

## Development

### Code Quality

```sh
# Run ESLint
npm run lint

# Apply automatic fixes
npm run lint:fix
```

ESLint checks JavaScript source files, development scripts, and tests.

### Automated Tests

Touro uses Vitest for automated testing.

```sh
# Run all tests
npm test

# Run individual test groups
npm run test:unit
npm run test:integration
npm run test:e2e

# Start watch mode
npm run test:watch
```

The `vitest.config.js` configuration uses the Node.js environment and discovers `*.test.js` files under `test/`.

### Dependency Auditing

```sh
npm run audit:deps
```

Checks `package-lock.json` against the npm registry for known vulnerabilities in runtime and development dependencies.

The audit reports all severity levels and fails on high or critical findings.

CI runs this check on pushes to `main` and `develop`, and on pull requests.

---

## Performance Benchmarks

Run performance benchmarks with Node.js 24 or 26:

```sh
npm run bench
```

The [Performance workflow](.github/workflows/performance.yml) also supports manual execution and runs automatically on Mondays at 04:23 UTC.

Benchmarks are independent of `npm test` and publish measurements without enforcing performance thresholds.

### Benchmark Scenarios

**Startup**

Launches a fresh Node.js process for each `--help` and `--version` sample.

**Discovery**

Scans nested directory trees containing 100, 500, and 2,000 images.

The largest scenario compares path-only discovery used by optimization with discovery that also reads file sizes for `scan`.

**Optimization**

Evaluates the CLI batch optimizer using JPEG, PNG, and WebP images at 256×256 and 1,024×1,024 resolutions.

Each sample processes three images. Fixture generation and restoration are excluded from timed measurements.

Large-image scenarios also measure reading, buffer-to-buffer encoding, file-to-file encoding, and atomic replacement separately. File-to-file timings include writing and removing the output file.

**Concurrency and Memory**

Compares one and two simultaneous optimization runs using two independent directories containing 48 images combined.

A separate measurement phase samples RSS and V8 heap every 10 ms during discovery and three rounds per concurrency level.

The CLI processes its own batches sequentially. The benchmark compares two independent sub-batches in the same Node.js process.

### Measurement Methodology

Tinybench warms up each scenario and reports:

- Mean execution time.
- Median execution time.
- Standard deviation.
- Images processed per second.

Images per second is calculated using the image count divided by the mean execution time.

Compare results using the same machine, Node.js version, and filesystem.

Synthetic fixtures are stored in temporary directories and removed after execution.

Memory measurements are sampled, so short-lived peaks may not be captured. RSS also includes native allocations.

---

## Code Scanning

GitHub CodeQL performs static security analysis of JavaScript code.

The workflow runs on pushes to `main` and pull requests, after the test matrix passes.

### Configuration

- Uses GitHub Actions.
- Runs once on Ubuntu.
- Analyzes JavaScript source code.
- Publishes security alerts in the repository's **Security → Code scanning** section.
- Uses the workflow token for GitHub integration.

This project uses CodeQL advanced setup.

If default setup is enabled for the repository, disable it before enabling this workflow.

Private repositories require GitHub Code Security to be enabled.

See the [GitHub CodeQL advanced setup documentation](https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/configure-code-scanning/configuring-advanced-setup-for-code-scanning).

---

## Standalone Executables

Touro supports standalone executable builds using Node.js 26.

### Build

```sh
npm ci
npm run build:exe
```

The build generates an executable for the current platform:

| Platform | Output |
|---|---|
| Linux | `dist-exe/touro` |
| Windows | `dist-exe/touro.exe` |

### Runtime

The executable includes Node.js and extracts its image runtime into the local Touro cache when an image optimization operation is first executed. It checks ownership, write access, links, and asset integrity before loading the runtime. Keep this cache in a trusted per-user location. On Windows, standalone cache checks use the system Windows PowerShell to read filesystem access controls.

### Executable Testing

Set `CLI_EXE` to the executable path when running the end-to-end tests:

```sh
CLI_EXE=./dist-exe/touro npm run test:e2e
```

On Windows PowerShell:

```powershell
$env:CLI_EXE = ".\dist-exe\touro.exe"
npm run test:e2e
```

CI builds and tests standalone executables on Linux and Windows using Node.js 26.

---

<p align="center">
  <strong>Touro</strong>
  <br />
  <sub>Image Optimization CLI</sub>
</p>
