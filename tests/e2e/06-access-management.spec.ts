import { readFile } from 'node:fs/promises';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { encode } from 'next-auth/jwt';
import { expect, test, type BrowserContext } from '@playwright/test';
import postgres from 'postgres';
import { users } from '../../src/infrastructure/db/schema';
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
  const pendingRow = page.locator('tr').filter({ hasText: pendingUser.email });
  await expect(pendingRow).toContainText('blocked');
  await pendingRow.getByRole('button', { name: /approve access/i }).click();
  await page.reload();
  const approvedRow = page.locator('tr').filter({ hasText: pendingUser.email });
  await expect(approvedRow).toContainText('approved');

  await approvedRow.getByRole('button', { name: /make admin/i }).click();
  await page.reload();
  const adminRow = page.locator('tr').filter({ hasText: pendingUser.email });
  await expect(adminRow).toContainText('admin');
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

  await signInAsUser(context, baseURL, member);
  await page.goto('/');
  await expect(page.getByTestId('app-header')).toBeVisible();

  await signInAsUser(context, baseURL, admin);
  await page.goto('/settings/access');
  const memberRow = page.locator('tr').filter({ hasText: member.email });
  await memberRow.getByRole('button', { name: /revoke access/i }).click();
  await page.reload();
  const revokedRow = page.locator('tr').filter({ hasText: member.email });
  await expect(revokedRow).toContainText('blocked');

  await signInAsUser(context, baseURL, member);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Travel Planner' })).toBeVisible();
  await expect(page.getByTestId('app-header')).toHaveCount(0);
});
