// Finance: Billing (tiles, lists, reminders, call notes, invoice run, invoice sheet), Payments (partial payments, refunds, Xero),
// Budget (weeks, approvals, sections), Receipts (snap, approve, vendor invoices) and the Directory (add, edit, delete, public view).
// Runs at phone, phone360, tablet and laptop. Isolated environment: `pnpm e2e:env finance 8807 5207`.
import { test, expect as baseExpect, type Page } from '@playwright/test';
import { resetDemo, signIn, watchConsole, isPhone, assertNoHorizontalScroll } from './helpers';
import { goToPage, pickDate, pickFilter, takePhotoWithFile } from './kit';

// Eight agents share one machine: leave room for a slow moment (a test that is wrong still fails, just a little later).
const expect = baseExpect.configure({ timeout: 15_000 });
test.beforeEach(async ({ request }) => { test.setTimeout(90_000); await resetDemo(request); });

const toast = (page: Page, text: string | RegExp) => expect(page.getByRole('status').filter({ hasText: text }).first()).toBeVisible();
const row = (page: Page, name: RegExp | string) => page.getByRole('button', { name });
/** What a family or staff member sees in "Updates" of the notification panel. */
async function updatesOf(page: Page) {
  await page.getByRole('button', { name: /Notifications/ }).first().click();
  const panel = page.getByRole('dialog', { name: 'Notifications' });
  await panel.getByRole('tab', { name: /Updates/ }).click();
  return panel;
}
/** Notifications addressed to one person, read from the same snapshot the app loads (for people whose screens belong to other areas). */
async function notificationsFor(page: Page, userId: string) {
  const r = await page.request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': userId } });
  const { state } = await r.json();
  return (Object.values(state.notifications) as { kind: string; toUsers: string[]; params: Record<string, string | number> }[]).filter((n) => n.toUsers.includes(userId));
}
/** The signed-in user's own call to the API (what the app does under the hood), e.g. to check what the server refuses. */
async function post(page: Page, userId: string, name: string, input: unknown) {
  return page.request.post(`/api/actions/${name}`, { headers: { 'x-user-id': userId }, data: { mutationId: `e2e-${Date.now()}-${Math.random()}`, club: 'citra', input } });
}

