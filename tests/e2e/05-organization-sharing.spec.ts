import { readFile } from 'node:fs/promises';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { encode } from 'next-auth/jwt';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import postgres from 'postgres';
import { users } from '../../src/infrastructure/db/schema';
import { E2E_POSTGRES_URL_FILE } from './setup/e2e-env';

const SESSION_COOKIE_NAME = 'authjs.session-token';
const E2E_DEFAULT_AUTH_SECRET = 'dev-only-not-a-real-secret';
const OWNER_EMAIL = 'e2e@travelplanner.test';
const OWNER_NAME = 'E2E Test User';

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

async function ensureUser(email: string, name: string): Promise<AuthUser> {
  return withDatabase(async (db) => {
    const existing = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
      })
      .from(users)
      .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
      .limit(1);

    const existingUser = existing[0];
    if (existingUser) {
      return {
        id: existingUser.id,
        email: existingUser.email,
        name: existingUser.name ?? name,
      };
    }

    const userId = crypto.randomUUID();
    await db.insert(users).values({
      id: userId,
      name,
      email,
      emailVerified: null,
      image: null,
    });

    return {
      id: userId,
      email,
      name,
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

async function selectDropdownOption(
  page: Page,
  label: string,
  optionTextContains: string,
): Promise<void> {
  const select = page.getByLabel(label);
  const optionValue = await select.evaluate((element, text) => {
    const options = Array.from((element as HTMLSelectElement).options);
    const match = options.find((option) => option.text.includes(text));
    return match?.value ?? null;
  }, optionTextContains);
  if (!optionValue) throw new Error(`Could not find option for "${optionTextContains}"`);

  await select.selectOption(optionValue);
}

async function switchActiveOrganization(page: Page, organizationName: string): Promise<void> {
  await selectDropdownOption(page, 'Active organization', organizationName);
  await page.waitForTimeout(400);
  await page.reload();
}

test('first authenticated visit bootstraps workspace and dashboard keeps management off-page', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.getByTestId('app-header-utility-row')).toBeVisible();
  await expect(page.getByTestId('app-header-section-row')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Trips' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Trips' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('link', { name: 'Settings' })).not.toHaveAttribute('aria-current');
  await expect(page.getByLabel('Create organization')).toHaveCount(0);
  await expect(page.getByLabel('Add member by email')).toHaveCount(0);

  const organizationSelect = page.getByLabel('Active organization');
  await expect(organizationSelect).toBeVisible();
  await expect(organizationSelect).toContainText("E2E Test User's Workspace");
  await expect(organizationSelect.locator('option')).toHaveCount(1);

  await page.reload();
  await expect(organizationSelect.locator('option')).toHaveCount(1);
});

test('owner manages sharing in settings, member is restricted, and owner can remove member', async ({
  page,
  context,
  baseURL,
}) => {
  const owner = await ensureUser(OWNER_EMAIL, OWNER_NAME);
  const partner = await ensureUser(`partner-${Date.now()}@travelplanner.test`, 'Partner E2E');

  await signInAsUser(context, baseURL, owner);
  await page.goto('/settings/organization');
  await expect(page.getByRole('heading', { name: /organization settings/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Settings' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  const sharedOrganizationName = `Shared Workspace For Mobile Header Truncation Coverage ${Date.now()}`;
  await page.getByLabel('Create organization').fill(sharedOrganizationName);
  await page.getByRole('button', { name: /^Create$/ }).click();
  await page.waitForTimeout(400);
  await page.reload();

  await expect(page.getByLabel('Active organization')).toContainText(sharedOrganizationName);
  await page.getByLabel('Add member by email').fill(partner.email);
  await page.getByRole('button', { name: /^Add$/ }).click();
  await expect(page.getByText(/Partner E2E \(member\)/)).toBeVisible();

  await page.setViewportSize({ width: 375, height: 812 });
  const utilityRow = page.getByTestId('app-header-utility-row');
  const sectionRow = page.getByTestId('app-header-section-row');
  await expect(utilityRow).toBeVisible();
  await expect(sectionRow).toBeVisible();
  await expect(page.getByRole('link', { name: 'Trips' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
  const orgSwitcherBox = await page.getByLabel('Active organization').boundingBox();
  expect(orgSwitcherBox).not.toBeNull();
  expect(orgSwitcherBox!.width).toBeLessThanOrEqual(375);
  await page.setViewportSize({ width: 1280, height: 800 });

  const sharedTripName = `Shared Org Trip ${Date.now()}`;
  await page.goto('/');
  await page.getByRole('button', { name: /create trip/i }).first().click();
  await page.getByLabel('Trip name').fill(sharedTripName);
  await page.getByLabel('Total budget').fill('10000');
  await page.locator('form').getByRole('button', { name: /create trip/i }).click();
  await expect(page.getByRole('heading', { name: sharedTripName })).toBeVisible();

  await signInAsUser(context, baseURL, partner);
  await page.goto('/');
  await switchActiveOrganization(page, sharedOrganizationName);
  await expect(page.getByRole('link').filter({ hasText: sharedTripName }).first()).toBeVisible();

  await page.getByRole('link').filter({ hasText: sharedTripName }).first().click();
  await page.getByRole('button', { name: /edit trip/i }).click();
  const editedTripName = `${sharedTripName} Edited`;
  await page.getByLabel('Trip name').fill(editedTripName);
  await page.getByRole('button', { name: /save changes/i }).click();
  await expect(page.getByRole('heading', { name: editedTripName })).toBeVisible();

  await page.goto('/settings/organization');
  await expect(
    page.getByText('Only organization owners can create organizations and manage members.'),
  ).toBeVisible();
  await expect(page.getByLabel('Create organization')).toHaveCount(0);
  await expect(page.getByLabel('Add member by email')).toHaveCount(0);

  await signInAsUser(context, baseURL, owner);
  await page.goto('/');
  await switchActiveOrganization(page, sharedOrganizationName);
  await page.getByRole('link').filter({ hasText: editedTripName }).first().click();

  await selectDropdownOption(page, 'Move to', "E2E Test User's Workspace");
  await page.getByRole('button', { name: /^Move$/ }).click();
  await page.goto('/');
  await switchActiveOrganization(page, sharedOrganizationName);
  await expect(page.getByRole('link').filter({ hasText: editedTripName })).toHaveCount(0);

  await switchActiveOrganization(page, "E2E Test User's Workspace");
  await expect(page.getByRole('link').filter({ hasText: editedTripName }).first()).toBeVisible();

  await page.goto('/settings/organization');
  await switchActiveOrganization(page, sharedOrganizationName);
  const partnerMemberRow = page.locator('li').filter({ hasText: 'Partner E2E (member)' });
  await partnerMemberRow.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByText(/Partner E2E \(member\)/)).toHaveCount(0);

  await signInAsUser(context, baseURL, partner);
  await page.goto('/');
  await expect(page.getByLabel('Active organization')).not.toContainText(sharedOrganizationName);
});
