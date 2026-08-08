import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    extensions: ['.ts', '.tsx', '.mts', '.js', '.jsx', '.mjs', '.json'],
  },
  test: {
    globals: true,
    clearMocks: true,
    environment: 'node',
    silent: false,
    disableConsoleIntercept: false,
    reporters: ['verbose'],
    pool: 'forks',
    fileParallelism: false,
    include: ['./**/__tests__/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '.idea', '*.js', 'tmp', 'docs'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: ['node_modules/', 'dist/', '**/__tests__/**', '**/*.test.ts', '**/*.d.ts'],
    },
    testTimeout: 20000,
  },
});