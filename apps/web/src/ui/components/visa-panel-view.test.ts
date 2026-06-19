import { describe, expect, it } from 'vitest';
import type { CountryCoverage, CountryStay, VisaAssessment } from '@/domain/visa/types';
import { buildVisaRows, coverageName, toVisaRow } from './visa-panel-view';

const NAMES = new Map([
  ['FRA', 'France'],
  ['JPN', 'Japan'],
]);

function stay(overrides: Partial<CountryStay> = {}): CountryStay {
  return {
    destination: 'JPN',
    zoneCode: null,
    countries: ['JPN'],
    totalDays: 20,
    entries: 1,
    firstArrival: null,
    lastDeparture: null,
    segments: [],
    ...overrides,
  };
}

function coverage(overrides: Partial<CountryCoverage> = {}): CountryCoverage {
  return {
    destination: 'JPN',
    zoneCode: null,
    appliedNationality: 'GBR',
    status: 'ok',
    appliedRuleId: 'r',
    category: 'visa-free',
    purpose: 'tourism',
    workRights: false,
    stay: stay(),
    violations: [],
    otherRequirements: [],
    alternativeRuleIds: [],
    ...overrides,
  };
}

describe('coverageName', () => {
  it('resolves alpha-3 to a friendly name', () => {
    expect(coverageName({ destination: 'FRA', zoneCode: null }, NAMES)).toBe('France');
  });
  it('names a zone', () => {
    expect(coverageName({ destination: 'SCHENGEN', zoneCode: 'SCHENGEN' }, NAMES)).toBe(
      'Schengen Area',
    );
  });
  it('falls back to the raw code when unknown', () => {
    expect(coverageName({ destination: 'ZZZ', zoneCode: null }, NAMES)).toBe('ZZZ');
  });
});

describe('toVisaRow', () => {
  it('maps an ok visa-free coverage', () => {
    const row = toVisaRow(coverage(), NAMES);
    expect(row).toMatchObject({
      name: 'Japan',
      severity: 'ok',
      statusLabel: 'OK',
      categoryLabel: 'Visa-free',
      staySummary: '20 days planned',
    });
  });

  it('maps a violation with its messages and entry count', () => {
    const row = toVisaRow(
      coverage({
        destination: 'SCHENGEN',
        zoneCode: 'SCHENGEN',
        status: 'violation',
        category: null,
        stay: stay({ destination: 'SCHENGEN', zoneCode: 'SCHENGEN', totalDays: 95, entries: 2 }),
        violations: [
          { kind: 'rolling-window-exceeded', message: '95 days exceeds the 90-day allowance.', limit: 90, actual: 95 },
        ],
      }),
      NAMES,
    );
    expect(row.severity).toBe('danger');
    expect(row.statusLabel).toBe('Issue');
    expect(row.staySummary).toBe('95 days planned · 2 entries');
    expect(row.messages).toEqual(['95 days exceeds the 90-day allowance.']);
  });

  it('renders an unknown coverage as informational with no stay summary when zero days', () => {
    const row = toVisaRow(
      coverage({ status: 'unknown', category: null, stay: stay({ totalDays: 0 }) }),
      NAMES,
    );
    expect(row.severity).toBe('info');
    expect(row.statusLabel).toBe('No visa data yet');
    expect(row.staySummary).toBeNull();
    expect(row.categoryLabel).toBeNull();
  });
});

describe('buildVisaRows', () => {
  it('orders violations first, then by name', () => {
    const assessment: VisaAssessment = {
      coverages: [
        coverage({ destination: 'JPN', status: 'ok' }),
        coverage({
          destination: 'SCHENGEN',
          zoneCode: 'SCHENGEN',
          status: 'violation',
          stay: stay({ destination: 'SCHENGEN', zoneCode: 'SCHENGEN' }),
        }),
      ],
      unknownCountries: [],
    };
    const rows = buildVisaRows(assessment, NAMES);
    expect(rows.map((r) => r.name)).toEqual(['Schengen Area', 'Japan']);
  });
});
