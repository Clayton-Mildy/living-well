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

test('Nanny note: Caca opens Edit details on Oma Lina and sees the carer\'s note field with the seeded note; Overview shows it', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's1', '/members/m1');
  await expect(page.getByTestId('nanny-row')).toContainText('Mbak Sari');
  await expect(page.getByTestId('nanny-row')).toContainText('Agency: Kasih Ibu, Mon–Wed');
  await assertNoHorizontalScroll(page);
  await page.getByRole('button', { name: 'Edit details' }).click();
  const dlg = page.getByRole('dialog').last();
  await expect(dlg.getByLabel('Note (agency, days)')).toHaveValue('Agency: Kasih Ibu, Mon–Wed');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('Today\'s numbers: Ega sees the Today block in Insights, and In the club on Members shows the Flex / Gold split', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/insights');
  await expect(page.getByTestId('insights-today')).toContainText('In the club');
  await expect(page.locator('#main').getByText('Today', { exact: true })).toBeVisible();
  await assertNoHorizontalScroll(page);
  await page.goto('/members');
  await pickOption(page, 'Filter members', /^In the club/);
  await expect(page.getByTestId('members-split')).toContainText('Flex ·');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('Mood at six moments: Caca checks Oma Lina in and Opa Hendra out without a face; Dinar marks Lina Good in the Morning round and sees its meaning', async ({ page, browser }) => {
  const c = watchConsole(page);
  await signIn(page, 's1');
  // check-in by name: the faces show, Confirm works without one
  await page.getByRole('button', { name: /^Check in: Oma Lina/ }).click();
  const confirm = page.getByRole('button', { name: 'Confirm check-in' });
  await expect(page.getByRole('radio')).toHaveCount(5);
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(page.getByText(/Oma Lina checked in at \d\d:\d\d\./).first()).toBeVisible();
  // check-out with no face succeeds
  await page.getByRole('tab', { name: /^Check out/ }).click();
  await page.getByRole('button', { name: /^Check out: Opa Hendra/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Check out · Opa Hendra' });
  await expect(dialog.getByRole('radio')).toHaveCount(5);
  await dialog.getByTestId('co-confirm').click();
  await expect(page.getByText(/Opa Hendra checked out at \d\d:\d\d/).first()).toBeVisible();
  await expect(dialog).toHaveCount(0);
  await assertNoHorizontalScroll(page);
  // the activity team's Morning round: a face per person, with the face's meaning under the row
  const o = test.info().project.use as Record<string, unknown>;
  const ctx = await browser.newContext({ baseURL: o.baseURL as string, viewport: o.viewport as { width: number; height: number }, hasTouch: o.hasTouch as boolean | undefined, isMobile: o.isMobile as boolean | undefined, deviceScaleFactor: o.deviceScaleFactor as number | undefined, userAgent: o.userAgent as string | undefined });
  const t = await ctx.newPage();
  const tc = watchConsole(t);
  await signIn(t, 's5', '/log?round=morning');
  await expect(t.getByRole('tab', { name: /^Morning/ })).toHaveAttribute('aria-selected', 'true');
  const lina = t.getByTestId('log-row').filter({ hasText: 'Oma Lina' });
  await lina.getByRole('radio', { name: 'Good' }).click();
  await expect(lina.getByRole('radio', { name: 'Good' })).toHaveAttribute('aria-checked', 'true');
  await expect(lina.getByTestId('mood-hint')).toHaveText('Engaged and content');
  await expect(t.getByRole('button', { name: 'Cheerful', exact: true })).toHaveCount(0); // the old mood word is gone
  await assertNoHorizontalScroll(t);
  tc.assertClean();
  await ctx.close();
  c.assertClean();
});

test('Lunch round: Yohanes marks Bapak Bambang "Most" with a "Good" face on /lunch; Ega sees it in Approvals; his family sees the Lunch card with the dishes', async ({ page, request, browser }) => {
  const c = watchConsole(page);
  // the round opens at 11:30 (the demo clock starts at 09:58)
  await request.post('/api/demo/clock', { data: { hm: '10:45', allowBack: true } });
  await signIn(page, 's2', '/lunch');
  await expect(page.getByRole('heading', { level: 1, name: 'Lunch round' })).toBeVisible();
  await expect(page.getByText('Opens at 11:30')).toBeVisible();
  await expect(page.getByTestId('lunch-row')).toHaveCount(0);
  await request.post('/api/demo/clock', { data: { hm: '12:10', allowBack: true } });
  await signIn(page, 's2', '/lunch');
  const snap = async (uid: string) => (await (await page.request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': uid } })).json()).state;
  await expect(page.getByTestId('lunch-row')).toHaveCount(3); // the three who checked in
  const bambang = page.getByTestId('lunch-row').filter({ hasText: 'Bapak Bambang' });
  await expect(bambang.getByRole('button')).toHaveText(['All', 'Most', 'Half', 'Little', 'None']);
  await bambang.getByRole('button', { name: 'Most', exact: true }).click();
  await expect(bambang.getByRole('button', { name: 'Most', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await bambang.getByRole('radio', { name: 'Good' }).click();
  await expect(bambang.getByRole('radio', { name: 'Good' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('round-progress')).toHaveText('1 of 3 marked');
  await assertNoHorizontalScroll(page);
  await expect.poll(async () => (await snap('s2')).dailyLogs['log-m10-2026-10-21']?.lunch).toBe('most');
  expect((await snap('s2')).moodMarks['2026-10-21:m10:lunch']).toMatchObject({ moment: 'lunch', face: 4 });
  // the amount waits for management: the family sees nothing yet
  expect((await snap('s2')).dailyLogs['log-m10-2026-10-21'].approval).toMatchObject({ status: 'pending', by: 'staff:s2' });
  const o = test.info().project.use as Record<string, unknown>;
  const newPage = async () => {
    const ctx = await browser.newContext({ baseURL: o.baseURL as string, viewport: o.viewport as { width: number; height: number }, hasTouch: o.hasTouch as boolean | undefined, isMobile: o.isMobile as boolean | undefined, deviceScaleFactor: o.deviceScaleFactor as number | undefined, userAgent: o.userAgent as string | undefined });
    return { ctx, page: await ctx.newPage() };
  };
  const fam = await newPage();
  const fc = watchConsole(fam.page);
  await signIn(fam.page, 'fm10_0', '/today');
  await expect(fam.page.getByTestId('lunch-card')).toBeVisible();
  await expect(fam.page.getByTestId('lunch-card-dishes')).toContainText('Sop ikan kakap');
  await expect(fam.page.getByTestId('lunch-card-amount')).toContainText('Not logged yet');
  // Ega approves it in Approvals ▸ Daily logs, where it reads "Ate most"
  const ega = await newPage();
  const ec = watchConsole(ega.page);
  await signIn(ega.page, 's9', '/reviews?tab=logs');
  const item = ega.page.locator('[data-approval][data-type="logs"]').filter({ hasText: 'Bapak Bambang' });
  await expect(item.first()).toContainText('Ate most');
  await ega.page.request.post('/api/actions/approval.approve', { headers: { 'x-user-id': 's9' }, data: { mutationId: 'e2e-r14-lunch-approve', club: 'citra', input: { type: 'logs', ids: ['log-m10-2026-10-21'] } } });
  // now the family's Lunch card says how much he ate
  await fam.page.reload();
  await expect(fam.page.getByTestId('lunch-card-amount')).toContainText('Ate most');
  await expect(fam.page.getByTestId('daily-log').getByText('Lunch', { exact: true })).toHaveCount(0); // not twice: the daily log has no Lunch row any more
  await assertNoHorizontalScroll(fam.page);
  fc.assertClean();
  ec.assertClean();
  await fam.ctx.close();
  await ega.ctx.close();
  c.assertClean();
});
