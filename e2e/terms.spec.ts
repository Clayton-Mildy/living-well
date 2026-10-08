// The brochure's terms (KC round 6): the real prices and fees (Plans), leave (cuti) asked in the family app, an unpaid invoice that puts the membership on hold on
// the 1st and stops it on the 3rd, the registration fee on a first invoice (and again after a stop), and the 2-day trial with its price.
// The demo clock moves to other days with POST /api/demo/clock { date } (the club's daily job then runs at once).
import { test, expect as baseExpect, type APIRequestContext, type Page } from '@playwright/test';
import { resetDemo, signIn, watchConsole, assertNoHorizontalScroll, isPhone } from './helpers';
import { pickOption } from './kit';

const expect = baseExpect.configure({ timeout: 15_000 });
test.beforeEach(async ({ request }) => { test.setTimeout(90_000); await resetDemo(request); });

let seq = 0;
const api = (request: APIRequestContext, user: string, name: string, input: unknown) =>
  request.post(`/api/actions/${name}`, { headers: { 'x-user-id': user }, data: { mutationId: `terms-${Date.now().toString(36)}-${++seq}`, club: 'citra', input } });
const ok = async (request: APIRequestContext, user: string, name: string, input: unknown) => { const r = await api(request, user, name, input); expect(r.ok(), `${name}: ${await r.text()}`).toBeTruthy(); return (await r.json()) as { result: Record<string, unknown> }; };
const state = async (request: APIRequestContext, user = 's9') => (await (await request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': user } })).json()).state;
/** Move the club's clock to another day (the daily job runs before this returns). */
async function setDay(request: APIRequestContext, date: string, hm = '10:00') {
  const r = await request.post('/api/demo/clock', { data: { hm, date, allowBack: true } });
  expect(r.ok()).toBeTruthy();
}
const toast = (page: Page, text: string | RegExp) => expect(page.getByRole('status').filter({ hasText: text }).first()).toBeVisible();
const famTab = (page: Page, name: string) => page.getByRole('tablist', { name: 'Choose a member' }).getByRole('tab', { name, exact: true });
const planCard = (page: Page) => page.getByTestId('plan-card');
/** A phone shows one stage of the enquiries board at a time. */
const showStage = async (page: Page, stage: RegExp) => { if (isPhone(page)) await pickOption(page, 'Stage', stage); };
/** The Updates tab of the notification panel. */
async function updatesOf(page: Page) {
  await page.getByRole('button', { name: /Notifications/ }).first().click();
  const panel = page.getByRole('dialog', { name: 'Notifications' });
  await panel.getByRole('tab', { name: /Updates/ }).click();
  return panel;
}
/** Everyone the families of Lina and Budi owe nothing to: pay October for them (finance, cash). */
async function payOctober(request: APIRequestContext, ids: [string, string][] = [['m1', 'INV-2610-001'], ['m46', 'INV-2610-046']]) {
  for (const [memberId, invoiceId] of ids) await ok(request, 's10', 'payment.record', { memberId, amount: memberId === 'm1' ? 2_700_000 : 3_950_000, method: 'cash', invoiceId });
}

test.describe('prices and fees (Plans)', () => {
  test('the brochure’s prices are real; the registration fee, the 2-day trial and a month of leave are edited beside them; only the extra day is still a sample', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's9', '/plans');
    await expect(page.getByLabel('Flex price in rupiah')).toHaveValue('2.700.000');
    await expect(page.getByLabel('Gold price in rupiah')).toHaveValue('3.950.000');
    await expect(page.getByLabel('Extra day price in rupiah')).toHaveValue('650.000');
    await expect(page.getByLabel('Registration price in rupiah')).toHaveValue('2.500.000');
    await expect(page.getByLabel('Trial price in rupiah')).toHaveValue('450.000');
    await expect(page.getByLabel('Leave (cuti) price in rupiah')).toHaveValue('250.000');
    await expect(page.getByText('Sample price')).toHaveCount(1); // the extra-day price is not in the brochure
    await expect(page.getByText('One time')).toBeVisible();
    await expect(page.getByText('For 2 days in a row')).toBeVisible();
    await assertNoHorizontalScroll(page);
    // edit the leave fee: Save, and it stays
    await page.getByLabel('Leave (cuti) price in rupiah').fill('300000');
    await expect(page.getByLabel('Leave (cuti) price in rupiah')).toHaveValue('300.000');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await toast(page, 'Saved');
    await page.reload();
    await expect(page.getByLabel('Leave (cuti) price in rupiah')).toHaveValue('300.000');
    await expect(page.getByLabel('Trial price in rupiah')).toHaveValue('450.000'); // the others carried over
    // validation: a fee is a positive number
    await page.getByLabel('Registration price in rupiah').fill('0');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('alert').first()).toBeVisible();
    c.assertClean();
  });
});

