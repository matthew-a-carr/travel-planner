'use server';

import { revalidatePath } from 'next/cache';
import { preProvisionUserAccess } from '@/application/use-cases/pre-provision-user-access';
import { sendUserAccessInvite } from '@/application/use-cases/send-user-access-invite';
import { setUserAdmin } from '@/application/use-cases/set-user-admin';
import { setUserApproval } from '@/application/use-cases/set-user-approval';
import { isUserAccessAdmin } from '@/infrastructure/auth/access-policy';
import { getAppContainer } from '@/infrastructure/container';
import { db } from '@/infrastructure/db/client';
import { buildLoginUrl } from '@/infrastructure/email/build-login-url';
import { getAuthenticatedAccessContext } from '@/infrastructure/organization/active-organization';

export type UpdateUserAccessState = {
  readonly error: string | null;
  readonly warning: string | null;
  readonly notice: string | null;
};

function parseBoolean(formData: FormData, key: string): boolean | null {
  const value = formData.get(key);
  if (typeof value !== 'string') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function errorState(error: string): UpdateUserAccessState {
  return {
    error,
    warning: null,
    notice: null,
  };
}

function warningState(warning: string, notice: string | null = null): UpdateUserAccessState {
  return {
    error: null,
    warning,
    notice,
  };
}

function noticeState(notice: string): UpdateUserAccessState {
  return {
    error: null,
    warning: null,
    notice,
  };
}

function clearState(): UpdateUserAccessState {
  return {
    error: null,
    warning: null,
    notice: null,
  };
}

export async function updateUserApprovalAction(
  _prev: UpdateUserAccessState,
  formData: FormData,
): Promise<UpdateUserAccessState> {
  const context = await getAuthenticatedAccessContext();
  if (!context) return errorState('Unauthorized');

  const isAdmin = await isUserAccessAdmin(db, context.userId);
  if (!isAdmin) return errorState('Forbidden');

  const targetUserId = formData.get('targetUserId');
  const nextValue = parseBoolean(formData, 'nextValue');
  if (typeof targetUserId !== 'string' || nextValue === null)
    return errorState('Invalid form data');

  const { userAccessRepository } = getAppContainer();
  const result = await setUserApproval(userAccessRepository, {
    actorUserId: context.userId,
    targetUserId,
    isApproved: nextValue,
  });

  if (!result.ok) return errorState(result.error);
  revalidatePath('/settings/access');
  return clearState();
}

export async function updateUserAdminAction(
  _prev: UpdateUserAccessState,
  formData: FormData,
): Promise<UpdateUserAccessState> {
  const context = await getAuthenticatedAccessContext();
  if (!context) return errorState('Unauthorized');

  const isAdmin = await isUserAccessAdmin(db, context.userId);
  if (!isAdmin) return errorState('Forbidden');

  const targetUserId = formData.get('targetUserId');
  const nextValue = parseBoolean(formData, 'nextValue');
  if (typeof targetUserId !== 'string' || nextValue === null)
    return errorState('Invalid form data');

  const { userAccessRepository } = getAppContainer();
  const result = await setUserAdmin(userAccessRepository, {
    actorUserId: context.userId,
    targetUserId,
    isAdmin: nextValue,
  });

  if (!result.ok) return errorState(result.error);
  revalidatePath('/settings/access');
  return clearState();
}

export async function preProvisionUserAction(
  _prev: UpdateUserAccessState,
  formData: FormData,
): Promise<UpdateUserAccessState> {
  const context = await getAuthenticatedAccessContext();
  if (!context) return errorState('Unauthorized');

  const isAdmin = await isUserAccessAdmin(db, context.userId);
  if (!isAdmin) return errorState('Forbidden');

  const email = formData.get('email');
  const name = formData.get('name');
  if (typeof email !== 'string') return errorState('Invalid form data');
  if (name !== null && typeof name !== 'string') return errorState('Invalid form data');

  const { userAccessRepository, inviteEmailService } = getAppContainer();
  const result = await preProvisionUserAccess(userAccessRepository, inviteEmailService, {
    actorUserId: context.userId,
    email,
    name: typeof name === 'string' ? name : null,
    loginUrl: buildLoginUrl(),
  });

  if (!result.ok) return errorState(result.error);
  revalidatePath('/settings/access');

  if (result.value.inviteDelivery.status === 'failed') {
    return warningState(
      `User pre-provisioned, but invite email failed: ${result.value.inviteDelivery.error}`,
      'User pre-provisioned successfully.',
    );
  }

  if (result.value.inviteDelivery.status === 'skipped') {
    return noticeState('User already approved. Invite email was not re-sent.');
  }

  return noticeState('User pre-provisioned and invite email sent.');
}

export async function resendUserInviteAction(
  _prev: UpdateUserAccessState,
  formData: FormData,
): Promise<UpdateUserAccessState> {
  const context = await getAuthenticatedAccessContext();
  if (!context) return errorState('Unauthorized');

  const isAdmin = await isUserAccessAdmin(db, context.userId);
  if (!isAdmin) return errorState('Forbidden');

  const targetUserId = formData.get('targetUserId');
  if (typeof targetUserId !== 'string') return errorState('Invalid form data');

  const { userAccessRepository, inviteEmailService } = getAppContainer();
  const result = await sendUserAccessInvite(userAccessRepository, inviteEmailService, {
    actorUserId: context.userId,
    targetUserId,
    loginUrl: buildLoginUrl(),
  });

  if (!result.ok) return errorState(result.error);
  revalidatePath('/settings/access');

  if (result.value.inviteDelivery.status === 'failed') {
    return warningState(`Invite email failed: ${result.value.inviteDelivery.error}`);
  }

  return noticeState(`Invite email sent to ${result.value.user.email}.`);
}
