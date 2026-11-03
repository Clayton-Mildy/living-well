// Round 17 phase 2 story (phone, small seed, demo day Wed 21 Oct 2026): Roles checkboxes, the few-visits alert, Settings and the terms.
//  - Benjamin opens Admin › Roles › Front desk, ticks Edit on Billing and saves; Caca then has Billing's buttons (no "View only").
//  - Caca opens Next month › Few visits (October's alert day was 16 Oct and the last change day 18 Oct, so the card reads "changes closed" but the list is open),
//    logs No answer for the first row; the row shows Called.
//  - Sinta Halim signs in for the first time: Agree is disabled until the terms are read to the end; she agrees and lands on Today; Me › Terms says when.
//  - Ega publishes version 2 in Settings › Terms; Maria signs in and sees "Terms updated".
// Screenshots (phone, tablet, laptop): E2E_SHOTS=1 scripts/e2e-all.sh 1 "phone tablet laptop" round17p2 ; PNGs go to artifacts/shots/round17p2/.
// Isolated env: E2E_NAME=r17b E2E_PORT=8941 scripts/e2e-all.sh 1 phone round16p2 round17p1 round17p2
import { test, expect, type Page } from '@playwright/test';
import { resetDemo, signIn, watchConsole, assertNoHorizontalScroll } from './helpers';

test.describe.configure({ timeout: 90_000 });
test.beforeEach(async ({ request }) => { await resetDemo(request); });

const goTab = (page: Page, key: 'today' | 'photos' | 'calendar' | 'health' | 'me') => page.locator(`[data-nav-key="${key}"]`).click();
const toast = (page: Page, text: string | RegExp) => expect(page.getByRole('status').filter({ hasText: text }).first()).toBeVisible();
/** Scroll the gate's text box to its end (the Agree button turns on once it is read). */
const readToEnd = (page: Page) => page.getByTestId('terms-scroll').evaluate((el) => { el.scrollTop = el.scrollHeight; });

