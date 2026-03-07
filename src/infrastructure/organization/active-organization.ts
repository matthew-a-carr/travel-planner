import { cookies } from 'next/headers';
import { getUserOrganizations } from '@/application/use-cases/get-user-organizations';
import type { OrganizationWithRole } from '@/domain/organization/types';
import { auth } from '@/infrastructure/auth';
import {
  isUserAllowedForApp,
  syncSeedAdminAccessByUserId,
} from '@/infrastructure/auth/access-policy';
import { getAppContainer } from '@/infrastructure/container';
import { db } from '@/infrastructure/db/client';
import { resolveAuthenticatedUserId } from './resolve-authenticated-user';

export const ACTIVE_ORGANIZATION_COOKIE = 'travel-planner-active-organization-id';

export type ActiveOrganizationContext = {
  readonly userId: string;
  readonly organizations: OrganizationWithRole[];
  readonly activeOrganization: OrganizationWithRole;
};

export type AuthenticatedAccessContext = {
  readonly userId: string;
  readonly organizations: OrganizationWithRole[];
  readonly activeOrganization: OrganizationWithRole | null;
};

export async function getAuthenticatedAccessContext(): Promise<AuthenticatedAccessContext | null> {
  const session = await auth();
  const userId = await resolveAuthenticatedUserId(db, {
    id: session?.user?.id,
    email: session?.user?.email ?? null,
    name: session?.user?.name ?? null,
  });
  if (!userId) return null;
  const isAllowed = await isUserAllowedForApp(db, userId);
  if (!isAllowed) return null;
  await syncSeedAdminAccessByUserId(db, userId);

  const { organizationRepository } = getAppContainer();
  const organizations = await getUserOrganizations(organizationRepository, userId);
  const firstOrganization = organizations[0] ?? null;

  const cookieStore = await cookies();
  const activeOrganizationId = cookieStore.get(ACTIVE_ORGANIZATION_COOKIE)?.value;
  const activeOrganization =
    organizations.find((organization) => organization.organization.id === activeOrganizationId) ??
    firstOrganization ??
    null;

  return {
    userId,
    organizations,
    activeOrganization,
  };
}

export async function getActiveOrganizationContext(): Promise<ActiveOrganizationContext | null> {
  const context = await getAuthenticatedAccessContext();
  if (!context?.activeOrganization) return null;

  return {
    userId: context.userId,
    organizations: context.organizations,
    activeOrganization: context.activeOrganization,
  };
}
