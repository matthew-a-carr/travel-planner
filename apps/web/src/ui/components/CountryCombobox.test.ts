import { describe, expect, it } from 'vitest';
import type { CountryReference } from '@/domain/country-reference/types';
import { filterCountries } from './CountryCombobox';

const refs: CountryReference[] = [
  {
    country: 'Japan',
    alpha2: 'JP',
    alpha3: 'JPN',
    region: 'Asia',
    subregion: 'Eastern Asia',
    avgDailyCostPence: 8_000,
    currency: 'GBP',
    source: 'manual',
  },
  {
    country: 'Jamaica',
    alpha2: 'JM',
    alpha3: 'JAM',
    region: 'Americas',
    subregion: 'Caribbean',
    avgDailyCostPence: 4_000,
    currency: 'GBP',
    source: 'estimated',
  },
  {
    country: 'Thailand',
    alpha2: 'TH',
    alpha3: 'THA',
    region: 'Asia',
    subregion: 'South-Eastern Asia',
    avgDailyCostPence: 3_500,
    currency: 'GBP',
    source: 'manual',
  },
];

describe('filterCountries', () => {
  it('returns all countries for an empty query', () => {
    expect(filterCountries('', refs)).toHaveLength(3);
  });

  it('filters by substring match on country name', () => {
    const result = filterCountries('jap', refs);
    expect(result).toHaveLength(1);
    expect(result[0]?.country).toBe('Japan');
  });

  it('matches case-insensitively', () => {
    expect(filterCountries('JAPAN', refs)).toHaveLength(1);
    expect(filterCountries('thailand', refs)).toHaveLength(1);
  });

  it('matches multiple countries with shared substring', () => {
    const result = filterCountries('ja', refs);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.country)).toEqual(['Japan', 'Jamaica']);
  });

  it('matches by alpha2 code', () => {
    const result = filterCountries('JP', refs);
    expect(result).toHaveLength(1);
    expect(result[0]?.country).toBe('Japan');
  });

  it('matches by alpha3 code', () => {
    const result = filterCountries('THA', refs);
    expect(result).toHaveLength(1);
    expect(result[0]?.country).toBe('Thailand');
  });

  it('trims whitespace from query', () => {
    const result = filterCountries('  japan  ', refs);
    expect(result).toHaveLength(1);
  });

  it('returns empty array when no match', () => {
    expect(filterCountries('narnia', refs)).toHaveLength(0);
  });
});
