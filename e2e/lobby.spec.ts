// Lobby for a drop-in day club (Prototype v3). Three number tabs sit at the top of Arrivals:
//   Not in yet  = the check-in list (members not in yet, with search); the side rail has "Also today", then the door camera (KC round 6);
//   In the club = a searchable list of the members in the club (each with Check out), "Also today" in the rail;
//   Gone home   = who has left today. Also: the Flex extra-day note (visit 11 of 10), undo, the departure check,
// the member drawer, trial and visit guests, the guided-demo deep link, Indonesian, every viewport.
// Nobody is "expected" and nobody is recorded as bringing or collecting.
// Isolated env: pnpm e2e:env lobby 8802 5202 && E2E_BASE_URL=http://localhost:5202 pnpm exec playwright test e2e/lobby.spec.ts
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { resetDemo, signIn, watchConsole, isPhone, uiZoom, assertNoHorizontalScroll } from './helpers';

test.beforeEach(async ({ request }) => { await resetDemo(request); });

/** The big number on a tab (In the club / Gone home). */
const tile = (page: Page, key: 'inClub' | 'goneHome') => page.getByTestId(`tile-${key}`);
/** Open the In the club or Gone home tab and bring its list into view. */
async function openTile(page: Page, key: 'inClub' | 'goneHome') {
  await page.getByRole('tab', { name: key === 'goneHome' ? /^Gone home/ : /^Check out/ }).click();
  await (key === 'goneHome' ? goneHomeList(page) : inClubList(page)).scrollIntoViewIfNeeded();
}
const toast = (page: Page, re: RegExp) => page.getByText(re).first();
const faceCard = (page: Page) => page.getByRole('region', { name: 'Face check-in camera' });
const manualList = (page: Page) => page.getByRole('region', { name: 'Check in a member' });
const alsoToday = (page: Page) => page.getByRole('region', { name: 'Also today' });
const inClubList = (page: Page) => page.getByRole('region', { name: 'In the club' });
const goneHomeList = (page: Page) => page.getByRole('region', { name: 'Gone home' });
/** The Check in | Check out switch. */
const modeTab = (page: Page, mode: 'in' | 'out', name = mode === 'in' ? /^Check in/ : /^Check out/) => page.getByRole('tab', { name });
/** Switch to Check out (the member rows with a Check out button live there). */
const checkOutMode = async (page: Page) => { await modeTab(page, 'out').click(); await expect(modeTab(page, 'out')).toHaveAttribute('aria-selected', 'true'); };
const checkInMode = async (page: Page) => { await modeTab(page, 'in').click(); await expect(modeTab(page, 'in')).toHaveAttribute('aria-selected', 'true'); };
const rowOf = (page: Page, name: string) => page.getByRole('button', { name: new RegExp(`^(Check in|Check out): ${name}`) });
/** The row's main button (opens the member drawer). */
const openRow = (page: Page, name: string) => page.getByRole('button', { name: new RegExp(`^${name}\\b`) });
/** Wait for the icon font: while it loads, icon names render as wide text and can make a nowrap row overflow for a moment. */
const fontsReady = (page: Page) => page.evaluate(() => document.fonts.ready.then(() => true));
/** Tablet and laptop: the list and the camera rail sit side by side; a phone stacks them and a manual pick confirms in a bottom sheet. */
const wideLayout = (page: Page) => (page.viewportSize()?.width || 1440) >= 768;
/** Raw i18n keys that leaked into the UI (no namespace.key text should ever be visible). */
const RAW_KEY = /\b(?:lobby|chat|common|status|err|nav|roles|shell|notif|feed|family|health|review|inv)\.[A-Za-z][A-Za-z0-9.]*/;
const GENERIC_KEY = /\b[a-z]+\.[a-zA-Z]+\b/;
const EXTRA_NOTE = 'Visit 11 of 10 this month: an extra day, Rp 650.000 on next month’s invoice.';
/** Words of the old planned-visit domain: none of them may show on the lobby. */
const OLD_DOMAIN = /expected|to arrive|walk-in|brought by|collected by|running late|absent today|not coming today|escort|booked for today/i;

test('the front desk knows today’s menu (KC round 6): lunch, the soft version and afternoon tea in "Also today"', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's1');
  const menu = page.getByTestId('lobby-menu');
  await expect(menu).toContainText('Menu today');
  await expect(menu).toContainText('Sop ikan kakap'); // Wednesday's lunch
  await expect(menu).toContainText(/Afternoon tea/);
  c.assertClean();
});

