'use server';

import { revalidatePath } from 'next/cache';
import { addOrganizationMember } from '@/application/use-cases/add-organization-member';
import { removeOrganizationMember } from '@/application/use-cases/remove-organization-member';
import { searchOrganizationMemberCandidates } from '@/application/use-cases/search-organization-member-candidates';
import { getAppContainer } from '@/infrastructure/container';
import { getAuthenticatedAccessContext } from '@/infrastructure/organization/active-organization';

export type AddOrganizationMemberState = { error: string | null };
export type OrganizationMemberCandidateState = {
  readonly id: string;
  readonly name: string | null;
  readonly email: string;
};

export async function addOrganizationMemberAction(
  _prev: AddOrganizationMemberState,
  formData: FormData,
): Promise<AddOrganizationMemberState> {
  const context = await getAuthenticatedAccessContext();
  if (!context) return { error: 'Unauthorized' };
  if (!context.activeOrganization) return { error: 'Join an organization first' };

  const organizationId = formData.get('organizationId');
  const targetUserId = formData.get('targetUserId');
  if (typeof organizationId !== 'string' || typeof targetUserId !== 'string') {
    return { error: 'Invalid form data' };
  }

  const { organizationRepository } = getAppContainer();
  const result = await addOrganizationMember(organizationRepository, {
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
  const context = await getAuthenticatedAccessContext();
  if (!context) return [];
  if (!context.activeOrganization) return [];

  const organizationId = input.organizationId.trim();
  if (organizationId.length === 0) return [];

  const { organizationRepository } = getAppContainer();
  const result = await searchOrganizationMemberCandidates(organizationRepository, {
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
  const context = await getAuthenticatedAccessContext();
  if (!context) throw new Error('Unauthorized');
  if (!context.activeOrganization) throw new Error('No organization membership');

  const { organizationRepository } = getAppContainer();
  const result = await removeOrganizationMember(organizationRepository, {
    actorUserId: context.userId,
    organizationId,
    memberUserId,
  });

  if (!result.ok) throw new Error(result.error);
  revalidatePath('/');
  revalidatePath('/settings/organization');
}
