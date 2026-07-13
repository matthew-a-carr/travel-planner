import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const keyboardJourneys = [
  'planning-core-journey.yaml',
  'spend-finance-journey.yaml',
];

test('write journeys dismiss the iOS keyboard with the return key', () => {
  for (const flow of keyboardJourneys) {
    const contents = readFileSync(new URL(`../.maestro/flows/${flow}`, import.meta.url), 'utf8');

    assert.match(contents, /- pressKey: enter\b/, `${flow} must submit the focused input`);
    assert.doesNotMatch(contents, /- hideKeyboard\b/, `${flow} must avoid flaky iOS hideKeyboard`);
    assert.doesNotMatch(
      contents,
      /- swipe:\s*\n\s*direction: UP/,
      `${flow} must not swipe while the keyboard may be open`,
    );
  }
});