test.describe('billing', () => {
  test('shows 1 overdue and 3 due; the tiles filter the lists; search narrows them', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's10', '/today');
    await expect(page.getByRole('heading', { name: 'Billing' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Overdue\s*1\b/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Outstanding · due 27 Oct\s*3\b/ })).toBeVisible();
    await expect(row(page, /Opa Tjahjadi Lim, INV-2609-020/)).toBeVisible();
    await expect(page.getByText('23 days late')).toBeVisible();
    await expect(row(page, /INV-2610-/)).toHaveCount(3);
    await assertNoHorizontalScroll(page);

    await page.getByRole('button', { name: /^Overdue/ }).click();
    await expect(page.getByText('Due on the 27th', { exact: true })).toHaveCount(0);
    await expect(row(page, /INV-2610-/)).toHaveCount(0);
    await page.getByRole('button', { name: /^Paid · October/ }).click();
    await expect(row(page, /INV-2610-002/)).toBeVisible();
    await expect(row(page, /INV-2610-010/)).toBeVisible();
    await page.getByRole('button', { name: /^Paid · October/ }).click(); // again: back to everything
    await expect(row(page, /INV-2610-/)).toHaveCount(3);

    await page.getByRole('searchbox', { name: 'Search by member, invoice or family' }).fill('lina');
    await expect(row(page, /INV-2610-/)).toHaveCount(1);
    await expect(row(page, /Oma Lina Wijaya, INV-2610-001/)).toBeVisible();
    await page.getByRole('searchbox', { name: 'Search by member, invoice or family' }).fill('zzzz');
    await expect(page.getByText('No matches').first()).toBeVisible();
    c.assertClean();
  });

  test('send a reminder and add a call note; the family hears about the reminder', async ({ page, context }) => {
    const c = watchConsole(page);
    await signIn(page, 's10', '/today');
    await row(page, /Opa Tjahjadi Lim, INV-2609-020/).click();
    await page.getByLabel('Call note').fill('Spoke to Yohana, paying on Friday');
    await page.getByRole('button', { name: 'Save note' }).click();
    await toast(page, 'Call note saved.');
    await expect(page.getByText('Spoke to Yohana, paying on Friday')).toBeVisible();
    await page.getByRole('button', { name: 'Send reminder' }).click();
    await toast(page, /Reminder sent to Yohana Lim on WhatsApp/);
    await expect(page.getByText('WhatsApp reminder sent with the virtual account number')).toBeVisible();
    await expect(page.getByText(/^Last reminder/)).toBeVisible();

    const fam = await context.newPage();
    await signIn(fam, 'fm20_0', '/contacts'); // any family screen has the bell; Useful contacts is ours
    const panel = await updatesOf(fam);
    await expect(panel.getByText(/Reminder: invoice INV-2609-020 for Opa Tjahjadi/)).toBeVisible();
    c.assertClean();
  });

  test('deep links from the notification bell: ?f=overdue filters the lists, ?run=1 opens the invoice run (management)', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's9', '/billing?f=overdue');
    await expect(page.getByRole('button', { name: /^Overdue/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(row(page, /INV-2609-020/)).toBeVisible();
    await expect(row(page, /INV-2610-/)).toHaveCount(0);
    await signIn(page, 's9', '/billing?run=1');
    const run = page.getByRole('dialog', { name: 'Invoice run' });
    await expect(run).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(run).toHaveCount(0);
    await expect(page).toHaveURL(/\/billing$/); // the parameter is gone once the sheet is closed
    c.assertClean();
  });

  test('finance can open the member profile from a billing row and from the invoice sheet', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's10', '/today');
    await row(page, /Opa Budi Wijaya, INV-2610-046/).click();
    await page.getByRole('button', { name: 'Open profile' }).click();
    await expect(page).toHaveURL(/\/members\/m46\/plan$/);
    await expect(page.locator('#main')).toContainText('Budi');
    // and from the invoice sheet (Plan tab of the profile: the sheet there has no second "Open profile")
    await signIn(page, 's10', '/today');
    await row(page, /Oma Lina Wijaya, INV-2610-001/).click();
    await page.getByRole('button', { name: 'Open invoice' }).click();
    await page.getByRole('dialog', { name: 'Invoice INV-2610-001' }).getByRole('button', { name: 'Open profile' }).click();
    await expect(page).toHaveURL(/\/members\/m1\/plan$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    c.assertClean();
  });

  test('opens the invoice sheet and a partial payment makes the invoice "Part paid"', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's10', '/today');
    await row(page, /Opa Budi Wijaya, INV-2610-046/).click();
    await page.getByRole('button', { name: 'Open invoice' }).click();
    const sheet = page.getByRole('dialog', { name: 'Invoice INV-2610-046' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('Gold plan · October')).toBeVisible();
    await expect(sheet.getByText('Rp 9.500.000').first()).toBeVisible();
    await expect(sheet.getByTestId('va-number')).toHaveText(/^3901 \d{4} \d{4} \d{4}$/);
    await sheet.getByRole('button', { name: 'Mandiri' }).click();
    await expect(sheet.getByTestId('va-number')).toHaveText(/^8950 /);
    await sheet.getByRole('button', { name: 'Copy' }).click();
    await toast(page, /Virtual account number copied|Couldn.t copy/);

    await sheet.getByRole('button', { name: 'Record payment' }).click();
    await sheet.getByLabel('Amount credited (Rp)').fill('4000000');
    await sheet.getByLabel('Reference').fill('SG-4471');
    await sheet.getByLabel('Amount received in SGD (optional)').fill('330.50');
    await sheet.getByRole('button', { name: 'Record payment' }).last().click();
    await toast(page, /Payment recorded for Opa Budi/);
    await expect(sheet.getByText('Part paid').first()).toBeVisible();
    await expect(sheet.getByText('Rp 4.000.000 paid · Rp 5.500.000 left')).toBeVisible();
    await expect(sheet.getByText(/SGD bank transfer · SGD 330.5/)).toBeVisible();
    await assertNoHorizontalScroll(page);
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(row(page, /Opa Budi Wijaya, INV-2610-046/)).toContainText('Part paid');

    // the rest of the money settles it (the row is still open)
    await page.getByRole('button', { name: 'Open invoice' }).click();
    await sheet.getByRole('button', { name: 'Record payment' }).click();
    await expect(sheet.getByLabel('Amount credited (Rp)')).toHaveValue('5.500.000'); // the balance is suggested
    await sheet.getByLabel('Reference').fill('SG-4472');
    await sheet.getByRole('button', { name: 'Record payment' }).last().click();
    await expect(sheet.getByText('Paid', { exact: true }).first()).toBeVisible();
    c.assertClean();
  });

  test('adjusts an invoice, then voids one with a reason; a paid invoice can’t be voided', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's10', '/today');
    await row(page, /Oma Lina Wijaya, INV-2610-001/).click();
    await page.getByRole('button', { name: 'Open invoice' }).click();
    const sheet = page.getByRole('dialog', { name: 'Invoice INV-2610-001' });
    await sheet.getByRole('button', { name: 'Adjust' }).click();
    await sheet.getByLabel('Label').fill('Late pick-up fee');
    await sheet.getByLabel('Amount (Rp)').fill('150000');
    await sheet.getByRole('button', { name: 'Add charge' }).click();
    await toast(page, 'Invoice INV-2610-001 updated.');
    await expect(sheet.getByText('Late pick-up fee')).toBeVisible();
    await expect(sheet.getByText('Rp 5.650.000').first()).toBeVisible();

    await sheet.getByRole('button', { name: 'Void', exact: true }).click();
    await sheet.getByLabel('Why is it voided?').fill('Member left early');
    await sheet.getByRole('button', { name: 'Void invoice' }).click();
    await toast(page, 'Invoice INV-2610-001 voided.');
    await expect(sheet.getByText('Voided by Bu Fransiska: Member left early')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(row(page, /INV-2610-001/)).toHaveCount(0); // void invoices leave the lists

    // an invoice that has a payment on it: the server says no
    const r = await post(page, 's10', 'invoice.void', { invoiceId: 'INV-2610-002', reason: 'Oops' });
    expect(r.status()).toBe(422);
    expect((await r.json()).code).toBe('finance.err.voidPaid');
    c.assertClean();
  });

  test('invoice run: preview November with Lina’s extra visit, then issue; the new invoices appear', async ({ page, context }) => {
    const c = watchConsole(page);
    // Oma Lina has made 10 visits in October (her Flex quota): today's check-in at the lobby is the 11th, an extra day for November's invoice
    const ci = await post(page, 's1', 'attendance.checkIn', { memberId: 'm1', method: 'face' });
    expect(ci.ok()).toBeTruthy();
    expect((await ci.json()).result.extra).toBe(true);
    await signIn(page, 's10', '/today');
    await expect(page.getByText('Next run · November 2026')).toBeVisible();
    await page.getByRole('button', { name: 'Preview and issue' }).click();
    const sheet = page.getByRole('dialog', { name: 'Invoice run' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'November 2026', pressed: true })).toBeVisible();
    await expect(sheet.getByText(/before the usual issue date \(15 November 2026\)/)).toBeVisible();
    await expect(sheet.getByText(/October 2026 isn.t over yet/)).toBeVisible(); // an early run says what it can't see yet
    await expect(sheet.getByText('Bill to Maria Wijaya').first()).toBeVisible();
    await expect(sheet.getByText('Gold plan · November').first()).toBeVisible();
    await expect(sheet.getByText('Flex plan · November').first()).toBeVisible();
    await expect(sheet.getByText('Extra days · October (1)')).toBeVisible();
    await expect(sheet.getByText('Wed 21 Oct', { exact: true })).toBeVisible(); // the visit that is the extra day
    await expect(sheet.getByText('Rp 650.000', { exact: true })).toBeVisible();
    await expect(sheet.getByText('Rp 6.150.000', { exact: true })).toBeVisible(); // Flex Rp 5.500.000 + 1 extra day
    await assertNoHorizontalScroll(page);
    await sheet.getByRole('button', { name: /^Issue invoices \(5\)/ }).click();
    await expect(sheet.getByText(/Send these invoices \(5, Rp [\d.]+\) to families now\?/)).toBeVisible();
    await sheet.getByRole('button', { name: 'Yes, release them early' }).click();
    await toast(page, 'Invoices issued: 5. Families have been told.');
    await expect(sheet).toHaveCount(0);
    for (const n of ['INV-2611-001', 'INV-2611-046', 'INV-2611-002', 'INV-2611-010', 'INV-2611-020']) await expect(row(page, new RegExp(n))).toBeVisible();
    await expect(page.getByRole('button', { name: /^Outstanding · due 27 Oct\s*8\b/ })).toBeVisible();
    // every invoice has its own virtual account, and Lina's carries the extra day
    await row(page, /INV-2611-001/).click();
    await page.getByRole('button', { name: 'Open invoice' }).click();
    const inv = page.getByRole('dialog', { name: 'Invoice INV-2611-001' });
    await expect(inv.getByText('Released early on Wed 21 Oct')).toBeVisible();
    await expect(inv.getByText('Extra days · October (1)')).toBeVisible();
    await expect(inv.getByText('Rp 6.150.000').first()).toBeVisible();
    await expect(inv.getByTestId('va-number')).toHaveText(/^3901 \d{4} \d{4} \d{4}$/);

    // the payer hears about it; a second run has nothing left to do
    const fam = await context.newPage();
    await signIn(fam, 'f1', '/contacts');
    const panel = await updatesOf(fam);
    await expect(panel.getByText(/New invoice INV-2611-001 for Oma Lina: Rp 6\.150\.000/)).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Preview and issue' }).click();
    await expect(page.getByRole('dialog', { name: 'Invoice run' }).getByText('Everything for November 2026 has been invoiced.')).toBeVisible();
    c.assertClean();
  });
});

