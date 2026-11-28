# Generated default configuration

- `touro init` renders editable values from `src/config/configuration.js`. When adding a public default, update the grouped template in `src/config/init.js`. The configuration unit test checks that the generated export matches all defined defaults and passes the project schema.
- Both `format` properties default to omission. The template documents that scan lists all supported formats and optimization keeps the source format. The schema accepts explicit format names only.
- The CLI keeps its CommonJS and ESM detection and exclusive write. Hidden subdirectories and symbolic links are documented as discovery behavior.
- On Windows with Node.js 26.13.1, `npm run lint`, the focused configuration and CLI suites (55 tests), and `npm test` (77 tests) passed. The CLI test compared scan output and optimized PNG bytes before and after generation.
