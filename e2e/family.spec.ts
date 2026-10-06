// Family app for a drop-in day club: Today (Both mode and per member: at the club since, went home, or simply not at the club), the plan card
// (Flex visits counted from check-ins, extra visits billed next month, Gold come any open day), the lobby checking a member in and out,
// billing (open invoices, pay one or all), photos, health member switcher, survey, lunch feedback, log comments, Indonesian.
// Nothing is "expected": there are no bookings, leave, "not coming" or "running late", and no "brought by" or "collected by".
// Run in the isolated env:  pnpm e2e:env family 8801 5201  ·  E2E_BASE_URL=http://localhost:5201 pnpm exec playwright test e2e/family.spec.ts
import { test, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { resetDemo, signIn, watchConsole, isPhone, assertNoHorizontalScroll } from './helpers';
import { lobbyGroups } from '../packages/shared/src/rules/attendance';
import { translate } from '../packages/shared/src/i18n';

const TODAY = '2026-10-21';
const src = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
/** True while another area's contract component is still a placeholder (its tests wait for the real one). */
const isStub = (rel: string) => /CONTRACT STUB|BuildStub/.test(src(rel));
const hasAction = (name: string) => fs.readdirSync(path.join(process.cwd(), 'packages/shared/src/actions')).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')).some((f) => src(`packages/shared/src/actions/${f}`).includes(`name: '${name}'`));

let seq = 0;
async function api(request: APIRequestContext, user: string, name: string, input: unknown) {
  return request.post(`/api/actions/${name}`, { headers: { 'x-user-id': user }, data: { mutationId: `e2e-${Date.now().toString(36)}-${++seq}`, club: 'citra', input } });
}
async function snapshot(request: APIRequestContext, user: string) {
  const r = await request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': user } });
  return (await r.json()).state;
}
/** The lobby's board as the server sees it. */
async function board(request: APIRequestContext) {
  return lobbyGroups(await snapshot(request, 's1'), TODAY);
}
const ids = (rows: { m: { id: string } }[]) => rows.map((x) => x.m.id).sort();
type Notice = { kind: string; toUsers: string[]; params: Record<string, string>; deletedAt?: string };
const noticesFor = (state: { notifications: Record<string, Notice> }, user: string, kind: string) => Object.values(state.notifications).filter((n) => !n.deletedAt && n.kind === kind && n.toUsers.includes(user));

const sheet = (page: Page, name: string | RegExp) => page.getByRole('dialog', { name });
const card = (page: Page, name: string) => page.getByRole('region', { name });
const tab = (page: Page, name: string, label = 'Choose a member') => page.getByRole('tablist', { name: label }).getByRole('tab', { name, exact: true });
const toast = (page: Page) => page.getByRole('status');
const plan = (page: Page) => page.getByTestId('plan-card');
/** The visit bar of a Flex plan card: how many segments there are and how many are filled. */
const bar = (p: Locator) => p.getByRole('img').first().evaluate((el) => {
  const kids = Array.from(el.children) as HTMLElement[];
  return { total: kids.length, on: kids.filter((k) => getComputedStyle(k).backgroundColor === 'rgb(117, 98, 75)').length };
});
/** Nothing from the booking era: no bookings, leave, absence or lateness notices, escorts, or "expected". */
const OLD_WORDS = /Book an extra day|Book a day|Plan leave|Not coming today|Running late|Expected today|Expected around|Brought by|Collected by|Cancel booking|Cancel this (notice|leave)|On leave|usual days/i;
async function noBookingUi(page: Page) {
  for (const name of [/^Book/, /Plan leave/, /Not coming today/, /Running late/, /Cancel (booking|leave|this notice)/, /Change the time/]) await expect(page.getByRole('button', { name })).toHaveCount(0);
  expect(await page.evaluate(() => document.body.innerText)).not.toMatch(OLD_WORDS);
}

test.beforeEach(async ({ request }) => { await resetDemo(request); });

// ---------------------------------------------------------------- Today
test('Maria: Today in Both mode shows where each parent is, with no booking, leave or lateness actions; the member choice sticks', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 'f1', '/today');
  await expect(page.getByRole('heading', { level: 1, name: 'Good morning, Maria' })).toBeVisible();
  await expect(tab(page, 'Both')).toHaveAttribute('aria-selected', 'true');
  const lina = card(page, 'Oma Lina Wijaya');
  const budi = card(page, 'Opa Budi Wijaya');
  for (const [parent, pay, planLine] of [[lina, 'Pay Rp 5.500.000', 'Flex · 10 of 10 visits used'], [budi, 'Pay Rp 9.500.000', 'Gold · come any open day']] as const) {
    await expect(parent).toBeVisible();
    // neither has come yet: a neutral line and their usual time, never "expected"
    await expect(parent).toContainText('Not at the club right now');
    await expect(parent).toContainText('Usually arrives around 10:05');
    await expect(parent).toContainText(planLine);
    for (const name of [pay, 'Profile']) await expect(parent.getByRole('button', { name })).toBeVisible();
    await expect(parent.getByLabel(/^Comment/)).toBeVisible(); // comments are per parent in Both mode
  }
  await noBookingUi(page);
  await expect(page.getByTestId('timeline')).toContainText('Keroncong sing-along');
  // each parent keeps their own plan card
  await expect(plan(page)).toHaveCount(2);
  await expect(page.locator('[data-testid="plan-card"][data-member="m1"]')).toContainText('10 of 10 visits used in October');
  await expect(page.locator('[data-testid="plan-card"][data-member="m46"]')).toContainText('Gold plan · come any open day');
  await assertNoHorizontalScroll(page);
  // one parent: a single card, that parent's plan, and the choice survives a reload
  await tab(page, 'Opa Budi').click();
  await expect(page.getByTestId('member-card')).toContainText('Opa Budi Wijaya');
  await expect(card(page, 'Oma Lina Wijaya')).toHaveCount(0);
  await expect(plan(page)).toContainText('Gold plan');
  await expect(plan(page)).not.toContainText('visits used');
  await page.reload();
  await expect(tab(page, 'Opa Budi')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('member-card')).toContainText('Opa Budi Wijaya');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('Today for one member: the programme without "expected", lunch line, team log, survey and links', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 'f1', '/today');
  await tab(page, 'Oma Lina').click();
  const mc = page.getByTestId('member-card');
  await expect(mc).toContainText('Not at the club right now');
  await expect(mc).toContainText('Usually arrives around 10:05');
  const tl = page.getByTestId('timeline');
  for (const x of ['Keroncong sing-along', 'Music room · Dinar', 'Batik painting', 'Afternoon tea']) await expect(tl).toContainText(x);
  // the club's day is shown either way; her own arrival, health check and home time appear once they happen
  for (const x of ['Arrived', 'Health check', 'Home time', 'expected']) await expect(tl).not.toContainText(x);
  // the kitchen has Oma Lina's shellfish allergy on file and today's menu is clear, before she has arrived
  await expect(tl).toContainText('shellfish allergy on file; today’s menu is clear');
  await expect(page.getByTestId('team-log')).toContainText(/Oma Lina had a \w+ day/); // the latest saved log, from her last visit
  await expect(page.getByTestId('survey-card')).toContainText('October check-in');
  await expect(page.getByTestId('photos-card')).toBeVisible();
  await expect(page.getByText(/Shared note from the club: Loves keroncong/)).toBeVisible();
  for (const name of ['Message the club', 'Club calendar', 'Useful contacts']) await expect(page.getByRole('button', { name })).toBeVisible();
  await noBookingUi(page);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

// ---------------------------------------------------------------- plan card
test('Plan card: Flex counts visits from check-ins and states the extra-visit rule; Gold is "come any open day"', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 'f1', '/today');
  await tab(page, 'Oma Lina').click();
  const p = plan(page);
  await expect(p).toContainText('Flex plan · October');
  await expect(p).toContainText('10 of 10 visits used in October');
  expect(await bar(p)).toEqual({ total: 10, on: 10 });
  await expect(p).toContainText('Extra visits are Rp 650.000 each, billed next month on the November invoice.');
  await expect(p.getByTestId('extra-visits')).toHaveCount(0); // no 11th visit yet
  await expect(p.getByRole('button')).toHaveCount(1); // nothing to book or cancel; only a plan request
  await expect(p.getByRole('button', { name: 'Ask to switch to Gold' })).toBeVisible();
  // Gold: no quota, no bar, no charge
  await tab(page, 'Opa Budi').click();
  await expect(p).toContainText('Gold plan · come any open day');
  await expect(p).toContainText(/Visits in October: \d+\./);
  await expect(p).toContainText('No limit and no extra charge.');
  await expect(p.getByRole('img')).toHaveCount(0);
  await expect(p).not.toContainText('650.000');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('Plan request: Maria asks to switch Oma Lina to Gold, management sees it, she can withdraw it', async ({ page, request }) => {
  const c = watchConsole(page);
  await signIn(page, 'f1', '/today');
  await tab(page, 'Oma Lina').click();
  const p = plan(page);
  await p.getByRole('button', { name: 'Ask to switch to Gold' }).click();
  const sheet = page.getByRole('dialog', { name: 'Switch Oma Lina to Gold?' });
  await expect(sheet).toContainText('Gold: come any open day for Rp 9.500.000 a month, with no extra-day charges. It starts on Sunday 1 November once the club confirms.');
  await sheet.getByRole('button', { name: 'Send request' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(p.getByTestId('plan-request')).toContainText('Switch to Gold from Sun 1 Nov requested · waiting for the club');
  // management and finance have it to act on
  const items = async (uid: string) => (await (await request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': uid } })).json()).state.planChangeRequests;
  await expect.poll(async () => Object.values<{ memberId: string; status: string; to: string; deletedAt?: string }>(await items('s9')).filter((r) => r.memberId === 'm1' && r.status === 'pending' && !r.deletedAt).map((r) => r.to)).toEqual(['gold']);
  // she withdraws it; the button comes back
  await p.getByRole('button', { name: 'Withdraw request' }).click();
  await expect(p.getByTestId('plan-request')).toHaveCount(0);
  await expect(p.getByRole('button', { name: 'Ask to switch to Gold' })).toBeVisible();
  // Daniel is not the payer: no request button for him
  await signIn(page, 'f2', '/today');
  await tab(page, 'Oma Lina').click();
  await expect(plan(page).getByRole('button')).toHaveCount(0);
  c.assertClean();
});

test('Plan card: Bapak Bambang has used 8 of 10 visits, today included', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 'fm10_0', '/today');
  await expect(tab(page, 'Bapak Bambang')).toHaveCount(0); // one member: no switcher
  await expect(plan(page)).toContainText('8 of 10 visits used in October');
  expect(await bar(plan(page))).toEqual({ total: 10, on: 8 });
  await expect(plan(page).getByTestId('extra-visits')).toHaveCount(0);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

// ---------------------------------------------------------------- the lobby checks members in and out
test('Lobby checks Oma Lina in: Maria’s Today follows live, the 11th visit is an extra visit on the plan card and in Billing, and nobody "brought" her', async ({ page, request }) => {
  const c = watchConsole(page);
  await signIn(page, 'f1', '/today');
  await tab(page, 'Oma Lina').click();
  const mc = page.getByTestId('member-card');
  await expect(mc).toContainText('Not at the club right now');
  await expect(plan(page)).toContainText('10 of 10 visits used in October');
  expect(await board(request).then((b) => ids(b.inClub))).toEqual(['m10', 'm2', 'm20']);

  // the lobby checks her in with the door camera
  const r = await api(request, 's1', 'attendance.checkIn', { memberId: 'm1', method: 'face' });
  expect(r.ok()).toBe(true);
  expect((await r.json()).result).toMatchObject({ extra: true, visit: 11 });
  await expect(mc).toContainText(/At the club since \d\d:\d\d/);
  await expect(mc).toContainText('Checked in by Caca');
  await expect(mc).not.toContainText('Not at the club right now');
  const tl = page.getByTestId('timeline');
  await expect(tl.locator('[data-tl="arrival"]')).toContainText('Arrived');
  await expect(tl.locator('[data-tl="arrival"]')).toContainText('Checked in by Caca');
  await expect(tl.locator('[data-tl="health"]')).toContainText('Health check on arrival');
  await expect(tl.locator('[data-tl="home"]')).toContainText('Home time');
  await expect(tl).toContainText('Keroncong sing-along');
  // the plan card: still 10 of 10, and the 11th visit is an extra day billed on the November invoice
  await expect(plan(page)).toContainText('10 of 10 visits used in October');
  const extra = plan(page).getByTestId('extra-visits');
  await expect(extra).toContainText('1 extra visit this month · Rp 650.000 on the November invoice');
  await expect(extra).toContainText('Wed 21 Oct');
  await noBookingUi(page);
  await assertNoHorizontalScroll(page);
  expect(await board(request).then((b) => ids(b.inClub))).toEqual(['m1', 'm10', 'm2', 'm20']);

  // the family is told the visit happened, with no escort in the message
  const state = await snapshot(request, 'f1');
  const told = noticesFor(state, 'f1', 'notif.checkedIn');
  expect(told).toHaveLength(1);
  expect(Object.keys(told[0].params).sort()).toEqual(['name', 'time']);
  expect(translate('en', 'notif.checkedIn', told[0].params)).toMatch(/^Oma Lina checked in at \d\d:\d\d\.$/);
  expect(translate('en', 'notif.checkedIn', told[0].params)).not.toMatch(/brought|collected/i);
  expect(noticesFor(await snapshot(request, 'f2'), 'f2', 'notif.checkedIn')).toHaveLength(1); // Daniel, the other contact, too

  // Billing says the same
  await page.goto('/billing');
  const lina = page.locator('[data-testid="open-invoice"]', { hasText: 'Oma Lina Wijaya' });
  await expect(lina).toContainText('Flex · 10 of 10 visits used in October');
  await expect(lina.getByTestId('billing-extra')).toContainText('1 extra visit this month · Rp 650.000 on the November invoice');
  await expect(page.locator('[data-testid="open-invoice"]', { hasText: 'Opa Budi Wijaya' }).getByTestId('billing-extra')).toHaveCount(0);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('Both mode follows the lobby: Oma Lina at the club since, Opa Budi not; then she goes home', async ({ page, request }) => {
  const c = watchConsole(page);
  await signIn(page, 'f1', '/today');
  const lina = card(page, 'Oma Lina Wijaya');
  const budi = card(page, 'Opa Budi Wijaya');
  await expect(lina).toContainText('Not at the club right now');
  expect((await api(request, 's1', 'attendance.checkIn', { memberId: 'm1', method: 'manual' })).ok()).toBe(true);
  await expect(lina).toContainText(/At the club since \d\d:\d\d/);
  await expect(lina).toContainText('Health check coming up with Ns. Dewi.');
  await expect(budi).toContainText('Not at the club right now');
  await expect(budi).toContainText('The nurse checks blood pressure when they arrive.'); // he may still drop in
  // she goes home: the day for her says so, with the real times
  expect((await api(request, 's1', 'attendance.checkOut', { memberId: 'm1' })).ok()).toBe(true);
  await expect(lina).toContainText(/Went home at \d\d:\d\d/);
  await expect(lina).toContainText(/At the club from \d\d:\d\d to \d\d:\d\d/);
  await expect(lina).not.toContainText('At the club since');
  await expect(budi).toContainText('Not at the club right now');
  await noBookingUi(page);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('Home time shows the real time once the lobby checks Oma Lina out, without "collected by"', async ({ page, request }) => {
  const c = watchConsole(page);
  await signIn(page, 'f1', '/today');
  await tab(page, 'Oma Lina').click();
  expect((await api(request, 's1', 'attendance.checkIn', { memberId: 'm1', method: 'face' })).ok()).toBe(true);
  const mc = page.getByTestId('member-card');
  await expect(mc).toContainText(/At the club since \d\d:\d\d/);
  expect((await api(request, 's1', 'attendance.checkOut', { memberId: 'm1' })).ok()).toBe(true);
  await expect(mc).toContainText(/Went home at \d\d:\d\d/);
  const tl = page.getByTestId('timeline');
  const home = tl.locator('[data-tl="home"]');
  await expect(home).toHaveAttribute('data-state', 'done');
  await expect(home).toContainText('Home time');
  await expect(home).toContainText('Checked out by Caca');
  await expect(home).toContainText(/\d\d:\d\d/);
  await expect(tl.locator('[data-tl="arrival"]')).toContainText('Arrived');
  const told = noticesFor(await snapshot(request, 'f1'), 'f1', 'notif.checkedOut');
  expect(told).toHaveLength(1);
  expect(Object.keys(told[0].params).sort()).toEqual(['name', 'time']);
  expect(translate('en', 'notif.checkedOut', told[0].params)).not.toMatch(/brought|collected/i);
  await noBookingUi(page);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('A Gold member is never charged: Opa Budi checks in and the plan card only counts the visit', async ({ page, request }) => {
  const c = watchConsole(page);
  await signIn(page, 'f1', '/today');
  await tab(page, 'Opa Budi').click();
  const p = plan(page);
  await expect(p).toContainText(/Visits in October: \d+\./);
  const before = Number((await p.textContent())!.match(/Visits in October: (\d+)\./)![1]);
  const r = await api(request, 's1', 'attendance.checkIn', { memberId: 'm46', method: 'manual' });
  expect(r.ok()).toBe(true);
  expect((await r.json()).result).toMatchObject({ extra: false });
  await expect(page.getByTestId('member-card')).toContainText(/At the club since \d\d:\d\d/);
  await expect(p).toContainText(`Visits in October: ${before + 1}.`);
  await expect(p).toContainText('Gold plan · come any open day');
  await expect(p.getByTestId('extra-visits')).toHaveCount(0);
  await expect(p).not.toContainText('650.000');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('Laras: Bapak Bambang is at the club since 09:48; if the lobby undoes the check-in he is simply not at the club and the visit stops counting', async ({ page, request }) => {
  test.skip(!hasAction('attendance.undoCheckIn'), 'attendance.undoCheckIn (lobby) is not built yet');
  const c = watchConsole(page);
  await signIn(page, 'fm10_0', '/today');
  const mc = page.getByTestId('member-card');
  await expect(mc).toContainText('At the club since 09:48');
  await expect(mc).toContainText('Checked in by Caca');
  const tl = page.getByTestId('timeline');
  await expect(tl.locator('[data-tl="arrival"]')).toContainText('09:48');
  await expect(tl.locator('[data-tl="health"]')).toContainText('122/73');
  await expect(plan(page)).toContainText('8 of 10 visits used in October');
  expect((await api(request, 's1', 'attendance.undoCheckIn', { memberId: 'm10' })).ok()).toBe(true);
  await expect(mc).toContainText('Not at the club right now');
  await expect(mc).toContainText('Usually arrives around 09:48');
  await expect(plan(page)).toContainText('7 of 10 visits used in October');
  expect(await bar(plan(page))).toEqual({ total: 10, on: 7 });
  await expect(tl.locator('[data-tl="arrival"]')).toHaveCount(0);
  await expect(tl.locator('[data-tl="health"]')).toHaveCount(0);
  await expect(tl).toContainText('Sop ikan kakap'); // the programme stays
  await noBookingUi(page);
  // the lobby's board follows: he is back on the check-in list
  expect(await board(request).then((b) => ids(b.others))).toContain('m10');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

// ---------------------------------------------------------------- billing
test('Maria pays an invoice (demo): one invoice, then the rest together', async ({ page }) => {
  test.skip(!hasAction('payment.simulateVa'), 'payment.simulateVa (finance) is not built yet');
  const c = watchConsole(page);
  await signIn(page, 'f1', '/billing');
  await expect(page.getByRole('heading', { level: 1, name: 'Billing' })).toBeVisible();
  await expect(page.getByTestId('open-total')).toHaveText('Rp 15.000.000');
  await expect(page.getByTestId('open-invoice')).toHaveCount(2);
  await expect(page.getByTestId('billing-total')).toContainText('Pay all together');
  // pay Oma Lina's invoice only
  const lina = page.locator('[data-testid="open-invoice"]', { hasText: 'Oma Lina Wijaya' });
  await expect(lina).toContainText('Flex · 10 of 10 visits used in October');
  await expect(page.locator('[data-testid="open-invoice"]', { hasText: 'Opa Budi Wijaya' })).toContainText('Gold · come any open day');
  await lina.getByRole('button', { name: 'Pay this invoice' }).click();
  const dlg = sheet(page, 'Pay by virtual account');
  await expect(dlg).toContainText('INV-2610-001');
  await expect(dlg).toContainText('Rp 5.500.000');
  await dlg.getByRole('radio', { name: 'Mandiri' }).click();
  await expect(dlg.getByTestId('va-number')).toHaveText(/^8950 /);
  await dlg.getByRole('button', { name: 'Demo: simulate payment received' }).click();
  await expect(toast(page)).toContainText('Payment received. Receipt sent to Maria on WhatsApp.');
  await expect(page.getByTestId('open-invoice')).toHaveCount(1);
  await expect(page.getByTestId('open-total')).toHaveText('Rp 9.500.000');
  await expect(page.locator('[data-history]', { hasText: 'INV-2610-001' })).toContainText('Paid');
  await assertNoHorizontalScroll(page);
  // the last open invoice from the Today page
  await page.goto('/today');
  await tab(page, 'Opa Budi').click();
  const inv = page.getByTestId('invoice-card');
  await expect(inv).toContainText('Rp 9.500.000');
  await inv.getByRole('button', { name: 'Pay by virtual account' }).click();
  const d2 = sheet(page, 'Pay by virtual account');
  await d2.getByRole('button', { name: 'Demo: simulate payment received' }).click();
  await expect(toast(page)).toContainText('Payment received');
  await expect(inv).toContainText('Paid');
  await expect(inv.getByRole('button', { name: 'Pay by virtual account' })).toHaveCount(0);
  c.assertClean();
});

test('Maria can pay every open invoice together from Billing', async ({ page }) => {
  test.skip(!hasAction('payment.simulateVa'), 'payment.simulateVa (finance) is not built yet');
  const c = watchConsole(page);
  await signIn(page, 'f1', '/billing');
  const all = page.getByTestId('billing-total');
  await expect(all).toContainText('Oma Lina Rp 5.500.000 + Opa Budi Rp 9.500.000');
  await expect(all).toContainText('Combined virtual account · DOKU');
  await all.getByRole('radio', { name: 'BNI' }).click();
  await all.getByRole('button', { name: 'Demo: simulate payment received' }).click();
  await expect(toast(page)).toContainText('Payment received');
  await expect(page.getByTestId('open-invoice')).toHaveCount(0);
  await expect(page.getByTestId('billing-allpaid')).toContainText('All paid');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('Yohana sees the overdue September invoice and can pay it', async ({ page }) => {
  test.skip(!hasAction('payment.simulateVa'), 'payment.simulateVa (finance) is not built yet');
  const c = watchConsole(page);
  await signIn(page, 'fm20_0', '/billing');
  await expect(page.getByTestId('open-invoice')).toHaveCount(2);
  const sep = page.locator('[data-testid="open-invoice"][data-status="overdue"]');
  await expect(sep).toHaveCount(1);
  await expect(sep).toContainText('September 2026');
  await expect(sep).toContainText('Overdue');
  await expect(sep).toContainText('INV-2609-020');
  await expect(page.getByTestId('open-total')).toHaveText('Rp 19.000.000');
  await expect(page.getByTestId('billing-total')).toContainText('1 overdue');
  await sep.getByRole('button', { name: 'Pay this invoice' }).click();
  await sheet(page, 'Pay by virtual account').getByRole('button', { name: 'Demo: simulate payment received' }).click();
  await expect(toast(page)).toContainText('Payment received');
  await expect(page.getByTestId('open-invoice')).toHaveCount(1);
  await expect(page.locator('[data-testid="open-invoice"][data-status="overdue"]')).toHaveCount(0);
  await expect(page.getByTestId('open-total')).toHaveText('Rp 9.500.000');
  c.assertClean();
});

test('Only the primary contact pays: Daniel sees every invoice and who looks after billing', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 'f2', '/billing');
  await expect(page.getByTestId('open-invoice')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Pay this invoice' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Demo: simulate payment received' })).toHaveCount(0);
  await expect(page.getByTestId('payer-note')).toContainText('Maria Wijaya looks after billing');
  await page.goto('/today');
  await expect(page.getByRole('button', { name: /^Pay Rp/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Pay by virtual account' })).toHaveCount(0);
  await expect(page.getByTestId('invoice-card').first()).toContainText('Maria Wijaya looks after billing');
  c.assertClean();
});

test('A member with no invoice gets an empty state, not a crash', async ({ page, request }) => {
  test.skip(!hasAction('invoice.void'), 'invoice.void (finance) is not built yet');
  for (const id of ['INV-2609-020', 'INV-2610-020']) expect((await api(request, 's10', 'invoice.void', { invoiceId: id, reason: 'e2e: no invoice' })).ok()).toBe(true);
  const c = watchConsole(page);
  await signIn(page, 'fm20_0', '/today');
  const inv = page.getByTestId('invoice-card');
  await expect(inv).toContainText('No invoice yet');
  await expect(inv).toContainText('The first invoice arrives on the 15th (15 November 2026).');
  await expect(plan(page)).toBeVisible();
  await page.goto('/billing');
  await expect(page.getByTestId('billing-empty')).toContainText('The first invoice arrives on the 15th');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

// ---------------------------------------------------------------- photos and health
test('Photos: by day, solo first; a tile opens the viewer for families', async ({ page }) => {
  test.skip(isStub('apps/web/src/features/activity/PhotoViewer.tsx'), 'PhotoViewer (activity) is still a stub');
  const c = watchConsole(page);
  await signIn(page, 'f1', '/photos');
  await expect(page.getByRole('heading', { level: 1, name: 'Photos' })).toBeVisible();
  await expect(tab(page, 'Both')).toHaveAttribute('aria-selected', 'true');
  const days = page.getByTestId('photo-day');
  await expect(days.first()).toBeVisible();
  await expect(page.getByText('Group photos with both').first()).toBeVisible();
  await assertNoHorizontalScroll(page);
  await tab(page, 'Oma Lina').click();
  await expect(page.getByText('Oma Lina’s photos').first()).toBeVisible();
  await expect(page.getByText('Opa Budi’s photos')).toHaveCount(0);
  await page.locator('[data-photo-id]').first().click();
  const viewer = page.getByRole('dialog');
  await expect(viewer).toBeVisible();
  // families get no staff actions (hide, retag, remove)
  for (const staff of [/Hide/i, /Retag|Tag/i, /Remove|Delete/i]) await expect(viewer.getByRole('button', { name: staff })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(viewer).toHaveCount(0);
  c.assertClean();
});

test('Photos: a family with a single member sees that member’s photos without a switcher', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 'fm10_0', '/photos');
  await expect(page.getByTestId('photo-day').first()).toBeVisible();
  await expect(page.getByRole('tablist', { name: 'Choose a member' })).toHaveCount(0);
  await expect(page.getByText('Bapak Bambang’s photos').first()).toBeVisible();
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('The door camera’s arrival picture is the club’s record, not a family photo', async ({ page, request }) => {
  const c = watchConsole(page);
  await signIn(page, 'f1', '/photos');
  await tab(page, 'Oma Lina').click();
  const count = () => page.locator('[data-photo-id]').count();
  const before = await count();
  expect((await api(request, 's1', 'attendance.checkIn', { memberId: 'm1', method: 'face' })).ok()).toBe(true);
  const state = await snapshot(request, 'f1');
  expect(Object.values(state.photos as Record<string, { kind: string; memberIds: string[]; date: string }>).some((x) => x.kind === 'arrival' && x.memberIds.includes('m1') && x.date === TODAY)).toBe(true);
  await page.reload();
  await tab(page, 'Oma Lina').click();
  await expect(page.getByTestId('photo-day').first()).toBeVisible();
  expect(await count()).toBe(before);
  c.assertClean();
});

test('Health shows the member you chose: Opa Budi’s Health is Opa Budi’s', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 'f1', '/health');
  const health = page.getByTestId('family-health');
  await expect(health).toHaveAttribute('data-member-id', 'm1'); // "Both" shows the first parent
  await expect(page.getByRole('tablist', { name: 'Choose a member' }).getByRole('tab')).toHaveCount(2); // no "Both" on Health
  await tab(page, 'Opa Budi').click();
  await expect(health).toHaveAttribute('data-member-id', 'm46');
  if (!isStub('apps/web/src/features/members/MemberProfile.tsx')) await expect(page.locator('#main')).toContainText('Budi');
  await page.reload();
  await expect(health).toHaveAttribute('data-member-id', 'm46');
  await expect(tab(page, 'Opa Budi')).toHaveAttribute('aria-selected', 'true');
  // a deep link picks the member, then the URL is clean
  await page.goto('/health?member=m1');
  await expect(health).toHaveAttribute('data-member-id', 'm1');
  await expect(page).toHaveURL(/\/health$/);
  // Today's Profile button opens Health for that parent
  await page.goto('/today');
  await tab(page, 'Both').click();
  await card(page, 'Opa Budi Wijaya').getByRole('button', { name: 'Profile' }).click();
  await expect(page).toHaveURL(/\/health$/);
  await expect(health).toHaveAttribute('data-member-id', 'm46');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

// ---------------------------------------------------------------- survey, lunch, log comments
test('Survey: Maria answers it from Today (and from the notification link)', async ({ page }) => {
  test.skip(!hasAction('survey.answer'), 'survey.answer (club) is not built yet');
  const c = watchConsole(page);
  await signIn(page, 'f1', '/today?survey=1');
  const dlg = sheet(page, 'October check-in');
  await expect(dlg).toBeVisible();
  await expect(page).toHaveURL(/\/today$/);
  await expect(dlg.getByRole('button', { name: 'Send answers' })).toHaveAttribute('aria-disabled', 'true');
  await dlg.getByRole('group', { name: 'Overall' }).getByRole('button', { name: '5 of 5' }).click();
  await dlg.getByRole('button', { name: 'Yes' }).click();
  await dlg.getByLabel('Anything we could do better?').fill('More photos please');
  await dlg.getByRole('button', { name: 'Send answers' }).click();
  await expect(toast(page)).toContainText('Thank you. Your answers went to the club team.');
  await expect(page.getByTestId('survey-card')).toContainText('Thank you. Your answers went to the club team.');
  await expect(page.getByTestId('survey-card').getByRole('button')).toHaveCount(0);
  c.assertClean();
});

test('Lunch: feedback goes to the kitchen; the allergy line follows the kitchen’s plan', async ({ page, request }) => {
  test.skip(!hasAction('feedback.submit'), 'feedback.submit (kitchen) is not built yet');
  const c = watchConsole(page);
  await signIn(page, 'fm10_0', '/today');
  const tl = page.getByTestId('timeline');
  // Bapak Bambang is allergic to seafood and today's lunch has fish soup: no reassurance until the kitchen serves an alternative
  await expect(tl).toContainText('Sop ikan kakap');
  await expect(tl).not.toContainText('today’s menu is clear');
  await expect(tl).not.toContainText('allergy on file');
  await tl.getByRole('button', { name: 'Feedback on lunch' }).click();
  const dlg = sheet(page, 'Feedback on lunch');
  await expect(dlg.getByRole('radio', { name: 'Sop ikan kakap' })).toBeVisible();
  await dlg.getByRole('radio', { name: 'Sop ikan kakap' }).click();
  await dlg.getByLabel('What would you like the kitchen to know?').fill('The soup was a little salty again.');
  await dlg.getByRole('button', { name: 'Send feedback' }).click();
  await expect(toast(page)).toContainText('Thank you. The kitchen team will reply in Messages.');
  const state = await snapshot(request, 's3');
  const fb = Object.values(state.feedback as Record<string, { memberId: string; dish: string; text: string; mealDate: string; source: string }>).find((f) => f.text.includes('a little salty again'));
  expect(fb).toMatchObject({ memberId: 'm10', dish: 'Sop ikan kakap', mealDate: TODAY, source: 'family' });
  // the kitchen sets an alternative: now the family is told what is served instead
  test.skip(!hasAction('allergyPlan.set'), 'allergyPlan.set (kitchen) is not built yet');
  const set = await api(request, 's3', 'allergyPlan.set', { date: TODAY, person: 'member:m10', dishId: 'dish-sop-ikan', alternative: 'Grilled chicken' });
  expect(set.ok()).toBe(true);
  await expect(tl).toContainText('isn’t safe for Bapak Bambang’s seafood allergy, so the kitchen is serving Grilled chicken instead');
  c.assertClean();
});

test('The allergy line is honest before the member arrives: Bapak Bambang, undone, still has no reassurance', async ({ page, request }) => {
  test.skip(!hasAction('attendance.undoCheckIn'), 'attendance.undoCheckIn (lobby) is not built yet');
  const c = watchConsole(page);
  expect((await api(request, 's1', 'attendance.undoCheckIn', { memberId: 'm10' })).ok()).toBe(true);
  await signIn(page, 'fm10_0', '/today');
  const tl = page.getByTestId('timeline');
  await expect(page.getByTestId('member-card')).toContainText('Not at the club right now');
  await expect(tl).toContainText('Sop ikan kakap');
  await expect(tl).not.toContainText('today’s menu is clear');
  c.assertClean();
});

test('Log comments: a comment goes to the care thread and shows under the log', async ({ page, request }) => {
  test.skip(!hasAction('message.send'), 'message.send (lobby / chat) is not built yet');
  const c = watchConsole(page);
  await signIn(page, 'f1', '/today');
  await tab(page, 'Oma Lina').click();
  const log = page.getByTestId('team-log');
  await log.getByLabel(/^Comment/).fill('Thank you Dinar, she is still humming it at home!');
  await log.getByRole('button', { name: 'Send' }).click();
  await expect(toast(page)).toContainText('Comment sent to Dinar.');
  await expect(log.getByTestId('log-comment')).toContainText('still humming it at home');
  await expect(log.getByTestId('log-comment')).toContainText('Maria Wijaya');
  // it is a care-thread message that references the log
  const state = await snapshot(request, 's5');
  const msgs = Object.values(state.messages as Record<string, { text: string; ref?: { type: string; id: string }; threadId: string }>);
  const m = msgs.find((x) => x.text.includes('still humming'));
  expect(m?.ref?.type).toBe('dailyLog');
  expect(state.threads[m!.threadId].topic).toBe('care');
  // a staff reply in the same thread shows up under the log
  if (hasAction('thread.markRead')) {
    const reply = await api(request, 's5', 'message.send', { threadId: m!.threadId, text: 'We will play it again on Friday!', ref: { type: 'dailyLog', id: m!.ref!.id } });
    expect(reply.ok()).toBe(true);
    await expect(log.getByTestId('log-comment')).toHaveCount(2);
    await expect(log.getByTestId('log-comment').nth(1)).toContainText('We will play it again on Friday!');
    await expect(log.getByTestId('log-comment').nth(1)).toContainText('Dinar');
  }
  c.assertClean();
});

// ---------------------------------------------------------------- timeline states
test('The timeline follows the clock for a member in the club, and every approved lunch photo appears (the kitchen\'s pending one does not)', async ({ page, request }) => {
  const c = watchConsole(page);
  expect((await request.post('/api/demo/clock', { data: { hm: '12:05' } })).ok()).toBe(true);
  await signIn(page, 'fm20_0', '/today');
  const tl = page.getByTestId('timeline');
  await expect(tl.locator('[data-tl="session-10:30"]')).toHaveAttribute('data-state', 'done');
  await expect(tl.locator('[data-tl="lunch"]')).toHaveAttribute('data-state', 'now');
  await expect(tl.locator('[data-tl="lunch"]')).toContainText('NOW');
  await expect(tl.locator('[data-tl="session-13:30"]')).toHaveAttribute('data-state', 'up');
  await expect(page.getByTestId('lunch-photo')).toHaveCount(0);
  if (hasAction('menu.postLunchPhoto')) {
    // the kitchen's photo waits for approval: the family sees nothing; management's two go live, one after the other
    expect((await api(request, 's3', 'menu.postLunchPhoto', { date: TODAY })).ok()).toBe(true);
    await expect(page.getByTestId('lunch-photo')).toHaveCount(0);
    expect((await api(request, 's9', 'menu.postLunchPhoto', { date: TODAY })).ok()).toBe(true);
    await expect(page.getByTestId('lunch-photo')).toHaveCount(1);
    await expect(page.getByTestId('lunch-photos')).toContainText('Lunch photo posted by the kitchen');
    expect((await api(request, 's9', 'menu.postLunchPhoto', { date: TODAY, notify: false })).ok()).toBe(true);
    await expect(page.getByTestId('lunch-photo')).toHaveCount(2); // live: all the approved photos of the day
    await expect(page.getByTestId('lunch-photo').first()).toBeVisible();
  }
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('Before the member arrives nothing is "now": the same clock, the same programme, all still to come', async ({ page, request }) => {
  const c = watchConsole(page);
  expect((await request.post('/api/demo/clock', { data: { hm: '12:05' } })).ok()).toBe(true);
  await signIn(page, 'f1', '/today');
  await tab(page, 'Oma Lina').click();
  const tl = page.getByTestId('timeline');
  await expect(page.getByTestId('member-card')).toContainText('Not at the club right now');
  for (const id of ['session-10:30', 'lunch', 'session-13:30', 'tea']) await expect(tl.locator(`[data-tl="${id}"]`)).toHaveAttribute('data-state', 'up');
  await expect(tl).not.toContainText('NOW');
  c.assertClean();
});

test('Once the club has closed for the day, "not at the club" is final: "Not at the club today"', async ({ page, request }) => {
  const c = watchConsole(page);
  expect((await request.post('/api/demo/clock', { data: { hm: '16:45' } })).ok()).toBe(true); // the club closes at 16:30
  await signIn(page, 'f1', '/today');
  for (const parent of ['Oma Lina Wijaya', 'Opa Budi Wijaya']) {
    await expect(card(page, parent)).toContainText('Not at the club today');
    await expect(card(page, parent)).not.toContainText('right now');
  }
  await tab(page, 'Oma Lina').click();
  await expect(page.getByTestId('member-card')).toContainText('Not at the club today');
  await expect(page.getByTestId('member-card')).toContainText('Usually arrives around 10:05');
  await noBookingUi(page);
  await toId(page);
  await expect(page.getByTestId('member-card')).toContainText('Tidak ke klub hari ini');
  await expect(page.getByTestId('member-card')).not.toContainText('Sedang tidak di klub');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('A closed day shows "Club closed" instead of a timeline', async ({ page, request }) => {
  test.skip(!hasAction('calendarEvent.create'), 'calendarEvent.create (schedule) is not built yet');
  const c = watchConsole(page);
  const r = await api(request, 's9', 'calendarEvent.create', { date: TODAY, kind: 'closed', title: 'Club closed: water supply repair' });
  expect(r.ok()).toBe(true);
  await signIn(page, 'f1', '/today');
  await tab(page, 'Oma Lina').click();
  await expect(page.getByTestId('member-card')).toContainText('Club closed today');
  const empty = page.getByTestId('timeline-empty');
  await expect(empty).toContainText('Club closed');
  await expect(empty).toContainText('Club closed: water supply repair');
  await noBookingUi(page);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('A scheduled last day shows on the card; the plan card stays', async ({ page, request }) => {
  test.skip(!hasAction('members.end'), 'members.end (members) is not built yet');
  const end = await api(request, 's9', 'members.end', { memberId: 'm1', lastDay: '2026-10-28', reason: 'movedAway' });
  expect(end.ok()).toBe(true);
  const c = watchConsole(page);
  await signIn(page, 'f1', '/today');
  await tab(page, 'Oma Lina').click();
  await expect(page.getByTestId('member-card')).toContainText('Membership ends Wed 28 Oct');
  await expect(page.getByTestId('member-card')).toContainText('Not at the club right now');
  await expect(plan(page)).toContainText('10 of 10 visits used in October');
  await noBookingUi(page);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

// ---------------------------------------------------------------- Indonesian
const RAW = /\b(family|common|status|nav|err|roles|lobby|health|inv|finance|chat|notif|feed|kitchen|mgmt|shell)\.[A-Za-z_][A-Za-z_.]*/;
async function toId(page: Page) {
  if (isPhone(page)) {
    await page.getByRole('button', { name: 'Account', exact: true }).click();
    await page.getByRole('tab', { name: 'Bahasa Indonesia' }).click();
    await page.keyboard.press('Escape');
  } else {
    await page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'ID' }).click();
  }
}
test('Indonesian: toggling the language shows no raw keys on any family screen or sheet, including after the lobby checks Oma Lina in', async ({ page, request }) => {
  const c = watchConsole(page);
  await signIn(page, 'f1', '/today');
  await toId(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Selamat pagi, Maria' })).toBeVisible();
  const body = async () => page.evaluate(() => document.body.innerText);
  const clean = async (label: string) => { const text = await body(); expect(text, label).not.toMatch(RAW); };
  await expect(tab(page, 'Keduanya', 'Pilih anggota')).toHaveAttribute('aria-selected', 'true');
  await clean('today both');
  await expect(page.getByText('Sedang tidak di klub').first()).toBeVisible();
  await expect(page.getByText('Biasanya tiba sekitar 10:05').first()).toBeVisible();
  await expect(page.getByText('Gold · datang di hari buka mana saja').first()).toBeVisible();
  await tab(page, 'Oma Lina', 'Pilih anggota').click();
  await expect(page.getByTestId('timeline')).toContainText('Dapur mencatat alergi kerang-kerangan Oma Lina; menu hari ini aman.');
  await expect(plan(page)).toContainText('Paket Flex · Oktober');
  await expect(plan(page)).toContainText('10 dari 10 kunjungan terpakai di Oktober');
  await expect(plan(page)).toContainText('Kunjungan tambahan Rp 650.000 per kunjungan, ditagih bulan depan di tagihan November.');
  await clean('today lina');
  // the lobby checks her in: the 11th visit is an extra visit, all in Indonesian
  expect((await api(request, 's1', 'attendance.checkIn', { memberId: 'm1', method: 'face' })).ok()).toBe(true);
  await expect(page.getByTestId('member-card')).toContainText(/Di klub sejak \d\d:\d\d/);
  await expect(page.getByTestId('member-card')).toContainText('Check-in oleh Caca');
  await expect(plan(page).getByTestId('extra-visits')).toContainText('1 kunjungan tambahan bulan ini · Rp 650.000 di tagihan November');
  await expect(page.getByTestId('timeline')).toContainText('Cek kesehatan saat tiba');
  await clean('today lina in the club');
  // the family notice is translated too
  const told = noticesFor(await snapshot(request, 'f1'), 'f1', 'notif.checkedIn');
  expect(translate('id', 'notif.checkedIn', told[0].params)).toMatch(/^Oma Lina check-in pukul \d\d:\d\d\.$/);
  expect(translate('id', 'notif.checkedIn', told[0].params)).not.toMatch(RAW);
  // the sheets
  await page.getByRole('button', { name: 'Masukan untuk makan siang' }).click();
  await clean('feedback sheet');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Isi survei' }).click();
  await clean('survey sheet');
  await page.keyboard.press('Escape');
  await assertNoHorizontalScroll(page);
  // photos, billing, health: in-app navigation keeps the language
  const go = async (key: string) => { await page.locator(`[data-nav-key="${key}"]`).first().click(); };
  await go('photos');
  await expect(page.getByText(/per hari/).first()).toBeVisible();
  await clean('photos');
  await go('billing');
  await expect(page.getByRole('heading', { level: 1, name: 'Tagihan' })).toBeVisible();
  await expect(page.getByTestId('billing-total')).toContainText('Total yang harus dibayar');
  await expect(page.locator('[data-testid="open-invoice"]', { hasText: 'Oma Lina Wijaya' })).toContainText('Flex · 10 dari 10 kunjungan terpakai di Oktober');
  await expect(page.locator('[data-testid="open-invoice"]', { hasText: 'Oma Lina Wijaya' }).getByTestId('billing-extra')).toContainText('1 kunjungan tambahan bulan ini');
  await clean('billing');
  await page.getByRole('button', { name: 'Bayar tagihan ini' }).first().click();
  await expect(sheet(page, 'Bayar via virtual account')).toContainText('Demo: simulasikan pembayaran diterima');
  await clean('pay sheet');
  await page.keyboard.press('Escape');
  await assertNoHorizontalScroll(page);
  await go('health');
  await expect(page.getByTestId('family-health')).toBeVisible();
  await clean('health');
  c.assertClean();
});

test('Indonesian: signing in as Yohana, a Gold member’s day reads in Indonesian and the old booking words are gone', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 'fm20_0', '/today', 'id');
  await expect(page.getByRole('heading', { level: 1, name: 'Selamat pagi, Yohana' })).toBeVisible();
  await expect(page.getByTestId('member-card')).toContainText('Di klub sejak 09:38');
  await expect(plan(page)).toContainText('Paket Gold · datang di hari buka mana saja');
  await expect(plan(page)).toContainText('Tanpa batas dan tanpa biaya tambahan.');
  const text = await page.evaluate(() => document.body.innerText);
  expect(text).not.toMatch(RAW);
  expect(text).not.toMatch(/Pesan hari|Atur cuti|Tidak datang hari ini|Datang terlambat|Dijadwalkan|diantar|Diantar|dijemput|Dijemput/);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});