test.describe('payments', () => {
  test('refund part of a payment: totals drop, the invoice re-opens; with a credit note it stays settled', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's10', '/payments');
    await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible();
    await expect(page.getByText('October so far')).toBeVisible();
    await expect(page.getByText('Rp 15.000.000').first()).toBeVisible();
    await assertNoHorizontalScroll(page);

    await page.getByRole('button', { name: /^Refund Bapak Bambang Purnomo INV-2610-010/ }).click();
    await page.getByLabel('Refund amount').fill('1000000');
    await page.getByPlaceholder('Reason for the refund').fill('Absent all month');
    await page.getByRole('button', { name: 'Refund Rp 1.000.000' }).click();
    await toast(page, 'Refund of Rp 1.000.000 recorded and sent to Xero.');
    await expect(page.getByText(/Refunded Rp 1\.000\.000 · .* · Absent all month/)).toBeVisible();
    await expect(page.getByText('Rp 14.000.000').first()).toBeVisible(); // refunds are not in the totals
    if (isPhone(page)) await expect(page.getByTestId('pay-tile-refunds')).toContainText('Rp 1.000.000'); // a phone shows only the amount
    else await expect(page.getByText(/Rp 1\.000\.000 · sent to Xero as credit notes/)).toBeVisible();

    // Hendra: a refund with a credit note keeps his invoice settled
    await page.getByRole('button', { name: /^Refund Opa Hendra Gunawan INV-2610-002/ }).click();
    await page.getByLabel('Refund amount').fill('500000');
    await page.getByPlaceholder('Reason for the refund').fill('Goodwill');
    await page.getByRole('switch', { name: /Issue a credit note/ }).click();
    await page.getByRole('button', { name: 'Refund Rp 500.000' }).click();
    await expect(page.getByText(/Refunded Rp 500\.000 · .* · Goodwill · credit note/)).toBeVisible();

    // Xero: the refunds wait, then sync
    await expect(page.getByTestId('pay-tile-xero')).toContainText(/^Xero pending\s*2/);
    await page.getByRole('button', { name: 'Sync Xero now' }).click();
    await toast(page, 'Xero is up to date.');
    await expect(page.getByTestId('pay-tile-xero')).toContainText(/^Xero pending\s*0/);

    // Billing: Bambang's invoice is open again (part paid), Hendra's is still paid
    await signIn(page, 's10', '/today');
    await expect(row(page, /Bapak Bambang Purnomo, INV-2610-010/)).toContainText('Part paid');
    await expect(row(page, /Opa Hendra Gunawan, INV-2610-002/)).toHaveCount(0);
    await page.getByRole('button', { name: /^Paid · October/ }).click();
    await expect(row(page, /Opa Hendra Gunawan, INV-2610-002/)).toBeVisible();
    c.assertClean();
  });

  test('long lists are paged, never cut off: 6 seeded + 18 new payments show 15, then all 24', async ({ page }) => {
    const c = watchConsole(page);
    for (let i = 1; i <= 18; i++) {
      const r = await post(page, 's10', 'payment.record', { memberId: 'm46', amount: 1000, method: 'cash', ref: `T${i}`, invoiceId: 'INV-2610-046' });
      expect(r.ok()).toBeTruthy();
    }
    await signIn(page, 's10', '/payments');
    const rows = page.getByText(/ · Cash · ref T\d+$/);
    await expect(rows).toHaveCount(15);
    await expect(page.getByRole('navigation', { name: /Payments as they arrive: pages/ })).toBeVisible();
    await goToPage(page, 2);
    await expect(rows).toHaveCount(3); // 24 payments: 15 on page 1, the other 9 on page 2 (3 of them are the cash ones)
    await expect(page.getByText('Opa Hendra Gunawan').first()).toBeVisible(); // the seeded payments are all there too
    await goToPage(page, 1);
    await expect(rows).toHaveCount(15);
    await page.getByRole('searchbox', { name: 'Search by member, invoice, reference or bank' }).fill('T7');
    await expect(rows).toHaveCount(1);
    await assertNoHorizontalScroll(page);
    c.assertClean();
  });

  test('record a manual payment from the payments page; search and pick the invoice', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's10', '/payments');
    await page.getByRole('searchbox', { name: 'Find a member or invoice' }).fill('tjahjadi');
    await expect(page.getByRole('radio', { name: /Opa Tjahjadi · September/ })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Opa Budi/ })).toHaveCount(0);
    await page.getByRole('radio', { name: /Opa Tjahjadi · September/ }).click();
    await expect(page.getByLabel('Amount credited (Rp)')).toHaveValue('9.500.000');
    await page.getByRole('button', { name: 'Revolut' }).click();
    await page.getByLabel('Amount credited (Rp)').fill('12000000'); // more than September: the rest goes to October
    await expect(page.getByRole('button', { name: 'Record payment' })).toHaveAttribute('aria-disabled', 'true'); // a Revolut payment needs its reference
    await page.getByLabel('Reference', { exact: true }).fill('RV-9981');
    await expect(page.getByRole('button', { name: 'Record payment' })).not.toHaveAttribute('aria-disabled', 'true');
    await page.getByRole('button', { name: 'Record payment' }).click();
    await toast(page, /Payment recorded for Opa Tjahjadi/);
    await expect(page.getByText('INV-2609-020, INV-2610-020 · Revolut · ref RV-9981')).toBeVisible(); // two periods: no single month in the line
    await signIn(page, 's10', '/today');
    await expect(row(page, /INV-2609-020/)).toHaveCount(0); // September is settled, no overdue list any more
    await expect(row(page, /Opa Tjahjadi Lim, INV-2610-020/)).toContainText('Part paid');
    c.assertClean();
  });

  test('the family’s primary contact pays by virtual account (demo); the other contact can’t, the server says so', async ({ page, context }) => {
    // server rules, whatever the screens do
    const f2 = await post(page, 'f2', 'payment.simulateVa', { invoiceIds: ['INV-2610-001'], bank: 'BCA' });
    expect(f2.status()).toBe(403);
    const stranger = await post(page, 'f1', 'payment.simulateVa', { invoiceIds: ['INV-2610-020'], bank: 'BCA' });
    expect(stranger.status()).toBe(403);
    const f1 = await post(page, 'f1', 'payment.simulateVa', { invoiceIds: ['INV-2610-001', 'INV-2610-046'], bank: 'Mandiri' });
    expect(f1.status()).toBe(200);
    expect((await f1.json()).result.paymentIds).toHaveLength(2); // one DOKU payment per member

    // finance sees both payments arrive, and the invoices settled
    const c = watchConsole(page);
    await signIn(page, 's10', '/payments');
    await expect(page.getByText(/INV-2610-001 · October 2026 · DOKU VA · Mandiri/)).toBeVisible();
    await expect(page.getByText(/INV-2610-046 · October 2026 · DOKU VA · Mandiri/)).toBeVisible();
    const panel = await updatesOf(page);
    await expect(panel.getByText(/Payment received from Maria Wijaya for INV-2610-001/)).toBeVisible();
    await page.keyboard.press('Escape');
    // the payer is told that the receipt is on its way
    const fam = await context.newPage();
    await signIn(fam, 'f1', '/contacts');
    await expect((await updatesOf(fam)).getByText(/Payment received for Oma Lina: Rp 5.500.000/)).toBeVisible();
    c.assertClean();
  });
});

