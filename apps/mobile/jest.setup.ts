/**
 * Jest test framework setup. Runs after Jest's test framework is
 * installed (per the `setupFilesAfterEnv` config), so `beforeAll`,
 * `afterEach`, and `expect` extensions can be used here.
 *
 * Network mocking in slice 6 uses a global `fetch` spy via
 * `jest.spyOn(globalThis, 'fetch')` directly in each test — see
 * `apps/mobile/AGENTS.md` "API mocking" section. msw (already in
 * devDependencies) was evaluated and deferred per the SPEC-006
 * deviation log; reactivate by importing `./__mocks__/msw-server`
 * here and wiring the lifecycle hooks once the transformIgnorePatterns
 * + moduleNameMapper fight is worth it.
 */

import '@testing-library/react-native/matchers';
