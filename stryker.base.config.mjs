export const baseConfig = {
  packageManager: 'pnpm',
  checkers: ['typescript'],
  coverageAnalysis: 'perTest',
  reporters: ['html', 'clear-text', 'progress'],
  timeoutFactor: 2,
  timeoutMS: 30000,
  tempDirName: '.stryker-tmp',
  cleanTempDir: true,
  ignoreStatic: true,
  inPlace: true,
  incremental: true,
  incrementalFile: 'reports/stryker-incremental.json',
};

export const vitestMutate = ['src/**/*.ts', '!src/**/__tests__/**', '!src/**/*.d.ts'];

export function createVitestConfig(resolvePlugin, overrides = {}) {
  return {
    ...baseConfig,
    testRunner: 'vitest',
    mutate: vitestMutate,
    plugins: [
      resolvePlugin('@stryker-mutator/vitest-runner'),
      resolvePlugin('@stryker-mutator/typescript-checker'),
    ],
    vitest: { pool: 'forks' },
    ...overrides,
  };
}