test.describe('budget', () => {
  test('approve the Activities request, switch week, add and rename a section, request and reject', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's10', '/budget');
    await expect(page.getByRole('heading', { name: 'Budget' })).toBeVisible();
    await expect(page.getByTestId('budget-week')).toHaveText('Mon 19 Oct – Sun 25 Oct');
    await expect(page.getByText(/Week of Mon 19 Oct · resets on Monday/)).toBeVisible();
    await expect(page.getByText('Rp 6.120.000 spent')).toBeVisible();
    await assertNoHorizontalScroll(page);

    await page.getByRole('button', { name: 'Approve Angklung tuning' }).click();
    await toast(page, 'Approved. Dinar has been told.');
    await expect(page.getByText('Rp 840.000 spent · Rp 450.000 committed')).toBeVisible();
    await expect(page.getByText('Rp 710.000 left')).toBeVisible();

    // weeks are real Monday to Sunday weeks; the label comes from the date
    await page.getByRole('button', { name: 'Previous week' }).click();
    await expect(page.getByTestId('budget-week')).toHaveText('Mon 12 Oct – Sun 18 Oct');
    await expect(page.getByText('Rp 0 spent').first()).toBeVisible();
    await expect(page.getByText('No requests this week.').first()).toBeVisible();
    await page.getByRole('button', { name: 'Next week' }).click();
    await page.getByRole('button', { name: 'Next week' }).click();
    await expect(page.getByTestId('budget-week')).toHaveText('Mon 26 Oct – Sun 1 Nov');
    await page.getByRole('button', { name: 'This week' }).click();
    await expect(page.getByTestId('budget-week')).toHaveText('Mon 19 Oct – Sun 25 Oct');

    // a new section, then rename it
    await page.getByRole('button', { name: 'Add a section' }).click();
    let dlg = page.getByRole('dialog', { name: 'Add a section' });
    await dlg.getByLabel('Section name').fill('Transport');
    await dlg.getByLabel('Weekly budget').fill('1500000');
    await dlg.getByRole('button', { name: 'Add section' }).click();
    await toast(page, 'Transport added.');
    await expect(page.getByLabel('Weekly budget Transport')).toHaveValue('1.500.000');
    await page.getByRole('button', { name: 'Rename Transport' }).click();
    dlg = page.getByRole('dialog', { name: 'Rename section' });
    await dlg.getByLabel('Section name').fill('Transport and fuel');
    await dlg.getByRole('button', { name: 'Save' }).click();
    await toast(page, 'Section renamed.');
    await expect(page.getByLabel('Weekly budget Transport and fuel')).toBeVisible();

    // a weekly limit applies from the viewed week on
    await page.getByLabel('Weekly budget F&B').fill('10000000');
    await page.getByRole('button', { name: /^Apply from/ }).click();
    await toast(page, /Weekly budget saved from/);
    await expect(page.getByLabel('Weekly budget F&B')).toHaveValue('10.000.000');

    // finance requests too: it waits for approval like anyone's; rejecting needs a reason
    await page.getByLabel('Item', { exact: true }).fill('Whiteboard markers');
    await page.getByLabel('Amount', { exact: true }).fill('120000');
    await page.getByRole('button', { name: 'Send request' }).click();
    await toast(page, 'Request added. Approve it from the section card.');
    await expect(page.getByText('Whiteboard markers · Rp 120.000')).toBeVisible();
    await page.getByRole('button', { name: 'Reject' }).first().click();
    await expect(page.getByRole('button', { name: 'Reject request' })).toHaveAttribute('aria-disabled', 'true');
    await page.getByLabel('Reason (the requester sees it)').fill('Use the stock first');
    await page.getByRole('button', { name: 'Reject request' }).click();
    await toast(page, 'Request rejected.');
    await expect(page.getByText('Reason: Use the stock first')).toBeVisible();
    c.assertClean();
  });

  test('a staff member’s own pending request can be edited and cancelled; other people’s can’t (server rules)', async ({ page }) => {
    const c = watchConsole(page);
    // the activity teacher has no budget screen: she asks through the API (the Requests screen), finance approves
    const r = await post(page, 's5', 'budget.request', { sectionId: 'activities', item: 'Paint brushes', amount: 90000 });
    expect(r.ok()).toBeTruthy();
    const id = (await r.json()).result.requestId as string;
    const own = await post(page, 's2', 'budget.cancel', { id });
    expect(own.status()).toBe(403); // someone else's request
    const edit = await post(page, 's5', 'budget.edit', { id, amount: 95000 });
    expect(edit.ok()).toBeTruthy();
    await signIn(page, 's10', '/budget');
    await expect(page.getByText('Paint brushes · Rp 95.000')).toBeVisible();
    expect((await post(page, 's5', 'budget.cancel', { id })).ok()).toBeTruthy();
    await expect(page.getByText('Paint brushes')).toHaveCount(0);
    c.assertClean();
  });
});

