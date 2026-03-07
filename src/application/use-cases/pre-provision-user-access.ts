import type { InviteEmailService } from '@/application/ports/invite-email-service';
import type { Result } from '@/domain/trip/types';
import { err, ok } from '@/domain/trip/types';
import type { UserAccessSummary } from '@/domain/user-access/types';
import type {
  UserAccessRepository,
  UserApprovalTransition,
} from '@/domain/user-access/user-access-repository';

export type PreProvisionUserAccessInput = {
  readonly actorUserId: string;
  readonly email: string;
  readonly name: string | null;
  readonly loginUrl: string;
};

export type InviteDeliveryOutcome =
  | { readonly status: 'skipped' }
  | { readonly status: 'sent'; readonly providerMessageId: string | null }
  | { readonly status: 'failed'; readonly error: string };

export type PreProvisionUserAccessResult = {
  readonly user: UserAccessSummary;
  readonly approvalTransition: UserApprovalTransition;
  readonly inviteDelivery: InviteDeliveryOutcome;
};

function sanitizeOptionalName(name: string | null): string | null {
  const trimmed = name?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function isValidEmail(email: string): boolean {
  const value = email.trim();
  if (value.length === 0) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function preProvisionUserAccess(
  repository: UserAccessRepository,
  inviteEmailService: InviteEmailService,
  input: PreProvisionUserAccessInput,
): Promise<Result<PreProvisionUserAccessResult>> {
  if (!isValidEmail(input.email)) return err('Valid email is required');

  const actor = await repository.findById(input.actorUserId);
  if (!actor?.isAdmin) return err('Forbidden');

  const creationResult = await repository.createOrApproveByEmail({
    email: input.email,
    name: sanitizeOptionalName(input.name),
    isApproved: true,
    isAdmin: false,
  });

  if (creationResult.approvalTransition !== 'approved_now') {
    return ok({
      user: creationResult.user,
      approvalTransition: creationResult.approvalTransition,
      inviteDelivery: { status: 'skipped' },
    });
  }

  const inviteResult = await inviteEmailService.sendUserAddedInvite({
    recipient: creationResult.user,
    inviter: actor,
    loginUrl: input.loginUrl,
  });

  if (!inviteResult.ok) {
    return ok({
      user: creationResult.user,
      approvalTransition: creationResult.approvalTransition,
      inviteDelivery: {
        status: 'failed',
        error: inviteResult.error,
      },
    });
  }

  return ok({
    user: creationResult.user,
    approvalTransition: creationResult.approvalTransition,
    inviteDelivery: {
      status: 'sent',
      providerMessageId: inviteResult.providerMessageId,
    },
  });
}
