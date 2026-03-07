import type { Result } from '@/domain/trip/types';
import { err, ok } from '@/domain/trip/types';

export type DeleteUserValidationInput = {
  readonly actorUserId: string;
  readonly targetUserId: string;
  readonly actorIsAdmin: boolean;
  readonly targetIsAdmin: boolean;
  readonly soleOwnerOrganizationNames: readonly string[];
};

export function validateDeleteUser(input: DeleteUserValidationInput): Result<void> {
  if (!input.actorIsAdmin) return err('Forbidden');

  if (input.actorUserId === input.targetUserId) {
    return err('You cannot delete your own account');
  }

  if (input.targetIsAdmin) {
    return err('Cannot delete an admin user. Remove their admin role first');
  }

  if (input.soleOwnerOrganizationNames.length > 0) {
    const names = input.soleOwnerOrganizationNames.join(', ');
    return err(`User is the sole owner of: ${names}. Transfer ownership before deleting`);
  }

  return ok(undefined);
}