test.describe('receipts', () => {
  test('snap a receipt (supplier from the directory), approve it, and it counts against the budget', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's10', '/receipts');
    await expect(page.getByRole('heading', { name: 'Receipts' })).toBeVisible();
    await page.getByRole('button', { name: 'Snap a receipt (nota)' }).click();
    await page.getByRole('button', { name: 'Tap to take the photo' }).click();
    await takePhotoWithFile(page); // no camera in a headless browser: the file picker is the fallback
    await expect(page.getByRole('img', { name: 'Photo of receipt nota_2110.jpg' })).toBeVisible();
    await page.getByRole('button', { name: 'Sayur Segar Kemang', exact: true }).click();
    await expect(page.getByLabel('Supplier', { exact: true })).toHaveValue('Sayur Segar Kemang');
    await page.getByLabel('Amount (Rp)').fill('150000');
    await assertNoHorizontalScroll(page);
    await page.getByRole('button', { name: 'Send to finance' }).click();
    await toast(page, 'Receipt sent to finance. It already counts against the F&B budget.');
    await expect(page.getByText('Sayur Segar Kemang · Rp 150.000')).toBeVisible();
    await expect(page.locator('img[src^="/api/media/md_"]').first()).toBeVisible(); // the real photo is on the row
    await expect(page.getByText('To approve').first()).toBeVisible();
    await page.getByRole('button', { name: 'Approve Sayur Segar Kemang' }).click();
    await toast(page, 'Sayur Segar Kemang receipt approved and sent to Xero.');
    await expect(page.getByText('Sending to Xero')).toBeVisible();

    // the money shows up in F&B for the week
    await signIn(page, 's10', '/budget');
    await expect(page.getByText('Rp 6.270.000 spent')).toBeVisible(); // 6.12M + 150k
    c.assertClean();
  });

  test('a free-text supplier can be rejected with a note, and the teacher who sent it is told why', async ({ page }) => {
    const c = watchConsole(page);
    const sent = await post(page, 's5', 'receipt.add', { date: '2026-10-21', supplier: 'Warung Bu Tini', amount: 40000, sectionId: 'activities', fileName: 'nota_2110.jpg' });
    expect(sent.ok()).toBeTruthy();
    await signIn(page, 's10', '/receipts');
    await page.getByRole('button', { name: 'Reject Warung Bu Tini' }).click();
    await expect(page.getByRole('button', { name: 'Reject', exact: true }).last()).toBeVisible();
    await page.getByLabel('Reason (the requester sees it)').fill('Not a club expense');
    await page.getByRole('button', { name: 'Reject', exact: true }).last().click();
    await toast(page, 'Receipt rejected.');
    await expect(page.getByText('Reason: Not a club expense')).toBeVisible();
    // the teacher who sent it is told why (her screens belong to the Requests area: read the notification as she would receive it)
    const told = (await notificationsFor(page, 's5')).find((n) => n.kind === 'finance.notif.receiptRejected');
    expect(told?.params).toMatchObject({ supplier: 'Warung Bu Tini', note: 'Not a club expense' });
    c.assertClean();
  });

  test('vendor invoices: add, edit, approve, mark paid, delete', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's10', '/receipts');
    await page.getByRole('button', { name: 'Add vendor invoice' }).click();
    const dlg = page.getByRole('dialog', { name: 'Add vendor invoice' });
    await dlg.getByRole('button', { name: 'Ikan Laut Jaya', exact: true }).click();
    await dlg.getByLabel('Invoice number').fill('ILJ-2610-77');
    await dlg.getByLabel('Amount (Rp)').fill('3200000');
    await pickDate(page, 'Due date', '2026-11-05');
    await dlg.getByRole('button', { name: 'Add invoice' }).click();
    await toast(page, 'Ikan Laut Jaya invoice added.');
    await expect(page.getByText('Ikan Laut Jaya · ILJ-2610-77')).toBeVisible();

    await page.getByRole('button', { name: 'Edit ILJ-2610-77' }).click();
    const edit = page.getByRole('dialog', { name: 'Edit vendor invoice' });
    await edit.getByLabel('Amount (Rp)').fill('3250000');
    await edit.getByRole('button', { name: 'Save' }).click();
    await toast(page, 'Vendor invoice updated.');
    await expect(page.getByText(/Rp 3\.250\.000 · due Thu 5 Nov/)).toBeVisible();

    await page.getByRole('button', { name: 'Approve ILJ-2610-77' }).click();
    await toast(page, 'Ikan Laut Jaya invoice approved and sent to Xero for payment.');
    await page.getByRole('button', { name: 'Mark paid ILJ-2610-77' }).click();
    await toast(page, 'Ikan Laut Jaya invoice marked as paid.');
    await expect(page.getByRole('button', { name: 'Mark paid ILJ-2610-77' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete ILJ-2610-77' })).toHaveCount(0); // a paid invoice stays on record

    // the seeded one waiting for approval: reject it (reason needed), fix it, delete it
    await page.getByRole('button', { name: 'Reject INV/SSK/1023' }).click();
    await page.getByLabel('Reason (the requester sees it)').fill('Quantities do not match');
    await page.getByRole('button', { name: 'Reject', exact: true }).last().click();
    await toast(page, 'Sayur Segar Kemang invoice rejected.');
    await page.getByRole('button', { name: 'Delete INV/SSK/1023' }).click();
    await page.getByRole('dialog', { name: 'Delete this vendor invoice?' }).getByRole('button', { name: 'Delete' }).click();
    await toast(page, 'Vendor invoice deleted.');
    await expect(page.getByText('INV/SSK/1023')).toHaveCount(0);
    c.assertClean();
  });
});

