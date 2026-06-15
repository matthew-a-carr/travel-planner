import { describe, expect, it } from 'vitest';
import { moneyUnchecked } from '../trip/types';
import type { Destination } from '../trip/types';
import type { Alpha3, TravellerProfile, VisaRule } from './types';
import {
  ageAt,
  aggregateCountryStays,
  assessVisas,
  evaluateCoverage,
  evaluateRollingWindow,
  filterEligibleRules,
  pickBestCoverage,
  selectApplicableRule,
} from './visa';

// ─── Fixtures ───────────────────────────────────────────────────────────────

function destination(overrides: Partial<Destination> & Pick<Destination, 'country'>): Destination {
  return {
    id: overrides.id ?? `dest-${Math.random().toString(36).slice(2)}`,
    tripId: 'trip-1',
    name: overrides.name ?? overrides.country,
    country: overrides.country,
    city: overrides.city ?? null,
    latitude: null,
    longitude: null,
    estimatedBudget: moneyUnchecked(0),
    comfortLevel: 'mid',
    startDate: overrides.startDate ?? null,
    endDate: overrides.endDate ?? null,
    sortOrder: overrides.sortOrder ?? 0,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };
}

function rule(overrides: Partial<VisaRule> & Pick<VisaRule, 'id' | 'destination'>): VisaRule {
  return {
    id: overrides.id,
    nationality: overrides.nationality ?? 'GBR',
    destination: overrides.destination,
    zoneCode: overrides.zoneCode ?? null,
    purpose: overrides.purpose ?? 'tourism',
    workRights: overrides.workRights ?? false,
    eligibility: overrides.eligibility ?? { minAgeYears: null, maxAgeYears: null, notes: null },
    category: overrides.category ?? 'visa-free',
    maxStayDays: overrides.maxStayDays === undefined ? 90 : overrides.maxStayDays,
    visaValidityDays: overrides.visaValidityDays ?? null,
    entryType: overrides.entryType ?? 'multiple',
    minDaysOutBeforeReturn: overrides.minDaysOutBeforeReturn ?? null,
    rollingWindow: overrides.rollingWindow ?? null,
    otherRequirements: overrides.otherRequirements ?? [],
    validFrom: overrides.validFrom ?? '2020-01-01',
    validTo: overrides.validTo ?? null,
    source: overrides.source ?? 'manual',
    sourceNote: overrides.sourceNote ?? null,
  };
}

const ALPHA3: Record<string, Alpha3> = {
  Japan: 'JPN',
  France: 'FRA',
  Italy: 'ITA',
  Spain: 'ESP',
  Australia: 'AUS',
  Thailand: 'THA',
  Testland: 'TST',
};
const toAlpha3 = (name: string): Alpha3 | null => ALPHA3[name] ?? null;
const SCHENGEN = new Set(['FRA', 'ITA', 'ESP']);
const zoneOf = (a: Alpha3): string | null => (SCHENGEN.has(a) ? 'SCHENGEN' : null);

const ukOnly: TravellerProfile = {
  passports: [{ nationality: 'GBR', label: 'UK passport' }],
  dateOfBirth: '1991-06-15',
};

const TRAVEL = { start: '2026-01-01', end: '2026-12-31' };

// ─── ageAt ──────────────────────────────────────────────────────────────────

describe('ageAt', () => {
  it('counts full years, not yet reaching the birthday', () => {
    expect(ageAt('1991-06-15', '2026-06-14')).toBe(34);
    expect(ageAt('1991-06-15', '2026-06-15')).toBe(35);
  });
});

// ─── aggregateCountryStays ────────────────────────────────────────────────────

