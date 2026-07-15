import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { findMobileArchitectureViolations } from './check-mobile-architecture.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

test('mobile runtime code stays independent of web delivery code', () => {
  assert.deepEqual(findMobileArchitectureViolations(repoRoot), []);
});

test('reports a relative import that escapes into the web application', () => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'mobile-architecture-'));
  const mobileFile = path.join(fixtureRoot, 'apps/mobile/src/trips/client.ts');
  mkdirSync(path.dirname(mobileFile), { recursive: true });
  writeFileSync(mobileFile, "import { action } from '../../../web/src/app/action';\n");

  assert.deepEqual(findMobileArchitectureViolations(fixtureRoot), [
    'apps/mobile/src/trips/client.ts imports ../../../web/src/app/action outside apps/mobile',
  ]);
});

test('reports a web workspace import while allowing the shared wire package', () => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'mobile-architecture-'));
  const mobileFile = path.join(fixtureRoot, 'apps/mobile/app/index.tsx');
  mkdirSync(path.dirname(mobileFile), { recursive: true });
  writeFileSync(
    mobileFile,
    "import type { Trip } from '@travel-planner/shared';\nimport { page } from '@travel-planner/web';\n",
  );

  assert.deepEqual(findMobileArchitectureViolations(fixtureRoot), [
    'apps/mobile/app/index.tsx imports forbidden workspace package @travel-planner/web',
  ]);
});

test('reports CommonJS requires of web workspace code', () => {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'mobile-architecture-'));
  const mobileFile = path.join(fixtureRoot, 'apps/mobile/src/legacy.ts');
  mkdirSync(path.dirname(mobileFile), { recursive: true });
  writeFileSync(mobileFile, "const web = require('@travel-planner/web');\n");

  assert.deepEqual(findMobileArchitectureViolations(fixtureRoot), [
    'apps/mobile/src/legacy.ts imports forbidden workspace package @travel-planner/web',
  ]);
});