test('the drop-in board: Not in yet by default, the check-in list on top, "Also today" above the camera in the rail; nobody is "expected"', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's1');
  await expect(page.getByRole('heading', { name: 'Arrivals', level: 1 })).toBeVisible();
  await expect(page.getByText('Wednesday 21 October', { exact: true })).toBeVisible();
  await expect(page.getByText('Club open until 16:30')).toBeVisible();
  await expect(page.getByText(/^\d\d:\d\d$/).first()).toBeVisible();
  await expect(tile(page, 'inClub')).toHaveText('3');
  await expect(tile(page, 'goneHome')).toHaveText('0');
  for (const k of ['expected', 'toArrive', 'away', 'late', 'absent']) await expect(page.getByTestId(`tile-${k}`)).toHaveCount(0);
  await expect(page.locator('#main')).not.toContainText(OLD_DOMAIN);
  // the switch: Check in is selected and shows how many are not in yet; Check out shows how many are in the club
  await expect(modeTab(page, 'in')).toHaveAttribute('aria-selected', 'true');
  await expect(modeTab(page, 'in')).toContainText('2');
  await expect(modeTab(page, 'out')).toHaveAttribute('aria-selected', 'false');
  await expect(modeTab(page, 'out')).toContainText('3');
  // the check-in list: members who are not in yet, by usual arrival time
  const list = manualList(page);
  await expect(list.getByRole('heading', { name: 'Check in a member', level: 2 })).toBeVisible();
  await expect(rowOf(page, 'Opa Budi Wijaya')).toBeVisible();
  await expect(rowOf(page, 'Oma Lina Wijaya')).toBeVisible();
  await expect(list.getByText('Est 10:05', { exact: true })).toHaveCount(2);
  await expect(list.getByText('Seafood')).toHaveCount(0); // no food tags in the Arrivals rows
  await expect(list.getByRole('navigation')).toHaveCount(0); // two members: a single page, no pager
  // Check in mode: the camera is there; the check-out lists are not
  await expect(faceCard(page)).toBeVisible();
  await expect(inClubList(page)).toHaveCount(0);
  await expect(goneHomeList(page)).toHaveCount(0);
  // order (KC round 6): the number tabs are at the top; "Also today" sits in the rail ABOVE the face camera. Wide: the rail is beside the list;
  // narrow (the rail drops under the list): list, then Also today, then the camera
  await fontsReady(page);
  const sw = await modeTab(page, 'in').boundingBox();
  const listBox = await list.boundingBox();
  const alsoBox = await alsoToday(page).boundingBox();
  const camBox = await faceCard(page).boundingBox();
  expect(sw!.y).toBeLessThan(listBox!.y);
  expect(alsoBox!.y + alsoBox!.height).toBeLessThanOrEqual(camBox!.y + 1); // Also today is ABOVE the face camera
  expect(Math.abs(alsoBox!.x - camBox!.x)).toBeLessThan(40); // …in the same rail
  const beside = alsoBox!.x > listBox!.x + listBox!.width - 1;
  if (!beside) expect(alsoBox!.y).toBeGreaterThan(listBox!.y + listBox!.height - 1); // stacked: under the list
  await expect(alsoToday(page).getByText('Trial day: Oma Siu Lan Tjandra')).toBeVisible();
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('In the club: the camera goes, a searchable list of members in the club with Check out buttons shows, Also today stays below; Gone home is its own tab', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's1');
  await checkOutMode(page);
  await expect(faceCard(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Simulate next arrival' })).toHaveCount(0);
  await expect(manualList(page)).toHaveCount(0);
  const inClub = inClubList(page);
  await expect(inClub.getByRole('heading', { name: 'In the club', level: 2 })).toBeVisible();
  // the three who arrived, newest first, each with a Check out button and the arrival time
  for (const [n, at] of [['Bapak Bambang Purnomo', '09:48'], ['Opa Hendra Gunawan', '09:40'], ['Opa Tjahjadi Lim', '09:38']]) {
    await expect(inClub.getByRole('button', { name: new RegExp(`^${n}\\b`) })).toContainText(`Arrived ${at}`);
    await expect(inClub.getByRole('button', { name: `Check out: ${n}` })).toHaveText('Check out');
  }
  await expect(inClub.getByRole('button', { name: /^Check in:/ })).toHaveCount(0); // nobody here can be checked in
  await expect(goneHomeList(page)).toHaveCount(0); // Gone home is its own tab
  // search by name, by family contact, by phone
  const search = inClub.getByLabel('Search by name, family or phone');
  expect((await search.boundingBox())?.height).toBeGreaterThan(30); // an underline search, not squashed
  await search.fill('zzz');
  await expect(inClub.getByText('Nobody in the club matches “zzz”.')).toBeVisible();
  await search.fill('hendra');
  await expect(inClub.getByRole('button', { name: /^Check out: / })).toHaveCount(1);
  await search.fill('stephanie'); // Opa Hendra’s other daughter
  await expect(inClub.getByRole('button', { name: 'Check out: Opa Hendra Gunawan' })).toBeVisible();
  await search.fill('815 1294'); // Cynthia’s phone digits
  await expect(inClub.getByRole('button', { name: 'Check out: Opa Hendra Gunawan' })).toBeVisible();
  await expect(inClub.getByRole('button', { name: /^Check out: / })).toHaveCount(1);
  await search.fill('');
  await expect(inClub.getByRole('button', { name: /^Check out: / })).toHaveCount(3);
  // "Also today" is still there (guests are checked out from it): in the rail beside the list (wide) or under it (narrow)
  await fontsReady(page);
  const listBox = await inClub.boundingBox();
  const alsoBox = await alsoToday(page).boundingBox();
  expect(alsoBox!.x > listBox!.x + listBox!.width - 1 || alsoBox!.y > listBox!.y + listBox!.height - 1).toBe(true);
  await assertNoHorizontalScroll(page);
  // Gone home: nobody has gone home yet
  await openTile(page, 'goneHome');
  await expect(goneHomeList(page).getByRole('heading', { name: 'Gone home', level: 2 })).toBeVisible();
  await expect(goneHomeList(page).getByText('Nobody has gone home yet')).toBeVisible();
  // back to Check in: the camera and the check-in list return, the check-out lists go
  await checkInMode(page);
  await expect(faceCard(page)).toBeVisible();
  await expect(manualList(page)).toBeVisible();
  await expect(inClubList(page)).toHaveCount(0);
  c.assertClean();
});

