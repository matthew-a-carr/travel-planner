import { describe, expect, it } from 'vitest';
import { validateTravellerProfileInput } from './user-profile';

const TODAY = '2026-06-16';

describe('validateTravellerProfileInput', () => {
  it('accepts an empty profile', () => {
    const result = validateTravellerProfileInput({ dateOfBirth: null, passports: [] }, TODAY);
    expect(result).toEqual({ ok: true, value: { passports: [], dateOfBirth: null } });
  });

  it('normalises nationality to upper-case alpha-3 and trims labels', () => {
    const result = validateTravellerProfileInput(
      { dateOfBirth: '1990-05-15', passports: [{ nationality: ' gbr ', label: '  UK passport ' }] },
      TODAY,
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.value.passports).toEqual([{ nationality: 'GBR', label: 'UK passport' }]);
    expect(result.value.dateOfBirth).toBe('1990-05-15');
  });

  it('treats a blank label as null', () => {
    const result = validateTravellerProfileInput(
      { dateOfBirth: null, passports: [{ nationality: 'GBR', label: '   ' }] },
      TODAY,
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.value.passports[0].label).toBeNull();
  });

  it('deduplicates the same nationality, first wins', () => {
    const result = validateTravellerProfileInput(
      {
        dateOfBirth: null,
        passports: [
          { nationality: 'GBR', label: 'first' },
          { nationality: 'gbr', label: 'second' },
          { nationality: 'IRL', label: null },
        ],
      },
      TODAY,
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.value.passports).toEqual([
      { nationality: 'GBR', label: 'first' },
      { nationality: 'IRL', label: null },
    ]);
  });

  it('ignores empty passport rows', () => {
    const result = validateTravellerProfileInput(
      { dateOfBirth: null, passports: [{ nationality: '   ', label: 'x' }] },
      TODAY,
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.value.passports).toEqual([]);
  });

  it('rejects a malformed nationality', () => {
    const result = validateTravellerProfileInput(
      { dateOfBirth: null, passports: [{ nationality: 'United Kingdom', label: null }] },
      TODAY,
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a future date of birth', () => {
    const result = validateTravellerProfileInput(
      { dateOfBirth: '2030-01-01', passports: [] },
      TODAY,
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a malformed or impossible date of birth', () => {
    expect(validateTravellerProfileInput({ dateOfBirth: '15/05/1990', passports: [] }, TODAY).ok).toBe(
      false,
    );
    expect(validateTravellerProfileInput({ dateOfBirth: '2021-02-30', passports: [] }, TODAY).ok).toBe(
      false,
    );
    expect(validateTravellerProfileInput({ dateOfBirth: '1850-01-01', passports: [] }, TODAY).ok).toBe(
      false,
    );
  });

  it('accepts an empty-string date of birth as null', () => {
    const result = validateTravellerProfileInput({ dateOfBirth: '', passports: [] }, TODAY);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.dateOfBirth).toBeNull();
  });
});