test.describe('directory', () => {
  test('add, edit and delete a contact; the phone is a tel: link; public contacts reach the family live', async ({ page, context }) => {
    const c = watchConsole(page);
    await signIn(page, 's10', '/directory');
    await expect(page.getByRole('heading', { name: 'Directory' })).toBeVisible();
    if (isPhone(page)) await expect(page.getByRole('combobox', { name: 'Filter contacts' })).toContainText('All · 7');
    else await expect(page.getByRole('button', { name: /^All\s*·?\s*7/ })).toBeVisible();
    await assertNoHorizontalScroll(page);

    await page.getByRole('button', { name: 'Add a contact' }).click();
    let dlg = page.getByRole('dialog', { name: 'Add a contact' });
    await dlg.getByLabel('Name', { exact: true }).fill('Toko Roti Manis');
    await dlg.getByLabel('What they do', { exact: true }).fill('Bread and cakes');
    await dlg.getByLabel('Mobile (WhatsApp)').fill('0812 3456 7890');
    await dlg.getByRole('button', { name: 'Add contact' }).click();
    await toast(page, 'Toko Roti Manis added to the directory.');
    await expect(page.getByRole('link', { name: 'Call Toko Roti Manis' })).toHaveAttribute('href', 'tel:+6281234567890');
    await expect(page.getByText('Supplier · Bread and cakes')).toBeVisible();

    await page.getByRole('button', { name: 'Edit Toko Roti Manis' }).click();
    dlg = page.getByRole('dialog', { name: 'Edit contact' });
    await dlg.getByLabel('Name', { exact: true }).fill('Toko Roti Manis Kemang');
    await dlg.getByLabel('What they do (Indonesian, optional)').fill('Roti dan kue');
    await dlg.getByRole('button', { name: 'Save' }).click();
    await toast(page, 'Toko Roti Manis Kemang saved.');
    await expect(page.getByText('Toko Roti Manis Kemang', { exact: true })).toBeVisible();

    // filters and search
    await pickFilter(page, 'Filter contacts', /^Doctors/);
    await expect(page.getByText('dr. Andreas Wirawan, Sp.PD')).toBeVisible();
    await expect(page.getByText('Toko Roti Manis Kemang', { exact: true })).toHaveCount(0);
    await pickFilter(page, 'Filter contacts', /^All/);
    await page.getByRole('searchbox', { name: 'Search contacts' }).fill('roti');
    await expect(page.getByRole('link', { name: /^Call / })).toHaveCount(1);
    await page.getByRole('searchbox', { name: 'Search contacts' }).fill('');

    // public means: families see it, at once
    const fam = await context.newPage();
    await signIn(fam, 'f1', '/contacts');
    await expect(fam.getByText('Toko Roti Manis Kemang', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: /^Make public: Toko Roti Manis Kemang/ }).click();
    await toast(page, /is now visible to families/);
    await expect(fam.getByRole('link', { name: /^Call / })).toHaveCount(5); // 4 seeded public contacts + the one just published
    await page.getByRole('button', { name: 'Delete Toko Roti Manis Kemang' }).click();
    await page.getByRole('dialog', { name: 'Delete this contact?' }).getByRole('button', { name: 'Delete' }).click();
    await toast(page, 'Toko Roti Manis Kemang deleted.');
    await expect(page.getByText('Toko Roti Manis Kemang', { exact: true })).toHaveCount(0);
    await expect(fam.getByRole('link', { name: /^Call / })).toHaveCount(4);
    c.assertClean();
  });

  test('the lobby keeps the list too; the nurse has no directory', async ({ page }) => {
    await signIn(page, 's1', '/contacts');
    await expect(page.getByRole('heading', { name: 'Directory' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add a contact' })).toBeVisible();
    await signIn(page, 's8', '/directory');
    await expect(page).toHaveURL(/\/today$/);
  });

  test('family: Useful contacts shows public entries only, with the club’s emergency number and a way back', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 'f1', '/contacts');
    await expect(page.getByRole('heading', { name: 'Useful contacts' })).toBeVisible();
    await expect(page.getByText('dr. Andreas Wirawan, Sp.PD')).toBeVisible();
    await expect(page.getByText('RS Medika Kemang')).toBeVisible();
    await expect(page.getByText('Apotek Sehat Selalu')).toBeVisible();
    for (const hidden of ['Sayur Segar Kemang', 'Ikan Laut Jaya', 'Bersih Prima']) await expect(page.getByText(hidden)).toHaveCount(0);
    await expect(page.getByRole('link', { name: /^Call / })).toHaveCount(4);
    await expect(page.getByRole('link', { name: '+62 21 7590 1188' })).toHaveAttribute('href', 'tel:+622175901188');
    await expect(page.getByRole('button', { name: 'Add a contact' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Make internal|Make public/ })).toHaveCount(0);
    await assertNoHorizontalScroll(page);
    await page.locator('#main').getByRole('button', { name: 'Today', exact: true }).click();
    await expect(page).toHaveURL(/\/today$/);
    // Indonesian wording where the directory has it
    await signIn(page, 'f1', '/contacts', 'id');
    await expect(page.getByText(/Penyakit dalam · berkunjung tiap Selasa/)).toBeVisible();
    c.assertClean();
  });

  test('the server refuses directory changes from nurse, family and kitchen', async ({ page }) => {
    for (const uid of ['s8', 'f1', 's2']) {
      const r = await post(page, uid, 'directory.add', { kind: 'supplier', name: 'X', what: 'Y', phone: '0812345678', public: true });
      expect(r.status()).toBe(403);
    }
  });
});

test.describe('screens render everywhere', () => {
  const SCREENS: [string, string, string][] = [['s10', '/today', 'Billing'], ['s10', '/payments', 'Payments'], ['s10', '/budget', 'Budget'], ['s10', '/receipts', 'Receipts'], ['s10', '/directory', 'Directory'], ['s9', '/billing', 'Billing']];
  for (const [uid, path, title] of SCREENS) {
    test(`${uid} ${path}: no console errors, no horizontal scroll`, async ({ page }) => {
      const c = watchConsole(page);
      await signIn(page, uid, path);
      await expect(page.getByRole('heading', { name: title, exact: true }).first()).toBeVisible();
      await assertNoHorizontalScroll(page);
      c.assertClean();
    });
  }

  test('Indonesian: no raw keys on any finance screen or sheet', async ({ page }) => {
    const c = watchConsole(page);
    const RAW = /\b(finance|common|status|inv|nav|family|err|notif|feed|roles|review|shell)\.[a-zA-Z_]+/i;
    const text = () => page.evaluate(() => document.body.innerText);
    for (const path of ['/today', '/payments', '/budget', '/receipts', '/directory']) {
      await signIn(page, 's10', path, 'id');
      await expect(page.locator('#main')).toBeVisible();
      await page.waitForTimeout(250);
      expect(await text(), path).not.toMatch(RAW);
    }
    await signIn(page, 's10', '/today', 'id');
    await expect(page.getByText('Tagihan terbit tanggal 15 · jatuh tempo tanggal 27')).toBeVisible();
    await expect(page.getByText('Terlambat 23 hari')).toBeVisible();
    // overlays
    await page.getByRole('button', { name: 'Pratinjau dan terbitkan' }).click();
    const run = page.getByRole('dialog', { name: 'Penerbitan tagihan' });
    await expect(run).toBeVisible();
    await expect(run.getByText(/Ditagihkan ke/).first()).toBeVisible();
    expect(await text()).not.toMatch(RAW);
    await page.keyboard.press('Escape');
    await row(page, /Opa Budi Wijaya, INV-2610-046/).click();
    await page.getByRole('button', { name: 'Buka tagihan' }).click();
    const sheet = page.getByRole('dialog', { name: 'Tagihan INV-2610-046' });
    await expect(sheet.getByText('Paket Gold · Oktober')).toBeVisible();
    await sheet.getByRole('button', { name: 'Sesuaikan' }).click();
    expect(await text()).not.toMatch(RAW);
    c.assertClean();
  });
});
