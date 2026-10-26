// Calendar area: the next-3-days list (with "Edit activity"), month view (a date opens its week in the schedule), management events editor (notify toggle),
// weekly schedule builder by week (versions, date under each day, quick remove, tap-to-place, dated publish with notify), catalog editor (room "Other"),
// events and the catalog are management only; round 14: an activity teacher builds too, and what she changes is sent to Ega (the server keeps her out of events and the catalog),
// family read-only view (no venue clients), Indonesian, no console errors, no horizontal scroll.
// Isolated env: pnpm e2e:env activity 8805 5205 ; E2E_BASE_URL=http://localhost:5205 pnpm exec playwright test e2e/calendar.spec.ts
import { test, expect, type Browser, type Page } from '@playwright/test';
import { resetDemo, signIn, watchConsole, isPhone, assertNoHorizontalScroll } from './helpers';
import { fieldText, goToPage, pickDate, pickOption, pickTime } from './kit';

/** Reset the demo data and pin the shared clock to 09:58 (Wed 21 Oct 2026). */
test.beforeEach(async ({ request }) => {
  await resetDemo(request);
  const r = await request.post('/api/demo/clock', { data: { hm: '09:58', allowBack: true } });
  expect(r.ok()).toBeTruthy();
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type State = Record<string, Record<string, any>>;
/** What a user's browser receives (the family projection for family users). */
async function snapshot(page: Page, uid: string): Promise<State> {
  const r = await page.request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': uid } });
  expect(r.ok()).toBeTruthy();
  return (await r.json()).state;
}
/** Run an action straight on the API as a user (the call the app makes); returns the HTTP status and the error code, if any. */
async function rawAct(page: Page, uid: string, name: string, input: object, mutationId: string) {
  const r = await page.request.post(`/api/actions/${name}`, { headers: { 'x-user-id': uid }, data: { mutationId, club: 'citra', input } });
  return { status: r.status(), code: ((await r.json().catch(() => ({}))) as { code?: string }).code };
}
/** No horizontal scroll, measured once the fonts are in (before the icon font loads, icon names briefly render as long words). */
async function noHScroll(page: Page) {
  await page.evaluate(async () => { await document.fonts.load("20px 'Material Symbols Rounded'"); await document.fonts.load('16px Inter'); await document.fonts.ready; });
  await assertNoHorizontalScroll(page);
}
const RAW_KEY = /\b(activity|cal|common|nav|status|lobby)\.[A-Za-z_]+/;
const VENUE_CLIENTS = /Arunika|Rotary|Bank Prima|Santi Wirjo|Arief Sudarmo|Teddy Haris/;
const block = (page: Page, date: string) => page.locator(`div[data-date="${date}"]`);
const cell = (page: Page, date: string) => page.locator(`button[data-date="${date}"]`);
/** What a day shows: laptop and tablet cells list the day's items; a phone's cell is a number and dots only, so the item is read from the day's list under the grid (tap to open, tap again to close). */
async function cellHas(page: Page, date: string, text: string) {
  if (!isPhone(page)) { await expect(cell(page, date)).toContainText(text); return; }
  await expect(cell(page, date)).not.toContainText(text);
  await cell(page, date).click();
  await expect(block(page, date)).toContainText(text);
  await cell(page, date).click();
  await expect(block(page, date)).toHaveCount(0);
}
const publishPage = (page: Page) => page.getByRole('button', { name: 'Publish to staff and families' });
async function openBuilder(page: Page) {
  await page.getByRole('heading', { name: 'Weekly schedule' }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('heading', { name: 'Weekly schedule' })).toBeVisible();
}
/** Another signed-in user in their own browser context (same device settings as the running project), so sessions never mix. */
async function otherUser(browser: Browser, uid: string, path: string, lang: 'en' | 'id' = 'en') {
  const o = test.info().project.use as Record<string, unknown>;
  const ctx = await browser.newContext({ baseURL: o.baseURL as string, viewport: o.viewport as { width: number; height: number }, hasTouch: o.hasTouch as boolean | undefined, isMobile: o.isMobile as boolean | undefined, deviceScaleFactor: o.deviceScaleFactor as number | undefined, userAgent: o.userAgent as string | undefined });
  const page = await ctx.newPage();
  await signIn(page, uid, path, lang);
  return { page, ctx };
}
async function goDay(page: Page, short: string) {
  if (isPhone(page)) await page.getByRole('tab', { name: new RegExp('^' + short) }).click(); // phones show one day at a time
}
/** The schedule opens on this week (editable from today on, KC round 7): go to next week (Mon 26 Oct), where every day can be changed and a publish starts on that Monday. */
async function editNextWeek(page: Page) {
  await page.getByRole('button', { name: 'Next week', exact: true }).click();
  await expect(page.getByText('26 Oct – 30 Oct 2026')).toBeVisible();
}
/** Open a day in the month view (any month already shown) so its detail card shows. */
async function openDay(page: Page, date: string) {
  await page.getByRole('tab', { name: 'Calendar' }).click();
  const month = +date.slice(5, 7);
  if (month === 11) await page.getByRole('button', { name: 'Next month' }).click();
  await cell(page, date).click();
  await expect(block(page, date)).toBeVisible();
}

test('s9 adds a closure: it shows on the month view; edit and delete it', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/calendar');
  await expect(page.getByRole('heading', { level: 1, name: 'Calendar and schedule' })).toBeVisible();
  await expect(page.getByText('Open Monday to Friday · 08:30–16:30')).toBeVisible();
  await noHScroll(page);
  await page.getByRole('button', { name: 'Add event' }).click();
  const dlg = page.getByRole('dialog', { name: 'Add to the calendar' });
  await expect(dlg).toBeVisible();
  // nothing is saved without a title
  await dlg.getByRole('button', { name: 'Save' }).click();
  await expect(dlg.getByText('Add a title.')).toBeVisible();
  await dlg.getByPlaceholder('For example: Staff first-aid training').fill('Water maintenance');
  await dlg.getByLabel('Title in Bahasa Indonesia').fill('Perawatan air');
  await pickDate(page, 'Date', '2026-11-03');
  await expect(dlg.getByRole('switch', { name: /Notify families and the team/ })).toHaveAttribute('aria-checked', 'true'); // on by default
  await dlg.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status')).toContainText('Calendar updated. Staff and families are told.');
  await expect(dlg).toHaveCount(0);
  // stored with both titles, and families and staff are told
  const s = await snapshot(page, 's9');
  const ev = Object.values(s.calendarEvents).find((e) => e.title === 'Water maintenance')!;
  expect(ev).toMatchObject({ date: '2026-11-03', kind: 'closed', titleId: 'Perawatan air' });
  const fam = await snapshot(page, 'f1');
  expect(Object.keys(fam.calendarEvents)).toContain(ev.id);
  const n = Object.values(fam.notifications).find((x) => x.kind === 'cal.notif.added_closed');
  expect(n).toMatchObject({ params: { date: '03/11/2026' }, link: '/calendar' });
  // month view: November, the day is marked closed and its detail lists the event
  await page.getByRole('tab', { name: 'Calendar' }).click();
  await page.getByRole('button', { name: 'Next month' }).click();
  await expect(page.getByRole('heading', { name: 'November 2026' })).toBeVisible();
  await expect(cell(page, '2026-11-03')).toHaveAttribute('aria-label', 'Tuesday 3 November · Closed');
  if (!isPhone(page)) await expect(cell(page, '2026-11-03')).toContainText('Closed'); // a phone's cell is a number and dots only
  await noHScroll(page);
  await cell(page, '2026-11-03').click();
  await expect(block(page, '2026-11-03')).toContainText('Tuesday 3 November');
  await expect(block(page, '2026-11-03')).toContainText('Water maintenance');
  await expect(block(page, '2026-11-03')).toContainText('Club closed');
  // edit it
  await page.getByRole('button', { name: 'Edit Water maintenance' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit event' });
  await edit.getByPlaceholder('For example: Staff first-aid training').fill('Water works');
  await edit.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status')).toContainText('Calendar updated');
  await expect(block(page, '2026-11-03')).toContainText('Water works');
  // delete it
  await page.getByRole('button', { name: 'Edit Water works' }).click();
  await edit.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(edit.getByText(/This removes the event on Tuesday 3 November/)).toBeVisible();
  await edit.getByRole('button', { name: 'Delete event' }).click();
  await expect(page.getByRole('status')).toContainText('Event deleted');
  await expect(cell(page, '2026-11-03')).toHaveAttribute('aria-label', 'Tuesday 3 November · Open · 08:30–16:30');
  expect((await snapshot(page, 's9')).calendarEvents[ev.id].deletedAt).toBeTruthy();
  c.assertClean();
});

test('s9 adds a closure with "notify" switched off: the calendar changes but nobody is told', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/calendar');
  await page.getByRole('button', { name: 'Add event' }).click();
  const dlg = page.getByRole('dialog', { name: 'Add to the calendar' });
  await dlg.getByPlaceholder('For example: Staff first-aid training').fill('Quiet cleaning');
  await pickDate(page, 'Date', '2026-11-10');
  await dlg.getByRole('switch', { name: /Notify families and the team/ }).click();
  await expect(dlg.getByRole('switch', { name: /Notify families and the team/ })).toHaveAttribute('aria-checked', 'false');
  await dlg.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status')).toContainText('Calendar updated. Nobody was notified.');
  const s = await snapshot(page, 's9');
  expect(Object.values(s.calendarEvents).find((e) => e.title === 'Quiet cleaning')).toMatchObject({ date: '2026-11-10', kind: 'closed' });
  expect(Object.values(s.notifications).some((x) => x.kind === 'cal.notif.added_closed')).toBe(false);
  expect(Object.values((await snapshot(page, 'f1')).notifications).some((x) => x.kind === 'cal.notif.added_closed')).toBe(false);
  // editing it with notify on tells everyone about the change
  await openDay(page, '2026-11-10');
  await page.getByRole('button', { name: 'Edit Quiet cleaning' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit event' });
  await edit.getByPlaceholder('For example: Staff first-aid training').fill('Cleaning day');
  await edit.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status')).toContainText('Staff and families are told');
  expect(Object.values((await snapshot(page, 'f1')).notifications).filter((x) => x.kind === 'cal.notif.changed_closed')).toHaveLength(1);
  c.assertClean();
});

test('s9 closes a day: it is closed for everyone (no check-in there) and staff and families are told', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/calendar');
  await page.getByRole('button', { name: 'Add event' }).click();
  const dlg = page.getByRole('dialog', { name: 'Add to the calendar' });
  await dlg.getByPlaceholder('For example: Staff first-aid training').fill('Deep cleaning');
  await pickDate(page, 'Date', '2026-10-26');
  await dlg.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status')).toContainText('Calendar updated');
  await openDay(page, '2026-10-26');
  await expect(block(page, '2026-10-26')).toContainText('Deep cleaning');
  await expect(block(page, '2026-10-26')).toContainText('Closed');
  await expect(block(page, '2026-10-26')).not.toContainText('Angklung ensemble'); // no activities on a closed day
  // the closure is a calendar fact every role and family receives; staff roles and families get one update each
  const s = await snapshot(page, 's9');
  const ev = Object.values(s.calendarEvents).find((e) => e.title === 'Deep cleaning')!;
  expect(ev).toMatchObject({ date: '2026-10-26', kind: 'closed' });
  const fam = await snapshot(page, 'f1');
  expect(Object.keys(fam.calendarEvents)).toContain(ev.id);
  const mine = Object.values(fam.notifications).filter((x) => x.kind === 'cal.notif.added_closed');
  expect(mine).toHaveLength(1);
  expect(mine[0].params.date).toBe('26/10/2026');
  const staff = Object.values(s.notifications).find((x) => x.kind === 'cal.notif.added_closed')!;
  expect(staff.toRoles).toEqual(expect.arrayContaining(['lobby', 'nurse', 'activity', 'kitchen', 'finance', 'mgmt']));
  c.assertClean();
});

test('s9 adds a three-day holiday and an outing with times', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/calendar');
  await page.getByRole('button', { name: 'Add event' }).click();
  let dlg = page.getByRole('dialog', { name: 'Add to the calendar' });
  await dlg.getByRole('button', { name: 'National holiday' }).click();
  await dlg.getByPlaceholder('For example: Staff first-aid training').fill('Long weekend');
  await pickDate(page, 'Date', '2026-11-02');
  await dlg.getByRole('switch', { name: 'Lasts several days' }).click();
  await pickDate(page, 'Last day', '2026-11-04');
  await dlg.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status')).toContainText('Calendar updated');
  await page.getByRole('tab', { name: 'Calendar' }).click();
  await page.getByRole('button', { name: 'Next month' }).click();
  for (const d of ['2026-11-02', '2026-11-03', '2026-11-04']) {
    await cell(page, d).click();
    await expect(block(page, d)).toContainText('Long weekend');
    await expect(block(page, d)).toContainText('National holiday · closed');
  }
  await cell(page, '2026-11-05').click();
  await expect(block(page, '2026-11-05')).not.toContainText('Long weekend');
  // an outing: the activities of that day are replaced by the outing
  await page.getByRole('tab', { name: 'List' }).click(); // (the date pickers look for days by data-date: keep the month grid out of the page)
  await page.getByRole('button', { name: 'Add event' }).click();
  dlg = page.getByRole('dialog', { name: 'Add to the calendar' });
  await dlg.getByRole('button', { name: 'Outing', exact: true }).click();
  await dlg.getByPlaceholder('For example: Staff first-aid training').fill('Botanical garden');
  await pickDate(page, 'Date', '2026-11-05');
  await pickTime(page, 'From', '09:00');
  await dlg.getByRole('button', { name: 'Save' }).click(); // only a start time: refused with a clear message
  await expect(dlg.getByText('Add both a start and an end time, or leave both empty.')).toBeVisible();
  await pickTime(page, 'To', '14:00');
  await dlg.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status')).toContainText('Calendar updated');
  await page.getByRole('tab', { name: 'Calendar' }).click();
  if (!(await block(page, '2026-11-05').isVisible())) await cell(page, '2026-11-05').click(); // 5 Nov is still the selected day
  await expect(block(page, '2026-11-05')).toContainText('Botanical garden');
  await expect(block(page, '2026-11-05')).toContainText('Outing · 09:00–14:00');
  await expect(block(page, '2026-11-05')).not.toContainText('Gardening club');
  const s = await snapshot(page, 's9');
  expect(Object.values(s.calendarEvents).find((e) => e.title === 'Long weekend')).toMatchObject({ date: '2026-11-02', endDate: '2026-11-04', kind: 'holiday' });
  expect(Object.values(s.calendarEvents).find((e) => e.title === 'Botanical garden')).toMatchObject({ from: '09:00', to: '14:00' });
  c.assertClean();
});

test('list view (s9): the next 3 days only, each activity has an "Edit activity" button; month view a date opens its week', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/calendar');
  // today, tomorrow and the day after: three cards, nothing further
  for (const d of ['2026-10-21', '2026-10-22', '2026-10-23']) await expect(block(page, d)).toBeVisible();
  await expect(page.locator('div[data-date]')).toHaveCount(3);
  await expect(block(page, '2026-10-26')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Show more days' })).toHaveCount(0);
  await noHScroll(page);
  // every activity (two a day, and Thursday's extra tea-time karaoke) has the button (management only: a teacher just views, see the s5 test below)
  await expect(page.getByRole('button', { name: /Edit activity/ })).toHaveCount(7);
  await expect(block(page, '2026-10-21').getByRole('button', { name: /Edit activity: Keroncong sing-along/ })).toBeVisible();
  // Thursday's first session: this week's schedule opens with that slot's editor (round 7: the current week can be edited from today on)
  await block(page, '2026-10-22').getByRole('button', { name: /Edit activity: Gardening club/ }).click();
  await page.getByRole('button', { name: /Change the weekly plan/ }).click(); // round 7: "Edit activity" first asks: just this day, or the weekly plan
  await expect(page.getByText('19 Oct – 23 Oct 2026')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Activity' })).toBeVisible(); // the slot's editor is open (on a phone, on that day)
  await expect(page.getByRole('radio', { name: 'Garden', exact: true })).toHaveAttribute('aria-checked', 'true');
  await pickOption(page, 'Activity', 'Angklung ensemble');
  await expect(page.getByRole('button', { name: 'Thursday 10:30: Angklung ensemble' })).toBeVisible();
  await expect(page.getByText('1 change not yet published')).toBeVisible();
  await noHScroll(page);
  // the same from the month: any date opens its week; 4 Nov is the week of 2–6 Nov
  await page.getByRole('tab', { name: 'Calendar' }).click();
  await page.getByRole('button', { name: 'Next month' }).click();
  await cell(page, '2026-11-04').click();
  await expect(page.getByText('2 Nov – 6 Nov 2026')).toBeVisible();
  await expect(block(page, '2026-11-04')).toBeVisible(); // its detail shows under the month too
  if (!isPhone(page)) await expect(page.getByText('4 Nov', { exact: true })).toBeVisible(); // the date under the day name
  // a Saturday opens the week it ends
  await cell(page, '2026-11-07').click();
  await expect(page.getByText('2 Nov – 6 Nov 2026')).toBeVisible();
  await cell(page, '2026-11-09').click();
  await expect(page.getByText('9 Nov – 13 Nov 2026')).toBeVisible();
  c.assertClean();
});

test('phone: the month is a compact grid of dots; a day lists its items under it; the key is collapsed; Add event is a small pill at the bottom right', async ({ page }) => {
  test.skip(!isPhone(page), 'the phone layout');
  const c = watchConsole(page);
  await signIn(page, 's9', '/calendar');
  // "Add event" is the compact Pin pill at the bottom right (round 6), not a full-width bar over the page
  const add = page.getByRole('button', { name: 'Add event' });
  const addBox = (await add.boundingBox())!;
  const tabBox = (await page.getByRole('tab', { name: 'List' }).boundingBox())!;
  expect(addBox.width).toBeLessThan(180);
  expect(addBox.height).toBeLessThanOrEqual(48);
  expect(addBox.y).toBeGreaterThan(tabBox.y + tabBox.height); // below the List | Calendar switch, no longer on its row
  // list view: each day is compact; the activity's "Edit activity" is an icon button on the same row
  const row = block(page, '2026-10-21').getByRole('button', { name: /Edit activity: Keroncong sing-along/ });
  await expect(row).toBeVisible();
  expect((await row.boundingBox())!.width).toBeLessThanOrEqual(48);
  await noHScroll(page);
  // month: the cells are a number and dots, nothing else; the whole month fits on one screen
  await page.getByRole('tab', { name: 'Calendar' }).click();
  await expect(cell(page, '2026-10-21')).toHaveText('21');
  await expect(cell(page, '2026-10-29')).toHaveText('29'); // an outing: no event name in the cell
  expect(await cell(page, '2026-10-21').locator('span[aria-hidden] > span').count()).toBeGreaterThanOrEqual(1); // coloured dots
  const cellBox = (await cell(page, '2026-10-21').boundingBox())!;
  expect(cellBox.width).toBeGreaterThanOrEqual(40);
  expect(cellBox.height).toBeGreaterThanOrEqual(40); // 48 px before the phone's CSS zoom (.875)
  expect(cellBox.height).toBeLessThanOrEqual(56);
  const grid = (await cell(page, '2026-10-30').boundingBox())!;
  expect(grid.y + grid.height).toBeLessThan(844); // the last week of the month is on the first screen too
  // the colour key is behind a small "Key" toggle
  const key = page.getByRole('button', { name: 'Key' });
  await expect(key).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByText('Venue booking', { exact: true })).toHaveCount(0);
  await key.click();
  await expect(key).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('Venue booking', { exact: true })).toBeVisible();
  await key.click();
  await expect(page.getByText('Venue booking', { exact: true })).toHaveCount(0);
  // tapping a day selects it and lists its items under the grid (and the page does not jump away to the schedule)
  await cell(page, '2026-10-29').click();
  await expect(cell(page, '2026-10-29')).toHaveAttribute('aria-pressed', 'true');
  const day = block(page, '2026-10-29');
  await expect(day).toContainText('Kebun Raya Bogor');
  const dayBox = (await day.boundingBox())!;
  expect(dayBox.y).toBeGreaterThan(grid.y); // under the grid
  expect(dayBox.y + dayBox.height).toBeLessThan(844 + 400);
  await expect(page.getByRole('button', { name: 'Open this week in the schedule' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Add an event on Thursday 29 October/ })).toBeVisible();
  // a day with activities lists them with the time, the room and the teacher
  await cell(page, '2026-10-21').click();
  await expect(block(page, '2026-10-21')).toContainText('Keroncong sing-along');
  await expect(block(page, '2026-10-21')).toContainText('10:30');
  await noHScroll(page);
  // the weekly schedule below: one day at a time, the date under each day name
  await openBuilder(page);
  await expect(page.getByRole('tab', { name: 'Wed 21 Oct' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Wed 21 Oct' })).toContainText('21 Oct');
  await noHScroll(page);
  c.assertClean();
});

test('month view: any month, translated headers, closures, outings and holidays', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's5', '/calendar');
  await page.getByRole('tab', { name: 'Calendar' }).click();
  await expect(page.getByRole('heading', { name: 'October 2026' })).toBeVisible();
  for (const w of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) await expect(page.getByText(w, { exact: true }).first()).toBeVisible();
  await expect(cell(page, '2026-10-21')).toHaveAttribute('aria-label', 'Wednesday 21 October · Open · 08:30–16:30');
  await expect(cell(page, '2026-10-30')).toHaveAttribute('aria-label', 'Friday 30 October · Closed');
  await cellHas(page, '2026-10-29', 'Kebun Raya Bogor');
  await expect(cell(page, '2026-10-24')).toHaveAttribute('aria-label', 'Saturday 24 October · Closed · weekend');
  await noHScroll(page);
  // forwards: any month, not a fixed list
  await page.getByRole('button', { name: 'Next month' }).click();
  await expect(page.getByRole('heading', { name: 'November 2026' })).toBeVisible();
  await cellHas(page, '2026-11-26', 'batik museum');
  await page.getByRole('button', { name: 'Next month' }).click();
  await expect(page.getByRole('heading', { name: 'December 2026' })).toBeVisible();
  await expect(cell(page, '2026-12-25')).toHaveAttribute('aria-label', 'Friday 25 December · National holiday · closed');
  await page.getByRole('button', { name: 'Next month' }).click();
  await expect(page.getByRole('heading', { name: 'January 2027' })).toBeVisible();
  await expect(cell(page, '2027-01-01')).toHaveAttribute('aria-label', 'Friday 1 January · National holiday · closed');
  for (let i = 0; i < 12; i++) await page.getByRole('button', { name: 'Next month' }).click();
  await expect(page.getByRole('heading', { name: 'January 2028' })).toBeVisible();
  await expect(cell(page, '2028-01-03')).toHaveAttribute('aria-label', 'Monday 3 January · Open · 08:30–16:30'); // the schedule in force keeps applying
  await noHScroll(page);
  // backwards: past months work too, and "This month" comes back
  for (let i = 0; i < 16; i++) await page.getByRole('button', { name: 'Previous month' }).click();
  await expect(page.getByRole('heading', { name: 'September 2026' })).toBeVisible();
  await cellHas(page, '2026-09-23', 'Keroncong');
  await page.getByRole('button', { name: 'This month' }).click();
  await expect(page.getByRole('heading', { name: 'October 2026' })).toBeVisible();
  // tapping a day shows its detail; tapping again hides it
  await cell(page, '2026-10-21').click();
  await expect(block(page, '2026-10-21')).toContainText('Keroncong sing-along');
  await expect(page.getByRole('heading', { name: 'Weekly schedule' })).toHaveCount(0); // a teacher has no schedule to open (management's date opens its week: see the list view test)
  await cell(page, '2026-10-21').click();
  await expect(block(page, '2026-10-21')).toHaveCount(0);
  c.assertClean();
});

test('builder (s9): this week is editable from today (earlier days read-only), a week that is over is not; next week: tap an activity then a slot, publish from that Monday: today stays as it is', async ({ page, browser }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/calendar');
  await openBuilder(page);
  // the version in force this week; KC round 7: the current week can be edited from today on, the days before today cannot
  await expect(page.getByText(/Published Mon 19 Oct, 16:10 by Ega/).first()).toBeVisible();
  await expect(page.getByText('19 Oct – 23 Oct 2026')).toBeVisible();
  await expect(page.getByText('This week is over, so it cannot be changed.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Angklung ensemble', exact: true })).toBeVisible(); // the palette is there
  await expect(publishPage(page)).toHaveAttribute('aria-disabled', 'true'); // nothing changed yet
  await goDay(page, 'Mon');
  await expect(page.getByRole('group', { name: 'Monday 10:30: Angklung ensemble' })).toBeVisible(); // Monday has passed: read-only
  if (!isPhone(page)) await expect(page.getByText('Days before today have passed and cannot be changed.')).toBeVisible();
  await goDay(page, 'Wed');
  await expect(page.getByRole('button', { name: 'Wednesday 10:30: Keroncong sing-along' })).toBeVisible(); // today can be changed
  if (!isPhone(page)) await expect(page.getByText('21 Oct', { exact: true })).toBeVisible(); // the date under each day name
  await noHScroll(page);
  // previous week: it is over, so only what ran shows; "Edit this week" and "This week" come back
  await page.getByRole('button', { name: 'Previous week' }).click();
  await expect(page.getByText('12 Oct – 16 Oct 2026')).toBeVisible();
  await expect(page.getByText('This week is over, so it cannot be changed.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Angklung ensemble', exact: true })).toHaveCount(0); // no palette
  await page.getByRole('button', { name: 'Edit this week' }).click();
  await expect(page.getByText('19 Oct – 23 Oct 2026')).toBeVisible();
  await editNextWeek(page);
  await goDay(page, 'Wed');
  // the palette comes from the catalog; teachers from staff with the activity role
  for (const a of ['Angklung ensemble', 'Keroncong sing-along', 'Reading circle']) await expect(page.getByRole('button', { name: a, exact: true })).toBeVisible();
  // tap-to-place (the touch path)
  await page.getByRole('button', { name: 'Angklung ensemble', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Angklung ensemble', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Wednesday 10:30: Keroncong sing-along' }).click();
  await expect(page.getByRole('button', { name: 'Wednesday 10:30: Angklung ensemble' })).toBeVisible();
  await expect(page.getByText('1 change not yet published')).toBeVisible();
  await expect(page.getByText('Draft')).toBeVisible();
  await expect(publishPage(page)).not.toHaveAttribute('aria-disabled', 'true');
  // KC round 8d: placing an activity doesn't open the side panel; tapping the placed activity does
  await expect(page.getByRole('radio', { name: 'Music room' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Wednesday 10:30: Angklung ensemble' }).click();
  await expect(page.getByRole('radio', { name: 'Music room' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radio', { name: 'Dinar' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radio', { name: 'Kak Dimas' }).click();
  await expect(page.getByRole('radio', { name: 'Kak Dimas' })).toHaveAttribute('aria-checked', 'true');
  await noHScroll(page);
  // the draft is saved on the server (shared with colleagues) for that week
  await expect.poll(async () => (await snapshot(page, 's9')).scheduleVersions['sched-draft']?.days?.['3']?.['10:30']?.staffId).toBe('s6');
  expect((await snapshot(page, 's9')).scheduleVersions['sched-draft'].effectiveFrom).toBe('2026-10-26');
  // publish: the date defaults to that week's Monday, and "notify" is on
  await publishPage(page).click();
  const sheet = page.getByRole('dialog', { name: 'Publish the weekly schedule' });
  await expect(sheet.getByText('1 change not yet published')).toBeVisible();
  await expect(sheet.getByText('Wed 10:30: Keroncong sing-along → Angklung ensemble')).toBeVisible();
  await expect(fieldText(page, 'Takes effect on')).toContainText('26 Oct');
  await expect(sheet.getByRole('switch', { name: /Notify families and the team/ })).toHaveAttribute('aria-checked', 'true');
  await sheet.getByRole('button', { name: 'Publish to staff and families' }).click();
  await expect(page.getByRole('status')).toContainText('Schedule published from Monday 26 October');
  await expect(page.getByText('Upcoming')).toBeVisible();
  await expect(page.getByText('From Monday 26 October', { exact: true })).toBeVisible();
  await expect(page.getByText(/Published Wed 21 Oct, \d\d:\d\d by Ega · In force from Mon 26 Oct/)).toBeVisible(); // the status follows the version of the week shown
  // stored as a dated version: the old one stays for the past
  const s = await snapshot(page, 's9');
  const published = Object.values(s.scheduleVersions).filter((v) => v.status === 'published');
  expect(published.map((v) => v.effectiveFrom).sort()).toEqual(['2024-07-01', '2026-10-26']);
  expect(s.scheduleVersions['sched-draft']).toBeUndefined();
  expect(published.find((v) => v.effectiveFrom === '2026-10-26')!.days['3']['10:30']).toMatchObject({ activityId: 'act-angklung', staffId: 's6' });
  expect(published.find((v) => v.effectiveFrom === '2024-07-01')!.days['3']['10:30'].activityId).toBe('act-keroncong');
  // staff roles and families are told
  const note = Object.values(s.notifications).find((n) => n.kind === 'cal.notif.schedulePublished')!;
  expect(note.toRoles).toEqual(expect.arrayContaining(['lobby', 'nurse', 'activity', 'kitchen', 'finance', 'mgmt']));
  expect(note.toUsers).toContain('f1');
  expect(note.params.date).toBe('26/10/2026');
  // this week still shows the old version; next week the new one; the week after follows it too
  await page.getByRole('button', { name: 'This week' }).click();
  await goDay(page, 'Wed');
  await expect(page.getByRole('button', { name: 'Wednesday 10:30: Keroncong sing-along' })).toBeVisible();
  await page.getByRole('button', { name: 'Next week', exact: true }).click();
  await page.getByRole('button', { name: 'Next week', exact: true }).click();
  await expect(page.getByText('2 Nov – 6 Nov 2026')).toBeVisible();
  await goDay(page, 'Wed');
  await expect(page.getByRole('button', { name: 'Wednesday 10:30: Angklung ensemble' })).toBeVisible();
  // today is unchanged on the calendar and on the teacher's Today
  await expect(block(page, '2026-10-21')).toContainText('Keroncong sing-along');
  const { page: t, ctx } = await otherUser(browser, 's5', '/today');
  const tc = watchConsole(t);
  await expect(t.getByText('Next · 10:30')).toBeVisible();
  await expect(t.getByTestId('today-plan').getByText('Keroncong sing-along')).toBeVisible(); // in the day's programme (the hero shows it too)
  tc.assertClean();
  await ctx.close();
  c.assertClean();
});

test('builder: the quick ✕ removes a placed activity, publishing with "notify" off tells nobody; Today and the calendar keep working', async ({ page, browser }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/calendar');
  await openBuilder(page);
  await editNextWeek(page);
  await goDay(page, 'Thu');
  // the ✕ sits on the placed activity itself: no need to open it first
  await expect(page.getByRole('button', { name: 'Thursday 13:30: Mahjong and cards' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove Mahjong and cards from Thursday at 13:30' }).click();
  await expect(page.getByRole('button', { name: 'Thursday 13:30: empty' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Remove .* from Thursday at 13:30/ })).toHaveCount(0); // nothing left to remove there
  await expect(page.getByText('1 change not yet published')).toBeVisible();
  await expect(page.getByText('Changed', { exact: true }).first()).toBeVisible();
  await noHScroll(page);
  await publishPage(page).click();
  const sheet = page.getByRole('dialog', { name: 'Publish the weekly schedule' });
  await expect(fieldText(page, 'Takes effect on')).toContainText('26 Oct');
  await sheet.getByRole('switch', { name: /Notify families and the team/ }).click();
  await sheet.getByRole('button', { name: 'Publish to staff and families' }).click();
  await expect(page.getByRole('status')).toContainText('Schedule published from Monday 26 October. Nobody was notified');
  const s = await snapshot(page, 's9');
  expect(Object.values(s.scheduleVersions).some((v) => v.status === 'published' && v.effectiveFrom === '2026-10-26')).toBe(true);
  expect(Object.values(s.notifications).some((n) => n.kind === 'cal.notif.schedulePublished')).toBe(false);
  expect(Object.values((await snapshot(page, 'f1')).notifications).some((n) => n.kind === 'cal.notif.schedulePublished')).toBe(false);
  // Thursday of this week and today are untouched; next week's Thursday has only the morning activity
  await openDay(page, '2026-10-21');
  await expect(block(page, '2026-10-21')).toContainText('Batik painting');
  await cell(page, '2026-10-29').click();
  await expect(block(page, '2026-10-29')).not.toContainText('Mahjong and cards');
  // the teacher's Today is intact
  const { page: t, ctx } = await otherUser(browser, 's5', '/today');
  const tc = watchConsole(t);
  await expect(t.getByText('Next · 10:30')).toBeVisible();
  await expect(t.getByText('Batik painting')).toBeVisible();
  tc.assertClean();
  await ctx.close();
  c.assertClean();
});

test('builder (KC round 9): a tap on an empty slot opens the activity list (placed at once, no side panel); on a phone a long press drags an activity onto a slot', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/calendar');
  await openBuilder(page);
  await editNextWeek(page);
  await goDay(page, 'Thu');
  await page.getByRole('button', { name: 'Remove Mahjong and cards from Thursday at 13:30' }).click();
  const empty = page.getByRole('button', { name: 'Thursday 13:30: empty' });
  await expect(empty).toContainText('Add an activity'); // an empty slot that can be changed invites a tap
  await empty.click();
  const list = page.getByRole('dialog', { name: /Choose an activity · Thursday 29 Oct, 13:30/ });
  await expect(list).toBeVisible();
  await list.getByRole('listitem').filter({ hasText: 'Reading circle' }).click();
  await expect(list).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Thursday 13:30: Reading circle' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Music room' })).toHaveCount(0); // KC round 8d: adding never opens the side panel
  if (isPhone(page)) {
    // the browser's own drag and drop needs a mouse: on a phone, hold an activity, drag it onto a slot and let go
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const chip = page.getByRole('button', { name: 'Karaoke', exact: true });
    await chip.scrollIntoViewIfNeeded();
    const a = (await chip.boundingBox())!;
    const b = (await page.getByRole('button', { name: 'Thursday 10:30: Gardening club' }).boundingBox())!;
    const [ax, ay, bx, by] = [a.x + a.width / 2, a.y + a.height / 2, b.x + b.width / 2, b.y + b.height / 2];
    await touch('touchStart', ax, ay);
    await page.waitForTimeout(450); // the long press picks it up
    for (let i = 1; i <= 10; i++) await touch('touchMove', ax + ((bx - ax) * i) / 10, ay + ((by - ay) * i) / 10);
    await touch('touchEnd', bx, by);
    await expect(page.getByRole('button', { name: 'Thursday 10:30: Karaoke' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Karaoke', exact: true })).toHaveAttribute('aria-pressed', 'false'); // the drag did not also "tap" the chip
    await expect(page.getByText('2 changes not yet published')).toBeVisible();
  }
  c.assertClean();
});

test('builder: "Clear this slot" in the editor, and an unpublished draft for another week is flagged; discard it', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/calendar');
  await openBuilder(page);
  await editNextWeek(page);
  await goDay(page, 'Tue');
  await page.getByRole('button', { name: 'Tuesday 13:30: Memory games' }).click();
  await page.getByRole('button', { name: 'Clear this slot' }).click();
  await expect(page.getByRole('button', { name: 'Tuesday 13:30: empty' })).toBeVisible();
  await expect(page.getByText('1 change not yet published')).toBeVisible();
  // the week after: the draft is for another week, so editing is blocked until it is dealt with
  await page.getByRole('button', { name: 'Next week', exact: true }).click();
  await expect(page.getByText('You have unpublished changes for the week of Mon 26 Oct.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Angklung ensemble', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Go to that week' }).click();
  await expect(page.getByText('26 Oct – 30 Oct 2026')).toBeVisible();
  await expect(page.getByText('1 change not yet published')).toBeVisible();
  await page.getByRole('button', { name: 'Next week', exact: true }).click();
  await page.getByRole('button', { name: 'Discard changes' }).click();
  await expect(page.getByText('You have unpublished changes for the week of')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Angklung ensemble', exact: true })).toBeVisible(); // editable again
  await expect.poll(async () => (await snapshot(page, 's9')).scheduleVersions['sched-draft']?.days?.['2']?.['13:30']?.activityId).toBe('act-memory');
  c.assertClean();
});

test('builder: the draft survives a reload, is shared with the manager\'s other device and can be discarded; a teacher\'s builder sends to Ega', async ({ page, browser }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/calendar');
  await openBuilder(page);
  await editNextWeek(page);
  await goDay(page, 'Tue');
  await page.getByRole('button', { name: 'Reading circle', exact: true }).click();
  await page.getByRole('button', { name: 'Tuesday 13:30: Memory games' }).click();
  await expect(page.getByText('1 change not yet published')).toBeVisible();
  await expect.poll(async () => (await snapshot(page, 's9')).scheduleVersions['sched-draft']?.days?.['2']?.['13:30']?.activityId).toBe('act-reading');
  await page.reload();
  await openBuilder(page);
  // the schedule opens on this week again, and points at the draft
  await expect(page.getByText('You have unpublished changes for the week of Mon 26 Oct.')).toBeVisible();
  await page.getByRole('button', { name: 'Go to that week' }).click();
  await expect(page.getByText('1 change not yet published')).toBeVisible();
  await goDay(page, 'Tue');
  await expect(page.getByRole('button', { name: 'Tuesday 13:30: Reading circle' })).toBeVisible();
  // round 14: a teacher has the builder too, on the same shared draft; her button sends it to Ega and the catalog stays management's
  const { page: teacher, ctx: teacherCtx } = await otherUser(browser, 's6', '/calendar');
  const tc = watchConsole(teacher);
  await expect(teacher.getByRole('heading', { level: 1, name: 'Calendar and schedule' })).toBeVisible();
  await openBuilder(teacher);
  await expect(teacher.getByText('You have unpublished changes for the week of Mon 26 Oct.')).toBeVisible();
  await expect(teacher.getByRole('button', { name: 'Send to Ega' })).toBeVisible();
  await expect(publishPage(teacher)).toHaveCount(0);
  await expect(teacher.getByRole('button', { name: 'Activities and rooms' })).toHaveCount(0);
  tc.assertClean();
  await teacherCtx.close();
  // the same manager on a second device sees the same draft and discards it
  const { page: other, ctx: otherCtx } = await otherUser(browser, 's9', '/calendar');
  const oc = watchConsole(other);
  await openBuilder(other);
  await expect(other.getByText('You have unpublished changes for the week of Mon 26 Oct.')).toBeVisible();
  await other.getByRole('button', { name: 'Go to that week' }).click();
  await expect(other.getByText('1 change not yet published')).toBeVisible();
  await other.getByRole('button', { name: 'Discard changes' }).click();
  await expect(other.getByText('1 change not yet published')).toHaveCount(0);
  await expect(other.getByText(/Published Mon 19 Oct, 16:10 by Ega/).first()).toBeVisible();
  await expect.poll(async () => (await snapshot(other, 's9')).scheduleVersions['sched-draft']?.days?.['2']?.['13:30']?.activityId).toBe('act-memory');
  oc.assertClean();
  await otherCtx.close();
  // and it follows to the first device without a reload
  await expect(page.getByText('1 change not yet published')).toHaveCount(0);
  c.assertClean();
});

test('catalog (s9): add activities with an Indonesian name and a free-text room, switch one off, add a room that shows in the room chooser', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/calendar');
  await openBuilder(page);
  await editNextWeek(page); // the palette is there for a week that can be changed
  await page.getByRole('button', { name: 'Activities and rooms' }).click();
  const dlg = page.getByRole('dialog'); // the title changes between the list and the forms, so address "the open dialog"
  await expect(dlg).toHaveAttribute('aria-label', 'Activities and rooms');
  await expect(dlg.getByRole('tab', { name: /Rooms/ })).toBeVisible(); // management edits rooms too
  await dlg.getByRole('button', { name: 'Add activity' }).click();
  await dlg.getByLabel('Name', { exact: true }).fill('Tai chi');
  await dlg.getByLabel('Name in Bahasa Indonesia').fill('Tai chi pagi');
  await pickOption(page, 'Room', 'Garden');
  await dlg.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status')).toContainText('Saved to the catalog.');
  await goToPage(page, 3, 'Catalog pages'); // the catalog is paged (six a page, A to Z): twelve in the seed + this one is page 3
  await expect(dlg.getByText('Tai chi', { exact: true })).toBeVisible();
  // the room can be "Other": typed as free text, and it joins the catalog
  await dlg.getByRole('button', { name: 'Add activity' }).click();
  await dlg.getByLabel('Name', { exact: true }).fill('Sunset stretching');
  await pickOption(page, 'Room', 'Other');
  await dlg.getByRole('button', { name: 'Save' }).click();
  await expect(dlg.getByText('Pick a room or type its name.')).toBeVisible(); // the free text is needed
  await dlg.getByLabel('Room name').fill('Skyline deck');
  await dlg.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status')).toContainText('Saved to the catalog.');
  await goToPage(page, 3, 'Catalog pages');
  await expect(dlg.getByText('Sunset stretching', { exact: true })).toBeVisible();
  await expect(dlg.getByText('Skyline deck')).toBeVisible();
  const withRoom = await snapshot(page, 's9');
  const roof = Object.values(withRoom.rooms).find((r) => r.name === 'Skyline deck')!;
  expect(roof).toMatchObject({ venue: false, createdBy: 'staff:s9' });
  expect(Object.values(withRoom.activities).find((a) => a.name === 'Sunset stretching')).toMatchObject({ roomId: roof.id, active: true });
  expect(Object.values(withRoom.activities).find((a) => a.name === 'Tai chi')).toMatchObject({ nameId: 'Tai chi pagi', roomId: 'room-garden', active: true });
  await dlg.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: 'Tai chi', exact: true })).toBeVisible(); // in the palette now
  // switched off: it leaves the palette but stays in the catalog
  await page.getByRole('button', { name: 'Activities and rooms' }).click();
  await goToPage(page, 3, 'Catalog pages');
  await dlg.getByRole('button', { name: 'Edit Tai chi' }).click();
  await dlg.getByRole('switch', { name: 'Active' }).click();
  await dlg.getByRole('button', { name: 'Save' }).click();
  await expect(dlg.getByText('Inactive')).toBeVisible();
  await dlg.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: 'Tai chi', exact: true })).toHaveCount(0);
  // a room: it shows in the room chooser of a slot
  await page.getByRole('button', { name: 'Activities and rooms' }).click();
  await dlg.getByRole('tab', { name: /Rooms/ }).click();
  await dlg.getByRole('button', { name: 'Add room' }).click();
  await dlg.getByLabel('Name', { exact: true }).fill('Terrace');
  await dlg.getByLabel('Name in Bahasa Indonesia').fill('Teras');
  await dlg.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status')).toContainText('Saved to the catalog.');
  await dlg.getByRole('button', { name: 'Done' }).click();
  await goDay(page, 'Wed');
  await page.getByRole('button', { name: 'Wednesday 10:30: Keroncong sing-along' }).click();
  await expect(page.getByRole('radio', { name: 'Terrace' })).toBeVisible();
  c.assertClean();
});

test('s5 (activity teacher): no event editor or catalog, but the builder and Edit activity, which send to Ega; the server refuses events and the catalog', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's5', '/calendar');
  await expect(page.getByRole('heading', { level: 1, name: 'Calendar and schedule' })).toBeVisible();
  // the list: the next 3 days, with the activities, the rooms and the teachers; she can change an activity (round 14: it goes to Ega), not an event
  for (const d of ['2026-10-21', '2026-10-22', '2026-10-23']) await expect(block(page, d)).toBeVisible();
  await expect(block(page, '2026-10-21')).toContainText('Keroncong sing-along');
  await expect(block(page, '2026-10-21')).toContainText('Pak Hendro'); // round 13: the demo seed has a guest host on the demo day's keroncong session
  const none = async () => {
    await expect(page.getByRole('button', { name: /Edit activity/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Edit (?!activity)/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add event' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Activities and rooms' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Weekly schedule' })).toHaveCount(1);
    await expect(publishPage(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Send to Ega' })).toHaveCount(1);
  };
  await none();
  await noHScroll(page);
  // the month: a day opens its detail, and there is no "add an event"
  await page.getByRole('tab', { name: 'Calendar' }).click();
  await expect(page.getByRole('heading', { name: 'October 2026' })).toBeVisible();
  await cell(page, '2026-10-21').click();
  await expect(block(page, '2026-10-21')).toContainText('Keroncong sing-along');
  await expect(page.getByRole('button', { name: /Add an event on/ })).toHaveCount(0);
  await none();
  await noHScroll(page);
  // phone: the teacher's bar is Today, Camera, Log, Calendar and More (Members and Requests are under More)
  if (isPhone(page)) {
    const bar = page.getByRole('navigation', { name: 'Main' });
    await expect(bar.locator('[data-nav-key="calendar"]')).toBeVisible();
    await expect(bar.locator('[data-nav-key="members"]')).toHaveCount(0);
    await expect(bar.locator('[data-nav-key="requests"]')).toHaveCount(0);
    await expect(bar.locator('[data-nav-key="more"]')).toBeVisible();
  }
  // the server keeps her out of events and the catalog (not just the screen); her publish is stored as a request for Ega, not in force
  for (const [name, input] of [['activity.upsert', { name: 'Tai chi', roomId: 'room-garden' }], ['calendarEvent.create', { date: '2026-11-03', kind: 'closed', title: 'Training' }]] as const) {
    const r = await rawAct(page, 's5', name, input, `e2e-forbid-${name}`);
    expect(r, name).toEqual({ status: 403, code: 'err.forbidden' });
  }
  const days = Object.fromEntries(['1', '2', '3', '4', '5'].map((w) => [w, { '10:30': null, '13:30': null }]));
  expect((await rawAct(page, 's5', 'schedule.publish', { effectiveFrom: '2026-10-26', days }, 'e2e-ask-publish')).code).toBeUndefined();
  const s = await snapshot(page, 's9');
  expect(Object.values(s.activities).some((a) => a.name === 'Tai chi')).toBe(false);
  expect(Object.values(s.scheduleVersions).filter((v) => v.status === 'published').map((v) => v.effectiveFrom)).toEqual(['2024-07-01']);
  expect(Object.values(s.scheduleVersions).filter((v) => v.status === 'pending').map((v) => v.effectiveFrom)).toEqual(['2026-10-26']);
  c.assertClean();
});

test('f1 sees the calendar read-only: no editor, no builder, no venue clients, trials or visits; the tab bar leads back to Today', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 'f1', '/calendar');
  const day = (d: string) => page.locator(`[data-testid="cal-agenda"][data-date="${d}"]`);
  await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add event' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Weekly schedule' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Edit / })).toHaveCount(0);
  await expect(day('2026-10-21')).toContainText('Keroncong sing-along');
  await expect(day('2026-10-21')).toContainText('guest host Pak Hendro');
  await expect(page.getByRole('button', { name: /Edit activity/ })).toHaveCount(0);
  await expect(page.getByTestId('cal-day')).toHaveCount(5); // the week's five open days
  await expect(page.getByText(/Siu Lan|Yusuf Hamid|Trial day|Visit ·/)).toHaveCount(0); // trials and visits are staff only
  await noHScroll(page);
  // month views of October and November: still no venue client names anywhere
  await page.getByTestId('cal-view').getByRole('tab', { name: 'Month' }).click();
  await page.locator('[data-testid="cal-cell"][data-date="2026-10-30"]').click();
  await expect(day('2026-10-30')).toContainText('Club closed'); // the closure is public
  await expect(page.getByRole('heading', { name: 'Weekly schedule' })).toHaveCount(0);
  await page.locator('[data-testid="cal-cell"][data-date="2026-10-24"]').click(); // a Saturday with a venue booking for staff
  await expect(day('2026-10-24')).toContainText('The club is closed on weekends');
  expect(await page.locator('#main').innerText()).not.toMatch(VENUE_CLIENTS);
  await page.getByTestId('cal-next-month').click();
  await page.locator('[data-testid="cal-cell"][data-date="2026-11-26"]').click();
  expect(await page.locator('#main').innerText()).not.toMatch(VENUE_CLIENTS);
  // what the family's browser receives has no venue bookings, guests or leads
  const fam = JSON.stringify(await snapshot(page, 'f1'));
  expect(fam).not.toMatch(VENUE_CLIENTS);
  expect(fam).not.toMatch(/Siu Lan|Yusuf Hamid/);
  // the tab bar leads back to Today (there is no "← Today" link any more)
  await page.locator('[data-nav-key="today"]').click();
  await expect(page).toHaveURL(/\/today$/);
  c.assertClean();
});

