// Family app (round 8: Today · Photos · Calendar · Health · Me, with Billing, Contacts and a parent's profile pushed from them) for a drop-in day club.
// Today: one hero for both parents (a row each, tap = focus on that parent, "‹ Both parents" goes back) or one parent's card, the day strip, the day's list,
// the team's note, lunch feedback. Billing (from Me): the dark total card with paying inline, each parent's plan (Flex visits counted from check-ins, extra visits
// billed next month, Gold come any open day) and the invoices. Contacts: WhatsApp the front desk. Photos, Health (avatar rings), survey, Indonesian.
// Nothing is "expected": there are no bookings, leave, "not coming" or "running late", and no "brought by" or "collected by".
// Run in the isolated env:  pnpm e2e:env family 8801 5201  ·  E2E_BASE_URL=http://localhost:5201 pnpm exec playwright test e2e/family.spec.ts
import { test, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { resetDemo, signIn, watchConsole, assertNoHorizontalScroll } from './helpers';
import { lobbyGroups } from '../packages/shared/src/rules/attendance';
import { translate } from '../packages/shared/src/i18n';

const TODAY = '2026-10-21';
const src = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
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
const toast = (page: Page) => page.getByRole('status');
/** Today's hero (data-mode: both | single | status) and a parent's row on the both-parents card. */
const hero = (page: Page) => page.getByTestId('story-hero');
const row = (page: Page, id: string) => page.locator(`[data-testid="parent-row"][data-member="${id}"]`);
/** Tap a parent's row on Today: the hero becomes that parent's card (the choice is stored for this user and shared by Health). */
async function focusOn(page: Page, id: string) {
  await row(page, id).click();
  await expect(hero(page)).toHaveAttribute('data-member', id);
}
/** The plan lines on Billing: one card per parent, always (or the one that is on a given parent). */
const plans = (page: Page) => page.getByTestId('plan-card');
const plan = (page: Page, id: string) => page.locator(`[data-testid="plan-card"][data-member="${id}"]`);
/** The invoices on Billing that still wait for payment (any status but paid). */
const openRows = (page: Page) => page.locator('[data-testid="invoice-row"]:not([data-status="paid"])');
/** The visit bar of a Flex plan: how many segments there are and how many are filled (the parent's profile card). */
const bar = (p: Locator) => p.getByRole('img').first().evaluate((el) => {
  const kids = Array.from(el.children) as HTMLElement[];
  return { total: kids.length, on: kids.filter((k) => getComputedStyle(k).backgroundColor === 'rgb(117, 98, 75)').length };
});
const goTab = (page: Page, key: 'today' | 'photos' | 'calendar' | 'health' | 'me') => page.locator(`[data-nav-key="${key}"]`).click();
/** Nothing from the booking era: no bookings, leave, absence or lateness notices, escorts, or "expected". */
const OLD_WORDS = /Book an extra day|Book a day|Plan leave|Not coming today|Running late|Expected today|Expected around|Brought by|Collected by|Cancel booking|Cancel this (notice|leave)|On leave|usual days/i;
async function noBookingUi(page: Page) {
  for (const name of [/^Book/, /Plan leave/, /Not coming today/, /Running late/, /Cancel (booking|leave|this notice)/, /Change the time/]) await expect(page.getByRole('button', { name })).toHaveCount(0);
  expect(await page.evaluate(() => document.body.innerText)).not.toMatch(OLD_WORDS);
}

test.beforeEach(async ({ request }) => { await resetDemo(request); });

// ---------------------------------------------------------------- Today
test('Maria: Today in Both mode shows where each parent is (a row each), with no booking, leave or lateness actions; tapping a row focuses on that parent and the choice sticks', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 'f1', '/today');
  await expect(page.getByTestId('today-header')).toBeVisible();
  await expect(page.getByTestId('fam-tabbar').locator('[data-nav-key]')).toHaveCount(5); // Today · Photos · Calendar · Health · Me: no top bar, no Messages
  await expect(hero(page)).toHaveAttribute('data-mode', 'both');
  await expect(page.getByTestId('all-parents')).toHaveAttribute('aria-pressed', 'true'); // KC round 9: the switch is always there (both, Oma, Opa: one tap each)
  for (const [id, who] of [['m1', 'Oma Lina'], ['m46', 'Opa Budi']]) {
    // neither has come yet: a neutral line and their usual time, never "expected"
    await expect(row(page, id)).toContainText(`${who} isn’t at the club`);
    await expect(row(page, id)).not.toContainText('Usually arrives'); // KC round 8b: no "usually arrives" on Today
  }
  await expect(page.getByLabel(/^Comment/)).toHaveCount(0); // families answer the club on WhatsApp: no comment box on the team note
  await noBookingUi(page);
  await expect(page.getByTestId('timeline')).toContainText('Keroncong sing-along');
  await expect(plans(page)).toHaveCount(0); // plans live in Billing
  await assertNoHorizontalScroll(page);
  // each parent keeps their own plan, in Billing
  await page.goto('/billing');
  await expect(plans(page)).toHaveCount(2);
  await expect(plan(page, 'm1')).toContainText('Oma Lina · Flex');
  await expect(plan(page, 'm1').getByTestId('plan-line')).toHaveText('10 of 10 visits used in October');
  await expect(plan(page, 'm46')).toContainText('Opa Budi · Gold');
  await expect(plan(page, 'm46').getByTestId('plan-line')).toHaveText('Any open day');
  await assertNoHorizontalScroll(page);
  // one parent: the hero is that parent's card, "‹ Both parents" goes back, and the choice survives a reload
  await page.goto('/today');
  await focusOn(page, 'm46');
  await expect(hero(page)).toHaveAttribute('data-mode', 'single');
  await expect(page.getByTestId('parent-row')).toHaveCount(0);
  await expect(hero(page)).toContainText('Opa Budi');
  await expect(page.getByTestId('all-parents')).toBeVisible();
  await page.reload();
  await expect(hero(page)).toHaveAttribute('data-member', 'm46');
  await assertNoHorizontalScroll(page);
  // Health follows the parent chosen on Today
  await goTab(page, 'health');
  await expect(page.getByTestId('family-health')).toHaveAttribute('data-member-id', 'm46');
  await goTab(page, 'today');
  await page.getByTestId('all-parents').click();
  await expect(hero(page)).toHaveAttribute('data-mode', 'both');
  await expect(row(page, 'm1')).toBeVisible();
  c.assertClean();
});

/** Switch the app to Indonesian the way a family does: Me → Language, then back to where they were (the language row is one tap and flips it). */
async function toId(page: Page) {
  await goTab(page, 'me');
  await page.getByTestId('me-language').click();
  await expect(page.getByTestId('me-language')).toContainText('Bahasa Indonesia');
  await page.goBack();
}

