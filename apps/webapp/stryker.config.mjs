import { baseConfig } from '../../stryker.base.config.mjs';

const config = {
  ...baseConfig,
  testRunner: 'jest',
  plugins: [
    import.meta.resolve('@stryker-mutator/jest-runner'),
    import.meta.resolve('@stryker-mutator/typescript-checker'),
  ],
  jest: {
    projectType: 'custom',
    configFile: 'jest.config.ts',
    enableFindRelatedTests: false,
  },
  mutate: [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'server/**/*.ts',
    'lib/**/*.ts',
    '!**/*.d.ts',
    '!**/*.test.{ts,tsx}',
    '!**/__tests__/**',
    '!**/cypress/**',
  ],
};

export default config;
