import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

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

    const btn = page.getByRole('button', { name: /sign in with google/i });
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

    const btn = page.getByRole('button', { name: /sign in with google/i });
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

    await expect(page.getByRole('button', { name: /create trip/i })).toBeVisible();
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
