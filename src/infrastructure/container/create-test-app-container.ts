import type { Db } from '@/infrastructure/db/client';
import { createAppContainer } from './create-app-container';
import type { AppContainer } from './types';

export type CreateTestAppContainerInput = {
  readonly dbClient: Db;
  readonly overrides?: Partial<AppContainer>;
};

/**
 * Test-only helper to build the real container with optional overrides.
 * Integration tests should pass a real Db instance to exercise real repositories.
 */
export function createTestAppContainer(input: CreateTestAppContainerInput): AppContainer {
  return createAppContainer(input);
}