test('Today notes a club closure or holiday in the coming week, in both languages: none when there is none, calm, under the day strip', async ({ page, request }) => {
  const c = watchConsole(page);
  await signIn(page, 'f1', '/today');
  await expect(page.getByTestId('today-header')).toBeVisible();
  await expect(page.getByTestId('closure-notice')).toHaveCount(0); // the seed's closure (30 Oct) is more than a week away
  // management adds a closure on Friday and a holiday on Tuesday (families are told when they are created)
  const closed = await api(request, 's9', 'calendarEvent.create', { date: '2026-10-23', kind: 'closed', title: 'Staff first-aid training', titleId: 'Pelatihan P3K staf' });
  expect(closed.ok()).toBeTruthy();
  const holiday = await api(request, 's9', 'calendarEvent.create', { date: '2026-10-27', kind: 'holiday', title: 'Prophet’s Birthday (national holiday)', titleId: 'Maulid Nabi (libur nasional)' });
  expect(holiday.ok()).toBeTruthy();
  expect(noticesFor(await snapshot(request, 'f1'), 'f1', 'cal.notif.added_closed')).toHaveLength(1);
  // one past the 7 days (28 Oct is day 7): not shown yet
  expect((await api(request, 's9', 'calendarEvent.create', { date: '2026-10-29', kind: 'closed', title: 'Too far ahead' })).ok()).toBeTruthy();
  await page.reload();
  const note = page.getByTestId('closure-notice');
  await expect(note).toBeVisible();
  const rows = note.getByTestId('closure-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('Club closed on Friday 23 Oct · Staff first-aid training');
  await expect(rows.nth(1)).toContainText('Club closed on Tuesday 27 Oct · Prophet’s Birthday (national holiday)');
  await expect(note).not.toContainText('Too far ahead');
  await expect(note).not.toContainText(/\bcal\.[a-z]/i);
  // under the day strip, above the day's list
  const y = async (l: Locator) => (await l.boundingBox())!.y;
  expect(await y(page.getByTestId('day-strip'))).toBeLessThan(await y(note));
  expect(await y(note)).toBeLessThan(await y(page.getByTestId('timeline')));
  await assertNoHorizontalScroll(page);
  // Indonesian uses the Indonesian titles
  await toId(page);
  await expect(rows.nth(0)).toContainText('Klub tutup pada Jumat 23 Okt · Pelatihan P3K staf');
  await expect(rows.nth(1)).toContainText('Klub tutup pada Selasa 27 Okt · Maulid Nabi (libur nasional)');
  await expect(note).not.toContainText(/\bcal\.[a-z]/i);
  c.assertClean();
});

test('Today for one parent: the programme without "expected", lunch line, team note, survey; the front desk is on Contacts', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 'f1', '/today');
  await focusOn(page, 'm1');
  await expect(hero(page)).toContainText('Oma Lina isn’t at the club');
  await expect(hero(page)).not.toContainText('Usually arrives'); // KC round 8b
  const tl = page.getByTestId('timeline');
  for (const x of ['Keroncong sing-along', 'Music room · Dinar', 'Batik painting', 'Afternoon tea']) await expect(tl).toContainText(x);
  // the club's day is shown either way; her own arrival, health check and home time appear once they happen
  for (const x of ['Arrived', 'Health check', 'Home time', 'expected']) await expect(tl).not.toContainText(x);
  // the kitchen has Oma Lina's shellfish allergy on file and today's menu is clear, before she has arrived
  await expect(tl).toContainText('shellfish allergy on file; today’s menu is clear');
  // the team's note is only what the team wrote: today has none yet, so it is the newest written one, from her last visit, with a way to open that day
  const note = page.getByTestId('team-note');
  await expect(note).toHaveAttribute('data-own', 'false');
  await expect(note).toContainText('19 Oct');
  await expect(note.getByTestId('team-log')).toContainText('Oma Lina sang Bengawan Solo for the group');
  await expect(note).toContainText('Dinar');
  await expect(note.getByTestId('note-open-day')).toContainText('19 Oct');
  await expect(page.getByTestId('survey-card')).toContainText('October check-in');
  await expect(page.getByTestId('lunch-feedback-row')).toHaveCount(0); // lunch feedback is for a day a parent came
  await noBookingUi(page);
  await assertNoHorizontalScroll(page);
  // there is no Messages tab and no in-app chat: "WhatsApp the club" is a real link to the front desk (Caca, the first lobby staff) on Contacts, which Me opens
  await expect(page.locator('[data-nav-key="chat"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /WhatsApp the club|Message the club/ })).toHaveCount(0);
  await goTab(page, 'me');
  await page.getByTestId('me-contacts').click();
  await expect(page).toHaveURL(/\/contacts$/);
  const wa = page.getByTestId('wa-club');
  await expect(wa).toBeVisible();
  await expect(wa).toHaveAttribute('href', 'https://wa.me/6281122013345');
  await expect(wa).toHaveAttribute('target', '_blank');
  await expect(wa).toHaveAttribute('rel', /noopener/);
  await expect(page.getByTestId('call-club')).toHaveAttribute('href', /^tel:\+?\d+$/);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

// ---------------------------------------------------------------- plan card (Billing → Plans)
test('Plan card (Billing): Flex counts visits from check-ins and states the extra-visit rule; Gold is "come any open day"', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 'f1', '/billing');
  const p = plan(page, 'm1');
  await expect(p).toHaveAttribute('data-plan', 'flex');
  await expect(p).toContainText('Oma Lina · Flex');
  await expect(p.getByTestId('plan-line')).toHaveText('10 of 10 visits used in October');
  // the rule: the next visit is an extra day, billed next month at the extra-day price
  await expect(p.getByTestId('extra-visits')).toHaveText('The next visit is an extra day · Rp 650.000 on the November invoice');
  await expect(p.getByRole('button')).toHaveCount(2); // nothing to book or cancel; a plan request and a leave request (the brochure's terms)
  await expect(p.getByTestId('plan-ask-link')).toHaveText('Ask the club to change the plan');
  await expect(p.getByTestId('leave-ask')).toBeVisible();
  // the visit bar is on her profile: 10 of 10
  await page.goto('/profile?member=m1');
  expect(await bar(page.getByTestId('pf-plan-card'))).toEqual({ total: 10, on: 10 });
  await expect(page.getByTestId('pf-plan-card')).toContainText('10 of 10 visits used');
  // Gold: no quota, no bar, no charge
  await page.goto('/billing');
  const g = plan(page, 'm46');
  await expect(g).toHaveAttribute('data-plan', 'gold');
  await expect(g).toContainText('Opa Budi · Gold');
  await expect(g.getByTestId('plan-line')).toHaveText('Any open day');
  await expect(g.getByTestId('extra-visits')).toHaveCount(0);
  await expect(g).not.toContainText('650.000');
  await page.goto('/profile?member=m46');
  const pc = page.getByTestId('pf-plan-card');
  await expect(pc).toContainText(/\d+ visits so far, any open day/);
  await expect(pc.getByRole('img')).toHaveCount(0);
  await expect(pc).not.toContainText('650.000');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('Plan request: Maria asks to switch Oma Lina to Gold, management sees it, she can withdraw it', async ({ page, request }) => {
  const c = watchConsole(page);
  await signIn(page, 'f1', '/billing');
  const p = plan(page, 'm1');
  await p.getByTestId('plan-ask-link').click();
  const dlg = sheet(page, 'Switch Oma Lina to Gold?');
  await expect(dlg).toContainText('Gold: come any open day for Rp 3.950.000 a month, with no extra-day charges. It starts on Sunday 1 November once the club confirms.');
  await dlg.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(dlg).toHaveCount(0);
  await expect(p.getByTestId('plan-request')).toContainText('Switch to Gold from Sun 1 Nov requested · waiting for the club');
  // management and finance have it to act on
  const items = async (uid: string) => (await (await request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': uid } })).json()).state.planChangeRequests;
  await expect.poll(async () => Object.values<{ memberId: string; status: string; to: string; deletedAt?: string }>(await items('s9')).filter((r) => r.memberId === 'm1' && r.status === 'pending' && !r.deletedAt).map((r) => r.to)).toEqual(['gold']);
  // she withdraws it; the link comes back
  await p.getByTestId('plan-withdraw').click();
  await expect(p.getByTestId('plan-request')).toHaveCount(0);
  await expect(p.getByTestId('plan-ask-link')).toBeVisible();
  // Daniel is not the payer: no request button for him
  await signIn(page, 'f2', '/billing');
  await expect(plan(page, 'm1')).toBeVisible();
  await expect(plan(page, 'm1').getByRole('button')).toHaveCount(0);
  c.assertClean();
});

test('Plan card: Bapak Bambang has used 8 of 10 visits, today included', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 'fm10_0', '/today');
  await expect(hero(page)).toHaveAttribute('data-mode', 'single'); // one parent: no both-parents card, nothing to switch
  await expect(page.getByTestId('parent-row')).toHaveCount(0);
  await expect(page.getByTestId('all-parents')).toHaveCount(0);
  await expect(hero(page)).toContainText('At the club since 09:48');
  await page.goto('/billing');
  await expect(plans(page)).toHaveCount(1);
  await expect(plans(page).getByTestId('plan-line')).toHaveText('8 of 10 visits used in October');
  await expect(plans(page).getByTestId('extra-visits')).toHaveCount(0);
  await page.goto('/profile?member=m10');
  expect(await bar(page.getByTestId('pf-plan-card'))).toEqual({ total: 10, on: 8 });
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

// ---------------------------------------------------------------- the lobby checks members in and out
test('Lobby checks Oma Lina in: Maria’s Today follows live, the 11th visit is an extra visit on the plan card and in Billing, and nobody "brought" her', async ({ page, request }) => {
  const c = watchConsole(page);
  await signIn(page, 'f1', '/today');
  await focusOn(page, 'm1');
  await expect(hero(page)).toContainText('Oma Lina isn’t at the club');
  expect(await board(request).then((b) => ids(b.inClub))).toEqual(['m10', 'm2', 'm20']);

  // the lobby checks her in with the door camera
  const r = await api(request, 's1', 'attendance.checkIn', { memberId: 'm1', method: 'face' });
  expect(r.ok()).toBe(true);
  expect((await r.json()).result).toMatchObject({ extra: true, visit: 11 });
  await expect(hero(page)).toContainText(/At the club since \d\d:\d\d/);
  await expect(hero(page)).not.toContainText('isn’t at the club');
  await expect(page.getByTestId('hero-rail')).toBeVisible(); // the day's steps over the picture
  const tl = page.getByTestId('timeline');
  await expect(tl.locator('[data-tl="health"]')).toContainText('Health check on arrival'); // her arrival is in the hero; the list holds what is still to come
  await expect(tl.locator('[data-tl="home"]')).toContainText('Home time');
  await expect(tl).toContainText('Keroncong sing-along');
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

  // Billing: the plan still reads 10 of 10 (never below zero), and the 11th visit is an extra day billed on the November invoice
  await page.goto('/billing');
  await expect(plan(page, 'm1').getByTestId('plan-line')).toHaveText('10 of 10 visits used in October');
  await expect(plan(page, 'm1').getByTestId('extra-visits')).toHaveText('1 extra visit this month · Rp 650.000 on the November invoice');
  await expect(plan(page, 'm46').getByTestId('extra-visits')).toHaveCount(0);
  // and her profile says which day it was
  await page.goto('/profile?member=m1');
  await expect(page.getByTestId('pf-plan-card')).toContainText('1 extra day this month · Rp 650.000 on next month’s invoice');
  await expect(page.locator('[data-testid="pf-month"] [data-date="2026-10-21"]')).toBeVisible();
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('Both mode follows the lobby: Oma Lina at the club since, Opa Budi not; then she goes home', async ({ page, request }) => {
  const c = watchConsole(page);
  await signIn(page, 'f1', '/today');
  const lina = row(page, 'm1');
  const budi = row(page, 'm46');
  await expect(lina).toContainText('Oma Lina isn’t at the club');
  expect((await api(request, 's1', 'attendance.checkIn', { memberId: 'm1', method: 'manual' })).ok()).toBe(true);
  await expect(lina).toContainText('Oma Lina is at the club');
  await expect(lina).toContainText(/Since \d\d:\d\d/);
  await expect(budi).toContainText('Opa Budi isn’t at the club');
  // she goes home: the day for her says so, with the real times
  expect((await api(request, 's1', 'attendance.checkOut', { memberId: 'm1' })).ok()).toBe(true);
  await expect(lina).toContainText('Oma Lina went home');
  await expect(lina).toContainText(/\d\d:\d\d–\d\d:\d\d/);
  await expect(lina).not.toContainText('is at the club');
  await expect(budi).toContainText('Opa Budi isn’t at the club');
  await noBookingUi(page);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('Home time shows the real time once the lobby checks Oma Lina out, without "collected by"', async ({ page, request }) => {
  const c = watchConsole(page);
  await signIn(page, 'f1', '/today');
  await focusOn(page, 'm1');
  expect((await api(request, 's1', 'attendance.checkIn', { memberId: 'm1', method: 'face' })).ok()).toBe(true);
  await expect(hero(page)).toContainText(/At the club since \d\d:\d\d/);
  expect((await api(request, 's1', 'attendance.checkOut', { memberId: 'm1' })).ok()).toBe(true);
  await expect(hero(page)).toContainText(/Home \d\d:\d\d/);
  await expect(hero(page)).not.toContainText('At the club since');
  const tl = page.getByTestId('timeline');
  const home = tl.locator('[data-tl="home"]');
  await expect(home).toHaveAttribute('data-state', 'done');
  await expect(home).toContainText('Home time');
  await expect(home).toContainText('Checked out by Caca');
  await expect(home).toContainText(/\d\d:\d\d/);
  const told = noticesFor(await snapshot(request, 'f1'), 'f1', 'notif.checkedOut');
  expect(told).toHaveLength(1);
  expect(Object.keys(told[0].params).sort()).toEqual(['name', 'time']);
  expect(translate('en', 'notif.checkedOut', told[0].params)).not.toMatch(/brought|collected/i);
  await noBookingUi(page);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('A Gold member is never charged: Opa Budi checks in and his plan only counts the visit', async ({ page, request }) => {
  const c = watchConsole(page);
  await signIn(page, 'f1', '/profile?member=m46');
  const pc = page.getByTestId('pf-plan-card');
  await expect(pc).toContainText(/\d+ visits so far, any open day/);
  const before = Number((await pc.textContent())!.match(/(\d+) visits so far/)![1]);
  const r = await api(request, 's1', 'attendance.checkIn', { memberId: 'm46', method: 'manual' });
  expect(r.ok()).toBe(true);
  expect((await r.json()).result).toMatchObject({ extra: false });
  await expect(pc).toContainText(`${before + 1} visits so far, any open day`);
  await expect(pc).not.toContainText('650.000');
  await page.goto('/billing');
  await expect(plan(page, 'm46')).toContainText('Opa Budi · Gold');
  await expect(plan(page, 'm46').getByTestId('extra-visits')).toHaveCount(0);
  await expect(plan(page, 'm46')).not.toContainText('650.000');
  await assertNoHorizontalScroll(page);
  await page.goto('/today');
  await expect(row(page, 'm46')).toContainText('Opa Budi is at the club');
  await focusOn(page, 'm46');
  await expect(hero(page)).toContainText(/At the club since \d\d:\d\d/);
  c.assertClean();
});

test('Laras: Bapak Bambang is at the club since 09:48; if the lobby undoes the check-in he is simply not at the club and the visit stops counting', async ({ page, request }) => {
  test.skip(!hasAction('attendance.undoCheckIn'), 'attendance.undoCheckIn (lobby) is not built yet');
  const c = watchConsole(page);
  await signIn(page, 'fm10_0', '/today');
  await expect(hero(page)).toContainText('At the club since 09:48');
  // the nurse's arrival reading is on Health: 122/73, Normal
  await goTab(page, 'health');
  await expect(page.getByTestId('health-hero')).toContainText('122/73');
  await page.goto('/billing');
  await expect(plan(page, 'm10').getByTestId('plan-line')).toHaveText('8 of 10 visits used in October');
  expect((await api(request, 's1', 'attendance.undoCheckIn', { memberId: 'm10' })).ok()).toBe(true);
  await expect(plan(page, 'm10').getByTestId('plan-line')).toHaveText('7 of 10 visits used in October');
  await page.goto('/profile?member=m10');
  expect(await bar(page.getByTestId('pf-plan-card'))).toEqual({ total: 10, on: 7 });
  await page.goto('/today');
  await expect(hero(page)).toContainText('Bapak Bambang isn’t at the club');
  await expect(hero(page)).not.toContainText('Usually arrives'); // KC round 8b
  await expect(hero(page)).not.toContainText('At the club since');
  const tl = page.getByTestId('timeline');
  await expect(tl.locator('[data-tl="arrival"]')).toHaveCount(0);
  await expect(tl.locator('[data-tl="health"]')).toHaveCount(0);
  await expect(tl).toContainText('Sop ikan kakap'); // the programme stays
  await noBookingUi(page);
  // the lobby's board follows: he is back on the check-in list
  expect(await board(request).then((b) => ids(b.others))).toContain('m10');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

// ---------------------------------------------------------------- billing (Me → Billing: the dark card, the plans, the invoices)
test('Maria pays an invoice (demo): one invoice from its sheet, then the rest on the card', async ({ page }) => {
  test.skip(!hasAction('payment.simulateVa'), 'payment.simulateVa (finance) is not built yet');
  const c = watchConsole(page);
  await signIn(page, 'f1', '/me');
  await expect(page.getByTestId('me-billing')).toContainText('Rp 6.650.000 due'); // Me says what is to pay
  await page.getByTestId('me-billing').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Billing' })).toBeVisible();
  const total = page.getByTestId('billing-total');
  await expect(total).toHaveAttribute('data-state', 'due');
  await expect(page.getByTestId('open-total')).toHaveText('Rp 6.650.000');
  await expect(openRows(page)).toHaveCount(2);
  await expect(total).toContainText('2 invoices');
  await expect(total).toContainText('To pay · due Wednesday 28 October');
  // the list shows six at a time: the open ones first, then the paid history, newest first
  await expect(page.getByTestId('invoice-row')).toHaveCount(6);
  await page.getByTestId('billing-more').click();
  expect(await page.getByTestId('invoice-row').count()).toBeGreaterThan(6);
  // the card pays inline: pick a bank, see the virtual account number, no pay sheet
  await total.getByRole('radio', { name: 'Mandiri' }).click();
  await expect(total.getByTestId('va-number')).toHaveText(/^8950 /);
  await total.getByRole('radio', { name: 'BCA' }).click();
  await expect(total.getByTestId('va-number')).toHaveText(/^3901 /);
  // pay Oma Lina's invoice only, from its own sheet
  const lina = page.locator('[data-testid="invoice-row"][data-invoice="INV-2610-001"]');
  await expect(lina).toContainText('Oma Lina · October');
  await expect(lina).toContainText('Due');
  await expect(plan(page, 'm1')).toContainText('10 of 10 visits used in October');
  await expect(plan(page, 'm46')).toContainText('Any open day');
  await lina.click();
  const dlg = sheet(page, /invoice$/);
  await expect(dlg).toContainText('INV-2610-001');
  await expect(dlg).toContainText('Rp 2.700.000');
  await dlg.getByRole('button', { name: 'Mandiri', exact: true }).click(); // the sheet's bank picker is a group of toggle buttons
  await dlg.getByRole('button', { name: 'Demo: simulate payment received' }).click();
  await expect(toast(page)).toContainText('Payment received. Receipt sent to Maria on WhatsApp.');
  await expect(openRows(page)).toHaveCount(1);
  await expect(page.getByTestId('open-total')).toHaveText('Rp 3.950.000');
  await expect(lina).toHaveAttribute('data-status', 'paid');
  await expect(lina).toContainText('Paid');
  await assertNoHorizontalScroll(page);
  // the last open invoice, paid on the card
  await expect(total).toContainText('Opa Budi · October');
  await total.getByTestId('simulate-pay').click();
  await expect(toast(page)).toContainText('Payment received');
  await expect(openRows(page)).toHaveCount(0);
  await expect(total).toHaveAttribute('data-state', 'paid');
  await goTab(page, 'today');
  await expect(page.getByTestId('invoice-card')).toHaveCount(0); // Today carries no bills
  c.assertClean();
});

test('Maria can pay every open invoice together from the Billing card', async ({ page }) => {
  test.skip(!hasAction('payment.simulateVa'), 'payment.simulateVa (finance) is not built yet');
  const c = watchConsole(page);
  await signIn(page, 'f1', '/billing');
  const all = page.getByTestId('billing-total');
  await expect(all).toContainText('Rp 6.650.000');
  await expect(all).toContainText('2 invoices');
  await expect(all.getByTestId('billing-pay')).toContainText('BCA VIRTUAL ACCOUNT'); // one combined account for both
  await all.getByRole('radio', { name: 'BNI' }).click();
  await expect(all.getByTestId('billing-pay')).toContainText('BNI VIRTUAL ACCOUNT');
  await all.getByTestId('simulate-pay').click();
  await expect(toast(page)).toContainText('Payment received');
  await expect(openRows(page)).toHaveCount(0);
  await expect(all).toHaveAttribute('data-state', 'paid');
  await expect(all).toContainText('Nothing to pay');
  await expect(all.getByTestId('billing-pay')).toHaveCount(0);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('Yohana sees the overdue September invoice and can pay it', async ({ page }) => {
  test.skip(!hasAction('payment.simulateVa'), 'payment.simulateVa (finance) is not built yet');
  const c = watchConsole(page);
  await signIn(page, 'fm20_0', '/billing');
  await expect(openRows(page)).toHaveCount(2);
  const sep = page.locator('[data-testid="invoice-row"][data-status="overdue"]');
  await expect(sep).toHaveCount(1);
  await expect(sep).toContainText('September');
  await expect(sep).toContainText('Overdue');
  await expect(sep).toContainText('INV-2609-020');
  await expect(page.getByTestId('open-total')).toHaveText('Rp 7.900.000');
  await expect(page.getByTestId('billing-total')).toHaveAttribute('data-state', 'overdue');
  await expect(page.getByTestId('billing-total')).toContainText('Overdue');
  await sep.click();
  await sheet(page, /invoice$/).getByRole('button', { name: 'Demo: simulate payment received' }).click();
  await expect(toast(page)).toContainText('Payment received');
  await expect(openRows(page)).toHaveCount(1);
  await expect(page.locator('[data-testid="invoice-row"][data-status="overdue"]')).toHaveCount(0);
  await expect(page.getByTestId('open-total')).toHaveText('Rp 3.950.000');
  await expect(page.getByTestId('billing-total')).toHaveAttribute('data-state', 'due');
  c.assertClean();
});

test('Only the primary contact pays: Daniel sees every invoice and who looks after billing', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 'f2', '/billing');
  await expect(openRows(page)).toHaveCount(2);
  await expect(page.getByTestId('billing-pay')).toHaveCount(0);
  await expect(page.getByTestId('simulate-pay')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Demo: simulate payment received' })).toHaveCount(0);
  await expect(page.getByTestId('payer-note')).toContainText('Maria Wijaya looks after billing');
  // an invoice opens for reading, with no way to pay it
  await page.locator('[data-testid="invoice-row"][data-invoice="INV-2610-001"]').click();
  await expect(sheet(page, /invoice$/)).toContainText('Maria Wijaya');
  await expect(page.getByRole('button', { name: 'Demo: simulate payment received' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  // Me says who pays rather than an amount due; Today has no bills
  await goTab(page, 'me');
  await expect(page.getByTestId('me-billing')).toContainText('Maria pays');
  await goTab(page, 'today');
  await expect(page.getByRole('button', { name: /^Pay Rp/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Pay by virtual account' })).toHaveCount(0);
  await expect(page.getByTestId('invoice-card')).toHaveCount(0);
  c.assertClean();
});

test('A member with no invoice gets an empty state, not a crash', async ({ page, request }) => {
  // every seeded member has six months of paid invoices now, so the club registers a new member: no invoice until the first run
  const made = await api(request, 's9', 'members.create', {
    title: 'Opa', name: 'Nol Faktur', dob: '1945-03-02', usualArrival: '11:00', plan: 'gold', start: TODAY,
    contact: { name: 'Keluarga Faktur', phone: '+62 812 9300 0001', relation: 'daughter', primary: true },
    formMediaId: 'md_e2eregistrationform0001', formFileName: 'registration-form.jpg', consent: { data: true, face: true },
  });
  expect(made.ok(), await made.text()).toBe(true);
  const { memberId, familyId } = (await made.json()).result as { memberId: string; familyId: string };
  expect(Object.values((await snapshot(request, 's9')).invoices as Record<string, { memberId: string }>).filter((i) => i.memberId === memberId)).toHaveLength(0);
  const c = watchConsole(page);
  await signIn(page, familyId, '/today');
  await expect(hero(page)).toBeVisible(); // Today renders without an invoice (bills are under Me)
  await expect(page.getByTestId('invoice-card')).toHaveCount(0);
  await page.goto('/billing');
  await expect(plans(page)).toHaveCount(1);
  await expect(plan(page, memberId)).toBeVisible();
  const total = page.getByTestId('billing-total');
  await expect(total).toHaveAttribute('data-state', 'empty');
  await expect(total).toContainText('No invoice yet');
  await expect(total).toContainText('First invoice on');
  await expect(page.getByTestId('invoice-row')).toHaveCount(0);
  await expect(total.getByTestId('billing-pay')).toHaveCount(0);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

// a member whose invoices are all paid: the history stays and "Nothing to pay" says so (the six months of seeded history)
test('A member whose invoices are all paid gets "Nothing to pay" and the history, not an empty state', async ({ page, request }) => {
  test.skip(!hasAction('invoice.void'), 'invoice.void (finance) is not built yet');
  for (const id of ['INV-2609-020', 'INV-2610-020']) expect((await api(request, 's10', 'invoice.void', { invoiceId: id, reason: 'e2e: no open invoice' })).ok()).toBe(true);
  const c = watchConsole(page);
  await signIn(page, 'fm20_0', '/billing');
  await expect(plans(page)).toHaveCount(1);
  const total = page.getByTestId('billing-total');
  await expect(total).toHaveAttribute('data-state', 'paid');
  await expect(total).toContainText('Nothing to pay');
  await expect(page.getByTestId('open-total')).toHaveText('Rp 0');
  await expect(openRows(page)).toHaveCount(0);
  await expect(page.locator('[data-testid="invoice-row"][data-invoice="INV-2608-020"]')).toContainText('Paid');
  await assertNoHorizontalScroll(page);
  await expect(page.getByTestId('invoice-row')).toHaveCount(4); // the four paid months, all on one page
  await expect(page.getByTestId('billing-more')).toHaveCount(0);
  await goTab(page, 'me');
  await expect(page.getByTestId('me-billing')).toContainText('All paid');
  c.assertClean();
});

// ---------------------------------------------------------------- photos and health
test('Photos: everyone’s days newest first, with memory cards and filters; a tile opens the viewer for families', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 'f1', '/photos');
  await expect(page.getByRole('heading', { level: 1, name: 'Photos' })).toBeVisible();
  await expect(page.getByRole('tablist')).toHaveCount(0); // Photos shows both parents: no member switch
  const days = page.getByTestId('photo-day');
  await expect(days.first()).toBeVisible();
  const dates = await days.evaluateAll((els) => els.map((e) => e.getAttribute('data-date')!));
  expect(dates).toEqual([...dates].sort().reverse());
  // one memory card per parent for the latest month (the monthly story)
  const cards = page.getByTestId('memory-card');
  await expect(cards.first()).toBeVisible();
  expect(new Set(await cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-member-id')))).size).toBe(2);
  // the filter chips only offer kinds that exist; picking one leaves only those pictures
  const filter = page.getByTestId('photo-filter');
  await expect(filter.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const all = await page.locator('[data-photo-id]').count();
  await expect(filter.getByRole('button', { name: 'Group', exact: true })).toHaveCount(0); // round 14: no Group chip (group pictures are Activities); the chips are All, Meals, Activities, Portraits
  await filter.getByRole('button', { name: 'Activities', exact: true }).click();
  await expect(page.locator('[data-photo-id]:not([data-kind="activity"]):not([data-kind="group"])')).toHaveCount(0);
  expect(await page.locator('[data-photo-id]').count()).toBeLessThan(all);
  await filter.getByRole('button', { name: 'All', exact: true }).click();
  await assertNoHorizontalScroll(page);
  await page.locator('[data-photo-id]').first().click();
  const viewer = page.getByTestId('family-viewer');
  await expect(viewer).toBeVisible();
  await expect(viewer.getByTestId('viewer-count')).toContainText(/^1 of \d+$/);
  // families get no staff actions (hide, retag, remove)
  for (const staff of [/Hide/i, /Retag|Tag/i, /Remove|Delete/i]) await expect(viewer.getByRole('button', { name: staff })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(viewer).toHaveCount(0);
  c.assertClean();
});

test('Photos: activity pictures show for the days a member came, labelled with the activity; a family whose member did not come gets none until one checks in', async ({ page, request }) => {
  const c = watchConsole(page);
  // management adds approved pictures of today's two sessions (activity is for the activity: nobody is tagged)
  // (KC round 9: families only see photos with a real picture, so these carry one)
  for (const [i, activity] of ['Keroncong sing-along', 'Batik painting'].entries()) expect((await api(request, 's9', 'photo.addActivity', { date: TODAY, activity, mediaId: i ? 'md_demo_act-batik-1' : 'md_demo_act-keroncong-1' })).ok(), String(i)).toBe(true);
  // Bambang came today: his family sees the day's pictures, each named after its activity, and they open in the viewer
  await signIn(page, 'fm10_0', '/photos');
  const day = page.locator(`[data-testid="photo-day"][data-date="${TODAY}"]`);
  await expect(day).toBeVisible();
  await expect(day.getByRole('button', { name: /^Keroncong sing-along, \d\d:\d\d, activity picture$/ })).toHaveCount(1);
  await expect(day.getByRole('button', { name: /^Batik painting, \d\d:\d\d, activity picture$/ })).toHaveCount(1);
  await assertNoHorizontalScroll(page);
  await day.getByRole('button', { name: /^Batik painting, \d\d:\d\d, activity picture$/ }).click();
  const viewer = sheet(page, 'Batik painting');
  await expect(viewer).toBeVisible();
  await expect(viewer.getByTestId('viewer-label')).toHaveText('Batik painting');
  await expect(viewer.getByRole('button', { name: /Edit tags|Hide from families|Remove photo|Approve/ })).toHaveCount(0); // families get no staff actions
  await page.keyboard.press('Escape');
  // in Indonesian the activity names follow the catalogue
  await signIn(page, 'fm10_0', '/photos', 'id');
  await expect(page.locator(`[data-testid="photo-day"][data-date="${TODAY}"]`).getByRole('button', { name: /^Bernyanyi keroncong, \d\d:\d\d/ })).toHaveCount(1);
  // Maria's members (Oma Lina, Opa Budi) did not come today: no picture of today in her data, none of today on her page (the seeded past weeks are theirs: they came then)…
  const todays = async () => Object.values((await snapshot(request, 'f1')).photos as Record<string, { kind: string; date: string }>).filter((p) => p.kind === 'activity' && p.date === TODAY);
  expect(await todays()).toHaveLength(0);
  await signIn(page, 'f1', '/photos');
  await expect(page.getByTestId('photo-day').first()).toBeVisible();
  const today = page.locator(`[data-testid="photo-day"][data-date="${TODAY}"]`);
  await expect(today.getByRole('button', { name: /activity picture$/ })).toHaveCount(0);
  // …until the lobby checks Oma Lina in: any check-in that day is enough, and her page follows live
  expect((await api(request, 's1', 'attendance.checkIn', { memberId: 'm1', method: 'manual' })).ok()).toBe(true);
  await expect(today.getByRole('button', { name: /^Keroncong sing-along, \d\d:\d\d, activity picture$/ })).toBeVisible();
  await expect(today.getByRole('button', { name: /^Batik painting, \d\d:\d\d, activity picture$/ })).toBeVisible();
  expect(await todays()).toHaveLength(2);
  c.assertClean();
});

test('Photos: a family with a single member sees that member’s photos and memories only', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 'fm10_0', '/photos');
  await expect(page.getByTestId('photo-day').first()).toBeVisible();
  await expect(page.getByRole('tablist')).toHaveCount(0);
  const cards = page.getByTestId('memory-card');
  await expect(cards.first()).toBeVisible();
  expect(Array.from(new Set(await cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-member-id')))))).toEqual(['m10']);
  await expect(page.getByTestId('photos-empty')).toHaveCount(0);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('The door camera’s arrival picture is the club’s record, not a family photo', async ({ page, request }) => {
  const c = watchConsole(page);
  await signIn(page, 'f1', '/photos');
  await expect(page.getByTestId('photo-day').first()).toBeVisible();
  const count = () => page.locator('[data-photo-id]').count();
  const before = await count();
  expect(before).toBeGreaterThan(0);
  expect((await api(request, 's1', 'attendance.checkIn', { memberId: 'm1', method: 'face' })).ok()).toBe(true);
  const state = await snapshot(request, 'f1');
  expect(Object.values(state.photos as Record<string, { kind: string; memberIds: string[]; date: string }>).some((x) => x.kind === 'arrival' && x.memberIds.includes('m1') && x.date === TODAY)).toBe(true);
  await page.reload();
  await expect(page.getByTestId('photo-day').first()).toBeVisible();
  expect(await count()).toBe(before);
  c.assertClean();
});

test('Health shows the parent you chose: Opa Budi’s Health is Opa Budi’s', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 'f1', '/health');
  const health = page.getByTestId('family-health');
  await expect(health).toHaveAttribute('data-member-id', 'm1'); // "Both" shows the first parent
  const rings = health.locator('button[data-member]');
  await expect(rings).toHaveCount(2); // avatar rings, no "Both" on Health
  await expect(health.locator('button[data-member="m1"]')).toHaveAttribute('aria-pressed', 'true');
  await health.locator('button[data-member="m46"]').click();
  await expect(health).toHaveAttribute('data-member-id', 'm46');
  await expect(page.getByTestId('health-hero')).toHaveAccessibleName('Blood pressure history for Opa Budi');
  await page.reload();
  await expect(health).toHaveAttribute('data-member-id', 'm46');
  await expect(health.locator('button[data-member="m46"]')).toHaveAttribute('aria-pressed', 'true');
  // a deep link picks the parent, then the URL is clean
  await page.goto('/health?member=m1');
  await expect(health).toHaveAttribute('data-member-id', 'm1');
  await expect(page).toHaveURL(/\/health$/);
  // Today's parent card opens that parent's profile, and Health follows the parent chosen there
  await page.goto('/today');
  await expect(hero(page)).toHaveAttribute('data-member', 'm1'); // the choice is shared: Health's deep link chose Oma Lina
  await page.getByTestId('all-parents').click();
  await expect(hero(page)).toHaveAttribute('data-mode', 'both');
  await focusOn(page, 'm46');
  await expect(page.getByTestId('hero-plan')).toHaveText('Gold plan'); // KC round 9: the plan under the name
  await page.getByTestId('hero-profile').click();
  await expect(page).toHaveURL(/\/profile\?member=m46$/);
  await expect(page.getByTestId('family-profile')).toContainText('Opa Budi');
  // KC round 9: the parent's page opens like Today — their picture (the demo's stock portrait) on top with the panel over it; a slim bar docks once scrolled
  await expect(page.getByTestId('pf-cover')).toHaveAttribute('data-cover', 'photo');
  await expect(page.getByTestId('pf-cover').getByRole('heading', { level: 1 })).toHaveText('Opa Budi');
  await page.getByTestId('pf-jump').getByRole('button', { name: 'Plan' }).click();
  await expect(page.getByTestId('pf-bar')).toHaveAttribute('data-docked', 'true');
  await expect(page.getByTestId('pf-bar-back')).toBeVisible();
  await goTab(page, 'health');
  await expect(health).toHaveAttribute('data-member-id', 'm46');
  // the tiles and the way into the history
  await expect(page.getByTestId('health-tile-pulse')).toBeVisible();
  await page.getByTestId('health-history').click();
  await expect(page).toHaveURL(/\/history\?member=m46$/);
  await expect(page.getByTestId('history-summary')).toHaveAttribute('data-metric', 'bp');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

// ---------------------------------------------------------------- survey, lunch, the team note
test('Survey: Maria answers it from Today (and from the notification link)', async ({ page }) => {
  test.skip(!hasAction('survey.answer'), 'survey.answer (club) is not built yet');
  const c = watchConsole(page);
  await signIn(page, 'f1', '/today?survey=1');
  const dlg = sheet(page, 'Quick survey');
  await expect(dlg).toBeVisible();
  await expect(page).toHaveURL(/\/today$/);
  await expect(dlg.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
  await dlg.getByRole('group', { name: 'Overall' }).getByRole('button', { name: '5 of 5' }).click();
  await dlg.getByRole('button', { name: 'Yes' }).click();
  await dlg.getByLabel('Anything we could do better?').fill('More photos please');
  await dlg.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(toast(page)).toContainText('Thank you. Your answers went to the club team.');
  await expect(page.getByTestId('survey-card')).toContainText('Thank you. Your answers went to the club team.');
  await expect(page.getByTestId('survey-card').getByRole('button')).toHaveCount(0);
  c.assertClean();
});

test('Lunch: feedback goes to the kitchen and comes back as a reply; the allergy line follows the kitchen’s plan', async ({ page, request }) => {
  test.skip(!hasAction('feedback.submit'), 'feedback.submit (kitchen) is not built yet');
  const c = watchConsole(page);
  await signIn(page, 'fm10_0', '/today');
  const tl = page.getByTestId('timeline');
  // Bapak Bambang is allergic to seafood and today's lunch has fish soup: no reassurance until the kitchen serves an alternative
  await expect(tl).toContainText('Sop ikan kakap');
  await expect(tl).not.toContainText('today’s menu is clear');
  await expect(tl).not.toContainText('allergy on file');
  const row = page.getByTestId('lunch-feedback-row');
  await expect(row).toContainText('Tell the kitchen about lunch');
  await row.click();
  const dlg = sheet(page, 'Lunch feedback');
  await expect(dlg).toContainText('Sop ikan kakap'); // what was served, named in the sheet's line
  await expect(dlg.getByRole('button', { name: 'Send', exact: true })).toBeDisabled(); // nothing to send yet
  await dlg.getByTestId('fb-change').click(); // pick the dish
  await dlg.getByRole('button', { name: 'Sop ikan kakap', exact: true }).click();
  await dlg.getByLabel('What would you like the kitchen to know?').fill('The soup was a little salty again.');
  await dlg.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(toast(page)).toContainText('Thank you. The kitchen team’s reply will appear on your Today, under Lunch feedback.');
  const state = await snapshot(request, 's3');
  const fb = Object.values(state.feedback as Record<string, { id: string; memberId: string; dish: string; text: string; mealDate: string; source: string }>).find((f) => f.text.includes('a little salty again'));
  expect(fb).toMatchObject({ memberId: 'm10', dish: 'Sop ikan kakap', mealDate: TODAY, source: 'family' });
  // it sits under Lunch feedback, waiting for the kitchen; the row says it was sent
  const mine = page.locator(`[data-feedback="${fb!.id}"]`);
  await expect(mine).toHaveAttribute('data-status', 'open');
  await expect(mine).toContainText('a little salty again');
  await expect(mine).toContainText('Waiting for the kitchen');
  await expect(row).toContainText('Sent · the kitchen will reply here');
  // the kitchen replies: the reply shows right there, in the app
  const reply = await api(request, 's3', 'feedback.reply', { feedbackId: fb!.id, text: 'Thank you, we will use less salt.' });
  expect(reply.ok(), await reply.text()).toBe(true);
  await expect(mine.getByTestId('kitchen-reply')).toContainText('Thank you, we will use less salt.');
  await expect(mine).toHaveAttribute('data-status', 'answered');
  await expect(row).toContainText('The kitchen replied');
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
  await expect(hero(page)).toContainText('Bapak Bambang isn’t at the club');
  await expect(tl).toContainText('Sop ikan kakap');
  await expect(tl).not.toContainText('today’s menu is clear');
  c.assertClean();
});

test('Team note: the latest note shows its text and who wrote it, with no comment box; messaging the club is WhatsApp only', async ({ page, request }) => {
  const c = watchConsole(page);
  await signIn(page, 'f1', '/today');
  await focusOn(page, 'm1');
  const log = page.getByTestId('team-log');
  await expect(log).toContainText(/Oma Lina had a \w+ day|“/);
  await expect(page.getByTestId('team-note')).toContainText('Dinar');
  await expect(log.getByLabel(/^Comment/)).toHaveCount(0);
  await expect(page.getByTestId('team-note').getByRole('button', { name: 'Send' })).toHaveCount(0);
  await expect(page.getByTestId('log-comment')).toHaveCount(0);
  // nothing is stored in Messages, and the old message actions are gone
  const state = await snapshot(request, 'f1');
  expect(Object.keys(state.messages)).toHaveLength(0);
  expect(Object.keys(state.threads)).toHaveLength(0);
  const r = await api(request, 'f1', 'message.send', { memberId: 'm1', topic: 'care', text: 'Hello' });
  expect(r.status()).toBe(422);
  expect((await r.json()).code).toBe('err.unknownAction');
  // an old /chat link lands on Today
  await page.goto('/chat');
  await expect(page).toHaveURL(/\/today$/);
  // the club's WhatsApp is a link that opens a chat with the front desk number (Contacts, and each family contact on a parent's profile)
  await page.goto('/contacts');
  await expect(page.getByTestId('wa-club')).toHaveAttribute('href', 'https://wa.me/6281122013345');
  c.assertClean();
});

// ---------------------------------------------------------------- timeline states
test('The timeline follows the clock for a member in the club, and every approved lunch photo appears (the kitchen\'s pending one does not)', async ({ page, request }) => {
  const c = watchConsole(page);
  expect((await request.post('/api/demo/clock', { data: { hm: '12:05' } })).ok()).toBe(true);
  await signIn(page, 'fm20_0', '/today');
  const tl = page.getByTestId('timeline');
  // the hero's steps follow the clock: the morning session is done, lunch is on now, the afternoon is still to come
  const step = (id: string) => page.getByTestId('hero-rail').locator(`[data-step="${id}"]`);
  await expect(step('session-10:30')).toHaveAttribute('data-state', 'done');
  await expect(step('lunch')).toHaveAttribute('data-state', 'now');
  await expect(step('session-13:30')).toHaveAttribute('data-state', 'up');
  // "Next" lists what is still to come: what is over has dropped off
  await expect(tl).toHaveAttribute('data-kind', 'next');
  await expect(tl.locator('[data-tl="session-10:30"]')).toHaveCount(0);
  await expect(tl.locator('[data-tl="lunch"]')).toHaveAttribute('data-state', 'now');
  await expect(tl.locator('[data-tl="lunch"]')).toContainText('NOW');
  await expect(tl.locator('[data-tl="session-13:30"]')).toHaveAttribute('data-state', 'up');
  await expect(page.getByTestId('lunch-photos')).toHaveCount(0);
  if (hasAction('menu.postLunchPhoto')) {
    // the kitchen's photo waits for approval: the family sees nothing; management's two go live, one after the other
    expect((await api(request, 's3', 'menu.postLunchPhoto', { date: TODAY, mediaId: 'md_demo_food-tahu' })).ok()).toBe(true);
    await expect(page.getByTestId('lunch-photos')).toHaveCount(0);
    expect((await api(request, 's9', 'menu.postLunchPhoto', { date: TODAY, mediaId: 'md_demo_food-rawon' })).ok()).toBe(true);
    await expect(page.getByTestId('lunch-photos')).toHaveAttribute('data-count', '1');
    await expect(page.getByTestId('lunch-photos')).toHaveAttribute('aria-label', /^View image · Lunch/); // KC round 9: the picture itself sits on the row
    expect((await api(request, 's9', 'menu.postLunchPhoto', { date: TODAY, notify: false, mediaId: 'md_demo_food-gado' })).ok()).toBe(true);
    await expect(page.getByTestId('lunch-photos')).toHaveAttribute('data-count', '2'); // live: all the approved photos of the day
    await expect(page.getByTestId('lunch-photos')).toHaveAttribute('aria-label', /^View 2 images · Lunch/);
    await page.getByTestId('lunch-photos').click(); // opens the row's pictures underneath
    await expect(page.getByTestId('lunch-photos-open').locator('[data-photo-id]')).toHaveCount(2);
    await page.getByTestId('lunch-photos-open').locator('[data-photo-id]').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
  }
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('Before the member arrives nothing is "now": what is over drops off the list as time passes, the rest still to come', async ({ page, request }) => {
  const c = watchConsole(page);
  expect((await request.post('/api/demo/clock', { data: { hm: '12:05' } })).ok()).toBe(true);
  await signIn(page, 'f1', '/today');
  await focusOn(page, 'm1');
  const tl = page.getByTestId('timeline');
  await expect(hero(page)).toContainText('Oma Lina isn’t at the club');
  // KC round 6: what is over is passed even when she is not in; lunch is running, but it is not "now" for someone who is not there
  await expect(tl.locator('[data-tl="session-10:30"]')).toHaveCount(0);
  for (const id of ['lunch', 'session-13:30', 'tea']) await expect(tl.locator(`[data-tl="${id}"]`)).toHaveAttribute('data-state', 'up');
  await expect(tl).not.toContainText('NOW');
  c.assertClean();
});

test('Once the club has closed for the day, "not at the club" is final: "is home today"', async ({ page, request }) => {
  const c = watchConsole(page);
  expect((await request.post('/api/demo/clock', { data: { hm: '16:45' } })).ok()).toBe(true); // the club closes at 16:30
  await signIn(page, 'f1', '/today');
  for (const [id, who] of [['m1', 'Oma Lina'], ['m46', 'Opa Budi']]) {
    await expect(row(page, id)).toContainText(`${who} is home today`);
    await expect(row(page, id)).not.toContainText('isn’t at the club');
  }
  await focusOn(page, 'm1');
  await expect(hero(page)).toContainText('Oma Lina is home today');
  await expect(hero(page)).not.toContainText('Usually arrives'); // KC round 8b
  await noBookingUi(page);
  await toId(page);
  await expect(hero(page)).toContainText('Oma Lina di rumah hari ini');
  await expect(hero(page)).not.toContainText('sedang tidak di klub');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('A closed day shows "Club closed" instead of a timeline', async ({ page, request }) => {
  test.skip(!hasAction('calendarEvent.create'), 'calendarEvent.create (schedule) is not built yet');
  const c = watchConsole(page);
  const r = await api(request, 's9', 'calendarEvent.create', { date: TODAY, kind: 'closed', title: 'Club closed: water supply repair' });
  expect(r.ok()).toBe(true);
  await signIn(page, 'f1', '/today');
  await expect(hero(page)).toHaveAttribute('data-mode', 'status'); // one calm card for both parents
  await expect(hero(page)).toContainText('Club closed today');
  await expect(hero(page).getByTestId('hero-sub')).toContainText('Club closed: water supply repair');
  await expect(page.getByTestId('timeline')).toHaveCount(0);
  await expect(page.getByTestId('lunch-feedback-row')).toHaveCount(0);
  await noBookingUi(page);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('A scheduled last day shows on her profile; the plan card stays in Billing', async ({ page, request }) => {
  test.skip(!hasAction('members.end'), 'members.end (members) is not built yet');
  const end = await api(request, 's9', 'members.end', { memberId: 'm1', lastDay: '2026-10-28', reason: 'movedAway' });
  expect(end.ok()).toBe(true);
  const c = watchConsole(page);
  await signIn(page, 'f1', '/today');
  await focusOn(page, 'm1');
  await expect(hero(page)).toContainText('Oma Lina isn’t at the club'); // still a member until the last day
  await noBookingUi(page);
  await assertNoHorizontalScroll(page);
  await page.goto('/profile?member=m1');
  await expect(page.getByTestId('pf-plan')).toContainText('Membership');
  await expect(page.getByTestId('pf-plan')).toContainText('Ends 28 October 2026');
  await page.goto('/billing');
  await expect(plan(page, 'm1').getByTestId('plan-line')).toHaveText('10 of 10 visits used in October');
  c.assertClean();
});

// ---------------------------------------------------------------- Indonesian
const RAW = /\b(family|common|status|nav|err|roles|lobby|health|inv|finance|chat|notif|feed|kitchen|mgmt|shell|fam|ftoday|fphotos|fcal|fhealth|fme|cal|profile)\.[A-Za-z_][A-Za-z_.]*/;
test('Indonesian: toggling the language shows no raw keys on any family screen or sheet, including after the lobby checks Oma Lina in', async ({ page, request }) => {
  const c = watchConsole(page);
  await signIn(page, 'f1', '/today');
  await toId(page);
  await expect(page.getByTestId('today-header')).toBeVisible();
  const body = async () => page.evaluate(() => document.body.innerText);
  const clean = async (label: string) => { const text = await body(); expect(text, label).not.toMatch(RAW); };
  await clean('today both');
  await expect(row(page, 'm1')).toContainText('Oma Lina sedang tidak di klub');
  await expect(row(page, 'm1')).not.toContainText('Biasanya tiba'); // KC round 8b: no "usually arrives" on Today
  await focusOn(page, 'm1');
  await expect(page.getByTestId('timeline')).toContainText('Dapur mencatat alergi kerang-kerangan Oma Lina; menu hari ini aman.');
  await expect(page.getByTestId('all-parents')).toHaveAttribute('aria-label', 'Kedua orang tua');
  await clean('today lina');
  // the lobby checks her in: the 11th visit is an extra visit, all in Indonesian
  expect((await api(request, 's1', 'attendance.checkIn', { memberId: 'm1', method: 'face' })).ok()).toBe(true);
  await expect(hero(page)).toContainText(/Di klub sejak \d\d:\d\d/);
  await expect(page.getByTestId('timeline')).toContainText('Cek kesehatan saat tiba');
  await clean('today lina in the club');
  // the family notice is translated too
  const told = noticesFor(await snapshot(request, 'f1'), 'f1', 'notif.checkedIn');
  expect(translate('id', 'notif.checkedIn', told[0].params)).toMatch(/^Oma Lina check-in pukul \d\d:\d\d\.$/);
  expect(translate('id', 'notif.checkedIn', told[0].params)).not.toMatch(RAW);
  // the sheets: the bell, lunch feedback (a parent is at the club now), the survey
  await page.getByTestId('fam-bell').click();
  await expect(page.getByTestId('fam-notifications')).toContainText('Tiba di klub');
  await clean('notifications');
  await page.keyboard.press('Escape');
  await page.getByTestId('lunch-feedback-row').click();
  await expect(sheet(page, 'Masukan makan siang')).toBeVisible();
  await clean('feedback sheet');
  await page.keyboard.press('Escape');
  await page.getByTestId('survey-card').getByRole('button', { name: 'Isi survei' }).click();
  await expect(sheet(page, 'Survei singkat')).toBeVisible();
  await clean('survey sheet');
  await page.keyboard.press('Escape');
  await assertNoHorizontalScroll(page);
  // photos, health, calendar, me: in-app navigation keeps the language
  await goTab(page, 'photos');
  await expect(page.getByRole('heading', { level: 1, name: 'Foto' })).toBeVisible();
  await expect(page.getByTestId('photo-day').first()).toBeVisible();
  await clean('photos');
  await goTab(page, 'calendar');
  await expect(page.getByTestId('cal-view')).toContainText('Bulan');
  await clean('calendar');
  await goTab(page, 'health');
  await expect(page.getByTestId('family-health')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Kesehatan' })).toBeVisible();
  await clean('health');
  await goTab(page, 'me');
  await expect(page.getByTestId('me-language')).toContainText('Bahasa Indonesia');
  await clean('me');
  await page.getByTestId('me-billing').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Tagihan' })).toBeVisible();
  await expect(page.getByTestId('billing-total')).toContainText('Harus dibayar');
  await expect(plan(page, 'm1')).toContainText('Oma Lina · Flex');
  await expect(plan(page, 'm1').getByTestId('plan-line')).toHaveText('10 dari 10 kunjungan terpakai di Oktober');
  await expect(plan(page, 'm1').getByTestId('extra-visits')).toHaveText('1 kunjungan tambahan bulan ini · Rp 650.000 di tagihan November');
  await expect(plan(page, 'm46').getByTestId('plan-line')).toHaveText('Setiap hari buka');
  await expect(plan(page, 'm1').getByTestId('plan-ask-link')).toHaveText('Minta klub mengubah paket');
  await clean('billing');
  await page.locator('[data-testid="invoice-row"][data-invoice="INV-2610-001"]').click();
  await expect(sheet(page, /^Tagihan /)).toContainText('Demo: simulasikan pembayaran diterima');
  await clean('invoice sheet');
  await page.keyboard.press('Escape');
  await page.getByTestId('plan-ask-link').first().click();
  await expect(sheet(page, 'Pindahkan Oma Lina ke paket Gold?')).toBeVisible();
  await clean('plan sheet');
  await page.keyboard.press('Escape');
  await assertNoHorizontalScroll(page);
  await page.goto('/profile?member=m1');
  await expect(page.getByTestId('family-profile')).toBeVisible();
  await clean('profile');
  await page.goto('/contacts');
  await expect(page.getByTestId('wa-club')).toContainText('WhatsApp');
  await clean('contacts');
  c.assertClean();
});

test('Indonesian: signing in as Yohana, a Gold member’s day reads in Indonesian and the old booking words are gone', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 'fm20_0', '/today', 'id');
  await expect(hero(page)).toHaveAttribute('data-mode', 'single');
  await expect(hero(page)).toContainText('Di klub sejak 09:38');
  const text = await page.evaluate(() => document.body.innerText);
  expect(text).not.toMatch(RAW);
  expect(text).not.toMatch(/Pesan hari|Atur cuti|Tidak datang hari ini|Datang terlambat|Dijadwalkan|diantar|Diantar|dijemput|Dijemput/);
  await assertNoHorizontalScroll(page);
  await page.goto('/billing');
  await expect(plans(page)).toHaveCount(1);
  await expect(plans(page)).toContainText('Gold');
  await expect(plans(page).getByTestId('plan-line')).toHaveText('Setiap hari buka');
  await expect(plans(page)).not.toContainText('650.000');
  expect(await page.evaluate(() => document.body.innerText)).not.toMatch(RAW);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

// ---------------------------------------------------------------- KC round 9: fewer taps
test('KC round 9: the Photos feed (posts, thumbnails, feed or gallery), the back gesture closes the viewer and sheets, a one-tap parent switch, the opened-out picture and tomorrow’s plan', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 'f1', '/photos');
  // a feed of posts: big pictures, each post's pictures as thumbnails underneath; a thumbnail brings its picture up
  const post = page.getByTestId('photo-post').filter({ has: page.getByTestId('post-thumbs') }).first();
  await expect(post).toBeVisible();
  await post.getByTestId('post-thumbs').locator('button').nth(1).click();
  await expect(post.getByTestId('post-thumbs').locator('button').nth(1)).toHaveAttribute('aria-current', 'true');
  // a picture opens full screen; the phone's back gesture closes it and the page stays
  await post.locator('[data-photo-id]').first().click();
  await expect(page.getByTestId('family-viewer')).toBeVisible();
  await page.waitForTimeout(150); // the overlay's history entry
  await page.goBack();
  await expect(page.getByTestId('family-viewer')).toHaveCount(0);
  await expect(page).toHaveURL(/\/photos$/);
  // the floating button switches to the gallery of tiles and back
  await page.getByTestId('photo-view-toggle').click();
  await expect(page.getByTestId('photo-feed')).toHaveAttribute('data-view', 'grid');
  await expect(page.getByTestId('photo-post')).toHaveCount(0);
  await page.getByTestId('photo-view-toggle').click();
  await expect(page.getByTestId('photo-feed')).toHaveAttribute('data-view', 'feed');
  // no placeholder ever reaches the family
  const ids = await page.locator('[data-testid="photo-feed"] [data-photo-id]').count();
  expect(ids).toBeGreaterThan(0);
  // Today: one tap from Oma to Opa and back to both
  await page.goto('/today');
  await page.getByTestId('parent-switch').locator('[data-member="m46"]').click();
  await expect(hero(page)).toHaveAttribute('data-member', 'm46');
  await page.getByTestId('parent-switch').locator('[data-member="m1"]').click();
  await expect(hero(page)).toHaveAttribute('data-member', 'm1');
  await page.getByTestId('all-parents').click();
  await expect(hero(page)).toHaveAttribute('data-mode', 'both');
  // the top picture opens out (the day moves down), swipes through the latest pictures, and folds back
  if (await page.getByTestId('hero-open').count()) {
    await page.getByTestId('hero-open').click();
    await expect(page.getByTestId('hero-open')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('hero-slides').locator('[data-photo-id]').first()).toBeVisible();
    await page.getByTestId('hero-slides').locator('[data-photo-id]').first().click();
    await expect(page.getByTestId('hero-open')).toHaveAttribute('aria-expanded', 'false');
  }
  // the day ahead: the dashed chip opens tomorrow's plan
  const ahead = page.locator('[data-testid="day-strip"] [data-plan]');
  await expect(ahead).toBeVisible();
  await ahead.click();
  await expect(page.getByTestId('timeline')).toHaveAttribute('data-kind', 'plan');
  await expect(page.getByTestId('timeline')).toContainText(/Tomorrow’s plan|Plan for /);
  await expect(page.getByTestId('timeline').locator('[data-state="done"]')).toHaveCount(0); // nothing of it is done yet
  // "View calendar" opens the calendar on that day
  const day = (await page.getByTestId('timeline').getAttribute('data-day'))!;
  await page.getByTestId('view-calendar').click();
  await expect(page).toHaveURL(new RegExp(`/calendar\\?date=${day}`));
  // a sheet closes with the back gesture too
  await page.goto('/me');
  await page.getByTestId('me-details').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.waitForTimeout(150);
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/me$/);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});