test('the switch works with the keyboard: arrow keys move between Check in and Check out', async ({ page }) => {
  await signIn(page, 's1');
  await modeTab(page, 'in').focus();
  await page.keyboard.press('ArrowRight');
  await expect(modeTab(page, 'out')).toHaveAttribute('aria-selected', 'true');
  await expect(modeTab(page, 'out')).toBeFocused();
  await expect(inClubList(page)).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(modeTab(page, 'in')).toHaveAttribute('aria-selected', 'true');
  await expect(modeTab(page, 'in')).toBeFocused();
  await expect(faceCard(page)).toBeVisible();
  // the content under the tabs is their panel
  await expect(page.getByRole('tabpanel')).toContainText('Check in a member');
});

test('Simulate next arrival picks Oma Lina; her 11th visit is an extra day, said before confirming and in the toast; Undo reverses it', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's1');
  await expect(faceCard(page).getByText('Standing by')).toBeVisible();
  await page.getByRole('button', { name: 'Simulate next arrival' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Recognising…' })).toBeVisible();
  await expect(faceCard(page).getByText('98% match')).toBeVisible();
  await expect(faceCard(page).getByText('Oma Lina Wijaya')).toBeVisible();
  await expect(faceCard(page).getByText('Flex · visit 11 of 10 this month')).toBeVisible();
  await expect(faceCard(page).getByText(EXTRA_NOTE)).toBeVisible();
  await expect(faceCard(page).getByRole('radio')).toHaveCount(0); // nobody is recorded as bringing her
  await expect(faceCard(page)).not.toContainText(/brought by|escort|nanny/i);
  await assertNoHorizontalScroll(page);
  await page.getByRole('button', { name: 'Confirm check-in' }).click();
  await expect(toast(page, /Oma Lina checked in at \d\d:\d\d\. Maria and Daniel got a message\. This is an extra day: Rp\s650\.000 on next month’s invoice\./)).toBeVisible();
  await expect(tile(page, 'inClub')).toHaveText('4');
  await expect(rowOf(page, 'Oma Lina Wijaya')).toHaveCount(0); // she left the check-in list…
  await expect(faceCard(page).getByText('Standing by')).toBeVisible();
  await expect(modeTab(page, 'in')).toContainText('1'); // …one member is left to check in
  await expect(modeTab(page, 'out')).toContainText('4');
  await checkOutMode(page);
  await expect(rowOf(page, 'Oma Lina Wijaya')).toHaveText('Check out'); // …and is on the check-out list
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(toast(page, /Oma Lina’s check-in was undone\./)).toBeVisible();
  await expect(tile(page, 'inClub')).toHaveText('3');
  await expect(rowOf(page, 'Oma Lina Wijaya')).toHaveCount(0);
  await checkInMode(page);
  await expect(rowOf(page, 'Oma Lina Wijaya')).toHaveText('Check in');
  c.assertClean();
});

test('management and finance are told about the extra day; the family only gets the plain check-in message', async ({ page, request }) => {
  await signIn(page, 's1');
  await page.getByRole('button', { name: 'Simulate next arrival' }).click();
  await expect(faceCard(page).getByText('98% match')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm check-in' }).click();
  await expect(toast(page, /This is an extra day/)).toBeVisible();
  const notes = async (user: string) => {
    const state = (await (await request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': user } })).json()).state;
    return Object.values<{ kind: string; params: Record<string, unknown>; toRoles: string[]; link: string; deletedAt?: string }>(state.notifications).filter((n) => !n.deletedAt);
  };
  const forMgmt = (await notes('s9')).filter((n) => n.kind === 'lobby.notif.extraVisit');
  expect(forMgmt).toHaveLength(1);
  expect(forMgmt[0]).toMatchObject({ link: '/members/m1', toRoles: ['mgmt', 'finance'], params: { name: 'Oma Lina', n: 11, price: 'Rp 650.000' } });
  expect((await notes('s10')).filter((n) => n.kind === 'lobby.notif.extraVisit')).toHaveLength(1);
  expect((await notes('f1')).filter((n) => n.kind === 'lobby.notif.extraVisit')).toHaveLength(0);
  expect((await notes('f1')).filter((n) => n.kind === 'notif.checkedIn')).toHaveLength(1);
});

test('check in by name from the list: Opa Budi (Gold, unlimited) confirms in a dialog (a bottom sheet on phones), never in the face camera card; no escort, no extra-day note', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's1');
  await rowOf(page, 'Opa Budi Wijaya').click();
  const confirm = page.getByRole('button', { name: 'Confirm check-in' });
  await expect(confirm).toBeVisible();
  await expect(confirm).toBeInViewport(); // never off-screen
  await expect(page.getByRole('dialog', { name: 'Check in' })).toBeVisible();
  await expect(faceCard(page).getByRole('button', { name: 'Confirm check-in' })).toHaveCount(0); // a manual pick is not a face match
  await expect(page.getByText('Gold · unlimited days')).toBeVisible();
  await expect(page.getByText(/an extra day/)).toHaveCount(0);
  await expect(page.getByRole('radio')).toHaveCount(0);
  await confirm.click();
  await expect(toast(page, /Opa Budi checked in at \d\d:\d\d\. Maria and Daniel got a message\./)).toBeVisible();
  await expect(toast(page, /extra day/)).toHaveCount(0);
  await expect(tile(page, 'inClub')).toHaveText('4');
  await expect(rowOf(page, 'Opa Budi Wijaya')).toHaveCount(0); // checked in: off the check-in list
  await checkOutMode(page);
  await expect(openRow(page, 'Opa Budi Wijaya')).toContainText(/Arrived \d\d:\d\d/);
  await expect(openRow(page, 'Opa Budi Wijaya')).not.toContainText('·'); // just the time: nobody "brought" him
  await expect(page.getByRole('button', { name: 'Confirm check-in' })).toHaveCount(0);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('Cancel closes a manual check-in without changing anything', async ({ page }) => {
  await signIn(page, 's1');
  await rowOf(page, 'Opa Budi Wijaya').click();
  await page.getByRole('dialog', { name: 'Check in' }).getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: 'Confirm check-in' })).toHaveCount(0);
  await expect(tile(page, 'inClub')).toHaveText('3');
  await expect(rowOf(page, 'Opa Budi Wijaya')).toHaveText('Check in');
});

