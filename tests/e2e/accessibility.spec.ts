import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const SIGN_IN_BUTTON_NAME = /sign in (with google|locally \(dev\))/i;

/**
 * Accessibility and responsive layout tests.
 *
 * Uses axe-core (via @axe-core/playwright) to audit WCAG 2.1 AA compliance
 * at three canonical viewports:
 *   - mobile  : 375px  (iPhone SE / small Android)
 *   - tablet  : 768px  (iPad Mini / iPad Air)
 *   - desktop : 1280px (laptop / monitor)
 *
 * Public pages run without a session cookie.
 * Authenticated pages use the session written by global.setup.ts.
 *
 * A failing axe audit must be fixed — it is treated identically to a
 * unit test failure and blocks merging. See CONSTITUTION.md §8.
 */

const VIEWPORTS = [
  { label: 'mobile (375px)', width: 375, height: 812 },
  { label: 'tablet (768px)', width: 768, height: 1024 },
  { label: 'desktop (1280px)', width: 1280, height: 800 },
] as const;

function tripLink(page: Page, name: string) {
  return page.getByRole('link').filter({ hasText: name }).first();
}

async function openExistingTrip(page: Page, ...candidateNames: string[]) {
  for (const name of candidateNames) {
    const link = tripLink(page, name);
    if ((await link.count()) > 0) {
      await link.click();
      return;
    }
  }
  throw new Error(`Could not find trip link for: ${candidateNames.join(', ')}`);
}

// ─── Public pages ─────────────────────────────────────────────────────────────

test.describe('Landing page — accessibility', () => {
  // Landing page is the unauthenticated sign-in screen — no session cookie.
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const vp of VIEWPORTS) {
    test(`passes axe audit at ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();

      expect(
        results.violations,
        formatViolations(results.violations),
      ).toEqual([]);
    });
  }

  test('sign-in button is visible and reachable at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    const btn = page.getByRole('button', { name: SIGN_IN_BUTTON_NAME }).first();
    await expect(btn).toBeVisible();

    // Ensure it is within viewport (not scrolled off-screen)
    const box = await btn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('sign-in button is visible and reachable at 768px', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    const btn = page.getByRole('button', { name: SIGN_IN_BUTTON_NAME }).first();
    await expect(btn).toBeVisible();
  });
});

test.describe('Login page — accessibility', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const vp of VIEWPORTS) {
    test(`passes axe audit at ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/login');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();

      expect(
        results.violations,
        formatViolations(results.violations),
      ).toEqual([]);
    });
  }
});

// ─── Authenticated pages ───────────────────────────────────────────────────────

test.describe('Dashboard — accessibility & responsive', () => {
  // Uses the global storageState (auth-state.json) from playwright.config.ts.

  for (const vp of VIEWPORTS) {
    test(`passes axe audit at ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();

      expect(
        results.violations,
        formatViolations(results.violations),
      ).toEqual([]);
    });
  }

  test('create trip button is visible at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    await expect(page.getByRole('button', { name: /create trip/i }).first()).toBeVisible();
  });

  test('primary nav and organization switcher are reachable at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    const utilityRow = page.getByTestId('app-header-utility-row');
    const sectionRow = page.getByTestId('app-header-section-row');
    await expect(utilityRow).toBeVisible();
    await expect(sectionRow).toBeVisible();

    await expect(page.getByRole('link', { name: 'Trips' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
    await expect(page.getByLabel('Active organization')).toBeVisible();

    const utilityBox = await utilityRow.boundingBox();
    const sectionBox = await sectionRow.boundingBox();
    expect(utilityBox).not.toBeNull();
    expect(sectionBox).not.toBeNull();
    expect(sectionBox!.y).toBeGreaterThanOrEqual(utilityBox!.y + utilityBox!.height - 1);

    const organizationSwitcherBox = await page.getByLabel('Active organization').boundingBox();
    expect(organizationSwitcherBox).not.toBeNull();
    expect(organizationSwitcherBox!.width).toBeLessThanOrEqual(375);
  });

  test('header nav and organization switcher are keyboard focusable', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    const brandLink = page.getByRole('link', { name: 'Travel Planner' });
    const tripsLink = page.getByRole('link', { name: 'Trips' });
    const settingsLink = page.getByRole('link', { name: 'Settings' });
    const orgSwitcher = page.getByLabel('Active organization');
    const signOutButton = page.getByRole('button', { name: /sign out/i });

    await brandLink.focus();
    await expect(brandLink).toBeFocused();
    await tripsLink.focus();
    await expect(tripsLink).toBeFocused();
    await settingsLink.focus();
    await expect(settingsLink).toBeFocused();
    await orgSwitcher.focus();
    await expect(orgSwitcher).toBeFocused();
    await signOutButton.focus();
    await expect(signOutButton).toBeFocused();
  });

  test('passes axe audit in dark mode with create trip modal open', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await page.getByRole('button', { name: /create trip/i }).first().click();
    await expect(page.getByRole('heading', { name: /new trip/i })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(
      results.violations,
      formatViolations(results.violations),
    ).toEqual([]);
  });
});

test.describe('Organizations settings page — accessibility', () => {
  for (const vp of VIEWPORTS) {
    test(`passes axe audit at ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/settings/organizations');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();

      expect(
        results.violations,
        formatViolations(results.violations),
      ).toEqual([]);
    });
  }

  test('passes axe audit in dark mode', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/settings/organizations');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(
      results.violations,
      formatViolations(results.violations),
    ).toEqual([]);
  });

  test('settings tab is active and header rows are visible', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/settings/organizations');

    await expect(page.getByTestId('app-header-utility-row')).toBeVisible();
    await expect(page.getByTestId('app-header-section-row')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByRole('link', { name: 'Trips' })).not.toHaveAttribute('aria-current');
  });

});

