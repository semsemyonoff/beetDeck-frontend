import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['dist'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: '19' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // The SPA uses plain JS/JSX without PropTypes.
      'react/prop-types': 'off',
      // react-hooks 7 added this opinionated rule. The SPA intentionally uses
      // the reset-state-on-dependency-change and fetch-in-effect patterns
      // (Cover.jsx, Artist.jsx, Untagged.jsx), which are valid here. Disabled
      // for now; revisit if these effects are refactored. All other new
      // react-hooks 7 rules remain enforced.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  // Node.js config files (Vite config) need Node globals, not browser globals.
  {
    files: ['vite.config.js', 'vitest.config.js'],
    languageOptions: { globals: globals.node },
  },
  // Test files use Vitest globals (describe, it, expect, vi, etc.)
  {
    files: ['**/*.test.{js,jsx}', 'test/**/*.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
  },
  // Disables ESLint rules that would conflict with Prettier formatting.
  prettier,
];
