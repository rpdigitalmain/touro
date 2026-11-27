# In-place optimization — 2026-11-27

- The root CLI action optimizes the current directory. The explicit `optimize [path]` entry point remains available for a specific file or directory.
- `src/images/source.js` shares traversal exclusions between optimization and scan. Discovery is extension-based. The processor checks the decoded format before writing.
- `src/images/replace.js` stages the encoded and synced file beside the original. Same-format updates use rename. Conversions use a hard link to publish without clobbering an occupied path, then remove the original. Hard-link support is required for conversion.
- Same-format results that would increase size leave the original bytes in place. Batch totals include successful and unchanged images in size calculations and count failures separately.
- On Windows with Node 26, lint and all 21 tests passed. The standalone build also passed all 11 CLI end-to-end tests.
