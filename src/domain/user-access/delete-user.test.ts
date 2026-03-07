import { describe, expect, it } from 'vitest';
import { validateDeleteUser } from './delete-user';

describe('validateDeleteUser', () => {
  const validInput = {
    actorUserId: 'actor-1',
    targetUserId: 'target-1',
    actorIsAdmin: true,
    targetIsAdmin: false,
    soleOwnerOrganizationNames: [] as string[],
  };

  it('allows an admin to delete a non-admin user', () => {
    expect(validateDeleteUser(validInput)).toEqual({ ok: true, value: undefined });
  });

  it('rejects non-admin actors', () => {
    expect(validateDeleteUser({ ...validInput, actorIsAdmin: false })).toEqual({
      ok: false,
      error: 'Forbidden',
    });
  });

  it('prevents self-deletion', () => {
    expect(
      validateDeleteUser({ ...validInput, actorUserId: 'same', targetUserId: 'same' }),
    ).toEqual({
      ok: false,
      error: 'You cannot delete your own account',
    });
  });

  it('rejects deletion of another admin', () => {
    expect(validateDeleteUser({ ...validInput, targetIsAdmin: true })).toEqual({
      ok: false,
      error: 'Cannot delete an admin user. Remove their admin role first',
    });
  });

  it('blocks deletion when user is sole owner of organizations', () => {
    const result = validateDeleteUser({
      ...validInput,
      soleOwnerOrganizationNames: ['Acme Corp', 'Globex'],
    });
    expect(result).toEqual({
      ok: false,
      error: 'User is the sole owner of: Acme Corp, Globex. Transfer ownership before deleting',
    });
  });
});