test.describe('leave (cuti)', () => {
  test('Maria asks for leave beside "Ask to switch plan": November is too late, December is fine; she can take it back until its deadline', async ({ page, request }) => {
    const c = watchConsole(page);
    await signIn(page, 'f1', '/billing');
    await famTab(page, 'Oma Lina').click();
    const p = planCard(page);
    await expect(p.getByRole('button', { name: 'Ask to switch to Gold' })).toBeVisible();
    await expect(p.getByRole('button', { name: 'Ask for leave' })).toBeVisible(); // beside it
    await p.getByRole('button', { name: 'Ask for leave' }).click();
    const sheet = page.getByRole('dialog', { name: 'Leave for Oma Lina' });
    await expect(sheet).toContainText('Rp 250.000');
    await expect(sheet).toContainText('14 days before the end of the month before');
    // the deadline for November was 17 October: it is not offered; December is, with its deadline
    await expect(sheet.getByRole('button', { name: /^November/ })).toHaveCount(0);
    await expect(sheet.getByRole('button', { name: 'December · ask by Mon 16 Nov' })).toBeVisible();
    await sheet.getByRole('button', { name: 'December · ask by Mon 16 Nov' }).click();
    await sheet.getByRole('button', { name: 'Ask for leave · December' }).click();
    await toast(page, 'Leave for December asked.');
    await expect(sheet).toHaveCount(0);
    const row = p.getByTestId('leave-row');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Leave in December · asked, you can take it back until Mon 16 Nov');
    // management and finance were told
    const snap = await state(request, 's9');
    expect(Object.values<{ kind: string; params: { month: string } }>(snap.notifications).some((n) => n.kind === 'family.notif.leaveAsked' && n.params.month === '2026-12')).toBe(true);
    // a late request is refused by the server with the deadline in the message
    const late = await api(request, 'f1', 'membership.requestLeave', { memberId: 'm1', month: '2026-11' });
    expect(late.status()).toBe(422);
    expect((await late.json()).code).toBe('err.leaveLate');
    // she takes it back; the row goes and the button stays
    await row.getByRole('button', { name: 'Take back' }).click();
    await toast(page, 'Leave for December taken back.');
    await expect(row).toHaveCount(0);
    await expect(p.getByRole('button', { name: 'Ask for leave' })).toBeVisible();
    // Daniel is not the billing contact: he sees no leave button
    await signIn(page, 'f2', '/billing');
    await famTab(page, 'Oma Lina').click();
    await expect(planCard(page).getByRole('button', { name: 'Ask for leave' })).toHaveCount(0);
    await assertNoHorizontalScroll(page);
    c.assertClean();
  });

  test('a leave month costs the leave fee on that month’s invoice instead of the plan, and nobody checks in during it', async ({ page, request }) => {
    const c = watchConsole(page);
    await ok(request, 'f1', 'membership.requestLeave', { memberId: 'm1', month: '2026-12' });
    await payOctober(request);
    // 21 Dec: December's invoices go out (the daily job); Oma Lina is on leave, Opa Budi is not
    await setDay(request, '2026-12-21');
    const snap = await state(request, 's9');
    const inv = Object.values<{ memberId: string; period: string; lines: { label: string; amount: number }[] }>(snap.invoices).filter((i) => i.period === '2026-12');
    expect(inv.find((i) => i.memberId === 'm1')!.lines.map((l) => [l.label, l.amount])).toEqual([['inv.line.leave', 250000]]);
    expect(inv.find((i) => i.memberId === 'm46')!.lines.map((l) => [l.label, l.amount])).toEqual([['inv.line.gold', 3950000]]);
    // Maria sees it on her Billing: the leave line, the status
    await signIn(page, 'f1', '/billing');
    await famTab(page, 'Oma Lina').click();
    await expect(planCard(page).getByTestId('leave-row')).toContainText('On leave in December');
    const invoice = page.getByTestId('open-invoice').filter({ hasText: 'Oma Lina' });
    await expect(invoice).toContainText('Rp 250.000');
    await invoice.getByRole('button', { name: 'Details' }).click();
    await expect(page.getByRole('dialog', { name: 'December 2026 invoice' })).toContainText(/Leave \(cuti\) · December/);
    await page.keyboard.press('Escape');
    // the lobby: her row says so, and the check-in is refused with a clear message (the server too)
    await signIn(page, 's1', '/today');
    await expect(page.getByRole('button', { name: /^Oma Lina Wijaya\b/ })).toContainText('On leave · Dec');
    await page.getByRole('button', { name: /^Check in: Oma Lina Wijaya/ }).click();
    await page.getByRole('button', { name: 'Confirm check-in' }).click();
    await toast(page, /Oma Lina is on leave in December 2026/);
    const r = await api(request, 's1', 'attendance.checkIn', { memberId: 'm1', method: 'manual' });
    expect(r.status()).toBe(422);
    expect((await r.json()).code).toBe('err.onLeave');
    // the profile reads "On leave · Dec" too, and Budi can still check in
    await signIn(page, 's9', '/members/m1/plan');
    await expect(page.locator('#main')).toContainText('On leave · Dec');
    expect((await api(request, 's1', 'attendance.checkIn', { memberId: 'm46', method: 'manual' })).ok()).toBeTruthy();
    c.assertClean();
  });

  test('finance records leave on the Plan tab; after 2 months with no word the membership ends (leave ran out), a return noted before keeps it', async ({ page, request }) => {
    const c = watchConsole(page);
    await signIn(page, 's10', '/members/m10/plan');
    await expect(page.getByTestId('plan-leave').getByRole('button', { name: 'Record leave' })).toBeVisible();
    await page.getByRole('button', { name: 'Record leave' }).click();
    const sheet = page.getByRole('dialog', { name: 'Record leave for Bapak Bambang' });
    await sheet.getByLabel('Note (optional)').fill('Laras wrote on 10 Oct');
    await sheet.getByRole('button', { name: 'Record leave · December' }).click();
    await toast(page, 'Leave for December recorded.');
    await expect(page.getByTestId('leave-row')).toContainText('Leave in December');
    await ok(request, 's10', 'membership.requestLeave', { memberId: 'm10', month: '2027-01' });
    await expect(page.getByTestId('leave-word')).toContainText('Bapak Bambang is on leave for 2 months in a row. Tell us by Sun 31 Jan that Bapak Bambang is coming back in February'); // the club waits to hear about February
    // a third month in a row is refused
    const third = await api(request, 's10', 'membership.requestLeave', { memberId: 'm10', month: '2027-02' });
    expect((await third.json()).code).toBe('err.leaveMax');
    // Bambang's family says nothing; Hendra's (m2) is noted as coming back
    await ok(request, 'fm2_0', 'membership.requestLeave', { memberId: 'm2', month: '2026-12' });
    await ok(request, 'fm2_0', 'membership.requestLeave', { memberId: 'm2', month: '2027-01' });
    await ok(request, 'fm2_0', 'membership.confirmReturn', { memberId: 'm2' });
    // everybody has paid
    for (const [memberId, invoiceId, amount] of [['m1', 'INV-2610-001', 2_700_000], ['m46', 'INV-2610-046', 3_950_000], ['m20', 'INV-2610-020', 3_950_000], ['m20', 'INV-2609-020', 3_950_000]] as const) await ok(request, 's10', 'payment.record', { memberId, amount, method: 'cash', invoiceId });
    await setDay(request, '2027-02-01');
    const snap = await state(request, 's9');
    expect(snap.members.m10.memberships.at(-1)).toMatchObject({ lastDay: '2027-01-31', endReason: 'leaveOverrun' });
    expect(snap.members.m2.memberships.at(-1).endReason).toBeUndefined();
    await signIn(page, 's9', '/members/m10/plan');
    await expect(page.locator('#main')).toContainText('Leave ran out');
    c.assertClean();
  });
});

