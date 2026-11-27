# Changelog

This file records notable changes to Touro.

Touro follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- JavaScript CLI for Linux and Windows with Commander, generated help, and the `greet` and `info` commands.
- Standalone executable builds for Linux and Windows.
- Separate unit, integration, and end-to-end test suites.
- CI on Linux and Windows with Node.js 22 and 24.
- Weekly Dependabot updates for npm dependencies and GitHub Actions.
- Recursive `scan` command with an optional format filter, file sizes, and aggregate totals.
- `optimize` command for JPEG, PNG, and WebP with batch conversion, protected output, and per-file and aggregate savings.

### Changed

- `optimize` detects destination conflicts before encoding and skips all inputs that share a destination.
