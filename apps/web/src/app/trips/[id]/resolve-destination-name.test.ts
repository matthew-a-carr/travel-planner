import { describe, expect, it } from 'vitest';
import { resolveDestinationName } from './resolve-destination-name';

describe('resolveDestinationName', () => {
  it('returns the trimmed user-typed name when provided', () => {
    expect(resolveDestinationName('  Tokyo Loop  ', 'Tokyo', 'Japan')).toBe('Tokyo Loop');
  });

  it('falls back to city when name is blank', () => {
    expect(resolveDestinationName('', 'Tokyo', 'Japan')).toBe('Tokyo');
  });

  it('falls back to city when name is whitespace only', () => {
    expect(resolveDestinationName('   ', 'Tokyo', 'Japan')).toBe('Tokyo');
  });

  it('falls back to country when both name and city are blank', () => {
    expect(resolveDestinationName('', '', 'Japan')).toBe('Japan');
  });

  it('falls back to country when name is blank and city is null', () => {
    expect(resolveDestinationName('', null, 'Japan')).toBe('Japan');
  });

  it('trims country in the fallback', () => {
    expect(resolveDestinationName('', null, '  Japan  ')).toBe('Japan');
  });
});
