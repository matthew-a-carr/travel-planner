import { Resend } from 'resend';
import { renderUserAddedInviteTemplate } from '@/application/email/user-added-invite-template';
import type {
  InviteEmailService,
  InviteSendResult,
  SendUserAddedInviteInput,
} from '@/application/ports/invite-email-service';

type ResendEmailServiceInput = {
  readonly apiKey: string;
  readonly fromAddress: string;
  readonly fromName: string;
};

export class ResendEmailService implements InviteEmailService {
  private readonly client: Resend;
  private readonly fromAddress: string;
  private readonly fromName: string;

  constructor(input: ResendEmailServiceInput) {
    this.client = new Resend(input.apiKey);
    this.fromAddress = input.fromAddress;
    this.fromName = input.fromName;
  }

  async sendUserAddedInvite(input: SendUserAddedInviteInput): Promise<InviteSendResult> {
    const template = renderUserAddedInviteTemplate(input);

    try {
      const response = await this.client.emails.send({
        from: `${this.fromName} <${this.fromAddress}>`,
        to: [input.recipient.email],
        subject: template.subject,
        text: template.text,
        html: template.html,
      });

      if (response.error) {
        const errorMessage = response.error.message || 'Unknown email provider error';
        console.error('email_invite_send_failed', {
          provider: 'resend',
          recipientEmail: input.recipient.email,
          inviterEmail: input.inviter.email,
          error: errorMessage,
        });
        return {
          ok: false,
          error: errorMessage,
        };
      }

      const providerMessageId = response.data?.id ?? null;
      console.info('email_invite_send_success', {
        provider: 'resend',
        recipientEmail: input.recipient.email,
        inviterEmail: input.inviter.email,
        providerMessageId,
      });

      return {
        ok: true,
        providerMessageId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unexpected email send failure';
      console.error('email_invite_send_failed', {
        provider: 'resend',
        recipientEmail: input.recipient.email,
        inviterEmail: input.inviter.email,
        error: errorMessage,
      });
      return {
        ok: false,
        error: errorMessage,
      };
    }
  }
}
