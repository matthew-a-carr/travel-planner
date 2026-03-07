import { readFile } from 'node:fs/promises';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { encode } from 'next-auth/jwt';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import postgres from 'postgres';
import { organizationMemberships, organizations, users } from '../../src/infrastructure/db/schema';
import { E2E_POSTGRES_URL_FILE } from './setup/e2e-env';

const SESSION_COOKIE_NAME = 'authjs.session-token';
const E2E_DEFAULT_AUTH_SECRET = 'dev-only-not-a-real-secret';

type AuthUser = {
  readonly id: string;
  readonly email: string;
  readonly name: string;
};

async function withDatabase<T>(fn: (db: ReturnType<typeof drizzle>) => Promise<T>): Promise<T> {
  const connectionUri = (await readFile(E2E_POSTGRES_URL_FILE, 'utf8')).trim();
  const sqlClient = postgres(connectionUri, { max: 1 });
  const db = drizzle(sqlClient);
  try {
    return await fn(db);
  } finally {
    await sqlClient.end();
  }
}

async function ensureUser(input: {
  email: string;
  name: string;
  isApproved: boolean;
  isAdmin: boolean;
}): Promise<AuthUser> {
  return withDatabase(async (db) => {
    const existing = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
      })
      .from(users)
      .where(sql`lower(${users.email}) = ${input.email.toLowerCase()}`)
      .limit(1);

    const firstName = input.name.split(' ')[0] ?? null;
    const lastName = input.name.split(' ').slice(1).join(' ') || null;

    const existingUser = existing[0];
    if (existingUser) {
      await db
        .update(users)
        .set({
          name: input.name,
          firstName,
          lastName,
          isApproved: input.isApproved,
          isAdmin: input.isAdmin,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id));

      return {
        id: existingUser.id,
        email: existingUser.email,
        name: input.name,
      };
    }

    const id = crypto.randomUUID();
    await db.insert(users).values({
      id,
      name: input.name,
      firstName,
      lastName,
      email: input.email,
      isApproved: input.isApproved,
      isAdmin: input.isAdmin,
      emailVerified: null,
      image: null,
    });

    return {
      id,
      email: input.email,
      name: input.name,
    };
  });
}

async function signInAsUser(
  context: BrowserContext,
  baseURL: string | undefined,
  user: AuthUser,
): Promise<void> {
  const maxAgeSeconds = 30 * 24 * 60 * 60;
  const expires = Math.floor((Date.now() + maxAgeSeconds * 1000) / 1000);
  const secret = process.env.AUTH_SECRET ?? E2E_DEFAULT_AUTH_SECRET;
  const sessionToken = await encode({
    token: {
      sub: user.id,
      name: user.name,
      email: user.email,
      picture: null,
    },
    secret,
    salt: SESSION_COOKIE_NAME,
    maxAge: maxAgeSeconds,
  });

  const cookieBaseUrl = new URL(baseURL ?? 'http://localhost:3000');
  await context.clearCookies();
  await context.addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: sessionToken,
      domain: cookieBaseUrl.hostname,
      path: '/',
      expires,
      httpOnly: true,
      secure: cookieBaseUrl.protocol === 'https:',
      sameSite: 'Lax',
    },
  ]);
}

function accessRowByEmail(page: Page, email: string) {
  const emailCell = page.getByRole('cell', { name: email, exact: true }).first();
  return emailCell.locator('xpath=ancestor::tr');
}

async function ensureOrganizationMembership(ownerUserId: string, memberUserId: string): Promise<void> {
  await withDatabase(async (db) => {
    const existingOrganization = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.createdByUserId, ownerUserId))
      .limit(1);

    const organizationId = existingOrganization[0]?.id ?? crypto.randomUUID();
    if (!existingOrganization[0]) {
      const now = new Date();
      await db.insert(organizations).values({
        id: organizationId,
        name: 'Access Management Org',
        createdByUserId: ownerUserId,
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(organizationMemberships).values({
        organizationId,
        userId: ownerUserId,
        role: 'owner',
        createdAt: now,
      });
    }

    await db.execute(sql`
      insert into organization_memberships (organization_id, user_id, role, created_at)
      values (${organizationId}, ${memberUserId}, 'member', now())
      on conflict (organization_id, user_id) do nothing
    `);
  });
}

