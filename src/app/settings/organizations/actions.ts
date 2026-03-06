'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createOrganization } from '@/application/use-cases/create-organization';
import { db } from '@/infrastructure/db/client';
import { DrizzleOrganizationRepository } from '@/infrastructure/db/repositories/drizzle-organization-repository';
import {
  ACTIVE_ORGANIZATION_COOKIE,
  getActiveOrganizationContext,
} from '@/infrastructure/organization/active-organization';

export type CreateOrganizationState = { error: string | null };

export async function createOrganizationAction(
  _prev: CreateOrganizationState,
  formData: FormData,
): Promise<CreateOrganizationState> {
  const context = await getActiveOrganizationContext();
  if (!context) return { error: 'Unauthorized' };

  const name = formData.get('name');
  if (typeof name !== 'string') return { error: 'Invalid form data' };

  const repository = new DrizzleOrganizationRepository(db);
  const result = await createOrganization(repository, {
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
