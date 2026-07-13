import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const keyboardJourneys = [
  'planning-core-journey.yaml',
  'spend-finance-journey.yaml',
];

test('write journeys dismiss the iOS keyboard without swipe typing', () => {
  for (const flow of keyboardJourneys) {
    const contents = readFileSync(new URL(`../.maestro/flows/${flow}`, import.meta.url), 'utf8');

    assert.match(contents, /- hideKeyboard\b/, `${flow} must dismiss the keyboard explicitly`);
    assert.doesNotMatch(
      contents,
      /- swipe:\s*\n\s*direction: UP/,
      `${flow} must not swipe while the keyboard may be open`,
    );
  }
});
