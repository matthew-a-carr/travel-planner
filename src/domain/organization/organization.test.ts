import { describe, expect, it } from 'vitest';
import {
  canManageOrganizationMembers,
  canMoveTripsBetweenOrganizations,
  derivePersonalOrganizationName,
} from './organization';

describe('derivePersonalOrganizationName', () => {
  it("uses the user's name when present", () => {
    expect(
      derivePersonalOrganizationName({
        userName: 'Matt Carr',
        email: 'matt@example.com',
      }),
    ).toBe("Matt Carr's Workspace");
  });

  it('collapses extra whitespace in user names', () => {
    expect(
      derivePersonalOrganizationName({
        userName: '  Matt     Carr  ',
        email: 'matt@example.com',
      }),
    ).toBe("Matt Carr's Workspace");
  });

  it('falls back to the email local part when name is missing', () => {
    expect(
      derivePersonalOrganizationName({
        userName: null,
        email: 'matt.carr@example.com',
      }),
    ).toBe("matt.carr's Workspace");
  });

  it('uses a fixed name for local-dev auth user', () => {
    expect(
      derivePersonalOrganizationName({
        userName: 'Local Dev User',
        email: 'local-dev@travel-planner.local',
      }),
    ).toBe('Local Dev Workspace');
  });

  it('caps generated names to 80 characters', () => {
    const longName = 'A'.repeat(120);
    expect(
      derivePersonalOrganizationName({
        userName: longName,
        email: 'long@example.com',
      }).length,
    ).toBeLessThanOrEqual(80);
  });
});

describe('organization role permissions', () => {
  it('owners can manage members', () => {
    expect(canManageOrganizationMembers('owner')).toBe(true);
  });

  it('members cannot manage members', () => {
    expect(canManageOrganizationMembers('member')).toBe(false);
  });

  it('owners can move trips between organizations', () => {
    expect(canMoveTripsBetweenOrganizations('owner')).toBe(true);
  });

  it('members cannot move trips between organizations', () => {
    expect(canMoveTripsBetweenOrganizations('member')).toBe(false);
  });
});
