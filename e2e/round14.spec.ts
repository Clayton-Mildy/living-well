// Round 14 phase 1 (small seed, demo day Wed 21 Oct 2026). One test per task; the phone project only.
// Isolated env: E2E_NAME=r14 E2E_PORT=8862 scripts/e2e-all.sh 1 "phone" round14
import { test, expect } from '@playwright/test';
import { resetDemo, signIn, watchConsole, assertNoHorizontalScroll } from './helpers';
import { pickDate, pickOption, regNext } from './kit';

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

test('Unpaid: Gabriel opens the list from /renewals?tab=unpaid, records "promised" for next week, and the row shows the promise', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's10', '/renewals?tab=unpaid');
  await expect(page.getByRole('tab', { name: 'Unpaid' })).toHaveAttribute('aria-selected', 'true');
  // the small seed has one overdue invoice (Opa Tjahjadi, 23 days late), not called yet
  const rows = page.locator('[data-unpaid]');
  await expect(rows).toHaveCount(1);
  const first = rows.first();
  await expect(first).toContainText('Opa Tjahjadi');
  await expect(first).toContainText('23 days late');
  await expect(first).toContainText('Not called yet');
  await assertNoHorizontalScroll(page);
  // note the call: "Promised", for next Wednesday
  await first.getByRole('button', { name: /^Open / }).click();
  await page.getByRole('button', { name: 'Promised', exact: true }).click();
  await pickDate(page, 'Promises to pay on', '2026-10-28');
  await assertNoHorizontalScroll(page);
  await page.getByRole('button', { name: 'Save call' }).click();
  // the row drops to the bottom of the list (the only row here) and carries the promise
  await expect(rows.last()).toContainText('Promised for 28 Oct');
  await expect(rows.last()).toHaveAttribute('data-called', '1');
  c.assertClean();
});

test('Dementia fee: on the Health step, answering Yes tells the cost, and the Review step repeats it', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/members');
  await page.getByRole('button', { name: 'Add member' }).click();
  const d = page.getByRole('dialog').last();
  await d.getByLabel('Full name, as on the KTP').fill('Siti Rahma');
  await pickDate(page, 'Date of birth', '1946-03-12');
  await regNext(d);
  await d.getByRole('textbox', { name: /^Name/ }).fill('Rudi Rahma');
  await d.getByLabel('Mobile (WhatsApp)').fill('0813 4000 7777');
  await regNext(d);
  // Health: nothing is told until the answer is Yes
  const askYes = d.getByText('Dementia (affects the monthly fee)?', { exact: true }).locator('xpath=..').getByRole('button', { name: 'Yes', exact: true });
  await expect(d).not.toContainText('more a month');
  await askYes.click();
  await expect(d).toContainText('Rp 750.000 more a month');
  await assertNoHorizontalScroll(page);
  // the Review step shows the same line under the answer
  await regNext(d);
  await d.getByRole('radio', { name: /^Flex/ }).click();
  await regNext(d);
  await d.getByTestId('doc-file').setInputFiles({ name: 'registration-form.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF') });
  await regNext(d);
  await expect(d.locator('[data-testid="review-dementia-fee"]')).toContainText('Rp 750.000 more a month');
  c.assertClean();
});