test('staff roles: management sees venue clients and edits; lobby sees trials and visits read-only', async ({ page, browser }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/calendar');
  await expect(block(page, '2026-10-21')).toContainText('Trial day: Oma Siu Lan Tjandra'); // a trial has no time
  await expect(page.getByRole('heading', { name: 'Weekly schedule' })).toBeVisible();
  await page.getByRole('tab', { name: 'Calendar' }).click();
  await cell(page, '2026-10-24').click();
  await expect(block(page, '2026-10-24')).toContainText('PT Arunika Farma caregiver seminar'); // Saturday venue booking
  await expect(block(page, '2026-10-24')).toContainText('Venue booking');
  await cell(page, '2026-10-30').click();
  await expect(page.getByRole('button', { name: 'Edit staff first-aid training' })).toBeVisible();
  c.assertClean();
  const { page: l, ctx: lCtx } = await otherUser(browser, 's1', '/calendar');
  const lc = watchConsole(l);
  await expect(block(l, '2026-10-21')).toContainText('Trial day: Oma Siu Lan Tjandra');
  await expect(block(l, '2026-10-21')).toContainText('Visit');
  await expect(l.getByRole('button', { name: 'Add event' })).toHaveCount(0);
  await expect(l.getByRole('heading', { name: 'Weekly schedule' })).toHaveCount(0);
  await expect(l.getByRole('button', { name: /^Edit / })).toHaveCount(0);
  lc.assertClean();
  await lCtx.close();
});

