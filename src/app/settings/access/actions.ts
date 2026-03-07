'use server';

import { revalidatePath } from 'next/cache';
import { preProvisionUserAccess } from '@/application/use-cases/pre-provision-user-access';
import { setUserAdmin } from '@/application/use-cases/set-user-admin';
import { setUserApproval } from '@/application/use-cases/set-user-approval';
import { isUserAccessAdmin } from '@/infrastructure/auth/access-policy';
import { getAppContainer } from '@/infrastructure/container';
import { db } from '@/infrastructure/db/client';
import { getAuthenticatedAccessContext } from '@/infrastructure/organization/active-organization';

export type UpdateUserAccessState = {
  readonly error: string | null;
};

function parseBoolean(formData: FormData, key: string): boolean | null {
  const value = formData.get(key);
  if (typeof value !== 'string') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

export async function updateUserApprovalAction(
  _prev: UpdateUserAccessState,
  formData: FormData,
): Promise<UpdateUserAccessState> {
  const context = await getAuthenticatedAccessContext();
  if (!context) return { error: 'Unauthorized' };

  const isAdmin = await isUserAccessAdmin(db, context.userId);
  if (!isAdmin) return { error: 'Forbidden' };

  const targetUserId = formData.get('targetUserId');
  const nextValue = parseBoolean(formData, 'nextValue');
  if (typeof targetUserId !== 'string' || nextValue === null) return { error: 'Invalid form data' };

  const { userAccessRepository } = getAppContainer();
  const result = await setUserApproval(userAccessRepository, {
    actorUserId: context.userId,
    targetUserId,
    isApproved: nextValue,
  });

  if (!result.ok) return { error: result.error };
  revalidatePath('/settings/access');
  return { error: null };
}

export async function updateUserAdminAction(
  _prev: UpdateUserAccessState,
  formData: FormData,
): Promise<UpdateUserAccessState> {
  const context = await getAuthenticatedAccessContext();
  if (!context) return { error: 'Unauthorized' };

  const isAdmin = await isUserAccessAdmin(db, context.userId);
  if (!isAdmin) return { error: 'Forbidden' };

  const targetUserId = formData.get('targetUserId');
  const nextValue = parseBoolean(formData, 'nextValue');
  if (typeof targetUserId !== 'string' || nextValue === null) return { error: 'Invalid form data' };

  const { userAccessRepository } = getAppContainer();
  const result = await setUserAdmin(userAccessRepository, {
    actorUserId: context.userId,
    targetUserId,
    isAdmin: nextValue,
  });

  if (!result.ok) return { error: result.error };
  revalidatePath('/settings/access');
  return { error: null };
}

export async function preProvisionUserAction(
  _prev: UpdateUserAccessState,
  formData: FormData,
): Promise<UpdateUserAccessState> {
  const context = await getAuthenticatedAccessContext();
  if (!context) return { error: 'Unauthorized' };

  const isAdmin = await isUserAccessAdmin(db, context.userId);
  if (!isAdmin) return { error: 'Forbidden' };

  const email = formData.get('email');
  const name = formData.get('name');
  if (typeof email !== 'string') return { error: 'Invalid form data' };
  if (name !== null && typeof name !== 'string') return { error: 'Invalid form data' };

  const { userAccessRepository } = getAppContainer();
  const result = await preProvisionUserAccess(userAccessRepository, {
    actorUserId: context.userId,
    email,
    name: typeof name === 'string' ? name : null,
  });

  if (!result.ok) return { error: result.error };
  revalidatePath('/settings/access');
  return { error: null };
}
