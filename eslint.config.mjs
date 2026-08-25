import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import js from '@eslint/js'

export default [
  js.configs.recommended,
  {
    files: ['app/**/*.ts', 'lib/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        // Node.js globals
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        fetch: 'readonly',
        FormData: 'readonly',
        Headers: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs['recommended'].rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
      'no-console': 'warn',
      // Turn off base rule — TS version handles it
      'no-unused-vars': 'off',
    },
  },
  {
    // Service modules use an intentional AnyDB pattern (accepts both db and tx).
    // Suppressing no-explicit-any here; the pattern is documented in each file.
    files: ['lib/modules/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // Route files use `as any` casts because Drizzle's `conditions` array type
    // inference degrades when mixing eq/gte/lte/isNull results.
    // Validation files use `as any` for Zod v3/v4 cross-compat error access.
    files: ['app/api/**/*.ts', 'lib/validation/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // Error utilities and authorize helper intentionally log to console server-side.
    files: ['lib/utils/error.ts', 'lib/auth/authorize.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: ['node_modules/**', '.next/**', '*.config.*', '__tests__/**', '__mocks__/**'],
  },
]
