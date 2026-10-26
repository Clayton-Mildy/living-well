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
  // undo it before the 1st: it asks first (the family is told at once), then the row is gone
  await row.getByRole('button', { name: /^Undo/ }).click();
  const ask = page.getByRole('dialog', { name: 'Undo this change?' });
  await expect(ask).toContainText('The change for Oma Lina in November is cancelled');
  await ask.getByRole('button', { name: 'Undo', exact: true }).click();
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
  await expect.poll(async () => (await snap('s2')).moodMarks['2026-10-21:m10:lunch']?.face).toBe(4); // the face is its own mutation
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
  await expect(fam.page.getByTestId('lunch-amount')).toContainText('Not logged yet');
  // Ega approves it in Approvals ▸ Daily logs, where it reads "Ate most"
  const ega = await newPage();
  const ec = watchConsole(ega.page);
  await signIn(ega.page, 's9', '/reviews?tab=logs');
  const item = ega.page.locator('[data-approval][data-type="logs"]').filter({ hasText: 'Bapak Bambang' });
  await expect(item.first()).toContainText('Ate most');
  await ega.page.request.post('/api/actions/approval.approve', { headers: { 'x-user-id': 's9' }, data: { mutationId: 'e2e-r14-lunch-approve', club: 'citra', input: { type: 'logs', ids: ['log-m10-2026-10-21'] } } });
  // now the family's Lunch card says how much he ate
  await fam.page.reload();
  await expect(fam.page.getByTestId('lunch-amount')).toContainText('Ate most');
  // not twice: the amount is on the Lunch card only (the daily log's "Lunch" is the lunch face's moment label)
  await expect(fam.page.getByTestId('lunch-amount')).toHaveCount(1);
  await expect(fam.page.getByTestId('daily-log').getByTestId('lunch-amount')).toHaveCount(0);
  await expect(fam.page.getByTestId('daily-log').getByText('Ate most')).toHaveCount(0);
  await expect(fam.page.getByTestId('daily-log').locator('[data-moment="lunch"]')).toHaveAttribute('data-face', '4');
  await assertNoHorizontalScroll(fam.page);
  fc.assertClean();
  ec.assertClean();
  await fam.ctx.close();
  await ega.ctx.close();
  c.assertClean();
});

test('Maria sees the daily mood on Today: Oma Lina checked in with a Good face shows the Mood row with the Check-in face', async ({ page, request }) => {
  const c = watchConsole(page);
  await signIn(page, 'f1', '/today?member=m1');
  await expect(page.getByTestId('story-hero')).toContainText('Oma Lina isn’t at the club');
  // Caca checks her in at the door and marks Good
  const r = await request.post('/api/actions/attendance.checkIn', { headers: { 'x-user-id': 's1' }, data: { mutationId: 'e2e-r14-mood-in', club: 'citra', input: { memberId: 'm1', method: 'manual', face: 4 } } });
  expect(r.ok()).toBe(true);
  const mood = page.getByTestId('daily-log').getByTestId('log-mood');
  await expect(mood).toHaveAttribute('data-mood', '4');
  await expect(mood).toContainText('Good');
  await expect(mood.locator('[data-moment="arrival"]')).toContainText('Check-in');
  await expect(page.getByTestId('hero-mood')).toContainText('Good');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('Birthdays: Dinar sees Opa Hendra’s birthday two weeks ahead on Today, taps Prepare, sends the pre-filled request, and the row shows Requested', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's5', '/today');
  // the small seed gives Opa Hendra a birthday on the first open day from 31 Oct (Mon 2 Nov), with no celebration yet; Opa Budi's party is confirmed already
  const list = page.getByTestId('birthdays-ahead');
  await expect(list.locator('[data-member="m2"]')).toContainText('turns 85 on Mon 2 Nov');
  await expect(list.getByTestId('celebration-status-m46')).toHaveText('Confirmed');
  await assertNoHorizontalScroll(page);
  await list.getByTestId('prepare-m2').getByRole('button').click();
  const d = page.getByRole('dialog').last();
  await expect(d.getByLabel('Title')).toHaveValue("Opa Hendra's birthday");
  await expect(d).toContainText('13:30');
  await expect(d).toContainText('15:00');
  await assertNoHorizontalScroll(page);
  await d.getByRole('button', { name: 'Send request' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(list.getByTestId('celebration-status-m2')).toHaveText('Requested');
  await expect(list.getByTestId('prepare-m2')).toHaveCount(0);
  c.assertClean();
});

test('Every programme goes to Ega: Dinar changes Friday 13:30 in the builder and sends it; Ega approves it under Approvals → Programme; the schedule shows it', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's5', '/calendar');
  await page.getByRole('heading', { name: 'Weekly schedule' }).scrollIntoViewIfNeeded();
  await page.getByRole('tab', { name: /^Fri/ }).click();
  await page.getByRole('button', { name: 'Friday 13:30: Cooking demo with Chef Agus' }).click();
  await pickOption(page, 'Activity', 'Reading circle');
  await expect(page.getByText('1 change not yet published')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Activities and rooms' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Send to Ega' }).click();
  const sheet = page.getByRole('dialog', { name: 'Send the weekly schedule to Ega' });
  await sheet.getByRole('button', { name: 'Send to Ega' }).click();
  await expect(page.getByRole('status')).toContainText('Sent to Ega');
  await expect(page.getByTestId('programme-waiting')).toContainText('Waiting for Ega');
  await assertNoHorizontalScroll(page);
  c.assertClean();
  // Ega approves it in the Programme tab: the row shows the week and the changed session
  await signIn(page, 's9', '/reviews?tab=programme');
  await expect(page.getByRole('tab', { name: /^Programme/ })).toHaveAttribute('aria-selected', 'true');
  const row = page.locator('[data-approval][data-type="programme"]').filter({ hasText: 'From Wed 21 Oct' });
  await expect(row).toHaveCount(1);
  await row.getByRole('button', { name: 'View' }).click();
  await expect(row).toContainText('Reading circle');
  await assertNoHorizontalScroll(page);
  await row.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(row).toHaveCount(0);
  // the schedule now runs the reading circle on Fridays
  await signIn(page, 's9', '/calendar');
  await page.getByRole('heading', { name: 'Weekly schedule' }).scrollIntoViewIfNeeded();
  await page.getByRole('tab', { name: /^Fri/ }).click();
  await expect(page.getByRole('button', { name: 'Friday 13:30: Reading circle' })).toBeVisible();
  await expect(page.getByTestId('programme-waiting')).toHaveCount(0);
  c.assertClean();
});

