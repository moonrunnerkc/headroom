// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import unicorn from 'eslint-plugin-unicorn';

const toolConfigFiles = ['*.config.{js,ts}', 'electron.vite.config.ts'];

// A flat config array is the tool's required default export.
export default defineConfig(
  {
    ignores: [
      'node_modules/',
      'out/',
      'dist/',
      'release/',
      'coverage/',
      'test-results/',
      'playwright-report/',
    ],
  },
  { linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' } },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { unicorn },
    rules: {
      'unicorn/filename-case': ['error', { case: 'kebabCase' }],
      'max-lines': ['error', { max: 300, skipBlankLines: false, skipComments: false }],
      'no-warning-comments': [
        'error',
        { terms: ['todo', 'fixme', 'xxx', 'hack'], location: 'anywhere' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' },
      ],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSAsExpression > TSAsExpression',
          message: 'Double assertions hide type errors; validate the value instead.',
        },
        {
          selector: 'ExportDefaultDeclaration',
          message: 'Application code uses named exports.',
        },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: 'error',
    },
  },
  { ...reactHooks.configs.flat.recommended, files: ['src/renderer/**/*.{ts,tsx}'] },
  { files: ['src/renderer/**/*.{ts,tsx}'], rules: { 'no-console': 'error' } },
  {
    files: ['src/domain/**/*.ts', 'src/shared/**/*.ts'],
    rules: {
      'no-console': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'electron',
            'node:*',
            'react',
            'react-dom',
            '@smartspectra/*',
            '../main/*',
            '../renderer/*',
          ],
        },
      ],
    },
  },
  {
    files: toolConfigFiles,
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'error',
      'max-lines': ['error', { max: 300 }],
    },
  },
);
