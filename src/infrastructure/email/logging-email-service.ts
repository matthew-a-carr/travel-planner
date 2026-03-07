import { renderUserAddedInviteTemplate } from '@/application/email/user-added-invite-template';
import type {
  InviteEmailService,
  InviteSendResult,
  SendUserAddedInviteInput,
} from '@/application/ports/invite-email-service';

type LoggingEmailServiceInput = {
  readonly environment: string;
  readonly fromAddress: string;
  readonly fromName: string;
  readonly isProductionFallback?: boolean;
};

export class LoggingEmailService implements InviteEmailService {
  constructor(private readonly input: LoggingEmailServiceInput) {}

  async sendUserAddedInvite(input: SendUserAddedInviteInput): Promise<InviteSendResult> {
    const template = renderUserAddedInviteTemplate(input);

    if (this.input.isProductionFallback) {
      const error = 'Invite email provider misconfigured in production (missing RESEND_API_KEY).';
      console.error('email_invite_send_failed', {
        provider: 'logging',
        environment: this.input.environment,
        recipientEmail: input.recipient.email,
        inviterEmail: input.inviter.email,
        fromAddress: this.input.fromAddress,
        fromName: this.input.fromName,
        error,
      });

      return {
        ok: false,
        error,
      };
    }

    console.info('email_invite_send_success', {
      provider: 'logging',
      environment: this.input.environment,
      recipientEmail: input.recipient.email,
      inviterEmail: input.inviter.email,
      fromAddress: this.input.fromAddress,
      fromName: this.input.fromName,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    return {
      ok: true,
      providerMessageId: null,
    };
  }
}
