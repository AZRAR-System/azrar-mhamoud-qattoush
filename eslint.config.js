import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Convert the existing .eslintrc.cjs to ESLint v9 flat config.
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      'release*/',
      'Backend/',
      'src/services/notificationExamples.ts',
      'src/electron/**',
      '**/*.config.js',
      '**/*.config.cjs',
      'electron/*.js',
      'electron/*.cjs',
      'electron/*.map',
    ],
  },
  ...compat.config({
    root: true,
    env: {
      browser: true,
      es2021: true,
      node: true,
    },
    extends: [
      'eslint:recommended',
      'plugin:react/recommended',
      'plugin:react/jsx-runtime',
      'plugin:@typescript-eslint/recommended',
      'plugin:react-hooks/recommended',
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    plugins: ['react', '@typescript-eslint', 'react-hooks'],
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // General
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],

      // TypeScript
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'warn',

      // React
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Best practices
      'prefer-const': 'warn',
      'no-var': 'error',
      eqeqeq: ['warn', 'always'],

      // This repo historically uses single-line ifs; enable later if desired.
      curly: 'off',
      'brace-style': 'off',

      // Reduce noise from style-only JSX rules in Arabic content.
      'react/no-unescaped-entities': 'off',
      'react/display-name': 'off',

      // Keep visibility but don't block builds for now.
      'no-control-regex': 'warn',
      'no-useless-escape': 'warn',
      'no-case-declarations': 'warn',
      'no-empty': 'warn',
    },
    overrides: [
      {
        files: ['*.test.ts', '*.test.tsx', '*.spec.ts', '*.spec.tsx'],
        env: {
          jest: true,
        },
        rules: {
          '@typescript-eslint/no-explicit-any': 'off',
        },
      },
      {
        files: ['**/*.js', '**/*.cjs'],
        rules: {
          // A lot of JS in this repo (especially Electron tooling) legitimately uses require().
          '@typescript-eslint/no-require-imports': 'off',
        },
      },
    ],
    ignorePatterns: [
      'node_modules/',
      'dist/',
      'build/',
      'release*/',
      '*.config.js',
      '*.config.cjs',
    ],
  }),
  {
    files: [
      '**/*.test.js',
      '**/*.spec.js',
      '**/*.test.cjs',
      '**/*.spec.cjs',
    ],
    languageOptions: {
      globals: {
        afterAll: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        describe: 'readonly',
        expect: 'readonly',
        it: 'readonly',
        jest: 'readonly',
        test: 'readonly',
      },
    },
  },
];