test('search the check-in list by name, family or phone, then check in; undo from the drawer', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's1');
  const list = manualList(page);
  const search = list.getByLabel('Search by name, family or phone');
  expect((await search.boundingBox())?.height).toBeGreaterThan(30); // an underline search, not squashed
  await search.fill('zzz');
  await expect(list.getByText('No member matches “zzz”.')).toBeVisible();
  await search.fill('maria'); // a family member's name finds both of her relatives
  await expect(list.getByRole('button', { name: /^Check in: Oma Lina Wijaya/ })).toBeVisible();
  await expect(list.getByRole('button', { name: /^Check in: Opa Budi Wijaya/ })).toBeVisible();
  await search.fill('812 1090'); // phone digits
  await expect(list.getByRole('button', { name: /^Check in: Oma Lina Wijaya/ })).toBeVisible();
  await search.fill('lina');
  await expect(list.getByRole('button', { name: /^Check in: Opa Budi Wijaya/ })).toHaveCount(0);
  await list.getByRole('button', { name: /^Check in: Oma Lina Wijaya/ }).click();
  await expect(page.getByText('Flex · visit 11 of 10 this month')).toBeVisible();
  await expect(page.getByText(EXTRA_NOTE)).toBeVisible(); // said before it is confirmed
  await page.getByRole('button', { name: 'Confirm check-in' }).click();
  await expect(toast(page, /Oma Lina checked in at \d\d:\d\d\./)).toBeVisible();
  await expect(search).toHaveValue(''); // ready for the next person
  await expect(tile(page, 'inClub')).toHaveText('4');
  // undo from the drawer (she is on the check-out list now)
  await checkOutMode(page);
  await openRow(page, 'Oma Lina Wijaya').click();
  const drawer = page.getByRole('dialog', { name: 'Oma Lina Wijaya' });
  await expect(drawer.getByText(/Arrived \d\d:\d\d$/).first()).toBeVisible();
  await drawer.getByRole('button', { name: 'Undo check-in' }).click();
  await expect(toast(page, /Oma Lina’s check-in was undone\./)).toBeVisible();
  await expect(drawer.getByText('Not checked in today · Usually arrives around 10:05')).toBeVisible();
  await expect(tile(page, 'inClub')).toHaveText('3');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

/** Management adds `n` members (active today, usual arrival 11:00+) so the lists run past one page. The seed has only five. */
async function addMembers(request: APIRequestContext, n: number) {
  for (let i = 0; i < n; i++) {
    const nn = String(i).padStart(2, '0');
    const r = await request.post('/api/actions/members.create', {
      headers: { 'x-user-id': 's9' },
      data: { mutationId: `e2e-pager-${i}`, club: 'citra', input: { title: 'Opa', name: `Pager Test${nn}`, dob: '1945-03-02', usualArrival: `11:${String(10 + i).padStart(2, '0')}`, plan: 'gold', start: '2026-10-21', contact: { name: `Pager Family${nn}`, phone: `+62 812 9000 00${nn}`, relation: 'daughter', primary: true }, formMediaId: 'md_e2eregistrationform0001', formFileName: 'registration-form.jpg', consent: { data: true, face: true } } },
    });
    expect(r.ok(), await r.text()).toBeTruthy();
  }
}
const lobbyAs = (request: APIRequestContext, action: string, memberId: string, tag: string) =>
  request.post(`/api/actions/${action}`, { headers: { 'x-user-id': 's1' }, data: { mutationId: `e2e-${tag}-${memberId}`, club: 'citra', input: action === 'attendance.checkIn' ? { memberId, method: 'manual' } : { memberId } } });

