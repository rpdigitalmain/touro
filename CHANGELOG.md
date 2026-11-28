# Changelog

This file records notable changes to Touro.

Touro follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0]

First stable release.

### Added

- CLI for Linux and Windows with Node.js 24 and 26 support, built-in help, and an `info` command with JSON output.
- Recursive `scan` with an optional format filter, per-file sizes, and totals.
- In-place optimization and batch conversion for JPEG, PNG, and WebP, with per-file results and aggregate savings. Same-format optimization replaces a file only when the result is smaller. Conversion protects occupied destinations.
- Optional `touro.config.js` for discovery and encoding settings, a `touro init` command to create it, and a `--no-config` flag to skip loading it.
- Image processing limits and per-file diagnostics so a failed image can be reported while the batch continues.
- Standalone Linux and Windows builds using Node.js 26.
