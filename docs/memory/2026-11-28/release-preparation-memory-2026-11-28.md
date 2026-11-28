# Touro 1.0.0 preparation - 2026-11-28

- Aligned `package.json` and `package-lock.json` at 1.0.0 on `develop`. Moved the user-facing changes into the first stable release section of `CHANGELOG.md`. Add the actual release date when cutting the release.
- Added the publishing steps in `docs/development/releasing.md` and linked the guide from the README. The preparation stayed local, with no commit, tag, or publication.
- The full suite passed on Windows x64 and Ubuntu x64 under WSL with Node.js 24.22.3 and 26.13.1. Lint passed on both platforms. Both Node.js 26 standalone builds passed all 25 CLI end-to-end tests with `CLI_EXE` set. The dependency audit found zero vulnerabilities.
- Installed the npm tarball in isolated directories and exercised the installed CLI on Windows and Ubuntu. Local artifacts are in the ignored `dist-exe/v1.0.0/` directory with a verified `SHA256SUMS.txt`.
- Export WSL artifacts back into the Windows workspace in the same invocation as the build. Ubuntu's `/tmp` contents did not survive a WSL restart.

## Follow-up

- Replaced the publishing guide and its README link with `.github/workflows/release.yml`. Pushing a `v*` tag runs only npm publication, authenticated by the `NPM_TOKEN` GitHub Actions secret. The workflow skips npm lifecycle scripts, including `prepublishOnly`.
