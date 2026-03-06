'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { addOrganizationMember } from '@/application/use-cases/add-organization-member';
import { createOrganization } from '@/application/use-cases/create-organization';
import { removeOrganizationMember } from '@/application/use-cases/remove-organization-member';
import { searchOrganizationMemberCandidates } from '@/application/use-cases/search-organization-member-candidates';
import { db } from '@/infrastructure/db/client';
import { DrizzleOrganizationRepository } from '@/infrastructure/db/repositories/drizzle-organization-repository';
import {
  ACTIVE_ORGANIZATION_COOKIE,
  getActiveOrganizationContext,
} from '@/infrastructure/organization/active-organization';

export type CreateOrganizationState = { error: string | null };
export type AddOrganizationMemberState = { error: string | null };
export type OrganizationMemberCandidateState = {
  readonly id: string;
  readonly name: string | null;
  readonly email: string;
};

export async function setActiveOrganizationAction(organizationId: string): Promise<void> {
  const context = await getActiveOrganizationContext();
  if (!context) throw new Error('Unauthorized');

  const allowed = context.organizations.some(
    (organization) => organization.organization.id === organizationId,
  );
  if (!allowed) throw new Error('Forbidden');

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORGANIZATION_COOKIE, organizationId, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
  });

  revalidatePath('/');
  revalidatePath('/settings/organization');
}

export async function setActiveOrganizationFromFormAction(formData: FormData): Promise<void> {
  const organizationId = formData.get('organizationId');
  if (typeof organizationId !== 'string') throw new Error('Invalid organization');
  await setActiveOrganizationAction(organizationId);
}

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
  revalidatePath('/settings/organization');
  return { error: null };
}

export async function addOrganizationMemberAction(
  _prev: AddOrganizationMemberState,
  formData: FormData,
): Promise<AddOrganizationMemberState> {
  const context = await getActiveOrganizationContext();
  if (!context) return { error: 'Unauthorized' };

  const organizationId = formData.get('organizationId');
  const targetUserId = formData.get('targetUserId');
  if (typeof organizationId !== 'string' || typeof targetUserId !== 'string') {
    return { error: 'Invalid form data' };
  }

  const repository = new DrizzleOrganizationRepository(db);
  const result = await addOrganizationMember(repository, {
    actorUserId: context.userId,
    organizationId,
    targetUserId,
  });

  if (!result.ok) return { error: result.error };
  revalidatePath('/');
  revalidatePath('/settings/organization');
  return { error: null };
}

export async function searchOrganizationMemberCandidatesAction(input: {
  organizationId: string;
  query: string;
}): Promise<readonly OrganizationMemberCandidateState[]> {
  const context = await getActiveOrganizationContext();
  if (!context) return [];

  const organizationId = input.organizationId.trim();
  if (organizationId.length === 0) return [];

  const repository = new DrizzleOrganizationRepository(db);
  const result = await searchOrganizationMemberCandidates(repository, {
    actorUserId: context.userId,
    organizationId,
    query: input.query,
    limit: 20,
  });

  if (!result.ok) return [];
  return result.value;
}

export async function removeOrganizationMemberAction(
  organizationId: string,
  memberUserId: string,
): Promise<void> {
  const context = await getActiveOrganizationContext();
  if (!context) throw new Error('Unauthorized');

  const repository = new DrizzleOrganizationRepository(db);
  const result = await removeOrganizationMember(repository, {
    actorUserId: context.userId,
    organizationId,
    memberUserId,
  });

  if (!result.ok) throw new Error(result.error);
  revalidatePath('/');
  revalidatePath('/settings/organization');
}
