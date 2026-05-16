import type { Result } from '@/domain/trip/types';
import { err, ok } from '@/domain/trip/types';
import { validateDeleteUser } from '@/domain/user-access/delete-user';
import type { UserAccessRepository } from '@/domain/user-access/user-access-repository';

export type DeleteUserInput = {
  readonly actorUserId: string;
  readonly targetUserId: string;
};

export async function deleteUser(
  repository: UserAccessRepository,
  input: DeleteUserInput,
): Promise<Result<void>> {
  const actor = await repository.findById(input.actorUserId);
  if (!actor?.isAdmin) return err('Forbidden');

  const target = await repository.findById(input.targetUserId);
  if (!target) return err('User not found');

  const soleOwnerOrgs = await repository.findSoleOwnerOrganizations(input.targetUserId);

  const validation = validateDeleteUser({
    actorUserId: actor.id,
    targetUserId: target.id,
    actorIsAdmin: actor.isAdmin,
    targetIsAdmin: target.isAdmin,
    soleOwnerOrganizationNames: soleOwnerOrgs.map((o) => o.organizationName),
  });

  if (!validation.ok) return validation;

  await repository.deleteUser(input.targetUserId);
  return ok(undefined);
}
