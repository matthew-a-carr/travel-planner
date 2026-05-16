'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import type { Result } from '@/domain/trip/types';
import { err, ok } from '@/domain/trip/types';
import {
  ACTIVE_ORGANIZATION_COOKIE,
  getActiveOrganizationContext,
} from '@/infrastructure/organization/active-organization';

export async function setActiveOrganizationAction(organizationId: string): Promise<Result<void>> {
  const context = await getActiveOrganizationContext();
  if (!context) return err('Unauthorized');

  const allowed = context.organizations.some(
    (organization) => organization.organization.id === organizationId,
  );
  if (!allowed) return err('Forbidden');

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORGANIZATION_COOKIE, organizationId, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
  });

  revalidatePath('/');
  revalidatePath('/settings/organizations');
  revalidatePath('/settings/organization');
  return ok(undefined);
}

export async function setActiveOrganizationFromFormAction(
  formData: FormData,
): Promise<Result<void>> {
  const organizationId = formData.get('organizationId');
  if (typeof organizationId !== 'string') return err('Invalid organization');
  return setActiveOrganizationAction(organizationId);
}