// KC round 7: "edit this week's activity plan"
test('builder (s9): this week’s plan is edited from today: a publish starts today, earlier days keep their version and stay read-only', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/calendar');
  await openBuilder(page);
  await expect(page.getByText('19 Oct – 23 Oct 2026')).toBeVisible();
  // Thursday morning: Gardening club -> Reading circle (tap the activity, then the slot)
  await goDay(page, 'Thu');
  await page.getByRole('button', { name: 'Reading circle', exact: true }).click();
  await page.getByRole('button', { name: 'Thursday 10:30: Gardening club' }).click();
  await expect(page.getByRole('button', { name: 'Thursday 10:30: Reading circle' })).toBeVisible();
  await expect(page.getByText('1 change not yet published')).toBeVisible();
  // a day before today cannot take it (no remove button on Monday's session)
  await goDay(page, 'Mon');
  await expect(page.getByRole('group', { name: 'Monday 10:30: Angklung ensemble' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Remove .* from Monday at/ })).toHaveCount(0);
  // publish: the date starts at today (not next Monday)
  await publishPage(page).click();
  const sheet = page.getByRole('dialog', { name: 'Publish the weekly schedule' });
  await expect(fieldText(page, 'Takes effect on')).toContainText('21 Oct');
  await expect(sheet.getByText('The new schedule starts today.')).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'From today' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Publish to staff and families' }).click();
  await expect(page.getByRole('status')).toContainText('Schedule published from today.');
  // stored from today; the old version stays for the days before it
  const s = await snapshot(page, 's9');
  const published = Object.values(s.scheduleVersions).filter((v) => v.status === 'published');
  expect(published.map((v) => v.effectiveFrom).sort()).toEqual(['2024-07-01', '2026-10-21']);
  expect(published.find((v) => v.effectiveFrom === '2026-10-21')!.days['4']['10:30']).toMatchObject({ activityId: 'act-reading' });
  expect(published.find((v) => v.effectiveFrom === '2024-07-01')!.days['4']['10:30'].activityId).toBe('act-garden');
  // today is as it was, Thursday follows the new plan
  await expect(block(page, '2026-10-21')).toContainText('Batik painting');
  await expect(block(page, '2026-10-22')).toContainText('Reading circle');
  c.assertClean();
});

