// Round 16 phase 1 story (phone, small seed, demo day Wed 21 Oct 2026). Caca: Flex and Gold beside Active, a late downgrade waits a month (14 days' notice).
// Fransiska: a cash payment needs a photo of the receipt. Maria passes the bills to Daniel, whose Bills then show them.
// Isolated env: E2E_NAME=r16 E2E_PORT=8901 scripts/e2e-all.sh 1 phone round16p1
import { test, expect } from '@playwright/test';
import { resetDemo, signIn, watchConsole, assertNoHorizontalScroll } from './helpers';
import { TINY_PNG } from './kit';

test.describe.configure({ timeout: 90_000 });
test.beforeEach(async ({ request }) => { await resetDemo(request); });

test('Caca: Flex and Gold sit beside Active; a downgrade asked on 21 Oct starts in December', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's1', '/members');
  await expect(page.getByTestId('members-split')).toHaveCount(0); // Active has no split line: Flex and Gold come next in the filter
  await page.getByRole('combobox', { name: 'Filter members' }).click();
  const opts = await page.getByRole('option').allTextContents();
  expect(opts.slice(0, 3).map((o) => o.split(/\s|·/)[0])).toEqual(['Active', 'Flex', 'Gold']);
  await page.getByRole('option', { name: /^Gold/ }).click();
  await expect(page.locator('[data-member="m46"]')).toBeVisible(); // Opa Budi is on Gold
  await expect(page.locator('[data-member="m1"]')).toHaveCount(0); // Oma Lina is on Flex

  await page.goto('/members/m46/plan'); // Opa Budi, on Gold
  await page.getByRole('button', { name: 'Change plan' }).click();
  const dlg = page.getByRole('dialog', { name: 'Change plan' });
  await dlg.getByText(/^Flex · /).click();
  await expect(dlg.getByTestId('plan-effective-fixed')).toContainText('1 December 2026'); // past the 18 Oct deadline for November
  await expect(dlg.getByTestId('plan-notice')).toContainText("14 days' notice");
  await dlg.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status').filter({ hasText: /1 December 2026/ }).first()).toBeVisible();
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('Fransiska: cash needs a photo of the receipt', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's10', '/billing');
  await expect(page.getByTestId('cel-to-bill')).toHaveCount(0); // round 17: the birthday cake goes on the next monthly invoice, not an invoice of its own

  await page.goto('/payments');
  await page.getByRole('searchbox', { name: 'Find a member or invoice' }).fill('lina');
  await page.getByRole('radio', { name: /Oma Lina · October/ }).click();
  await page.getByRole('button', { name: 'Cash', exact: true }).click();
  const save = page.getByRole('button', { name: 'Record payment' });
  await expect(save).toHaveAttribute('aria-disabled', 'true'); // no photo yet
  await expect(page.getByTestId('payment-proof')).toContainText('Add a photo of the transfer slip or the signed receipt.');
  await page.getByTestId('payment-proof').getByTestId('doc-file').setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: TINY_PNG });
  await expect(page.getByTestId('payment-proof')).toContainText(/receipt\.(png|jpg)/);
  await expect(save).not.toHaveAttribute('aria-disabled', 'true');
  await save.click();
  await expect(page.getByRole('status').filter({ hasText: /Payment recorded for Oma Lina/ }).first()).toBeVisible();
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('Maria passes Oma Lina\'s bills to Daniel; Daniel\'s Bills show the open invoice', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 'f1', '/billing');
  const lina = page.locator('[data-testid="billing-contact"][data-member="m1"]');
  await expect(lina).toContainText('Billing contact: you');
  await expect(page.getByTestId('billing-email')).toContainText('Invoices go to maria.wijaya@example.com');
  await lina.getByTestId('pass-billing').click();
  const sheet = page.getByTestId('pass-sheet');
  await expect(sheet).toContainText('Daniel');
  await sheet.getByRole('button', { name: 'Pass on' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Daniel now looks after these bills.' }).first()).toBeVisible();
  await expect(lina).toContainText('Billing contact: Daniel');
  await assertNoHorizontalScroll(page);

  await signIn(page, 'f2', '/billing');
  await expect(page.locator('[data-testid="billing-contact"][data-member="m1"]')).toContainText('Billing contact: you');
  await expect(page.locator('[data-testid="invoice-row"][data-invoice="INV-2610-001"]')).toBeVisible();
  await expect(page.getByTestId('billing-pay')).toBeVisible();
  c.assertClean();
});
