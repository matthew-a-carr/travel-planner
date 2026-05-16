import { db } from '@/infrastructure/db/client';
import { createAppContainer } from './create-app-container';
import type { AppContainer } from './types';

let singleton: AppContainer | null = null;

export function getAppContainer(): AppContainer {
  if (singleton) return singleton;

  singleton = createAppContainer({ dbClient: db });
  return singleton;
}

export { createTestAppContainer } from './create-test-app-container';
export type { AppContainer } from './types';
