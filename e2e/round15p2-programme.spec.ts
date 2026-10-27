// Round 15 phase 2 task 4 (phone, small seed, demo day Wed 21 Oct 2026): Ega reviews the activity team's proposed week inside the Calendar, and the week two weeks out is empty.
// Isolated env: E2E_NAME=e5 E2E_PORT=8891 scripts/e2e-all.sh 1 phone round15p2-programme
import { test, expect } from '@playwright/test';
import { resetDemo, signIn, watchConsole, assertNoHorizontalScroll } from './helpers';
import { pickOption } from './kit';

test.describe.configure({ timeout: 90_000 });
test.beforeEach(async ({ request }) => { await resetDemo(request); });

test('Dinar sends a change; Ega opens "See proposed week" in the Calendar, sees it struck through, and approves it there', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's5', '/calendar');
  await page.getByRole('heading', { name: 'Weekly schedule' }).scrollIntoViewIfNeeded();
  await page.getByRole('tab', { name: /^Fri/ }).click();
  await page.getByRole('button', { name: 'Friday 13:30: Cooking demo with Chef Agus' }).click();
  await pickOption(page, 'Activity', 'Reading circle');
  await page.getByRole('button', { name: 'Send to Ega' }).click();
  await page.getByRole('dialog', { name: 'Send the weekly schedule to Ega' }).getByRole('button', { name: 'Send to Ega' }).click();
  await expect(page.getByTestId('programme-waiting')).toContainText('Waiting for Ega');
  // the activity team sees the proposed week, without Approve
  await page.getByRole('button', { name: 'See proposed week' }).click();
  await page.getByRole('tab', { name: /^Fri/ }).click();
  await expect(page.locator('[data-proposed-cell="5|13:30"]')).toContainText('Reading circle');
  await expect(page.locator('[data-proposed-cell="5|13:30"] s')).toContainText('Cooking demo with Chef Agus');
  await expect(page.getByTestId('programme-waiting').getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0);
  // Ega reviews it in the Calendar
  await signIn(page, 's9', '/calendar');
  await page.getByRole('heading', { name: 'Weekly schedule' }).scrollIntoViewIfNeeded();
  const bar = page.getByTestId('programme-waiting');
  await bar.getByRole('button', { name: 'See proposed week' }).click();
  await page.getByRole('tab', { name: /^Fri/ }).click();
  await expect(page.locator('[data-proposed-cell="5|13:30"] s')).toContainText('Cooking demo with Chef Agus');
  await assertNoHorizontalScroll(page);
  await bar.getByRole('button', { name: 'Reject', exact: true }).click();
  await expect(bar.getByRole('button', { name: 'Reject', exact: true })).toBeDisabled();
  await bar.getByRole('button', { name: 'Cancel' }).click();
  await bar.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByTestId('programme-waiting')).toHaveCount(0);
  await page.getByRole('tab', { name: /^Fri/ }).click();
  await expect(page.getByRole('button', { name: 'Friday 13:30: Reading circle' })).toBeVisible();
  c.assertClean();
});

test('the week two weeks out (2 – 6 Nov) is empty for the activity team to plan, and the programme is back the week after', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's5', '/calendar');
  await page.getByRole('heading', { name: 'Weekly schedule' }).scrollIntoViewIfNeeded();
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Next week' }).click();
  await page.getByRole('tab', { name: /^Mon/ }).click();
  await expect(page.getByRole('button', { name: 'Monday 10:30: Empty' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Monday 13:30: Empty' })).toBeVisible();
  await page.getByRole('button', { name: 'Next week' }).click();
  await page.getByRole('tab', { name: /^Mon/ }).click();
  await expect(page.getByRole('button', { name: /^Monday 10:30: (?!Empty)/ })).toBeVisible();
  c.assertClean();
});
