// Round 13 phase 2 (small seed, demo day Wed 21 Oct 2026). One test per task; the phone project only.
// Isolated env: E2E_NAME=r13 E2E_PORT=8861 scripts/e2e-all.sh 1 "phone" round13
import { test, expect } from '@playwright/test';
import { resetDemo, signIn, watchConsole, assertNoHorizontalScroll } from './helpers';
import { pickDate } from './kit';
import type { Page } from '@playwright/test';

/** The bell lists many items now and pages them: look through the pages of the open Notifications dialog for a line (the last locator is returned, so a count of 0 means it is on no page). */
async function bellLine(page: Page, text: string) {
  const bell = page.getByRole('dialog', { name: 'Notifications' });
  for (let i = 0; i < 6; i++) {
    const hit = bell.getByText(text);
    if (await hit.count()) return hit;
    const next = bell.getByRole('button', { name: 'Next page' });
    if (!(await next.count()) || (await next.isDisabled())) break;
    await next.click();
  }
  return bell.getByText(text);
}

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
  await expect(await bellLine(page, 'Caca asks for 2 days off from Mon 9 Nov')).toBeVisible();
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
  await page.goto('/hr'); // the bell sits in the header of the list, not on a staff page
  await page.getByRole('button', { name: /^Notifications/ }).first().click();
  await expect(await bellLine(page, 'Caca asks for 2 days off')).toHaveCount(0);
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

test('plans: the page reads in sections, the visits field sits in Plans, and Changes appears once something is edited', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/plans');
  const labels = () => page.locator('#main section[aria-label]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  expect(await labels()).toEqual(['Plans', 'Extra charges', 'One-off fees', 'Next invoice preview']);
  const plans = page.locator('#main section[aria-label="Plans"]');
  await expect(plans.getByLabel('Flex visits per month')).toBeVisible();
  await plans.getByLabel('Flex visits per month').fill('8');
  expect(await labels()).toEqual(['Plans', 'Extra charges', 'One-off fees', 'Changes', 'Next invoice preview']);
  await expect(page.locator('#main section[aria-label="Changes"]')).toContainText('Takes effect from');
  await expect(page.locator('#main section[aria-label="Changes"]')).toContainText(/On next month.s invoice/);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('front desk: Caca changes Oma Lina’s plan (pending banner) and records a cash payment; Fransiska confirms it', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's1', '/members/m1/plan');
  await page.getByRole('button', { name: 'Change plan' }).click();
  const dlg = page.getByRole('dialog', { name: 'Change plan' });
  await dlg.getByText(/^Gold · /).click();
  await expect(dlg.getByTestId('plan-effective-fixed')).toContainText('1 November 2026'); // the desk can only pick the 1st of next month
  await dlg.getByRole('button', { name: 'Submit for review' }).click();
  await expect(page.getByRole('group', { name: 'Pending review' })).toBeVisible();
  // a cash payment on the October invoice waits for finance
  await page.getByRole('button', { name: /INV-2610-001$/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Invoice INV-2610-001' });
  await sheet.getByRole('button', { name: 'Record payment' }).click();
  await sheet.getByRole('button', { name: 'Record payment' }).last().click();
  await expect(sheet).toContainText('Recorded by Caca, waiting for finance');
  await assertNoHorizontalScroll(page);
  // Fransiska confirms it
  await signIn(page, 's10', '/payments');
  await expect(page.getByText('Waiting for you · 1')).toBeVisible();
  await page.getByRole('button', { name: /^Confirm/ }).first().click();
  await expect(page.getByText(/^Waiting for you/)).toHaveCount(0);
  // Ega sees the plan change in Approvals
  await signIn(page, 's9', '/reviews');
  await expect(page.getByText(/Oma Lina/).first()).toBeVisible();
  c.assertClean();
});

test('month report: four hero tiles with a six-month line each, the groups below, and Send to owner leads with the numbers', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/monthReport');
  const hero = page.locator('section[aria-label="Key numbers"]');
  await expect(hero.locator('[data-tile]')).toHaveCount(4);
  for (const k of ['collected', 'active', 'index']) await expect(hero.locator(`[data-tile="${k}"] svg`).first()).toBeVisible();
  await expect(hero.locator('[data-tile="conversion"]')).toContainText('No data yet'); // the small seed has no lead cohort with a result to draw a line from
  await expect(hero.locator('[data-tile="collected"]')).toContainText('so far this month');
  for (const g of ['Money', 'Members', 'Care and mood', 'Pipeline and team']) await expect(page.getByRole('region', { name: g })).toBeVisible();
  await assertNoHorizontalScroll(page);
  await page.getByRole('button', { name: 'Send to owner' }).click();
  await expect(page.getByRole('dialog', { name: 'Summary for the owner' })).toContainText('Revenue collected:');
  c.assertClean();
});

test('surveys: Caca sees the live survey, no New survey, and sends it to one more contact', async ({ page, request }) => {
  const add = await request.post('/api/actions/family.addContact', { headers: { 'x-user-id': 's9' }, data: { mutationId: 'e2e-r13-contact', club: 'citra', input: { memberId: 'm2', name: 'Rina Santoso', phone: '081255500123', relation: 'daughter', appAccess: true } } });
  expect(add.ok(), await add.text()).toBeTruthy();
  const c = watchConsole(page);
  await signIn(page, 's1', '/today');
  await page.locator('[data-nav-key="more"]').first().click();
  await page.getByRole('dialog', { name: 'All modules' }).locator('[data-nav-key="surveys"]').click();
  await expect(page).toHaveURL(/\/surveys$/);
  await expect(page.getByText('October check-in').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /New survey/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Send to a contact' }).click();
  await page.locator('[data-send-to]').filter({ hasText: 'Rina Santoso' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Sent to Rina Santoso.' })).toBeVisible();
  await assertNoHorizontalScroll(page);
  c.assertClean();
});
