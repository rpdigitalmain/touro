# Changelog

This file records notable changes to Touro.

Touro follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- JavaScript CLI for Linux and Windows with Commander, generated help, and the `info` command.
- Standalone executable builds for Linux and Windows.
- Separate unit, integration, and end-to-end test suites.
- CI on Linux and Windows with Node.js 24 and 26.
- Weekly Dependabot updates for npm dependencies and GitHub Actions.
- Recursive `scan` command with an optional format filter, file sizes, and aggregate totals.
- Optimization for JPEG, PNG, and WebP with batch conversion and per-file and aggregate savings.

### Changed

- Running `touro` now optimizes images in place, recursively from the current directory. Format conversions publish beside the original and protect occupied paths.
- Standalone builds use an ESM entry point and Node.js 26.