// KC round 7: "add an extra activity session at any time"
test('extra session (s9): added from Edit activity at any time, tagged Extra, in the teacher’s plan and the log rounds; edited, removed; a clash is refused', async ({ page, browser }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/calendar');
  const today = block(page, '2026-10-21');
  await today.getByRole('button', { name: /Edit activity: Keroncong sing-along/ }).click();
  await page.getByRole('button', { name: /Add a session/ }).click();
  const dlg = page.getByRole('dialog', { name: /^Extra session/ });
  await expect(dlg).toBeVisible();
  await expect(fieldText(page, 'Time')).toContainText('11:30'); // starts on a free time
  // too close to the 10:30 session: refused before saving, with the reason
  await pickOption(page, 'Activity', 'Reading circle');
  await pickTime(page, 'Time', '10:45');
  await expect(dlg.getByText(/Too close to the session at 10:30/)).toBeVisible();
  await expect(dlg.getByRole('button', { name: 'Add session' })).toBeDisabled();
  await pickTime(page, 'Time', '11:30');
  await expect(dlg.getByText(/Too close/)).toHaveCount(0);
  await expect(dlg.getByRole('switch', { name: /Tell teachers and families/ })).toHaveAttribute('aria-checked', 'true');
  await noHScroll(page);
  await dlg.getByRole('button', { name: 'Add session' }).click();
  await expect(page.getByRole('status')).toContainText('Session added on');
  await expect(dlg).toHaveCount(0);
  // the day lists it with its time and the Extra tag (staff)
  await expect(today).toContainText('11:30');
  await expect(today).toContainText('Reading circle');
  await expect(today).toContainText('Extra');
  const s = await snapshot(page, 's9');
  expect(s.scheduleDays['2026-10-21'].extra).toEqual([expect.objectContaining({ time: '11:30', cell: expect.objectContaining({ activityId: 'act-reading' }) })]);
  const fam = await snapshot(page, 'f1');
  expect(Object.values(fam.notifications).filter((n) => n.kind === 'cal.notif.extraAdded')).toHaveLength(1);
  // the teacher's plan for today and the daily log's rounds have it
  const { page: t, ctx } = await otherUser(browser, 's5', '/today');
  const tc = watchConsole(t);
  await expect(t.getByTestId('today-plan').getByText('Reading circle')).toBeVisible();
  await t.goto('/log');
  await expect(t.getByRole('tablist', { name: 'Log rounds' }).getByRole('tab', { name: /^11:30 · Reading circle/ })).toBeVisible();
  tc.assertClean();
  await ctx.close();
  // edit it: add a note (staff only, nobody is told about a note alone)
  await today.getByRole('button', { name: /Edit activity: Reading circle/ }).click();
  await page.getByRole('button', { name: /Edit this session/ }).click();
  const edit = page.getByRole('dialog', { name: /^Extra · .* · 11:30/ });
  await edit.getByLabel('Note').fill('Bring the books');
  await edit.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status')).toContainText('Session updated');
  await expect(today).toContainText('Extra · Bring the books');
  const famNote = (await snapshot(page, 'f1')).scheduleDays['2026-10-21'].extra[0];
  expect(famNote.note).toBeUndefined(); // families never get the note
  expect(Object.values((await snapshot(page, 'f1')).notifications).filter((n) => n.kind === 'cal.notif.extraChanged')).toHaveLength(0);
  // remove it
  await today.getByRole('button', { name: /Edit activity: Reading circle/ }).click();
  await page.getByRole('button', { name: /Edit this session/ }).click();
  await edit.getByRole('button', { name: 'Remove this session' }).click();
  await expect(page.getByRole('status')).toContainText('Session removed');
  await expect(today).not.toContainText('11:30');
  expect((await snapshot(page, 's9')).scheduleDays['2026-10-21']).toBeUndefined();
  c.assertClean();
});