describe('aggregateCountryStays', () => {
  it('sums two cities in one country into one stay (AC1)', () => {
    const dests = [
      destination({ country: 'Japan', city: 'Tokyo', startDate: new Date('2026-01-01'), endDate: new Date('2026-02-20') }),
      destination({ country: 'Japan', city: 'Osaka', startDate: new Date('2026-02-20'), endDate: new Date('2026-04-11') }),
    ];
    const result = aggregateCountryStays(dests, toAlpha3, zoneOf);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0].destination).toBe('JPN');
    expect(result.value[0].totalDays).toBe(100);
    expect(result.value[0].entries).toBe(1);
  });

  it('counts a gap-separated return as two entries', () => {
    const dests = [
      destination({ country: 'Japan', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-11') }),
      destination({ country: 'Japan', startDate: new Date('2026-01-21'), endDate: new Date('2026-01-31') }),
    ];
    const result = aggregateCountryStays(dests, toAlpha3, zoneOf);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value[0].entries).toBe(2);
    expect(result.value[0].totalDays).toBe(20);
  });

  it('buckets Schengen countries into one zone group', () => {
    const dests = [
      destination({ country: 'France', startDate: new Date('2026-01-01'), endDate: new Date('2026-02-10') }),
      destination({ country: 'Italy', startDate: new Date('2026-02-10'), endDate: new Date('2026-03-12') }),
    ];
    const result = aggregateCountryStays(dests, toAlpha3, zoneOf);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value).toHaveLength(1);
    expect(result.value[0].destination).toBe('SCHENGEN');
    expect(result.value[0].zoneCode).toBe('SCHENGEN');
    expect(result.value[0].countries).toEqual(['FRA', 'ITA']);
  });

  it('ignores undated and unresolvable destinations', () => {
    const dests = [
      destination({ country: 'Japan' }), // no dates
      destination({ country: 'Atlantis', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-05') }), // unresolvable
    ];
    const result = aggregateCountryStays(dests, toAlpha3, zoneOf);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value).toHaveLength(0);
  });
});

// ─── filterEligibleRules ──────────────────────────────────────────────────────

describe('filterEligibleRules', () => {
  const wh = rule({
    id: 'au-wh',
    destination: 'AUS',
    purpose: 'working-holiday',
    eligibility: { minAgeYears: 18, maxAgeYears: 35, notes: null },
  });

  it('keeps an age-gated rule for an eligible traveller (age 34)', () => {
    const profile: TravellerProfile = { passports: ukOnly.passports, dateOfBirth: '1991-06-15' };
    expect(filterEligibleRules([wh], profile, TRAVEL).map((r) => r.id)).toEqual(['au-wh']);
  });

  it('drops an age-gated rule for an ineligible traveller (age 36)', () => {
    const profile: TravellerProfile = { passports: ukOnly.passports, dateOfBirth: '1989-06-15' };
    expect(filterEligibleRules([wh], profile, TRAVEL)).toHaveLength(0);
  });

  it('keeps age-gated rules when DOB is unknown', () => {
    const profile: TravellerProfile = { passports: ukOnly.passports, dateOfBirth: null };
    expect(filterEligibleRules([wh], profile, TRAVEL)).toHaveLength(1);
  });
});

// ─── selectApplicableRule ─────────────────────────────────────────────────────

describe('selectApplicableRule', () => {
  it('returns null when no rule is temporally applicable (AC6)', () => {
    const r = rule({ id: 'old', destination: 'JPN', validFrom: '2000-01-01', validTo: '2005-01-01' });
    const result = selectApplicableRule([r], TRAVEL);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value).toBeNull();
  });

  it('picks the newest validFrom among overlapping rules (AC5)', () => {
    const oldR = rule({ id: 'old', destination: 'JPN', validFrom: '2020-01-01' });
    const newR = rule({ id: 'new', destination: 'JPN', validFrom: '2025-06-01' });
    const result = selectApplicableRule([oldR, newR], TRAVEL);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value?.id).toBe('new');
  });

  it('prefers a short-stay purpose over working-holiday by default (AC7)', () => {
    const tourist = rule({ id: 'au-tourist', destination: 'AUS', purpose: 'tourism' });
    const wh = rule({ id: 'au-wh', destination: 'AUS', purpose: 'working-holiday' });
    const result = selectApplicableRule([wh, tourist], TRAVEL);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value?.id).toBe('au-tourist');
  });
});

// ─── evaluateRollingWindow ────────────────────────────────────────────────────