test.describe('an unpaid invoice: on hold on the 1st, stopped on the 3rd', () => {
  test('on 2 November Oma Lina, Opa Budi and Opa Tjahjadi are on hold: Members, the profile, Arrivals and finance Billing say so; the check-in is refused until it is paid', async ({ page, request }) => {
    const c = watchConsole(page);
    await setDay(request, '2026-11-02');
    // Arrivals: the row says "Suspended · unpaid"
    await signIn(page, 's1', '/today');
    await expect(page.getByRole('button', { name: /^Oma Lina Wijaya\b/ })).toContainText('Suspended · unpaid');
    await page.getByRole('button', { name: /^Check in: Oma Lina Wijaya/ }).click();
    await page.getByRole('button', { name: 'Confirm check-in' }).click();
    await toast(page, /Membership on hold: invoice INV-2610-001 \(Rp 2\.700\.000\) is still unpaid/);
    // Members list and the profile
    await signIn(page, 's9', '/members');
    await expect(page.locator('[data-member="m1"]')).toContainText('Suspended · unpaid');
    await expect(page.locator('[data-member="m2"]')).not.toContainText('Suspended');
    await signIn(page, 's9', '/members/m1/plan');
    await expect(page.locator('#main')).toContainText('Suspended · unpaid');
    await expect(page.getByTestId('plan-hold')).toContainText('invoice INV-2610-001 (Rp 2.700.000) is unpaid');
    await expect(page.getByTestId('plan-hold')).toContainText('it is still unpaid on Tue 3 Nov, the membership stops');
    // finance Billing lists who is on hold
    await signIn(page, 's10', '/billing');
    const hold = page.getByTestId('billing-hold');
    await expect(hold).toContainText('On hold · unpaid');
    for (const n of ['Oma Lina Wijaya', 'Opa Budi Wijaya', 'Opa Tjahjadi Lim']) await expect(hold.getByRole('button', { name: new RegExp(`^${n}`) })).toBeVisible();
    await expect(hold.getByRole('button', { name: /^Oma Lina Wijaya/ })).toContainText('INV-2610-001 · Rp 2.700.000 · stops Tue 3 Nov');
    await expect(hold.getByRole('button', { name: /^Opa Tjahjadi Lim/ })).toContainText('on hold until paid'); // the family told finance: held, not stopped
    await assertNoHorizontalScroll(page);
    // the family sees it on the plan card
    await signIn(page, 'f1', '/billing');
    await famTab(page, 'Oma Lina').click();
    await expect(planCard(page).getByTestId('plan-hold')).toContainText('Membership on hold: invoice INV-2610-001 (Rp 2.700.000) is unpaid');
    // management and the billing contact were told (once) by the daily job
    await expect((await updatesOf(page)).getByText(/Membership on hold: invoice INV-2610-001 \(Rp 2\.700\.000\) for Oma Lina is unpaid/)).toBeVisible();
    // paying lifts the hold at once, and she can check in
    await ok(request, 's10', 'payment.record', { memberId: 'm1', amount: 2_700_000, method: 'cash', invoiceId: 'INV-2610-001' });
    await signIn(page, 's1', '/today');
    await expect(page.getByRole('button', { name: /^Oma Lina Wijaya\b/ })).not.toContainText('Suspended');
    expect((await api(request, 's1', 'attendance.checkIn', { memberId: 'm1', method: 'manual' })).ok()).toBeTruthy();
    c.assertClean();
  });

  test('still unpaid on 3 November with no word from the family: the membership stops (Lina and Budi), Tjahjadi’s family told finance so he stays on hold; coming back pays the registration fee again', async ({ page, request }) => {
    const c = watchConsole(page);
    await setDay(request, '2026-11-03');
    const snap = await state(request, 's9');
    for (const id of ['m1', 'm46']) expect(snap.members[id].memberships.at(-1)).toMatchObject({ lastDay: '2026-10-31', endReason: 'unpaid', endedBy: 'system' });
    expect(snap.members.m20.memberships.at(-1).endReason).toBeUndefined();
    expect(snap.members.m2.memberships.at(-1).endReason).toBeUndefined(); // paid
    // management sees them as ended, with the reason; the lobby cannot check them in
    await signIn(page, 's9', '/members/m1/plan');
    await expect(page.locator('#main')).toContainText('Stopped: invoice unpaid');
    await signIn(page, 's9', '/today'); // the bell is on the main screens (a phone profile is a pushed screen without it)
    await expect((await updatesOf(page)).getByText(/Oma Lina’s membership stopped: invoice INV-2610-001/)).toBeVisible();
    await page.keyboard.press('Escape');
    expect((await api(request, 's1', 'attendance.checkIn', { memberId: 'm1', method: 'manual' })).status()).toBe(422);
    // Maria is told
    await signIn(page, 'f1', '/billing');
    await expect((await updatesOf(page)).getByText(/Oma Lina’s membership has stopped: invoice INV-2610-001/)).toBeVisible();
    await page.keyboard.press('Escape');
    // management registers Oma Lina again: the first invoice of the new membership carries the registration fee once more
    await ok(request, 's9', 'members.reactivate', { memberId: 'm1', start: '2026-11-09' });
    await setDay(request, '2026-11-23');
    const later = await state(request, 's9');
    const inv = Object.values<{ memberId: string; period: string; lines: { label: string; amount: number }[] }>(later.invoices).find((i) => i.memberId === 'm1' && i.period === '2026-11')!;
    expect(inv.lines.map((l) => l.label)).toEqual(['inv.line.flex', 'inv.line.registration']); // the part month is prorated, the fee is not
    expect(inv.lines[1].amount).toBe(2500000);
    await signIn(page, 's10', '/billing');
    await page.getByRole('button', { name: /^Oma Lina Wijaya, INV-2611-001/ }).click();
    await page.getByRole('button', { name: 'Open invoice' }).click();
    const sheet = page.getByRole('dialog', { name: 'Invoice INV-2611-001' });
    await expect(sheet).toContainText('Registration fee');
    await expect(sheet).toContainText('Rp 2.500.000');
    c.assertClean();
  });
});

