import type { Result } from '@/domain/trip/types';
import { err } from '@/domain/trip/types';
import type { UserAccessSummary } from '@/domain/user-access/types';
import type { UserAccessRepository } from '@/domain/user-access/user-access-repository';

export type GetCurrentUserError = 'unauthenticated' | 'user_not_found' | 'unapproved';

export async function getCurrentUser(
  repository: UserAccessRepository,
  sessionUserId: string | null,
): Promise<Result<UserAccessSummary, GetCurrentUserError>> {
  if (!sessionUserId) return err<GetCurrentUserError>('unauthenticated');

  const user = await repository.findById(sessionUserId);
  if (!user) return err<GetCurrentUserError>('user_not_found');
  if (!user.isApproved) return err<GetCurrentUserError>('unapproved');

  return { ok: true, value: user };
}
