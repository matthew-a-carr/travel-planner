import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const STATUSES = new Set(['complete', 'in_progress', 'missing']);
const CAPABILITY_ID = /^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+$/;
const WEB_E2E_DIRECTORY = 'apps/web/tests/e2e';
const NUMBERED_WEB_SUITE = /^\d{2}-.*\.spec\.ts$/;

export function validateParityManifest({ repoRoot, manifest, requireComplete = false }) {
  const errors = [];
  const counts = { complete: 0, in_progress: 0, missing: 0 };

  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { errors: ['manifest must be an object'], counts };
  }
  if (manifest.version !== 1) errors.push('manifest version must be 1');

  const trackedWebSuites = stringArray(
    manifest.trackedWebSuites,
    'trackedWebSuites',
    errors,
  );
  const capabilities = Array.isArray(manifest.capabilities) ? manifest.capabilities : [];
  if (!Array.isArray(manifest.capabilities)) errors.push('capabilities must be an array');
  if (capabilities.length === 0) errors.push('capabilities must not be empty');

  const seenIds = new Set();
  const referencedWebSuites = new Set();
  for (const [index, capability] of capabilities.entries()) {
    const label = `capabilities[${index}]`;
    if (!capability || typeof capability !== 'object' || Array.isArray(capability)) {
      errors.push(`${label} must be an object`);
      continue;
    }

    const id = capability.id;
    if (typeof id !== 'string' || !CAPABILITY_ID.test(id)) {
      errors.push(`${label}.id must be a stable dotted capability id`);
    } else if (seenIds.has(id)) {
      errors.push(`duplicate capability id: ${id}`);
    } else {
      seenIds.add(id);
    }
    const capabilityLabel = typeof id === 'string' ? id : label;

    if (typeof capability.title !== 'string' || capability.title.trim() === '') {
      errors.push(`${capabilityLabel} must have a title`);
    }
    if (!Number.isInteger(capability.slice) || capability.slice < 1 || capability.slice > 8) {
      errors.push(`${capabilityLabel} must have an EPIC-006 slice from 1 to 8`);
    }
    if (!STATUSES.has(capability.status)) {
      errors.push(`${capabilityLabel} has invalid status: ${String(capability.status)}`);
    } else {
      counts[capability.status] += 1;
      if (requireComplete && capability.status !== 'complete') {
        errors.push(`${capabilityLabel} is ${capability.status}; strict parity requires complete`);
      }
    }

    const webEvidence = stringArray(capability.webEvidence, `${capabilityLabel}.webEvidence`, errors);
    const mobileEvidence = stringArray(
      capability.mobileEvidence,
      `${capabilityLabel}.mobileEvidence`,
      errors,
    );
    const contractEvidence = stringArray(
      capability.contractEvidence,
      `${capabilityLabel}.contractEvidence`,
      errors,
    );

    if (webEvidence.length === 0) errors.push(`${capabilityLabel} requires web evidence`);
    if (capability.status === 'complete' && mobileEvidence.length === 0) {
      errors.push(`${capabilityLabel} is complete but has no mobile evidence`);
    }
    if (capability.status === 'complete' && contractEvidence.length === 0) {
      errors.push(`${capabilityLabel} is complete but has no contract evidence`);
    }

    for (const evidence of [...webEvidence, ...mobileEvidence, ...contractEvidence]) {
      validateEvidencePath(repoRoot, evidence, errors);
    }
    for (const evidence of webEvidence) referencedWebSuites.add(evidence);
  }

  for (const suite of trackedWebSuites) {
    validateEvidencePath(repoRoot, suite, errors);
    if (!referencedWebSuites.has(suite)) {
      errors.push(`tracked web suite is not referenced by a capability: ${suite}`);
    }
  }

  const webDirectory = path.join(repoRoot, WEB_E2E_DIRECTORY);
  if (!existsSync(webDirectory)) {
    errors.push(`${WEB_E2E_DIRECTORY} does not exist`);
  } else {
    const tracked = new Set(trackedWebSuites);
    for (const name of readdirSync(webDirectory).filter((entry) => NUMBERED_WEB_SUITE.test(entry))) {
      const suite = `${WEB_E2E_DIRECTORY}/${name}`;
      if (!tracked.has(suite)) errors.push(`numbered web suite is not tracked: ${suite}`);
    }
  }

  return { errors, counts };
}

function stringArray(value, label, errors) {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== 'string' || entry.trim() === '')
  ) {
    errors.push(`${label} must be an array of repository-relative paths`);
    return [];
  }
  return value;
}

function validateEvidencePath(repoRoot, evidence, errors) {
  if (path.isAbsolute(evidence) || evidence.split('/').includes('..')) {
    errors.push(`${evidence} must be repository-relative`);
    return;
  }
  if (!existsSync(path.join(repoRoot, evidence))) errors.push(`${evidence} does not exist`);
}

function run() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDirectory, '../../..');
  const manifestPath = path.join(repoRoot, 'docs/mobile-parity.json');
  const requireComplete = process.argv.includes('--require-complete');

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    console.error(`Mobile parity manifest could not be read: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const result = validateParityManifest({ repoRoot, manifest, requireComplete });
  if (result.errors.length > 0) {
    console.error('Mobile parity manifest is invalid:');
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  const { complete, in_progress: inProgress, missing } = result.counts;
  console.log(`Mobile parity: ${complete} complete, ${inProgress} in progress, ${missing} missing.`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) run();
