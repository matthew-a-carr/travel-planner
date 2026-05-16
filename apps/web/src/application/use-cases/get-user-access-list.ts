import type { Result } from '@/domain/trip/types';
import { err, ok } from '@/domain/trip/types';
import type { UserAccessListItem } from '@/domain/user-access/types';
import type { UserAccessRepository } from '@/domain/user-access/user-access-repository';

export async function getUserAccessList(
  repository: UserAccessRepository,
  actorUserId: string,
): Promise<Result<readonly UserAccessListItem[]>> {
  const actor = await repository.findById(actorUserId);
  if (!actor?.isAdmin) return err('Forbidden');
  const users = await repository.listAll();
  return ok(users);
}
