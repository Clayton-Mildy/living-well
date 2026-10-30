// Round 16 phase 2 story (phone, small seed, demo day Wed 21 Oct 2026). Benjamin (Owner) approves Ega's staff training day (closed Mon 14 Dec) and sets Front desk's Next month (renewals) to Hidden.
// Caca then has no Next month in More and Billing opens view-only; Ega sees no Approve on Receipts (Fransiska approves them).
// Isolated env: E2E_NAME=r16b E2E_PORT=8921 scripts/e2e-all.sh 1 phone round16p2
import { test, expect } from '@playwright/test';
import { resetDemo, signIn, watchConsole, assertNoHorizontalScroll } from './helpers';
import { pickOption, pickDate } from './kit';

test.describe.configure({ timeout: 90_000 });
test.beforeEach(async ({ request }) => { await resetDemo(request); });

test('Benjamin approves the staff training day and the Calendar shows it closed', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's11', '/reviews?tab=owner');
  await expect(page.getByRole('tab', { name: /^Owner · 1/ })).toHaveAttribute('aria-selected', 'true');
  const row = page.locator('[data-type="owner"]').filter({ hasText: 'Staff training day' });
  await expect(row).toHaveCount(1);
  await assertNoHorizontalScroll(page);
  await row.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Approved' }).first()).toBeVisible();
  await expect(page.getByRole('tab', { name: /^Owner · 0/ })).toBeVisible();

  await page.goto('/calendar');
  await page.getByRole('tab', { name: 'Calendar' }).click();
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Next month' }).click();
  await expect(page.getByRole('heading', { name: 'December 2026' })).toBeVisible();
  await expect(page.locator('button[data-date="2026-12-14"]')).toHaveAttribute('aria-label', 'Monday 14 December · Closed');
  c.assertClean();
});

test('Benjamin hides Next month for the front desk; Caca loses it from More and Billing is view-only', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's11', '/roles');
  await pickOption(page, 'Role', 'Front desk');
  await pickOption(page, 'Front desk: Next month', 'Hidden');
  await expect(page.getByRole('combobox', { name: 'Front desk: Next month' })).toContainText('Hidden');
  await assertNoHorizontalScroll(page);

  await signIn(page, 's1', '/today');
  await page.getByRole('button', { name: 'More' }).click();
  const sheet = page.getByRole('dialog', { name: 'All modules' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('Next month', { exact: true })).toHaveCount(0);
  await expect(sheet.getByText('Billing', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.goto('/billing');
  await expect(page.getByTestId('view-only')).toContainText('View only');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('Ega sees no Approve on Receipts; Fransiska does', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/receipts');
  await expect(page.getByRole('heading', { name: 'Receipts' })).toBeVisible();
  await expect(page.getByTestId('view-only')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Approve/ })).toHaveCount(0);
  await signIn(page, 's10', '/receipts');
  await expect(page.getByRole('heading', { name: 'Receipts' })).toBeVisible();
  await expect(page.getByTestId('view-only')).toHaveCount(0);
  c.assertClean();
});

test("Ega's closure waits for the Owner (not closed yet); Benjamin approves one and Ega withdraws another", async ({ page }) => {
  const c = watchConsole(page);
  const addClosure = async (title: string, iso: string) => {
    await page.getByRole('button', { name: 'Add event' }).click();
    const dlg = page.getByRole('dialog', { name: 'Add to the calendar' });
    await dlg.getByPlaceholder('For example: Staff first-aid training').fill(title);
    await pickDate(page, 'Date', iso);
    await dlg.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Sent to the owner for approval.' }).first()).toBeVisible();
    await expect(dlg).toHaveCount(0);
  };
  await signIn(page, 's9', '/calendar');
  await addClosure('Deep cleaning', '2026-11-17');
  await addClosure('Pipe repair', '2026-11-18');
  await page.getByRole('tab', { name: 'Calendar' }).click();
  await page.getByRole('button', { name: 'Next month' }).click();
  await expect(page.locator('button[data-date="2026-11-17"]')).not.toHaveAttribute('aria-label', /Closed/); // still open
  await page.locator('button[data-date="2026-11-17"]').click();
  await expect(page.getByText(/Waiting for owner · .*Deep cleaning/).first()).toBeVisible();

  // Ega withdraws the second one
  await page.locator('button[data-date="2026-11-18"]').click();
  const wait18 = page.getByText(/Waiting for owner · .*Pipe repair/).first();
  await expect(wait18).toBeVisible();
  await page.getByRole('button', { name: 'Withdraw' }).first().click();
  await expect(page.getByRole('status').filter({ hasText: 'Request withdrawn.' }).first()).toBeVisible();

  // Benjamin sees the seeded training day and Ega's first closure (the withdrawn one is gone), and approves the closure
  await signIn(page, 's11', '/reviews?tab=owner');
  await expect(page.getByRole('tab', { name: /^Owner · 2/ })).toHaveAttribute('aria-selected', 'true');
  const row = page.locator('[data-type="owner"]').filter({ hasText: 'Deep cleaning' });
  await expect(row).toHaveCount(1);
  await row.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByRole('tab', { name: /^Owner · 1/ })).toBeVisible();
  await page.goto('/calendar');
  await page.getByRole('tab', { name: 'Calendar' }).click();
  await page.getByRole('button', { name: 'Next month' }).click();
  await expect(page.locator('button[data-date="2026-11-17"]')).toHaveAttribute('aria-label', 'Tuesday 17 November · Closed');
  await expect(page.locator('button[data-date="2026-11-18"]')).not.toHaveAttribute('aria-label', /Closed/);
  c.assertClean();
});
