import type { SendUserAddedInviteInput } from '@/application/ports/invite-email-service';
import { renderBaseEmailTemplate } from './base-email-template';

export type InviteEmailTemplate = {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
};

function describePerson(name: string | null, email: string): string {
  const trimmedName = name?.trim() ?? '';
  if (trimmedName.length === 0) return email;
  return trimmedName;
}

export function renderUserAddedInviteTemplate(
  input: SendUserAddedInviteInput,
): InviteEmailTemplate {
  const recipientLabel = describePerson(input.recipient.name, input.recipient.email);
  const inviterLabel = describePerson(input.inviter.name, input.inviter.email);
  const loginUrl = input.loginUrl;
  const subject = `You're invited to Travel Planner`;
  const body = renderBaseEmailTemplate({
    previewText: 'You have been added to Travel Planner.',
    greeting: `Hi ${recipientLabel},`,
    paragraphs: [
      `${inviterLabel} has added you to Travel Planner.`,
      'Use Google Sign-In with this email address to access the app.',
    ],
    action: {
      label: 'Sign in to Travel Planner',
      url: loginUrl,
    },
    closingLines: ['Welcome aboard,', 'Travel Planner'],
  });

  return {
    subject,
    text: body.text,
    html: body.html,
  };
}
