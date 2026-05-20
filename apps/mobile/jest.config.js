/**
 * Jest configuration for the mobile app. See ADR 052 for why Jest (not
 * Vitest) is the runner. `jest-expo` provides the RN + Expo transform
 * preset; jest.setup.ts extends expect with RNTL matchers and prepares
 * the msw/native lifecycle hooks for future API mocking (slice 6+).
 */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEach: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/app/**/*.test.{ts,tsx}'],
};
