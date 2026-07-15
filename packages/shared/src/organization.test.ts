import { describe, expect, it } from 'vitest';
import { organizationSummarySchema } from './organization';

describe('organizationSummarySchema', () => {
  it('accepts a user organization and closed role', () => {
    expect(
      organizationSummarySchema.parse({
        id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
        name: 'Carr Family',
        role: 'owner',
      }),
    ).toEqual({
      id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
      name: 'Carr Family',
      role: 'owner',
    });
  });

  it('rejects an unknown role', () => {
    expect(() =>
      organizationSummarySchema.parse({
        id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
        name: 'Team',
        role: 'viewer',
      }),
    ).toThrow();
  });
});
