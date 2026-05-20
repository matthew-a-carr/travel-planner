/**
 * Jest configuration for the mobile app. See ADR 052 for why Jest (not
 * Vitest) is the runner; ADR 053 for why test files live under
 * `__tests__/` rather than co-located inside `app/` (Expo Router treats
 * every file in `app/` as a route). `jest-expo` provides the RN + Expo
 * transform preset; jest.setup.ts extends expect with RNTL matchers and
 * prepares the msw/native lifecycle hooks for future API mocking
 * (slice 6+).
 */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEach: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/__tests__/**/*.test.{ts,tsx}'],
};