describe('evaluateRollingWindow', () => {
  const win = { allowanceDays: 90, windowDays: 180 };

  it('passes a single 89-day Schengen stay', () => {
    const seg = [{ start: '2026-01-01', end: '2026-03-31', days: 89 }];
    const rw = evaluateRollingWindow(seg, win);
    expect(rw.exceeded).toBe(false);
    expect(rw.peakDays).toBe(89);
  });

  it('flags a single 91-day Schengen stay', () => {
    const seg = [{ start: '2026-01-01', end: '2026-04-02', days: 91 }];
    const rw = evaluateRollingWindow(seg, win);
    expect(rw.exceeded).toBe(true);
    expect(rw.peakDays).toBe(91);
  });
});

// ─── evaluateCoverage ─────────────────────────────────────────────────────────

describe('evaluateCoverage', () => {
  function stayOf(dests: Destination[]) {
    const r = aggregateCountryStays(dests, toAlpha3, zoneOf);
    if (!r.ok) throw new Error('expected ok');
    return r.value[0];
  }

  it('flags max-stay exceeded across multiple cities (AC1)', () => {
    const stay = stayOf([
      destination({ country: 'Japan', startDate: new Date('2026-01-01'), endDate: new Date('2026-02-20') }),
      destination({ country: 'Japan', startDate: new Date('2026-02-20'), endDate: new Date('2026-04-11') }),
    ]);
    const cov = evaluateCoverage(stay, rule({ id: 'jp', destination: 'JPN', maxStayDays: 90 }));
    expect(cov.status).toBe('violation');
    expect(cov.violations.map((v) => v.kind)).toContain('max-stay-exceeded');
  });

  it('flags a single-entry visa used for re-entry (AC3)', () => {
    const stay = stayOf([
      destination({ country: 'Thailand', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-11') }),
      destination({ country: 'Thailand', startDate: new Date('2026-02-01'), endDate: new Date('2026-02-11') }),
    ]);
    const single = evaluateCoverage(stay, rule({ id: 'th', destination: 'THA', entryType: 'single' }));
    expect(single.violations.map((v) => v.kind)).toContain('single-entry-multiple-entries');
    const multi = evaluateCoverage(stay, rule({ id: 'th2', destination: 'THA', entryType: 'multiple' }));
    expect(multi.violations.map((v) => v.kind)).not.toContain('single-entry-multiple-entries');
  });

  it('flags a cooling-off violation (AC4)', () => {
    const stay = stayOf([
      destination({ country: 'Thailand', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-11') }),
      destination({ country: 'Thailand', startDate: new Date('2026-02-10'), endDate: new Date('2026-02-20') }),
    ]);
    // 30 days out (Jan11 → Feb10) < 60 required.
    const cov = evaluateCoverage(
      stay,
      rule({ id: 'th', destination: 'THA', entryType: 'multiple', minDaysOutBeforeReturn: 60 }),
    );
    expect(cov.violations.map((v) => v.kind)).toContain('cooling-off-violated');
  });

  it('marks visa-required as action-needed, unknown rule as unknown', () => {
    const stay = stayOf([
      destination({ country: 'Japan', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10') }),
    ]);
    expect(evaluateCoverage(stay, rule({ id: 'r', destination: 'JPN', category: 'visa-required' })).status).toBe(
      'action-needed',
    );
    expect(evaluateCoverage(stay, null).status).toBe('unknown');
  });
});

// ─── pickBestCoverage ─────────────────────────────────────────────────────────

describe('pickBestCoverage', () => {
  it('prefers the passport with the better status (AC8)', () => {
    const base = {
      destination: 'XXX',
      zoneCode: null,
      stay: {
        destination: 'XXX',
        zoneCode: null,
        countries: ['XXX'],
        totalDays: 5,
        entries: 1,
        firstArrival: null,
        lastDeparture: null,
        segments: [],
      },
      purpose: 'tourism' as const,
      workRights: false,
      otherRequirements: [],
      alternativeRuleIds: [],
    };
    const gbr = {
      ...base,
      appliedNationality: 'GBR',
      status: 'action-needed' as const,
      appliedRuleId: 'g',
      category: 'visa-required' as const,
      violations: [],
    };
    const irl = {
      ...base,
      appliedNationality: 'IRL',
      status: 'ok' as const,
      appliedRuleId: 'i',
      category: 'visa-free' as const,
      violations: [],
    };
    expect(pickBestCoverage([gbr, irl]).appliedNationality).toBe('IRL');
  });
});

// ─── assessVisas (end-to-end pure pipeline) ───────────────────────────────────

describe('assessVisas', () => {
  it('raises one zone-level rolling-window violation for Schengen (AC2)', () => {
    const dests = [
      destination({ country: 'France', startDate: new Date('2026-01-01'), endDate: new Date('2026-02-10') }), // 40
      destination({ country: 'Italy', startDate: new Date('2026-02-10'), endDate: new Date('2026-03-12') }), // 30
      destination({ country: 'Spain', startDate: new Date('2026-03-12'), endDate: new Date('2026-04-06') }), // 25
    ];
    const schengen = rule({
      id: 'schengen-gbr',
      destination: 'FRA',
      zoneCode: 'SCHENGEN',
      maxStayDays: null,
      rollingWindow: { allowanceDays: 90, windowDays: 180 },
    });
    const result = assessVisas(ukOnly, dests, [schengen], toAlpha3, zoneOf, {
      start: '2026-01-01',
      end: '2026-04-06',
    });
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.coverages).toHaveLength(1);
    const cov = result.value.coverages[0];
    expect(cov.destination).toBe('SCHENGEN');
    expect(cov.stay.totalDays).toBe(95);
    const rolling = cov.violations.filter((v) => v.kind === 'rolling-window-exceeded');
    expect(rolling).toHaveLength(1);
  });

  it('auto-selects the tourist rule and lists working-holiday as an alternative for an eligible traveller (AC7)', () => {
    const dests = [
      destination({ country: 'Australia', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31') }),
    ];
    const tourist = rule({ id: 'au-tourist', destination: 'AUS', purpose: 'tourism', maxStayDays: 90 });
    const wh = rule({
      id: 'au-wh',
      destination: 'AUS',
      purpose: 'working-holiday',
      workRights: true,
      maxStayDays: 365,
      eligibility: { minAgeYears: 18, maxAgeYears: 35, notes: null },
    });
    const young: TravellerProfile = { passports: ukOnly.passports, dateOfBirth: '1991-06-15' }; // 34
    const result = assessVisas(young, dests, [tourist, wh], toAlpha3, zoneOf, {
      start: '2026-01-01',
      end: '2026-01-31',
    });
    if (!result.ok) throw new Error('expected ok');
    const cov = result.value.coverages[0];
    expect(cov.appliedRuleId).toBe('au-tourist');
    expect(cov.alternativeRuleIds).toContain('au-wh');
  });

  it('excludes the working-holiday rule entirely for an over-age traveller (AC7)', () => {
    const dests = [
      destination({ country: 'Australia', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31') }),
    ];
    const tourist = rule({ id: 'au-tourist', destination: 'AUS', purpose: 'tourism' });
    const wh = rule({
      id: 'au-wh',
      destination: 'AUS',
      purpose: 'working-holiday',
      eligibility: { minAgeYears: 18, maxAgeYears: 35, notes: null },
    });
    const older: TravellerProfile = { passports: ukOnly.passports, dateOfBirth: '1989-06-15' }; // 36
    const result = assessVisas(older, dests, [tourist, wh], toAlpha3, zoneOf, {
      start: '2026-01-01',
      end: '2026-01-31',
    });
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.coverages[0].alternativeRuleIds).not.toContain('au-wh');
  });

  it('reports a destination with no rule as unknown (AC6)', () => {
    const dests = [
      destination({ country: 'Testland', startDate: new Date('2026-01-01'), endDate: new Date('2026-01-10') }),
    ];
    const result = assessVisas(ukOnly, dests, [], toAlpha3, zoneOf, { start: '2026-01-01', end: '2026-01-10' });
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.coverages[0].status).toBe('unknown');
    expect(result.value.unknownCountries).toContain('TST');
  });
});
