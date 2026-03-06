'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import {
  ACTIVE_ORGANIZATION_COOKIE,
  getActiveOrganizationContext,
} from '@/infrastructure/organization/active-organization';

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
  revalidatePath('/settings/organizations');
  revalidatePath('/settings/organization');
}

export async function setActiveOrganizationFromFormAction(formData: FormData): Promise<void> {
  const organizationId = formData.get('organizationId');
  if (typeof organizationId !== 'string') throw new Error('Invalid organization');
  await setActiveOrganizationAction(organizationId);
}
