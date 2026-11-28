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
</p>

---

## Overview

Touro optimizes JPEG, PNG, and WebP images directly in their original locations. It supports recursive discovery, format conversion, configurable quality, and processing reports.

## Contents

- [Local Installation](#local-installation)
- [Usage](#usage)
- [Project Configuration](#project-configuration)
- [Documentation](#documentation)
- [Standalone Executables](#standalone-executables)
- [Development](#development)

---

## Local Installation

Install Node.js 24 or 26. From a local clone, run these commands on Linux or Windows.

```sh
npm ci
npm link
touro --version
```

The linked command runs from your local checkout. To try the CLI without linking it, run `npm run dev -- --help`. If PowerShell blocks `.ps1` launchers, use `npm.cmd` and `touro.cmd`.

---

## Usage

Scan the target directory first. Optimization modifies files in place, so keep a backup and review the [safe usage guide](docs/guides/safe-usage.md) before processing originals. These examples skip the optional project configuration.

```sh
touro scan --no-config ./assets
touro --no-config ./assets
```

---

## Project Configuration

Run `touro init` in your project directory to create an optional `touro.config.js` with the built-in defaults and comments explaining each setting. Edit the values you want to customize. See the [configuration guide](docs/guides/configuration.md) for options, precedence, and examples.

**Security.** Touro executes `touro.config.js` with your user permissions, including during `scan`. Only load configurations from projects you trust. Pass `--no-config` to use built-in defaults and explicit CLI options.

---

## Documentation

| Document | Covers |
|---|---|
| [Safe usage](docs/guides/safe-usage.md) | Backups, scan scope, and in-place changes |
| [Configuration](docs/guides/configuration.md) | Public settings, defaults, and precedence |
| [Commands](docs/reference/commands.md) | Syntax, options, and exit codes |
| [Features](docs/reference/features.md) | Discovery, conversion, processing limits, and reports |
| [Troubleshooting](docs/guides/troubleshooting.md) | Common failures and what to do next |
| [Architecture](docs/development/architecture.md) | Module boundaries, the standalone cache, and development tooling |
| [Security policy](docs/SECURITY.md) | Private vulnerability reporting |

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

## Development

| Task | Command |
|---|---|
| Run the linter | `npm run lint` |
| Apply automatic lint fixes | `npm run lint:fix` |
| Run all tests | `npm test` |
| Run one test group | `npm run test:unit`, `npm run test:integration`, or `npm run test:e2e` |
| Watch tests | `npm run test:watch` |
| Audit dependencies | `npm run audit:deps` |

### Local Docker Checks

With Docker running, build the test image and run lint and the full test suite.

```sh
docker build -t touro-local-test .
docker run --rm touro-local-test
```

### Performance Benchmarks

Run `npm run bench` with Node.js 24 or 26. See the [benchmark scenarios and measurement notes](docs/development/architecture.md#performance-benchmarks).

### Code Scanning

CI runs CodeQL on pull requests and pushes to `main`. See [continuous integration](docs/development/architecture.md#continuous-integration) for the test matrix, dependency audit, and CodeQL setup.

---

<p align="center">
  <strong>Touro</strong>
  <br />
  <sub>Image Optimization CLI</sub>
</p>
