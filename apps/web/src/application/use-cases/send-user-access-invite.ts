import type { InviteEmailService } from '@/application/ports/invite-email-service';
import type { Result } from '@/domain/trip/types';
import { err, ok } from '@/domain/trip/types';
import type { UserAccessSummary } from '@/domain/user-access/types';
import type { UserAccessRepository } from '@/domain/user-access/user-access-repository';
import type { InviteDeliveryOutcome } from './pre-provision-user-access';

export type SendUserAccessInviteInput = {
  readonly actorUserId: string;
  readonly targetUserId: string;
  readonly loginUrl: string;
};

export type SendUserAccessInviteResult = {
  readonly user: UserAccessSummary;
  readonly inviteDelivery: InviteDeliveryOutcome;
};

export async function sendUserAccessInvite(
  repository: UserAccessRepository,
  inviteEmailService: InviteEmailService,
  input: SendUserAccessInviteInput,
): Promise<Result<SendUserAccessInviteResult>> {
  const actor = await repository.findById(input.actorUserId);
  if (!actor?.isAdmin) return err('Forbidden');

  const target = await repository.findById(input.targetUserId);
  if (!target) return err('User not found');
  if (!target.isApproved) return err('User is not approved');

  const inviteResult = await inviteEmailService.sendUserAddedInvite({
    recipient: target,
    inviter: actor,
    loginUrl: input.loginUrl,
  });

  if (!inviteResult.ok) {
    return ok({
      user: target,
      inviteDelivery: {
        status: 'failed',
        error: inviteResult.error,
      },
    });
  }

  return ok({
    user: target,
    inviteDelivery: {
      status: 'sent',
      providerMessageId: inviteResult.providerMessageId,
    },
  });
}
