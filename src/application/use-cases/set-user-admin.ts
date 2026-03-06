import type { Result } from '@/domain/trip/types';
import { err, ok } from '@/domain/trip/types';
import type { UserAccessRepository } from '@/domain/user-access/user-access-repository';

export type SetUserAdminInput = {
  readonly actorUserId: string;
  readonly targetUserId: string;
  readonly isAdmin: boolean;
};

export async function setUserAdmin(
  repository: UserAccessRepository,
  input: SetUserAdminInput,
): Promise<Result<void>> {
  const actor = await repository.findById(input.actorUserId);
  if (!actor?.isAdmin) return err('Forbidden');

  const target = await repository.findById(input.targetUserId);
  if (!target) return err('User not found');

  if (target.id === actor.id && input.isAdmin === false) {
    return err('You cannot remove your own admin access');
  }

  await repository.updateAdmin(target.id, input.isAdmin);
  if (input.isAdmin) {
    await repository.updateApproval(target.id, true);
  }

  return ok(undefined);
}
