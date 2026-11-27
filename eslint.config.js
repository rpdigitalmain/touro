import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';

export default defineConfig([
  globalIgnores(['build/', 'coverage/', 'dist-exe/']),
  {
    files: ['**/*.{js,mjs}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: globals.nodeBuiltin,
    },
    rules: {
      eqeqeq: 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', reportUsedIgnorePattern: true }],
    },
  },
  {
    files: ['src/runtime/package-info.js'],
    languageOptions: { globals: { __PACKAGE_INFO__: 'readonly' } },
  },
  {
    files: ['src/runtime/load-sharp.js'],
    languageOptions: { globals: { __NATIVE_RUNTIME_ID__: 'readonly' } },
  },
]);
