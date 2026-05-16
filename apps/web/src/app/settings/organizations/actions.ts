'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createOrganization } from '@/application/use-cases/create-organization';
import { isUserAccessAdmin } from '@/infrastructure/auth/access-policy';
import { getAppContainer } from '@/infrastructure/container';
import { db } from '@/infrastructure/db/client';
import {
  ACTIVE_ORGANIZATION_COOKIE,
  getAuthenticatedAccessContext,
} from '@/infrastructure/organization/active-organization';

export type CreateOrganizationState = { error: string | null };

export async function createOrganizationAction(
  _prev: CreateOrganizationState,
  formData: FormData,
): Promise<CreateOrganizationState> {
  const context = await getAuthenticatedAccessContext();
  if (!context) return { error: 'Unauthorized' };
  const isAdmin = await isUserAccessAdmin(db, context.userId);
  if (!isAdmin) return { error: 'Forbidden' };

  const name = formData.get('name');
  if (typeof name !== 'string') return { error: 'Invalid form data' };

  const { organizationRepository, userAccessRepository } = getAppContainer();
  const result = await createOrganization(organizationRepository, userAccessRepository, {
    actorUserId: context.userId,
    name,
  });

  if (!result.ok) return { error: result.error };

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORGANIZATION_COOKIE, result.value.id, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
  });

  revalidatePath('/');
  revalidatePath('/settings/organizations');
  revalidatePath('/settings/organization');
  return { error: null };
}
