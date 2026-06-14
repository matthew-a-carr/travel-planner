import { readFile } from 'node:fs/promises';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { encode } from 'next-auth/jwt';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
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
      firstName: name.split(' ')[0] ?? null,
      lastName: name.split(' ').slice(1).join(' ') || null,
      email,
      isApproved: true,
      isAdmin: false,
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
      isApproved: true,
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
      url: cookieBaseUrl.origin,
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
): Promise<string> {
  const select = page.getByLabel(label);
  await expect(select).toBeVisible({ timeout: 10_000 });

  const optionValue = await select.evaluate((element, text) => {
    const options = Array.from((element as HTMLSelectElement).options);
    const match = options.find((option) => option.text.includes(text));
    return match?.value ?? null;
  }, optionTextContains);
  if (!optionValue) throw new Error(`Could not find option for "${optionTextContains}"`);

  await select.selectOption(optionValue);
  return optionValue;
}

async function switchActiveOrganization(page: Page, organizationName: string): Promise<void> {
  const optionValue = await selectDropdownOption(page, 'Active organization', organizationName);
  await expect(page.getByLabel('Active organization')).toHaveValue(optionValue);
  await page.waitForLoadState('networkidle');
  await page.reload();
}

async function createSignedInPageForUser(
  browser: Browser,
  baseURL: string | undefined,
  user: AuthUser,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    baseURL: baseURL ?? 'http://localhost:3000',
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();
  await signInAsUser(context, baseURL, user);
  return { context, page };
}

