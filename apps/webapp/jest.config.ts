import nextJest from 'next/jest.js';
import type { Config } from 'jest';

const createJestConfig = nextJest({
  dir: './',
});
const config: Config = {
  clearMocks: true,

  collectCoverage: false,

  coverageDirectory: 'coverage',

  coverageProvider: 'v8',

  globals: {
    fetch: global.fetch,
  },

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },

  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  testEnvironment: 'jsdom',

  testPathIgnorePatterns: [
    '/node_modules/',
    '__tests__/builders/',
    '__tests__/utils/',
  ],
};

export default createJestConfig(config);
