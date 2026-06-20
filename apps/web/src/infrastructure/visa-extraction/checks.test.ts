import { describe, expect, it } from 'vitest';
import type { ExtractedVisaRule } from './extraction-schema';
import { runSanityChecks } from './checks';

function extracted(overrides: Partial<ExtractedVisaRule> = {}): ExtractedVisaRule {
  return {
    purpose: 'tourism',
    workRights: false,
    minAgeYears: null,
    maxAgeYears: null,
    eligibilityNotes: null,
    category: 'visa-free',
    maxStayDays: 90,
    visaValidityDays: null,
    entryType: 'multiple',
    minDaysOutBeforeReturn: null,
    rollingWindow: null,
    otherRequirements: [],
    sourceNote: 'gov.uk travel advice',
    ...overrides,
  };
}

const ctx = { destination: 'JPN', knownAlpha3: new Set(['JPN', 'FRA']) };

describe('runSanityChecks', () => {
  it('passes a coherent rule', () => {
    expect(runSanityChecks(extracted(), ctx)).toEqual([]);
  });

  it('flags an unknown / malformed destination', () => {
    expect(runSanityChecks(extracted(), { destination: 'XX', knownAlpha3: ctx.knownAlpha3 })).toContain(
      'destination "XX" is not an ISO alpha-3 code',
    );
    expect(
      runSanityChecks(extracted(), { destination: 'ZZZ', knownAlpha3: ctx.knownAlpha3 }),
    ).toContain('destination "ZZZ" is not in the known country list');
  });

  it('flags max stay exceeding visa validity', () => {
    expect(runSanityChecks(extracted({ maxStayDays: 200, visaValidityDays: 90 }), ctx)).toContain(
      'maxStayDays (200) exceeds visaValidityDays (90)',
    );
  });

  it('flags a single-entry rule carrying a rolling window', () => {
    expect(
      runSanityChecks(
        extracted({ entryType: 'single', rollingWindow: { allowanceDays: 90, windowDays: 180 } }),
        ctx,
      ),
    ).toContain('single-entry rule carries a rolling window (usually a multiple-entry concept)');
  });

  it('flags an allowance larger than its window and inverted age bounds', () => {
    expect(
      runSanityChecks(extracted({ rollingWindow: { allowanceDays: 200, windowDays: 180 } }), ctx),
    ).toContain('rolling allowance (200) exceeds window (180)');
    expect(runSanityChecks(extracted({ minAgeYears: 40, maxAgeYears: 30 }), ctx)).toContain(
      'minAgeYears (40) exceeds maxAgeYears (30)',
    );
  });

  it('flags a working-holiday rule without work rights and a missing citation', () => {
    expect(runSanityChecks(extracted({ purpose: 'working-holiday', workRights: false }), ctx)).toContain(
      'working-holiday purpose without workRights',
    );
    expect(runSanityChecks(extracted({ sourceNote: '' }), ctx)).toContain(
      'missing a meaningful sourceNote citation',
    );
  });
});
