// Round 13 phase 2 (small seed, demo day Wed 21 Oct 2026). One test per task; the phone project only.
// Isolated env: E2E_NAME=r13 E2E_PORT=8861 scripts/e2e-all.sh 1 "phone" round13
import { test, expect } from '@playwright/test';
import { resetDemo, signIn, watchConsole, assertNoHorizontalScroll } from './helpers';
import { pickDate } from './kit';

test.beforeEach(async ({ request }) => { await resetDemo(request); });

test('lead history: the Enquiries History view lists the months, Leads comes back unchanged', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/enquiries');
  await page.getByRole('tab', { name: 'History' }).click();
  const oct = page.getByRole('region', { name: 'October 2026' });
  await expect(oct).toContainText('4 opened'); // e1, e2, e3 and e5
  await expect(oct).toContainText('Chose another place 1'); // Ibu Nyoman Sari, lost on 8 Oct (a move of this month)
  const sep = page.getByRole('region', { name: 'September 2026' });
  await expect(sep).toContainText('1 opened'); // Ibu Nyoman Sari was opened on 28 Sep
  await expect(sep).not.toContainText('Chose another place');
  await oct.getByRole('button', { name: /^Leads \(4\)$/ }).click();
  await expect(oct).toContainText('Oma Siu Lan Tjandra');
  await expect(oct).toContainText('New 8 Oct · Trial 12 Oct');
  await assertNoHorizontalScroll(page);
  // back on Leads the stage chips are unchanged
  await page.getByRole('tab', { name: 'Leads' }).click();
  await expect(page.locator('[data-lead]').first()).toBeVisible();
  await expect(page.locator('[data-hist-lead]')).toHaveCount(0);
  c.assertClean();
});

test('staff leave: the People row says Leave asked, the Leave tab shows Caca’s balance and request, Ega approves it and the bell item goes', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/hr');
  await expect(page.locator('[data-staff="s1"]')).toContainText('Leave asked');
  await expect(page.locator('[data-staff="s5"]')).not.toContainText('Leave asked');
  // the bell has one item for Caca's request
  await page.getByRole('button', { name: /^Notifications/ }).first().click();
  const bell = page.getByRole('dialog', { name: 'Notifications' });
  await expect(bell.getByText('Caca asks for 2 days off from Mon 9 Nov')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto('/hr?staff=s1&tab=leave');
  await expect(page.getByRole('tab', { name: 'Leave' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('leave-balance')).toHaveText('4 of 5 days left this year');
  const req = page.locator('[data-leave="lv-3"]');
  await expect(req).toContainText('Taking my mother to a check-up in Bandung');
  await expect(req).toContainText('Mon 9 Nov – Tue 10 Nov');
  await assertNoHorizontalScroll(page);
  await req.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Leave approved.' })).toBeVisible();
  await expect(page.getByTestId('leave-balance')).toHaveText('2 of 5 days left this year');
  await expect(page.locator('[data-leave="lv-3"]')).toContainText('Approved');
  await page.getByRole('button', { name: /^Notifications/ }).first().click();
  await expect(page.getByRole('dialog', { name: 'Notifications' }).getByText('Caca asks for 2 days off')).toHaveCount(0);
  c.assertClean();
});

test('staff leave: Dinar asks for two days next month from Account and sees the request waiting', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's5', '/today');
  await page.getByRole('button', { name: 'Account' }).click();
  const acct = page.getByRole('dialog', { name: 'Account' });
  await expect(acct.getByTestId('leave-balance')).toHaveText('3 of 5 days left this year');
  await acct.getByRole('button', { name: 'Ask for leave' }).click();
  const sheet = page.getByRole('dialog', { name: 'Ask for leave' });
  await pickDate(page, 'From', '2026-11-16');
  await pickDate(page, 'To', '2026-11-17');
  await expect(sheet.getByTestId('leave-count')).toHaveText('2 club days · 1 left after');
  await sheet.getByLabel('Reason').fill('Family wedding in Solo');
  await sheet.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Sent to management.' })).toBeVisible();
  await expect(acct.getByTestId('leave-balance')).toHaveText('3 of 5 days left this year · 2 waiting');
  await expect(acct.locator('[data-leave]').first()).toContainText('Mon 16 Nov – Tue 17 Nov');
  await expect(acct.getByRole('button', { name: 'Cancel request' })).toBeVisible();
  await assertNoHorizontalScroll(page);
  c.assertClean();
});