test('admin can approve and promote users from settings access page', async ({
  page,
  context,
  baseURL,
}) => {
  const admin = await ensureUser({
    email: 'e2e@travelplanner.test',
    name: 'E2E Test User',
    isApproved: true,
    isAdmin: true,
  });
  const pendingUser = await ensureUser({
    email: `pending-${Date.now()}@travelplanner.test`,
    name: 'Pending Member',
    isApproved: false,
    isAdmin: false,
  });

  await signInAsUser(context, baseURL, admin);
  await page.goto('/settings/access');

  await expect(page.getByRole('heading', { name: /application access/i })).toBeVisible();
  const pendingRow = accessRowByEmail(page, pendingUser.email);
  await expect(pendingRow).toContainText('blocked');
  await pendingRow.getByRole('button', { name: /approve access/i }).click();
  await expect(pendingRow).toContainText('approved', { timeout: 10_000 });
  await expect(pendingRow.getByRole('button', { name: /revoke access/i })).toBeVisible();

  await pendingRow.getByRole('button', { name: /make admin/i }).click();
  await expect(pendingRow).toContainText('admin', { timeout: 10_000 });
  await expect(pendingRow.getByRole('button', { name: /remove admin/i })).toBeVisible();
});

test('admin can pre-provision users from access settings', async ({ page, context, baseURL }) => {
  const admin = await ensureUser({
    email: 'e2e@travelplanner.test',
    name: 'E2E Test User',
    isApproved: true,
    isAdmin: true,
  });
  const provisionedEmail = `provisioned-${Date.now()}@travelplanner.test`;

  await signInAsUser(context, baseURL, admin);
  await page.goto('/settings/access');

  await page.getByPlaceholder('teammate@example.com').fill(provisionedEmail);
  await page.getByPlaceholder('Optional display name').fill('Provisioned User');
  await page.getByRole('button', { name: /pre-provision/i }).click();
  await expect(page.getByText('User pre-provisioned and invite email sent.')).toBeVisible();

  const provisionedRow = accessRowByEmail(page, provisionedEmail);
  await expect(provisionedRow).toContainText('Provisioned User');
  await expect(provisionedRow).toContainText('approved');
  await expect(provisionedRow).toContainText('user');
  await expect(provisionedRow.getByRole('button', { name: /resend invite/i })).toBeVisible();

  await page.getByPlaceholder('teammate@example.com').fill(provisionedEmail);
  await page.getByRole('button', { name: /pre-provision/i }).click();
  await expect(page.getByText('User already approved. Invite email was not re-sent.')).toBeVisible();

  await provisionedRow.getByRole('button', { name: /resend invite/i }).click();
  await expect(page.getByText(`Invite email sent to ${provisionedEmail}.`)).toBeVisible();
});

test('approved users without memberships are routed to organization settings', async ({
  page,
  context,
  baseURL,
}) => {
  const unassigned = await ensureUser({
    email: `unassigned-${Date.now()}@travelplanner.test`,
    name: 'Unassigned User',
    isApproved: true,
    isAdmin: false,
  });

  await signInAsUser(context, baseURL, unassigned);
  await page.goto('/');

  await expect(page).toHaveURL(/\/settings\/organizations/);
  await expect(page.getByText('You do not belong to any organizations yet.')).toBeVisible();
  await expect(page.getByLabel('Create organization')).toHaveCount(0);
});

test('revoked users lose access on the next request', async ({ page, context, baseURL }) => {
  const admin = await ensureUser({
    email: 'e2e@travelplanner.test',
    name: 'E2E Test User',
    isApproved: true,
    isAdmin: true,
  });
  const member = await ensureUser({
    email: `revoked-${Date.now()}@travelplanner.test`,
    name: 'Revoked User',
    isApproved: true,
    isAdmin: false,
  });
  await ensureOrganizationMembership(admin.id, member.id);

  await signInAsUser(context, baseURL, member);
  await page.goto('/');
  await expect(page.getByTestId('app-header')).toBeVisible();

  await signInAsUser(context, baseURL, admin);
  await page.goto('/settings/access');
  const memberRow = accessRowByEmail(page, member.email);
  await memberRow.getByRole('button', { name: /revoke access/i }).click();
  await expect(memberRow).toContainText('blocked', { timeout: 10_000 });
  await expect(memberRow.getByRole('button', { name: /approve access/i })).toBeVisible();

  await signInAsUser(context, baseURL, member);
  await page.goto('/');
  await expect(page.getByTestId('app-header')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /sign in/i }).first()).toBeVisible();
});
