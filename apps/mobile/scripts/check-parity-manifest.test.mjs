import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { validateParityManifest } from './check-parity-manifest.mjs';

function fixture() {
  const repoRoot = mkdtempSync(path.join(tmpdir(), 'mobile-parity-'));
  const web = 'apps/web/tests/e2e/01-trips.spec.ts';
  const mobile = 'apps/mobile/.maestro/flows/trips.yaml';
  const contract = 'packages/shared/src/trip.ts';
  for (const file of [web, mobile, contract]) {
    const absolute = path.join(repoRoot, file);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, 'evidence');
  }
  return {
    repoRoot,
    manifest: {
      version: 1,
      trackedWebSuites: [web],
      capabilities: [
        {
          id: 'trips.read',
          title: 'Read trips',
          slice: 1,
          status: 'complete',
          webEvidence: [web],
          mobileEvidence: [mobile],
          contractEvidence: [contract],
        },
      ],
    },
  };
}

test('accepts a valid incremental manifest', () => {
  const { repoRoot, manifest } = fixture();
  manifest.capabilities.push({
    id: 'trips.create',
    title: 'Create a trip',
    slice: 3,
    status: 'missing',
    webEvidence: [manifest.trackedWebSuites[0]],
    mobileEvidence: [],
    contractEvidence: [],
  });

  const result = validateParityManifest({ repoRoot, manifest });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.counts, { complete: 1, in_progress: 0, missing: 1 });
});

test('strict mode rejects an incomplete capability', () => {
  const { repoRoot, manifest } = fixture();
  manifest.capabilities[0].status = 'in_progress';

  const result = validateParityManifest({ repoRoot, manifest, requireComplete: true });

  assert.match(result.errors.join('\n'), /trips\.read.*in_progress/);
});

test('rejects duplicate capability IDs', () => {
  const { repoRoot, manifest } = fixture();
  manifest.capabilities.push({ ...manifest.capabilities[0] });

  const result = validateParityManifest({ repoRoot, manifest });

  assert.match(result.errors.join('\n'), /duplicate capability id.*trips\.read/i);
});

test('rejects evidence paths that do not exist', () => {
  const { repoRoot, manifest } = fixture();
  manifest.capabilities[0].webEvidence = ['apps/web/tests/e2e/does-not-exist.spec.ts'];

  const result = validateParityManifest({ repoRoot, manifest });

  assert.match(result.errors.join('\n'), /does-not-exist\.spec\.ts.*does not exist/);
});

test('rejects a false complete claim without mobile or contract evidence', () => {
  const { repoRoot, manifest } = fixture();
  manifest.capabilities[0].mobileEvidence = [];
  manifest.capabilities[0].contractEvidence = [];

  const result = validateParityManifest({ repoRoot, manifest });

  assert.match(result.errors.join('\n'), /trips\.read.*mobile evidence/);
  assert.match(result.errors.join('\n'), /trips\.read.*contract evidence/);
});

test('rejects a numbered web feature suite omitted from the baseline', () => {
  const { repoRoot, manifest } = fixture();
  writeFileSync(path.join(repoRoot, 'apps/web/tests/e2e/02-destinations.spec.ts'), 'evidence');

  const result = validateParityManifest({ repoRoot, manifest });

  assert.match(result.errors.join('\n'), /not tracked.*02-destinations\.spec\.ts/);
});