test('Benjamin ticks Edit on Billing for the front desk; Caca then has the Billing buttons', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's1', '/billing');
  await expect(page.getByTestId('view-only')).toContainText('View only'); // Front desk reads Billing by default
  await signIn(page, 's11', '/roles');
  await page.locator('[data-role-row="lobby"]').click();
  await expect(page.locator('[data-role-page="lobby"]')).toBeVisible();
  const edit = page.getByRole('checkbox', { name: 'Billing: Edit', exact: true });
  const view = page.getByRole('checkbox', { name: 'Billing: View', exact: true });
  await expect(view).toHaveAttribute('aria-checked', 'true');
  await expect(edit).toHaveAttribute('aria-checked', 'false');
  await edit.click();
  await expect(edit).toHaveAttribute('aria-checked', 'true');
  await assertNoHorizontalScroll(page);
  await page.getByRole('button', { name: /^Save · \d+ changes?$/ }).click();
  await toast(page, 'Saved.');
  await expect(page.locator('[data-role-page="lobby"]')).toContainText(/changed 21 Oct by .*Benjamin/);

  await signIn(page, 's1', '/billing');
  await expect(page.getByRole('heading', { name: 'Billing' }).first()).toBeVisible();
  await expect(page.getByTestId('view-only')).toHaveCount(0);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('Caca logs "No answer" for the first row of the few-visits list: the row shows Called', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's1', '/renewals');
  const card = page.getByTestId('few-card');
  await expect(card).toContainText('Few visits');
  await expect(card).toContainText('3 · 1 called · changes closed'); // 21 Oct is after October's last change day, 18 Oct: the counts stay
  await assertNoHorizontalScroll(page);
  await card.click();
  const list = page.getByTestId('few-list');
  await expect(list).toBeVisible();
  const rows = list.locator('[data-few]');
  await expect(rows).toHaveCount(3); // Opa Budi (3), Opa Tjahjadi (4) and Opa Hendra (4, already called)
  await expect(rows.last()).toHaveAttribute('data-called', 'true'); // called ones go last
  const first = rows.first();
  await expect(first).not.toHaveAttribute('data-called', 'true');
  const id = (await first.getAttribute('data-few'))!;
  await assertNoHorizontalScroll(page);
  await first.locator(`[data-log="${id}"]`).click();
  const sheet = page.getByRole('dialog').last();
  await expect(sheet).toContainText('Log a call');
  await sheet.getByRole('button', { name: 'No answer', exact: true }).click();
  await sheet.getByRole('button', { name: 'Save', exact: true }).click();
  await toast(page, /Call logged for/);
  await expect(page.locator(`[data-few="${id}"]`).getByTestId('few-called')).toContainText('Called');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('Sinta meets the terms on her first sign-in: Agree waits for the end of the text, then Today; Me › Terms says when', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 'f_sinta', '/today');
  const gate = page.getByTestId('terms-gate');
  await expect(gate).toHaveAttribute('data-kind', 'first');
  await expect(gate).toContainText('Welcome, Sinta');
  await expect(gate).toContainText('Opa Hendra');
  const agree = page.getByTestId('terms-agree');
  await expect(agree).toBeDisabled();
  await expect(gate).toContainText('Scroll to the end to continue');
  await assertNoHorizontalScroll(page);
  await readToEnd(page);
  await expect(agree).toBeEnabled();
  await agree.click();
  await expect(gate).toHaveCount(0);
  await expect(page).toHaveURL(/\/today/);
  await goTab(page, 'me');
  await page.getByTestId('me-terms').click();
  await expect(page.getByTestId('terms-sheet')).toContainText('You agreed on 21 Oct · version 1');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('Ega publishes version 2 in Settings; Maria (who agreed to version 1) sees "Terms updated"', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 'f1', '/today');
  await expect(page.getByTestId('terms-gate')).toHaveCount(0); // Maria agreed to version 1 long ago

  await signIn(page, 's9', '/settings');
  const row = page.locator('[data-row="terms"]');
  await expect(row).toContainText('Version 1');
  await assertNoHorizontalScroll(page);
  await row.click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Edit terms' });
  await expect(editor).toBeVisible();
  const text = editor.locator('textarea[name="terms-en"]');
  await text.fill((await text.inputValue()) + '\n# Visitors\n- Visitors sign in at the front desk.');
  await editor.getByRole('button', { name: 'Publish', exact: true }).click();
  const ask = page.getByRole('dialog').filter({ hasText: 'Families will be asked to agree again' });
  await expect(ask).toContainText('Publish version 2?');
  await ask.getByRole('button', { name: 'Publish', exact: true }).click();
  await toast(page, /Terms published · version 2/);
  await expect(page.locator('body')).toContainText('Version 2'); // the Settings row on a phone, the terms page on a wide screen
  await assertNoHorizontalScroll(page);

  await signIn(page, 'f1', '/today');
  const gate = page.getByTestId('terms-gate');
  await expect(gate).toHaveAttribute('data-kind', 'updated');
  await expect(gate.getByRole('heading', { name: 'Terms updated' })).toBeVisible();
  await expect(gate).toContainText('Visitors sign in at the front desk.');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

// ---- screenshots (E2E_SHOTS=1): the new screens at the project's width ----
test('screenshots', async ({ page }, info) => {
  test.skip(!process.env.E2E_SHOTS, 'only with E2E_SHOTS=1');
  const shot = async (name: string) => { await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(400); await page.screenshot({ path: `artifacts/shots/round17p2/${info.project.name}-${name}.png`, fullPage: false }); };
  const wide = (page.viewportSize()?.width || 0) >= 768;

  await signIn(page, 's11', '/roles');
  await expect(page.locator('[data-role-row="lobby"]')).toBeVisible();
  if (!wide) await shot('1-roles-list');
  await page.locator('[data-role-row="lobby"]').click();
  await expect(page.locator('[data-role-page="lobby"]')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Billing: Edit', exact: true }).click(); // an unsaved change shows the Save bar
  await shot(wide ? '1-roles-list-and-role' : '2-role-page');
  await page.getByRole('button', { name: 'Discard', exact: true }).click();

  await signIn(page, 's9', '/settings');
  await expect(page.locator('[data-row="terms"]')).toBeVisible();
  await shot('3-settings');
  await page.locator('[data-row="terms"]').click();
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
  await shot('4-terms-page');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Edit terms' })).toBeVisible();
  await shot('5-terms-editor');

  await signIn(page, 'f_sinta', '/today');
  await expect(page.getByTestId('terms-gate')).toBeVisible();
  await shot('6-family-terms-gate');

  await signIn(page, 's1', '/renewals');
  await expect(page.getByTestId('few-card')).toBeVisible();
  await shot('7-few-visits-card');
  await page.getByTestId('few-card').click();
  await expect(page.getByTestId('few-list')).toBeVisible();
  await shot('8-few-visits-list');
  await page.locator('[data-few]').first().locator('[data-log]').click();
  await expect(page.getByRole('dialog').last()).toContainText('Log a call');
  await shot('9-few-visits-call-sheet');
});
