import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadExtractedVisaRules } from './ingest-visa-rules';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'visa-data-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const validRow = {
  nationality: 'GBR',
  destination: 'JPN',
  zoneCode: null,
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
  rollingAllowanceDays: null,
  rollingWindowDays: null,
  otherRequirements: [],
  validFrom: '2026-06-20',
  validTo: null,
  source: 'ai-extracted',
  sourceNote: 'gov.uk',
};

describe('loadExtractedVisaRules', () => {
  it('returns [] when the directory is missing', () => {
    expect(loadExtractedVisaRules(join(dir, 'does-not-exist'))).toEqual([]);
  });

  it('loads + validates rows from nested files', () => {
    const gbr = join(dir, 'GBR');
    writeFileSync(join(dir, 'ignore.txt'), 'not json');
    mkdirSync(gbr, { recursive: true });
    writeFileSync(join(gbr, 'JPN.json'), JSON.stringify([validRow]));
    const rows = loadExtractedVisaRules(dir);
    expect(rows).toHaveLength(1);
    expect(rows[0].destination).toBe('JPN');
  });

  it('throws on a malformed row', () => {
    writeFileSync(join(dir, 'bad.json'), JSON.stringify([{ ...validRow, category: 'not-a-category' }]));
    expect(() => loadExtractedVisaRules(dir)).toThrow(/failed validation/);
  });

  it('throws when a file is not an array', () => {
    writeFileSync(join(dir, 'obj.json'), JSON.stringify(validRow));
    expect(() => loadExtractedVisaRules(dir)).toThrow(/expected a JSON array/);
  });
});
