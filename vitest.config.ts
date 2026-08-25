import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['__tests__/**/*.test.ts'],
    // Inline next and next-auth so vitest can resolve their internal imports
    server: {
      deps: {
        inline: ['next', 'next-auth'],
      },
    },
    coverage: {
      provider: 'v8',
      include: ['app/api/**', 'lib/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
