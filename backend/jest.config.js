/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/*.test.ts',
    '**/*.spec.ts'
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/index.ts',
    '!src/migrations/**',
    '!src/seeds/**',
    '!src/types/**',
    '!src/config/swagger.ts',
  ],
  coverageThreshold: {
  global: {
    branches: 60,
    functions: 70,
    lines: 70,
    statements: 70,
  },
},

setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
};