test.describe('Organization members page — accessibility', () => {
  for (const vp of VIEWPORTS) {
    test(`passes axe audit at ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/settings/organization');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();

      expect(
        results.violations,
        formatViolations(results.violations),
      ).toEqual([]);
    });
  }

  test('passes axe audit in dark mode', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/settings/organization');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(
      results.violations,
      formatViolations(results.violations),
    ).toEqual([]);
  });

  test('member search combobox is keyboard reachable', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/settings/organization');

    const memberSearch = page.getByLabel('Search users to add');
    await expect(memberSearch).toBeVisible();
    await memberSearch.focus();
    await expect(memberSearch).toBeFocused();
    await expect(page.getByRole('listbox')).toBeVisible();
  });
});

// ─── Trip detail page ─────────────────────────────────────────────────────────

test.describe('Trip detail page — accessibility', () => {
  // Uses the global storageState (auth-state.json) from playwright.config.ts.
  // Depends on the "Test Round the World" trip created by 01-trips.spec.ts.

  for (const vp of VIEWPORTS) {
    test(`passes axe audit at ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await openExistingTrip(page, 'Big Adventure', 'Test Round the World');
      await page.waitForURL(/\/trips\//);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();

      expect(
        results.violations,
        formatViolations(results.violations),
      ).toEqual([]);
    });
  }

  test('passes axe audit in dark mode', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await openExistingTrip(page, 'Big Adventure', 'Test Round the World');
    await page.waitForURL(/\/trips\//);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(
      results.violations,
      formatViolations(results.violations),
    ).toEqual([]);
  });

  test('sticky header stays pinned while scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await openExistingTrip(page, 'Big Adventure', 'Test Round the World');
    await page.waitForURL(/\/trips\//);

    const header = page.getByTestId('app-header');
    const headerBoxBeforeScroll = await header.boundingBox();
    expect(headerBoxBeforeScroll).not.toBeNull();

    const contentTop = page.getByRole('heading', { level: 1 }).first();
    const contentTopBox = await contentTop.boundingBox();
    expect(contentTopBox).not.toBeNull();
    expect(contentTopBox!.y).toBeGreaterThanOrEqual(headerBoxBeforeScroll!.height - 1);

    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(100);

    const yOffset = await page.evaluate(() => window.scrollY);
    expect(yOffset).toBeGreaterThan(0);

    const headerBoxAfterScroll = await header.boundingBox();
    expect(headerBoxAfterScroll).not.toBeNull();
    expect(headerBoxAfterScroll!.y).toBeGreaterThanOrEqual(-1);
    expect(headerBoxAfterScroll!.y).toBeLessThanOrEqual(1);
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

type AxeViolation = {
  id: string;
  description: string;
  nodes: { html: string }[];
};

/**
 * Formats axe violations into a readable string for test failure messages.
 * Without this, a failing test just shows an empty array diff.
 */
function formatViolations(violations: AxeViolation[]): string {
  if (violations.length === 0) return 'No violations';
  return violations
    .map(
      (v) =>
        `[${v.id}] ${v.description}\n  Nodes: ${v.nodes.map((n) => n.html).join('\n         ')}`,
    )
    .join('\n\n');
}
