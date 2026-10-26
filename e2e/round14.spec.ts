// Round 14 phase 1 (small seed, demo day Wed 21 Oct 2026). One test per task; the phone project only.
// Isolated env: E2E_NAME=r14 E2E_PORT=8862 scripts/e2e-all.sh 1 "phone" round14
import { test, expect } from '@playwright/test';
import { resetDemo, signIn, watchConsole, assertNoHorizontalScroll } from './helpers';
import { pickOption } from './kit';

test.beforeEach(async ({ request }) => { await resetDemo(request); });

test('Next month: Caca records Oma Lina’s upgrade (in effect at once), sees the row with Undo, and undoes it', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's1', '/renewals');
  await expect(page.getByRole('heading', { level: 1, name: 'Next month' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Changes' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Unpaid' })).toBeVisible();
  await assertNoHorizontalScroll(page);
  // record a change: pick the member, then the change (Oma Lina is on Flex, so the switch is an upgrade)
  await page.getByRole('button', { name: 'Record a change' }).click();
  await pickOption(page, 'Pick a member', /Oma Lina/);
  await page.getByRole('button', { name: 'Upgrade to Gold' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const row = page.locator('[data-change="m1"]');
  await expect(row).toContainText('Oma Lina');
  await expect(row).toContainText('Upgrade to Gold');
  await expect(row).toContainText('from 1 Nov');
  await assertNoHorizontalScroll(page);
  // undo it before the 1st: the row is gone
  await row.getByRole('button', { name: /^Undo/ }).click();
  await expect(row).toHaveCount(0);
  c.assertClean();
});
