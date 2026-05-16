import { join } from 'node:path';

export const E2E_FIXTURES_DIR = join(process.cwd(), 'tests/e2e/fixtures');
export const E2E_CONTAINER_ID_FILE = join(E2E_FIXTURES_DIR, '.container-id');
export const E2E_POSTGRES_URL_FILE = join(E2E_FIXTURES_DIR, '.postgres-url');
export const E2E_AUTH_STATE_FILE = join(E2E_FIXTURES_DIR, 'auth-state.json');

export const E2E_WEB_BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
