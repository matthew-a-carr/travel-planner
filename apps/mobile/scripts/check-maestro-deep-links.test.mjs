import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const authenticatedRead = readFileSync(
  new URL('../.maestro/flows/authenticated-read-journey.yaml', import.meta.url),
  'utf8',
);

test('the missing-trip deep link tolerates first-use iOS confirmation state', () => {
  const missingTripLink =
    "- openLink: 'travelplanner:///trips/00000000-0000-4000-8000-000000000404'";

  assert.equal(
    authenticatedRead.split(missingTripLink).length - 1,
    2,
    'replay the link after granting first-use confirmation so iOS delivers it',
  );
  assert.match(
    authenticatedRead,
    /- runFlow:\n\s+when:\n\s+visible: Open\n\s+commands:\n\s+- tapOn: Open/,
    'the permanent iOS confirmation may be present or already accepted',
  );
});