test('Indonesian: month and weekday names, labels and activity names follow the language', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/calendar', 'id');
  await expect(page.getByRole('heading', { level: 1, name: 'Kalender dan jadwal' })).toBeVisible();
  await expect(page.getByText('Buka Senin sampai Jumat · 08:30–16:30')).toBeVisible();
  await expect(block(page, '2026-10-21')).toContainText('Bernyanyi keroncong'); // nameId, not the English name
  await expect(block(page, '2026-10-21')).toContainText('Ruang musik · bersama Pak Hendro · tamu');
  await expect(block(page, '2026-10-21')).toContainText('Buka · 08:30–16:30');
  await expect(block(page, '2026-10-21')).toContainText('Hari ini');
  await expect(block(page, '2026-10-21')).toContainText('Hari uji coba: Oma Siu Lan Tjandra');
  await expect(page.getByRole('button', { name: /Ubah kegiatan/ }).first()).toBeVisible();
  await noHScroll(page);
  // the builder and the editors are Indonesian too
  await expect(page.getByRole('heading', { name: 'Jadwal mingguan' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Minggu sebelumnya' })).toBeVisible();
  await page.getByRole('button', { name: 'Minggu sebelumnya' }).click();
  await expect(page.getByText('Minggu ini sudah lewat, jadi tidak bisa diubah.')).toBeVisible();
  await page.getByRole('button', { name: 'Ubah minggu ini' }).click();
  await expect(page.getByRole('button', { name: 'Ansambel angklung', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publikasikan ke staf dan keluarga' })).toBeVisible();
  await page.getByRole('tab', { name: 'Kalender' }).click();
  await expect(page.getByRole('heading', { name: 'Oktober 2026' })).toBeVisible();
  for (const w of ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']) await expect(page.getByText(w, { exact: true }).first()).toBeVisible();
  await expect(cell(page, '2026-10-30')).toHaveAttribute('aria-label', /30 Oktober · Tutup/);
  await cell(page, '2026-10-30').click();
  await expect(block(page, '2026-10-30')).toContainText('pelatihan P3K staf'); // titleId
  await page.getByRole('button', { name: 'Bulan berikutnya' }).click();
  await expect(page.getByRole('heading', { name: 'November 2026' })).toBeVisible();
  await page.getByRole('button', { name: 'Tambah acara' }).click();
  const dlg = page.getByRole('dialog', { name: 'Tambah ke kalender' });
  await expect(dlg).toBeVisible();
  for (const t of ['Penutupan', 'Libur nasional', 'Jalan-jalan']) await expect(dlg.getByRole('button', { name: t, exact: true })).toBeVisible();
  await expect(dlg.getByRole('switch', { name: /Kabari keluarga dan tim/ })).toBeVisible();
  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(RAW_KEY);
  expect(body).not.toMatch(/Weekly schedule|Add event|Publish to staff|Open Monday|Calendar and schedule|Activities and rooms|Drop an activity|Notify families|Edit next week|Previous week/);
  await noHScroll(page);
  c.assertClean();
});

test('Indonesian: the family calendar has no raw keys and no English leftovers', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 'f1', '/calendar', 'id');
  await expect(page.getByRole('heading', { level: 1, name: 'Kalender' })).toBeVisible();
  await expect(page.locator('[data-testid="cal-agenda"][data-date="2026-10-21"]')).toContainText('Bernyanyi keroncong');
  const body = await page.locator('#main').innerText();
  expect(body).not.toMatch(RAW_KEY);
  expect(body).not.toMatch(/Club calendar|Open Monday|National holiday|Closed|Keroncong sing-along/);
  await page.getByTestId('cal-view').getByRole('tab', { name: 'Bulan' }).click();
  const month = await page.getByTestId('cal-month').innerText();
  expect(month).not.toMatch(RAW_KEY);
  expect(month).not.toMatch(/Photo days|came|closed/);
  await noHScroll(page);
  c.assertClean();
});
