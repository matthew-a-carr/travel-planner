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

test('write journeys scroll created records into view before selecting them', () => {
  const planning = readFileSync(
    new URL('../.maestro/flows/planning-core-journey.yaml', import.meta.url),
    'utf8',
  );
  const spend = readFileSync(
    new URL('../.maestro/flows/spend-finance-journey.yaml', import.meta.url),
    'utf8',
  );

  assert.match(
    planning,
    /element:\n\s+id: 'trip-detail-destination-\.\*'\n\s+text: 'Mobile Planning Stop\.\*'\n\s+direction: DOWN\n\s+visibilityPercentage: 50/,
  );
  assert.match(
    spend,
    /element:\n\s+id: 'finance-entry-\.\*'\n\s+text: 'Mobile Finance Entry\.\*'\n\s+direction: DOWN\n\s+visibilityPercentage: 50/,
  );
});

test('write journeys wait for transitions and scroll destructive controls into view', () => {
  const planning = readFileSync(
    new URL('../.maestro/flows/planning-core-journey.yaml', import.meta.url),
    'utf8',
  );
  const spend = readFileSync(
    new URL('../.maestro/flows/spend-finance-journey.yaml', import.meta.url),
    'utf8',
  );

  assert.match(
    planning,
    /scrollUntilVisible:\n\s+element:\n\s+id: 'destination-delete'\n\s+direction: DOWN/,
  );
  assert.match(
    spend,
    /scrollUntilVisible:\n\s+element:\n\s+id: 'finance-dismiss-alerts'\n\s+direction: UP\n\s+visibilityPercentage: 50\n- tapOn:\n\s+id: 'finance-dismiss-alerts'\n\s+retryTapIfNoChange: true/,
  );
  assert.match(
    spend,
    /id: 'finance-entry-\.\*'\n\s+text: 'Mobile Finance Entry\.\*'\n\s+retryTapIfNoChange: true/,
  );
  assert.match(
    spend,
    /scrollUntilVisible:\n\s+element:\n\s+id: 'spend-delete'\n\s+direction: DOWN/,
  );
});
