import type { UserAccessSummary } from '@/domain/user-access/types';

export type SendUserAddedInviteInput = {
  readonly recipient: UserAccessSummary;
  readonly inviter: UserAccessSummary;
  readonly loginUrl: string;
};

export type InviteSendResult =
  | {
      readonly ok: true;
      readonly providerMessageId: string | null;
    }
  | {
      readonly ok: false;
      readonly error: string;
    };

export interface InviteEmailService {
  sendUserAddedInvite(input: SendUserAddedInviteInput): Promise<InviteSendResult>;
}
