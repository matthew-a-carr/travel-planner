import { describe, expect, it } from 'vitest';
import { renderUserAddedInviteTemplate } from './user-added-invite-template';

describe('renderUserAddedInviteTemplate', () => {
  it('renders subject, text, and html with login URL and inviter context', () => {
    const template = renderUserAddedInviteTemplate({
      recipient: {
        id: 'recipient',
        email: 'new.member@example.com',
        name: 'New Member',
        firstName: 'New',
        lastName: 'Member',
        isApproved: true,
        isAdmin: false,
        createdAt: new Date('2026-03-07T10:00:00.000Z'),
      },
      inviter: {
        id: 'admin',
        email: 'admin@example.com',
        name: 'Admin User',
        firstName: 'Admin',
        lastName: 'User',
        isApproved: true,
        isAdmin: true,
        createdAt: new Date('2026-03-07T09:00:00.000Z'),
      },
      loginUrl: 'https://travel.matthewcarr.dev/login',
    });

    expect(template.subject).toContain('Travel Planner');
    expect(template.text).toContain('Admin User');
    expect(template.text).toContain('https://travel.matthewcarr.dev/login');
    expect(template.html).toContain('Sign in to Travel Planner');
    expect(template.html).toContain('Admin User');
    expect(template.html).toContain('https://travel.matthewcarr.dev/login');
  });
});