test('long lists are paged: the check-in list, the check-out list and Gone home show 10 members at a time; searching goes back to page 1', async ({ page, request }) => {
  const c = watchConsole(page);
  await addMembers(request, 12); // 14 members not in yet
  await signIn(page, 's1');
  const list = manualList(page);
  const rows = list.getByRole('button', { name: /^Check in: / });
  await expect(rows).toHaveCount(10);
  await expect(list.getByTestId('count-checkin')).toHaveText('14');
  const pager = list.getByRole('navigation', { name: 'Pages of Check in a member' });
  await expect(pager).toBeVisible();
  await expect(pager.getByRole('button', { name: 'Previous page' })).toHaveAttribute('aria-disabled', 'true');
  await pager.getByRole('button', { name: 'Next page' }).click();
  await expect(rows).toHaveCount(4);
  await expect(pager.getByRole('button', { name: 'Next page' })).toHaveAttribute('aria-disabled', 'true');
  await fontsReady(page);
  await assertNoHorizontalScroll(page);
  // a search goes back to page 1 and narrows the count: "12 of 14"
  const search = list.getByLabel('Search by name, family or phone');
  await search.fill('pager');
  await expect(list.getByTestId('count-checkin')).toHaveText('12 of 14');
  await expect(rows).toHaveCount(10);
  await search.fill('Test05');
  await expect(rows).toHaveCount(1);
  await expect(pager).toHaveCount(0);
  await search.fill('');
  // check-out mode: everyone checked in → the in-club list pages too; some leave → Gone home pages
  const snap = (await (await request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': 's9' } })).json()).state;
  const created = Object.values<{ id: string; firstName: string }>(snap.members).filter((m) => m.firstName === 'Pager').map((m) => m.id);
  expect(created).toHaveLength(12);
  for (const id of created) expect((await lobbyAs(request, 'attendance.checkIn', id, 'in')).ok()).toBeTruthy();
  for (const id of created.slice(0, 11)) expect((await lobbyAs(request, 'attendance.checkOut', id, 'out')).ok()).toBeTruthy();
  await page.reload();
  await expect(tile(page, 'inClub')).toHaveText('4'); // 3 in the seed + the one who stayed
  await expect(tile(page, 'goneHome')).toHaveText('11');
  await openTile(page, 'goneHome');
  const gone = goneHomeList(page);
  await expect(gone.getByRole('button', { name: /^Opa Pager Test\d\d/ })).toHaveCount(10);
  const gonePager = gone.getByRole('navigation', { name: 'Pages of Gone home' });
  await gonePager.getByRole('button', { name: 'Next page' }).click();
  await expect(gone.getByRole('button', { name: /^Opa Pager Test\d\d/ })).toHaveCount(1);
  await openTile(page, 'inClub');
  await expect(inClubList(page).getByRole('navigation')).toHaveCount(0); // four in the club: one page
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('face opt-out: once management records it, Simulate skips Oma Lina and she is still checked in by name', async ({ page, request }) => {
  const r = await request.post('/api/actions/members.setConsent', { headers: { 'x-user-id': 's9' }, data: { mutationId: 'e2e-optout', club: 'citra', input: { memberId: 'm1', face: false } } });
  expect(r.ok(), await r.text()).toBeTruthy();
  await signIn(page, 's1');
  await page.getByRole('button', { name: 'Simulate next arrival' }).click();
  await expect(faceCard(page).getByText('98% match')).toBeVisible();
  await expect(faceCard(page).getByText('Opa Budi Wijaya')).toBeVisible(); // not Oma Lina
  // "Not this person" asks who it really is: pick Oma Lina, then confirm as a manual check-in
  await page.getByRole('button', { name: 'Not this person' }).click();
  const who = page.getByRole('dialog', { name: 'Who is this?' });
  await expect(who.getByRole('button', { name: /Opa Budi Wijaya/ })).toHaveCount(0); // the wrong match is not offered
  await who.getByRole('button', { name: /Oma Lina Wijaya/ }).click();
  await page.getByRole('dialog', { name: 'Check in' }).getByRole('button', { name: 'Confirm check-in' }).click();
  await expect(toast(page, /Oma Lina checked in at \d\d:\d\d\./)).toBeVisible();
  await expect(tile(page, 'inClub')).toHaveText('4');
});

test('check out Opa Hendra: send to the health station, then one confirmation; undo the check-out from the drawer', async ({ page, request }) => {
  const c = watchConsole(page);
  await signIn(page, 's1');
  await checkOutMode(page);
  await rowOf(page, 'Opa Hendra Gunawan').click();
  const dialog = page.getByRole('dialog', { name: 'Check out · Opa Hendra' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('radio')).toHaveCount(0); // nobody is recorded as collecting him
  await expect(dialog.locator('a[href^="tel:"]')).toHaveCount(0);
  await expect(dialog).not.toContainText(/collecting|collected|driver|Cynthia/i);
  await expect(dialog.getByText('Departure blood pressure not taken yet.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Send to health station' }).click();
  await expect(toast(page, /Opa Hendra sent to the health station\./)).toBeVisible();
  await expect(dialog.getByText('Waiting at the health station for the departure check.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Send to health station' })).toHaveCount(0);
  // the request is on the attendance row the nurse queue reads
  const snap = await request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': 's8' } });
  const state = (await snap.json()).state;
  expect(state.attendance['2026-10-21:m2'].departureAsked).toMatchObject({ by: 'staff:s1' });
  await dialog.getByRole('button', { name: 'Check out and tell family' }).click();
  await expect(toast(page, /Opa Hendra checked out at \d\d:\d\d\. Family told\./)).toBeVisible();
  await expect(dialog).toHaveCount(0);
  const after = (await (await request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': 's8' } })).json()).state;
  expect(after.attendance['2026-10-21:m2'].checkOut).toMatchObject({ by: 'staff:s1', method: 'manual' });
  expect(after.attendance['2026-10-21:m2'].checkOut).not.toHaveProperty('escort');
  await expect(tile(page, 'inClub')).toHaveText('2');
  await expect(tile(page, 'goneHome')).toHaveText('1');
  await expect(inClubList(page).getByRole('button', { name: /Opa Hendra/ })).toHaveCount(0); // off the check-out list…
  await openTile(page, 'goneHome');
  await expect(goneHomeList(page)).toBeInViewport();
  await expect(goneHomeList(page).getByRole('button', { name: /^Opa Hendra Gunawan/ })).toContainText(/Arrived 09:40 · left \d\d:\d\d/); // …and on Gone home
  await expect(openRow(page, 'Opa Hendra Gunawan')).toContainText(/Arrived 09:40 · left \d\d:\d\d/);
  // undo the check-out from the drawer
  await openRow(page, 'Opa Hendra Gunawan').click();
  const drawer = page.getByRole('dialog', { name: 'Opa Hendra Gunawan' });
  await expect(drawer).not.toContainText(/Collected by/i);
  await drawer.getByRole('button', { name: 'Undo check-out' }).click();
  await expect(toast(page, /Opa Hendra’s check-out was undone\./)).toBeVisible();
  await expect(tile(page, 'inClub')).toHaveText('3');
  await expect(tile(page, 'goneHome')).toHaveText('0');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('the member drawer: today, care, notes and family with tel: links; no Brought by, Collected by, absent or late buttons', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's1');
  await checkOutMode(page);
  await openRow(page, 'Opa Hendra Gunawan').click();
  const drawer = page.getByRole('dialog', { name: 'Opa Hendra Gunawan' });
  await expect(drawer.getByRole('heading', { name: 'Opa Hendra Gunawan' })).toBeVisible();
  await expect(drawer.getByText('84 · Gold · unlimited days')).toBeVisible();
  await expect(drawer.getByText('Arrived 09:40', { exact: true })).toBeVisible();
  await expect(drawer).toContainText('Walker');
  await expect(drawer.getByText('Shared with family:')).toBeVisible();
  await expect(drawer.getByText('Staff only:').first()).toBeVisible();
  await expect(drawer.getByText('Care instructions')).toBeVisible();
  const call = drawer.locator('a[href^="tel:"]');
  await expect(call.first()).toHaveAttribute('href', 'tel:+6281512944718');
  await expect(call.first()).toHaveAccessibleName('Call Cynthia Gunawan');
  expect(await call.count()).toBe(2);
  await expect(drawer.getByText('Daughter · Primary billing contact · +62 815-1294-4718')).toBeVisible();
  await expect(drawer).not.toContainText(/Brought by|Collected by|Change:/i);
  await expect(drawer.getByRole('button', { name: /Absent today|Running late|Change/ })).toHaveCount(0);
  await expect(drawer.getByRole('button', { name: 'Undo check-in' })).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Check out', exact: true })).toBeVisible();
  await drawer.getByRole('button', { name: /Open full profile/ }).click();
  await expect(page).toHaveURL(/\/members\/m2$/);
  await expect(drawer).toHaveCount(0); // the drawer closes as the profile opens
  await expect(tile(page, 'inClub')).toHaveCount(0); // the profile (loaded on demand) has replaced the board
  await page.goBack();
  await expect(modeTab(page, 'in')).toBeVisible();
  await expect(modeTab(page, 'in')).toHaveAttribute('aria-selected', 'true'); // the board starts in Check in mode again
  c.assertClean();
});

test('the drawer of a member who has not come in: usual arrival, the nanny as care information, and Check in', async ({ page }) => {
  await signIn(page, 's1');
  await openRow(page, 'Oma Lina Wijaya').click();
  const drawer = page.getByRole('dialog', { name: 'Oma Lina Wijaya' });
  await expect(drawer.getByText('Flex · visit 11 of 10 this month')).toBeVisible();
  await expect(drawer.getByText('Not checked in today · Usually arrives around 10:05')).toBeVisible();
  await expect(drawer.getByText('With Mbak Sari, her nanny')).toBeVisible();
  await expect(drawer.locator('a[href^="tel:"]')).toHaveCount(2); // Maria and Daniel (the nanny has no number on file)
  await expect(drawer.getByText('Mbak Sari', { exact: true })).toBeVisible(); // listed with the family as a contact
  await expect(drawer.getByRole('button', { name: 'Undo check-in' })).toHaveCount(0);
  await expect(drawer.getByRole('button', { name: /Absent today|Running late/ })).toHaveCount(0);
  // Check in from the drawer closes it and opens the confirm for her
  await drawer.getByRole('button', { name: 'Check in', exact: true }).click();
  await expect(drawer).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Confirm check-in' })).toBeVisible();
  await expect(page.getByText(EXTRA_NOTE)).toBeVisible();
});

test('guests in "Also today": check in the trial guest (she joins the nurse queue), mark the visit guest a no-show, undo it', async ({ page, request }) => {
  const c = watchConsole(page);
  await signIn(page, 's1');
  const also = alsoToday(page);
  await expect(also.getByText('Trial day: Oma Siu Lan Tjandra')).toBeVisible();
  await expect(also.getByText('With Melinda Tjandra (daughter) · referral')).toBeVisible();
  // a trial pass has no time of its own; the visit guest shows hers, and trials are listed before timed visits
  const order = (await also.innerText()).replace(/\s+/g, ' ');
  expect(order.indexOf('Trial day: Oma Siu Lan Tjandra')).toBeLessThan(order.indexOf('Visit: Bapak Yusuf Hamid'));
  await expect(also.getByText('Shellfish')).toHaveCount(0); // no food tags on Arrivals
  await expect(also.getByText('Penicillin allergy')).toBeVisible();
  await expect(also.getByText('Visit: Bapak Yusuf Hamid')).toBeVisible();
  await expect(also.getByText('14:00', { exact: true })).toBeVisible();
  await expect(also.locator('a[href="tel:+6281277812290"]')).toHaveAccessibleName('Call Melinda Tjandra'); // the front desk can ring the person who booked
  await also.getByRole('button', { name: 'Check in: Oma Siu Lan Tjandra' }).click();
  await expect(toast(page, /Oma Siu Lan Tjandra checked in at \d\d:\d\d\. Sent to the health station\./)).toBeVisible();
  await expect(also.getByText(/Checked in \d\d:\d\d/)).toBeVisible();
  const state = (await (await request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': 's8' } })).json()).state;
  expect(state.guestVisits['g-e1'].checkIn).toMatchObject({ by: 'staff:s1' });
  await expect(tile(page, 'inClub')).toHaveText('3'); // guests are not members: the member counts do not change
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(toast(page, /Oma Siu Lan Tjandra’s check-in was undone\./)).toBeVisible();
  await also.getByRole('button', { name: 'No-show: Bapak Yusuf Hamid' }).click();
  await expect(toast(page, /Bapak Yusuf Hamid marked as not coming\./)).toBeVisible();
  await expect(also.getByText('Did not come')).toBeVisible();
  await also.getByRole('button', { name: 'Undo no-show' }).click();
  await expect(also.getByRole('button', { name: 'Check in: Bapak Yusuf Hamid' })).toBeVisible();
  // check the trial guest out later
  await also.getByRole('button', { name: 'Check in: Oma Siu Lan Tjandra' }).click();
  await also.getByRole('button', { name: 'Check out' }).click();
  await expect(also.getByText(/Left \d\d:\d\d/)).toBeVisible();
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('"Also today" lists the guests only, and a guest title opens its enquiry; there are no unread messages', async ({ page }) => {
  await signIn(page, 's1');
  const also = alsoToday(page);
  await also.getByRole('button', { name: /Trial day: Oma Siu Lan Tjandra/ }).click();
  await expect(page).toHaveURL(/\/enquiries$/);
  await page.goBack();
  await expect(also.getByRole('button', { name: /Trial day: Oma Siu Lan Tjandra/ })).toBeVisible();
  await expect(also.getByRole('button', { name: /Visit: Bapak Yusuf Hamid/ })).toBeVisible();
  await expect(also).not.toContainText(/unread|dentist/i);
  await expect(page.locator('[data-nav-key="chat"]')).toHaveCount(0);
});

test('the number tabs pick the list: In the club and Gone home bring their list into view; the layout follows the width', async ({ page }) => {
  await signIn(page, 's1');
  await fontsReady(page);
  // Not in yet: wide = the list left, the camera rail right; narrow = the check-in list, "Also today", then the camera
  const cam = await faceCard(page).boundingBox();
  const list = await manualList(page).boundingBox();
  if (wideLayout(page)) {
    expect(cam!.x).toBeGreaterThan(list!.x + list!.width - 1); // the list on the left, the camera on the right
  } else {
    expect(cam!.y).toBeGreaterThan(list!.y + list!.height - 1); // stacked: the check-in list first, then the camera
    expect(Math.abs(list!.x - cam!.x)).toBeLessThan(40);
  }
  await expect(modeTab(page, 'in')).toHaveAttribute('aria-selected', 'true');
  await openTile(page, 'goneHome');
  await expect(page.getByRole('tab', { name: /^Gone home/ })).toHaveAttribute('aria-selected', 'true');
  await expect(modeTab(page, 'in')).toHaveAttribute('aria-selected', 'false');
  await expect(faceCard(page)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Gone home', level: 2 })).toBeInViewport();
  await checkInMode(page);
  await expect(faceCard(page)).toBeVisible();
  await openTile(page, 'inClub');
  await expect(modeTab(page, 'out')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'In the club', level: 2 })).toBeInViewport();
  await expect(inClubList(page).getByRole('button', { name: /^Check out: / })).toHaveCount(3);
});

test('guided-demo deep link: /today?demo=arrival plays Oma Lina’s face check-in by itself and clears the parameter', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's1', '/today?demo=arrival');
  await expect(page.getByRole('status').filter({ hasText: 'Recognising…' })).toBeVisible();
  await expect(faceCard(page).getByText('98% match')).toBeVisible();
  await expect(faceCard(page).getByText('Oma Lina Wijaya')).toBeVisible();
  await expect(faceCard(page).getByRole('radio')).toHaveCount(0);
  await expect(toast(page, /Oma Lina checked in at \d\d:\d\d\. Maria and Daniel got a message\. This is an extra day/)).toBeVisible({ timeout: 10_000 });
  await expect(tile(page, 'inClub')).toHaveText('4');
  await expect(page).not.toHaveURL(/demo=/);
  await expect(page).toHaveURL(/\/today$/);
  // a reload does not repeat it, and with Oma Lina already in the club the link does nothing
  await page.reload();
  await expect(tile(page, 'inClub')).toHaveText('4');
  await page.goto('/today?demo=arrival');
  await expect(tile(page, 'inClub')).toHaveText('4');
  await expect(page).not.toHaveURL(/demo=/);
  await expect(page.getByRole('button', { name: 'Confirm check-in' })).toHaveCount(0);
  c.assertClean();
});

test('Indonesian: the board, check-in list, drawer, check-out and the extra-day note show no raw keys', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's1', '/today', 'id');
  await expect(page.getByRole('heading', { name: 'Kedatangan', level: 1 })).toBeVisible();
  await expect(page.getByText('Klub buka sampai 16:30')).toBeVisible();
  await expect(page.getByText('Perkiraan 10:05', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Check-in anggota' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /^Check-in/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tablist', { name: 'Check-in atau check-out' })).toBeVisible();
  const text = async () => (await page.locator('body').innerText());
  let t = await text();
  expect(t).not.toMatch(RAW_KEY);
  expect(t).not.toMatch(GENERIC_KEY);
  await fontsReady(page);
  await assertNoHorizontalScroll(page); // Indonesian texts are longer: nothing may push the page sideways
  await page.getByRole('button', { name: /^Check-in: Opa Budi/ }).click();
  await expect(page.getByRole('button', { name: 'Konfirmasi check-in' })).toBeVisible();
  await expect(page.getByText('Gold · hari tanpa batas')).toBeVisible();
  t = await text();
  expect(t).not.toMatch(RAW_KEY);
  await page.getByRole('dialog').getByRole('button', { name: 'Batal' }).click(); // a manual pick cancels; only a face match says "Bukan orang ini"
  await page.getByRole('button', { name: 'Simulasikan kedatangan berikutnya' }).click();
  await expect(page.getByText('Kunjungan ke-11 dari 10 bulan ini: hari tambahan, Rp 650.000 di tagihan bulan depan.')).toBeVisible();
  t = await text();
  expect(t).not.toMatch(RAW_KEY);
  await page.getByRole('button', { name: 'Bukan orang ini' }).click();
  await expect(page.getByRole('dialog', { name: 'Siapa ini?' })).toBeVisible();
  expect(await text()).not.toMatch(RAW_KEY);
  await page.getByRole('button', { name: 'Bukan siapa-siapa: tutup' }).click();
  await page.getByRole('tab', { name: /^Check-out/ }).click(); // Check-out mode: the members in the club, and Sudah pulang
  await expect(page.getByRole('region', { name: 'Di klub' })).toBeVisible();
  await page.getByRole('tab', { name: /Sudah pulang/ }).click(); // the number tabs pick one list at a time
  await expect(page.getByRole('region', { name: 'Sudah pulang' }).getByText('Belum ada yang pulang')).toBeVisible();
  await page.getByRole('tab', { name: /Di klub/ }).click();
  await expect(page.getByRole('region', { name: 'Di klub' })).toBeVisible();
  await page.getByRole('region', { name: 'Di klub' }).getByLabel('Cari nama, keluarga, atau nomor telepon').fill('zzz');
  await expect(page.getByText('Tidak ada anggota di klub yang cocok dengan “zzz”.')).toBeVisible();
  await page.getByRole('region', { name: 'Di klub' }).getByLabel('Cari nama, keluarga, atau nomor telepon').fill('');
  t = await text();
  expect(t).not.toMatch(RAW_KEY);
  expect(t).not.toMatch(GENERIC_KEY);
  await assertNoHorizontalScroll(page);
  await openRow(page, 'Opa Hendra Gunawan').click();
  t = await text();
  expect(t).not.toMatch(RAW_KEY);
  expect(t).toContain('Petunjuk perawatan');
  // the drawer closes with ✕ on wider screens; on a phone it is a pushed screen with "‹ Kedatangan"
  await page.getByRole('dialog', { name: 'Opa Hendra Gunawan' }).getByRole('button', { name: /^(Tutup|Kedatangan)$/ }).click();
  await page.getByRole('button', { name: /^Check-out: Opa Hendra/ }).click();
  await expect(page.getByRole('dialog', { name: 'Check-out · Opa Hendra' })).toBeVisible();
  t = await text();
  expect(t).not.toMatch(RAW_KEY);
  expect(t).toContain('Tekanan darah pulang belum diukur.');
  await page.keyboard.press('Escape');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('a closed day shows "Club closed" instead of the board (English and Indonesian) and never crashes', async ({ page, request }) => {
  const c = watchConsole(page);
  const r = await request.post('/api/actions/calendarEvent.create', { headers: { 'x-user-id': 's9' }, data: { mutationId: 'e2e-closed', club: 'citra', input: { date: '2026-10-21', kind: 'closed', title: 'Staff training day', titleId: 'Hari pelatihan staf' } } });
  expect(r.ok(), await r.text()).toBeTruthy();
  await signIn(page, 's1');
  await expect(page.getByText('Staff training day')).toBeVisible(); // the empty state carries the closure's own title
  await expect(page.locator('#main')).toContainText('Club closed'); // and the header pill says it too
  await expect(page.getByText(/The club is closed today\. We open again on Thursday 22 October\./)).toBeVisible();
  await expect(tile(page, 'inClub')).toHaveCount(0);
  await expect(manualList(page)).toHaveCount(0); // nobody can check in on a closed day
  await expect(page.getByRole('tab')).toHaveCount(0); // and there is no Check in | Check out switch
  await assertNoHorizontalScroll(page);
  await signIn(page, 's1', '/today', 'id');
  await expect(page.getByText('Hari pelatihan staf')).toBeVisible();
  await expect(page.locator('#main')).toContainText('Klub tutup');
  await expect(page.getByText(/Klub tutup hari ini\. Kami buka lagi pada Kamis, 22 Oktober\./)).toBeVisible();
  c.assertClean();
});

test('layout: the board fits the screen with its confirm, drawer and dialog open', async ({ page }) => {
  await signIn(page, 's1');
  await fontsReady(page);
  await assertNoHorizontalScroll(page);
  await rowOf(page, 'Opa Budi Wijaya').click();
  await expect(page.getByRole('button', { name: 'Confirm check-in' })).toBeVisible();
  await assertNoHorizontalScroll(page);
  await page.getByRole('dialog', { name: 'Check in' }).getByRole('button', { name: 'Cancel' }).click();
  await checkOutMode(page);
  await assertNoHorizontalScroll(page);
  await openRow(page, 'Bapak Bambang Purnomo').click();
  const drawer = page.getByRole('dialog', { name: 'Bapak Bambang Purnomo' });
  await expect(drawer).toBeVisible();
  await page.waitForTimeout(400); // the drawer slides in
  const box = await drawer.boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual((page.viewportSize()?.width || 1440) + 1);
  if (isPhone(page)) expect(box!.width).toBeGreaterThanOrEqual((page.viewportSize()?.width || 390) - 2);
  else expect(Math.round(box!.width / (await uiZoom(page)))).toBe(440); // CSS px: the page is zoomed
  await assertNoHorizontalScroll(page);
  await page.keyboard.press('Escape');
  await rowOf(page, 'Opa Hendra Gunawan').click();
  await expect(page.getByRole('dialog', { name: 'Check out · Opa Hendra' })).toBeVisible();
  await assertNoHorizontalScroll(page);
});