test('Weekends: the seeded Saturday (7 Nov) is an open day with two sessions on the calendar, and Arrivals opens on it', async ({ page, request }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/calendar');
  await page.getByRole('tab', { name: 'Calendar' }).click();
  await page.getByRole('button', { name: 'Next month' }).click();
  await page.locator('button[data-date="2026-11-07"]').click();
  const day = page.locator('div[data-date="2026-11-07"]');
  await expect(day).toContainText('Open · 08:30–16:30');
  await expect(day).toContainText('Angklung ensemble');
  await expect(day).toContainText('Karaoke');
  await assertNoHorizontalScroll(page);
  c.assertClean();
  // on that date the front desk's board is open, not "Club closed"
  const r = await request.post('/api/demo/clock', { data: { hm: '09:30', allowBack: true, date: '2026-11-07' } });
  expect(r.ok()).toBeTruthy();
  await signIn(page, 's1', '/today');
  await expect(page.getByRole('heading', { name: 'Arrivals', level: 1 })).toBeVisible();
  await expect(page.getByText('Saturday 7 November', { exact: true })).toBeVisible();
  await expect(page.getByText('Club open until 16:30')).toBeVisible();
  await expect(page.locator('#main')).not.toContainText('Club closed');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('Year view: Dinar sees January to December and the outlined open Saturday, a tap opens that day in the month; Maria sees the Year view too', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/calendar');
  await page.getByRole('tab', { name: 'Year' }).click();
  await expect(page.getByTestId('year-label')).toHaveText('2026');
  for (const m of ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']) await expect(page.getByTestId('year-month').filter({ hasText: m })).toBeVisible();
  await expect(page.locator('button[data-date="2026-11-07"]')).toHaveAttribute('data-state', 'weekendOpen');
  await expect(page.locator('button[data-date="2026-11-14"]')).toHaveAttribute('data-state', 'closed');
  await assertNoHorizontalScroll(page);
  // a day opens in the Month view with that day selected
  await page.locator('button[data-date="2026-11-07"]').click();
  await expect(page.locator('div[data-date="2026-11-07"]')).toContainText('Angklung ensemble');
  // the month header opens that month
  await page.getByRole('tab', { name: 'Year' }).click();
  await page.getByTestId('year-month').filter({ hasText: 'March' }).click();
  await expect(page.getByRole('heading', { name: 'March 2026' })).toBeVisible();
  c.assertClean();
  // the family calendar has the Year view as well
  await signIn(page, 'f1', '/calendar');
  await page.getByTestId('cal-view').getByRole('tab', { name: 'Year' }).click();
  await expect(page.getByTestId('year-view')).toBeVisible();
  await expect(page.getByTestId('year-month')).toHaveCount(12);
  await expect(page.locator('button[data-date="2026-11-07"]')).toHaveAttribute('data-state', 'weekendOpen');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});
