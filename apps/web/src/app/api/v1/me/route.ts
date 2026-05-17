import { getCurrentUser } from '@/application/use-cases/get-current-user';
import type { UserAccessSummary } from '@/domain/user-access/types';
import { auth } from '@/infrastructure/auth';
import { getAppContainer } from '@/infrastructure/container';
import { apiError, apiOk } from '../_lib/api-response';

export type MeResponse = {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly isApproved: boolean;
  readonly isAdmin: boolean;
  readonly createdAt: string;
};

function serialize(user: UserAccessSummary): MeResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    firstName: user.firstName,
    lastName: user.lastName,
    isApproved: user.isApproved,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function GET() {
  const session = await auth();
  const { userAccessRepository } = getAppContainer();
  const result = await getCurrentUser(userAccessRepository, session?.user?.id ?? null);

  if (result.ok) {
    return apiOk(serialize(result.value));
  }

  switch (result.error) {
    case 'unauthenticated':
    case 'user_not_found':
      return apiError('unauthenticated', 'Authentication required.');
    case 'unapproved':
      return apiError('account_pending_approval', 'Account is pending approval.');
  }
}
