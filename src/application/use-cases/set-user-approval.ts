import type { Result } from '@/domain/trip/types';
import { err, ok } from '@/domain/trip/types';
import type { UserAccessRepository } from '@/domain/user-access/user-access-repository';

export type SetUserApprovalInput = {
  readonly actorUserId: string;
  readonly targetUserId: string;
  readonly isApproved: boolean;
};

export async function setUserApproval(
  repository: UserAccessRepository,
  input: SetUserApprovalInput,
): Promise<Result<void>> {
  const actor = await repository.findById(input.actorUserId);
  if (!actor?.isAdmin) return err('Forbidden');

  const target = await repository.findById(input.targetUserId);
  if (!target) return err('User not found');

  if (target.id === actor.id && input.isApproved === false) {
    return err('You cannot revoke your own access');
  }

  await repository.updateApproval(target.id, input.isApproved);
  return ok(undefined);
}