test.describe('the registration fee and the trial', () => {
  test('a new member’s first invoice carries the one-time registration fee, and the join dialog says so', async ({ page, request }) => {
    const c = watchConsole(page);
    await signIn(page, 's9', '/enquiries');
    await showStage(page, /^Trial booked ·/);
    await page.locator('[data-lead="e1"]').getByRole('button', { name: 'Join', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Oma Siu Lan Tjandra' }).getByTestId('join-reg-fee')).toContainText('The registration fee (Rp 2.500.000, one time) is on the first invoice.');
    await page.keyboard.press('Escape');
    // she joins on Monday 26 October (the paper form is attached through the API); November's invoice is her first
    const join = await ok(request, 's9', 'enquiry.convert', { enquiryId: 'e1', plan: 'gold', start: '2026-10-26', formMediaId: 'md_testregistrationform01', formFileName: 'form.jpg' });
    const memberId = join.result.memberId as string;
    await setDay(request, '2026-11-21');
    const snap = await state(request, 's9');
    const inv = Object.values<{ id: string; memberId: string; period: string; lines: { label: string; amount: number }[] }>(snap.invoices).find((i) => i.memberId === memberId && i.period === '2026-11')!;
    expect(inv.lines.map((l) => [l.label, l.amount])).toEqual([['inv.line.gold', 3950000], ['inv.line.registration', 2500000]]);
    await signIn(page, 's10', '/billing');
    await page.getByRole('button', { name: new RegExp(inv.id) }).click();
    await page.getByRole('button', { name: 'Open invoice' }).click();
    const sheet = page.getByRole('dialog', { name: `Invoice ${inv.id}` });
    await expect(sheet).toContainText('Registration fee');
    await expect(sheet).toContainText('Rp 2.500.000');
    await expect(sheet).toContainText('Rp 6.450.000');
    // the next invoice (December) does not carry it again (the family paid November: an unpaid invoice would have stopped the membership on 3 Dec)
    await ok(request, 's10', 'payment.record', { memberId, amount: 6_450_000, method: 'cash', invoiceId: inv.id });
    await setDay(request, '2026-12-21');
    const dec = Object.values<{ memberId: string; period: string; lines: { label: string }[] }>((await state(request, 's9')).invoices).find((i) => i.memberId === memberId && i.period === '2026-12')!;
    expect(dec.lines.map((l) => l.label)).toEqual(['inv.line.gold']);
    c.assertClean();
  });

  test('booking a trial books 2 days in a row and shows its price, Rp 450.000', async ({ page, request }) => {
    const c = watchConsole(page);
    await signIn(page, 's1', '/enquiries');
    await showStage(page, /^Visit ·/);
    const card = page.locator('[data-lead="e5"]');
    await card.getByRole('button', { name: 'Book trial' }).click();
    const d = page.getByRole('dialog');
    await expect(d).toContainText('A trial is 2 days in a row for Rp 450.000');
    await d.getByRole('radio', { name: /^Thu 22 Oct/ }).click();
    await expect(d.getByTestId('trial-days')).toContainText('Thu 22 Oct and Fri 23 Oct · Rp 450.000');
    await d.getByRole('button', { name: 'Book trial · Thu 22 Oct and Fri 23 Oct · Rp 450.000' }).click();
    await toast(page, /Trial booked for Opa Leo Gunadi: Thu 22 Oct and Fri 23 Oct \(Rp 450\.000\)/);
    const snap = await state(request, 's9');
    const guests = Object.values<{ enquiryId: string; kind: string; date: string; status: string }>(snap.guestVisits).filter((g) => g.enquiryId === 'e5' && g.kind === 'trial');
    expect(guests.map((g) => g.date).sort()).toEqual(['2026-10-22', '2026-10-23']);
    // a start day whose second day is the outing (Thu 29 Oct) is not offered, and the server refuses it
    const refused = await api(request, 's1', 'enquiry.bookTrial', { enquiryId: 'e5', date: '2026-10-28', food: [], drugs: [], mobility: null, diet: [] });
    expect(refused.status()).toBe(422);
    expect((await refused.json()).code).toBe('enq.err.outing');
    await assertNoHorizontalScroll(page);
    c.assertClean();
  });
});