test('authenticated dashboard shows organization-scoped app controls only', async ({
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
  await expect(page.getByLabel('Search users to add')).toHaveCount(0);

  const organizationSelect = page.getByLabel('Active organization');
  await expect(organizationSelect).toBeVisible();
  await expect(organizationSelect).toContainText('E2E Test User Org');
  await expect(organizationSelect.locator('option')).toHaveCount(1);

  await page.reload();
  await expect(organizationSelect.locator('option')).toHaveCount(1);
});

test('owner manages sharing in settings, member is restricted, and owner can remove member', async ({
  page,
  context,
  baseURL,
  browser,
}) => {
  const runId = Date.now();
  const owner = await ensureUser(OWNER_EMAIL, OWNER_NAME);
  const partnerEmail = `partner-${runId}@travelplanner.test`;
  const alphaCandidate = await ensureUser(`alpha-${runId}@travelplanner.test`, 'Alpha Candidate');
  const zuluCandidate = await ensureUser(`zulu-${runId}@travelplanner.test`, 'Zulu Candidate');

  await signInAsUser(context, baseURL, owner);
  await page.goto('/settings/organizations');
  await expect(page.getByRole('heading', { name: 'Organizations', exact: true })).toBeVisible();
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
  await page.goto('/settings/access');
  await page.getByPlaceholder('teammate@example.com').fill(partnerEmail);
  await page.getByPlaceholder('Optional display name').fill('Partner E2E');
  await page.getByRole('button', { name: /pre-provision/i }).click();
  await expect(page.getByRole('cell', { name: partnerEmail, exact: true })).toBeVisible();

  await page.goto('/settings/organization');
  const memberSearch = page.getByLabel('Search users to add');
  await memberSearch.click();
  await memberSearch.fill(String(runId));
  await expect(page.locator('[role="option"]').filter({ hasText: alphaCandidate.email })).toBeVisible();
  await expect(page.locator('[role="option"]').filter({ hasText: zuluCandidate.email })).toBeVisible();
  await expect(page.locator('[role="option"]').filter({ hasText: partnerEmail })).toBeVisible();
  const optionTexts = await page.getByRole('option').allInnerTexts();
  const alphaIndex = optionTexts.findIndex((text) => text.includes(alphaCandidate.email));
  const zuluIndex = optionTexts.findIndex((text) => text.includes(zuluCandidate.email));
  expect(alphaIndex).toBeGreaterThanOrEqual(0);
  expect(zuluIndex).toBeGreaterThanOrEqual(0);
  expect(alphaIndex).toBeLessThan(zuluIndex);

  await memberSearch.fill(partnerEmail);
  await expect(page.locator('[role="option"]').filter({ hasText: partnerEmail })).toBeVisible();
  await page.locator('[role="option"]').filter({ hasText: partnerEmail }).first().click();
  await page.getByRole('button', { name: /^Add$/ }).click();
  await expect(page.getByText(/Partner E2E \(member\)/)).toBeVisible();
  await memberSearch.click();
  await expect(page.locator('[role="option"]').filter({ hasText: partnerEmail })).toHaveCount(0);

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

  const partner = await ensureUser(partnerEmail, 'Partner E2E');
  const { context: partnerContext, page: partnerPage } = await createSignedInPageForUser(
    browser,
    baseURL,
    partner,
  );
  const editedTripName = `${sharedTripName} Edited`;
  try {
    await partnerPage.goto('/');
    await switchActiveOrganization(partnerPage, sharedOrganizationName);
    await expect(partnerPage.getByRole('link').filter({ hasText: sharedTripName }).first()).toBeVisible();

    await partnerPage.getByRole('link').filter({ hasText: sharedTripName }).first().click();
    await partnerPage.getByRole('button', { name: /edit trip/i }).click();
    await partnerPage.getByLabel('Trip name').fill(editedTripName);
    await partnerPage.getByRole('button', { name: /save changes/i }).click();
    await expect(partnerPage.getByRole('heading', { name: editedTripName })).toBeVisible();

    await partnerPage.goto('/settings/organization');
    await expect(
      partnerPage.getByText('You can view members, but only owners can change membership.'),
    ).toBeVisible();
    await expect(partnerPage.getByLabel('Search users to add')).toHaveCount(0);
    await partnerPage.goto('/settings/organizations');
    await expect(
      partnerPage.getByText('Organization creation is restricted to app admins.'),
    ).toBeVisible();
    await expect(partnerPage.getByLabel('Create organization')).toHaveCount(0);

    await page.goto('/');
    await switchActiveOrganization(page, sharedOrganizationName);
    await page.getByRole('link').filter({ hasText: editedTripName }).first().click();
    await page.waitForURL(/\/trips\/[^/]+$/);
    await expect(page.getByRole('heading', { name: editedTripName })).toBeVisible();
    // The "Move to" dropdown lives behind the header's "More trip actions"
    // overflow menu, and only renders when the server knows the owner has
    // another organization to move the trip into. On slow CI runners the
    // server-action cookie write / revalidation from switchActiveOrganization
    // may not have settled by the time this page first renders, so we retry
    // with a reload (re-opening the menu each time) until the dropdown appears.
    await expect(async () => {
      await page.reload();
      await page.getByRole('button', { name: 'More trip actions' }).click();
      await expect(page.getByLabel('Move to')).toBeVisible();
    }).toPass({ timeout: 30_000, intervals: [1_000, 2_000, 3_000, 5_000] });

    await selectDropdownOption(page, 'Move to', 'E2E Test User Org');
    await page.getByRole('button', { name: /^Move$/ }).click();
    await page.goto('/');
    await switchActiveOrganization(page, sharedOrganizationName);
    await expect(page.getByRole('link').filter({ hasText: editedTripName })).toHaveCount(0);

    await switchActiveOrganization(page, 'E2E Test User Org');
    await expect(page.getByRole('link').filter({ hasText: editedTripName }).first()).toBeVisible();

    await page.goto('/settings/organization');
    await switchActiveOrganization(page, sharedOrganizationName);
    const partnerMemberRow = page.locator('li').filter({ hasText: 'Partner E2E (member)' });
    await partnerMemberRow.getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByText(/Partner E2E \(member\)/)).toHaveCount(0);

    await partnerPage.goto('/');
    await expect(partnerPage).toHaveURL(/\/settings\/organizations/);
    await expect(partnerPage.getByText('You do not belong to any organizations yet.')).toBeVisible();
  } finally {
    await partnerContext.close();
  }
});
