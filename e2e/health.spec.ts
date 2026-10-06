// Nurse area: the health station (no queue: every active member in one searchable, paged list with the ones in the club first, chips for what is
// due, a suggested kind of check, PC-303 simulation, keypad and phone inputs, result banner, re-check, tell the family, monthly check that never
// blocks, today's readings corrected or removed, clear a reminder, trial guest, departure checks, guided-demo deep link) and the Readings screen
// (trends, and the record by day with the calendar). Every viewport: phone, phone360, tablet, laptop.
// Isolated env: E2E_NAME=nurse E2E_PORT=8841 scripts/e2e-all.sh 1 "phone laptop" health
import { test, expect, type APIRequestContext, type Browser, type Locator, type Page, type TestInfo } from '@playwright/test';
import { resetDemo, signIn, watchConsole, isPhone } from './helpers';
import { fieldText, goToPage, pickDate } from './kit';

const T = '2026-10-21';

/**
 * No horizontal page scroll; when there is some, the failure names the elements that stick out.
 * Waits for the web fonts first: until the icon font is in, an icon shows as its long ligature name and a row can briefly be too wide.
 */
async function assertNoHorizontalScroll(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  const r = await page.evaluate(() => {
    const main = document.querySelector('#main') as HTMLElement | null;
    const el = main || document.documentElement;
    const over = el.scrollWidth - el.clientWidth;
    const culprits: string[] = [];
    if (over > 1 && main) for (const e of Array.from(main.querySelectorAll('*'))) { const b = e.getBoundingClientRect(); if (b.right > main.clientWidth + 1 && culprits.length < 6) culprits.push(`${e.tagName}${e.getAttribute('data-testid') ? '[' + e.getAttribute('data-testid') + ']' : ''} right=${Math.round(b.right)} "${(e.textContent || '').slice(0, 30)}"`); }
    return { over, culprits };
  });
  expect(r.over, `horizontal overflow of ${r.over}px by: ${r.culprits.join(' | ')}`).toBeLessThanOrEqual(1);
}
test.beforeEach(async ({ request }) => { await resetDemo(request); });

// ---------- helpers ----------
const act = (page: Page, userId: string, name: string, input: unknown) =>
  page.request.post('/api/actions/' + name, { headers: { 'x-user-id': userId }, data: { mutationId: 'e2e-' + Math.random().toString(36).slice(2), club: 'citra', input } });
const stateOf = async (page: Page, userId: string) => (await (await page.request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': userId } })).json()).state;
const setClock = (page: Page, hm: string) => page.request.post('/api/demo/clock', { data: { hm } });
/** The lobby checks someone in. A check-in records who and when; nothing about who brought them. */
async function checkIn(page: Page, memberId: string) {
  const r = await act(page, 's1', 'attendance.checkIn', { memberId, method: 'face' });
  expect(r.ok()).toBeTruthy();
}
/** A second signed-in browser (another person's device) with the same viewport as the current project. */
async function another(browser: Browser, info: TestInfo, userId: string, path: string, lang: 'en' | 'id' = 'en') {
  const u = info.project.use;
  const ctx = await browser.newContext({ baseURL: u.baseURL as string, viewport: u.viewport ?? undefined, isMobile: u.isMobile, hasTouch: u.hasTouch, userAgent: u.userAgent, deviceScaleFactor: u.deviceScaleFactor });
  const page = await ctx.newPage();
  await signIn(page, userId, path, lang);
  return { page, close: () => ctx.close() };
}
/** Raw i18n keys that leaked into the UI (a namespace.key text must never be visible). */
const RAW_KEY = /\b(?:health|common|status|err|nav|roles|shell|notif|feed|chat|lobby|family|review|inv|members|profile)\.[A-Za-z][A-Za-z0-9.]*/;
const GENERIC_KEY = /\b[a-z]+\.[a-zA-Z]+\b/;
async function assertNoRawKeys(page: Page) {
  const text = await page.evaluate(() => document.body.innerText);
  expect(text.match(RAW_KEY)?.[0] ?? null, 'raw key in the UI').toBeNull();
  expect(text.match(GENERIC_KEY)?.[0] ?? null, 'key-like text in the UI').toBeNull();
}
/** Twelve more active members, so the list needs a second page. */
async function addMembers(page: Page, n = 12) {
  for (let i = 0; i < n; i++) {
    const nn = String(i).padStart(2, '0');
    const r = await page.request.post('/api/actions/members.create', {
      headers: { 'x-user-id': 's9' },
      data: { mutationId: `e2e-health-m${i}`, club: 'citra', input: { title: 'Opa', name: `Pager Test${nn}`, dob: '1945-03-02', usualArrival: '11:00', plan: 'gold', start: T, contact: { name: `Pager Family${nn}`, phone: `+62 812 9100 00${nn}`, relation: 'daughter', primary: true }, consent: { data: true, face: true } } },
    });
    expect(r.ok(), await r.text()).toBeTruthy();
  }
}

type G = 'bp' | 'vit' | 'glu' | 'wt';
const row = (page: Page, name: string | RegExp) => page.getByTestId('station-row').filter({ hasText: name });
const readingRow = (page: Page, name: string) => page.getByTestId('reading-row').filter({ hasText: name }).first();
const group = (page: Page, id: G) => page.locator(`[data-group="${id}"]`);
const flag = (where: Page | Locator, text: string | RegExp) => where.getByTestId('care-flag').filter({ hasText: text });
/** The detail: inline on tablet and laptop, a full-screen sheet on the phone. */
const detail = (page: Page, name: string) => (isPhone(page) ? page.getByRole('dialog', { name }) : page.locator('#main'));
const toast = (page: Page, re: RegExp) => page.getByRole('status').filter({ hasText: re });
const LABEL = { sys: 'Sys', dia: 'Dia', pulse: 'Pulse', spo2: 'SpO₂', temp: 'Temp', glucose: 'Glucose', weight: 'Weight', grip: 'Grip' } as const;
type FieldName = keyof typeof LABEL;
const saveBtn = (page: Page) => page.getByRole('button', { name: /^(Save and next|Save reading|Simpan dan lanjut|Simpan hasil ukur)$/ });
const kindBtn = (page: Page, name: string | RegExp) => page.getByTestId('kind-picker').getByRole('button', { name });
/** The words of the chips on a row (the icon font's ligature names are left out); `chipEl` is the chip itself (its tone). */
const chips = (r: Locator) => r.getByTestId('due-chip-label');
const chipEl = (r: Locator) => r.getByTestId('due-chip');
const hm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
/** On the phone a person's detail is a sheet above everything: its "← Health checks" bar goes back to the list. */
const backToList = async (page: Page, label = 'Health checks') => { if (isPhone(page)) await page.getByRole('dialog').getByRole('button', { name: label, exact: true }).click(); };

/** Tap a person's row (phone: opens their sheet) and wait for their detail. */
async function openPerson(page: Page, name: string) {
  await row(page, name).first().click();
  await expect(page.getByRole('heading', { level: 2, name: new RegExp(name) })).toBeVisible();
  if (isPhone(page)) await expect(page.getByRole('dialog', { name: new RegExp(name) })).toBeVisible();
}
const field = (page: Page, g: G, f: FieldName): Locator =>
  isPhone(page) ? group(page, g).getByLabel(LABEL[f], { exact: true }) : group(page, g).getByRole('button', { name: new RegExp('^' + LABEL[f]) });
/** The value a field shows (native input on the phone, the field button elsewhere). */
async function valueOf(page: Page, g: G, f: FieldName) {
  const el = field(page, g, f);
  if (isPhone(page)) return el.inputValue();
  return ((await el.textContent()) || '').replace(LABEL[f], '').replace(/mmHg|bpm|°C|mg\/dL|kg|%/g, '').trim();
}
const expectValue = async (page: Page, g: G, f: FieldName, v: string) => { await expect.poll(() => valueOf(page, g, f), { timeout: 12_000 }).toBe(v); };
/** Type a number: the on-screen keypad on tablet and laptop, the native input on the phone. */
async function typeValue(page: Page, g: G, f: FieldName, v: string) {
  if (isPhone(page)) { const el = field(page, g, f); await el.fill(''); await el.pressSequentially(v); return; } // real key presses: focus must stay in the input
  await field(page, g, f).click();
  for (const ch of v) await page.getByRole('button', { name: ch, exact: true }).click();
}
/** The PC-303 for a group: opening someone already waits for it (blood pressure, then oxygen and temperature); otherwise "Read PC-303". Waits for the values. */
async function readDevice(page: Page, g: 'bp' | 'vit' | 'glu') {
  const grp = group(page, g);
  const done = async () => (await grp.getAttribute('data-has')) === 'true' && (await grp.getAttribute('data-waiting')) === null;
  if ((await grp.getAttribute('data-waiting')) === null && (await grp.getAttribute('data-has')) === null) await grp.getByRole('button', { name: /PC-303/ }).click();
  await expect.poll(done, { timeout: 15_000 }).toBe(true);
}
/** Open a saved reading (its card on "today's readings") and return the card. */
async function openCard(where: Locator, kind: string | RegExp) {
  const card = where.getByTestId('reading-card').filter({ hasText: kind }).first();
  await card.getByRole('button', { expanded: false }).first().click();
  return card;
}

// ---------- the list ----------
test('the list: every member, the ones in the club first; the last reading; nothing "due"; no queue tabs', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's8');
  await expect(page.getByRole('heading', { name: 'Health checks', level: 1 })).toBeVisible();
  await expect(page.getByText('Health station · Wednesday 21 October')).toBeVisible();
  await expect(page.getByText('LEPU PC-303 · connected')).toBeVisible();
  await expect(page.getByText(/^\d\d:\d\d$/).first()).toBeVisible();
  await expect(page.getByText('3 in the club')).toBeVisible();
  await expect(page.getByText('5 members')).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(0); // no To do / Later / Done
  await expect(page.getByText('Later', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add to queue' })).toHaveCount(0);
  await expect(page.getByText('In the club today', { exact: true })).toBeVisible();
  await expect(page.getByText('Not in today', { exact: true })).toBeVisible();
  const rows = page.getByTestId('station-row');
  await expect(rows).toHaveCount(5);
  // in the club first (with something due on top), then the others by first name
  await expect(rows.nth(0)).toContainText('Opa Tjahjadi Lim');
  await expect(rows.nth(1)).toContainText('Opa Hendra Gunawan');
  await expect(rows.nth(2)).toContainText('Bapak Bambang Purnomo');
  await expect(rows.nth(3)).toContainText('Opa Budi Wijaya');
  await expect(rows.nth(4)).toContainText('Oma Lina Wijaya');
  for (const [i, p] of ['in', 'in', 'in', 'no', 'no'].entries()) await expect(rows.nth(i)).toHaveAttribute('data-presence', p);
  await expect(rows.nth(0)).toContainText('Arrived 09:38');
  // the last reading and its status
  await expect(rows.nth(0)).toContainText(/Last \d+\/\d+ · Tue 20 Oct/);
  await expect(rows.nth(1)).toContainText(/Last \d+\/\d+ · Tue 20 Oct/);
  await expect(rows.nth(1).getByTestId('status-badge')).toHaveAttribute('data-status', 'watch');
  await expect(rows.nth(2)).toContainText(/Today 09:55 · 122\/73/); // today's reading is the "today" info of the row
  await expect(rows.nth(2).getByTestId('status-badge')).toHaveAttribute('data-status', 'normal');
  await expect(rows.nth(3)).toContainText(/Last \d+\/\d+ · Tue 20 Oct/);
  // nothing is "due": no chips on any row
  for (let i = 0; i < 5; i++) await expect(chips(rows.nth(i))).toHaveCount(0);
  await expect(page.getByTestId('station-search')).toBeVisible();
  if (isPhone(page)) {
    // phone: the list alone; a row opens the detail as a full-screen sheet with a sticky "← Health checks" bar
    await expect(page.locator('[data-group]')).toHaveCount(0);
    await rows.nth(1).click();
    const sheet = page.getByRole('dialog', { name: 'Opa Hendra Gunawan' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('2 of 5')).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Health checks', exact: true })).toBeVisible();
    await expect(sheet.getByRole('textbox', { name: 'Sys' })).toBeVisible(); // native inputs
    await expect(sheet.getByRole('button', { name: '7', exact: true })).toHaveCount(0); // no keypad
    await assertNoHorizontalScroll(page);
    await sheet.getByRole('button', { name: 'Health checks', exact: true }).click();
    await expect(sheet).toHaveCount(0);
  } else {
    // tablet and laptop: nobody is open until a row is tapped; then the keypad is beside the fields
    await expect(page.getByText('Choose someone from the list')).toBeVisible();
    await rows.nth(1).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Opa Hendra Gunawan' })).toBeVisible();
    await expect(rows.nth(1)).toHaveAttribute('aria-current', 'true');
    await expect(page.getByText('Keypad · Sys')).toBeVisible();
    await expect(page.getByRole('button', { name: '7', exact: true })).toBeVisible();
    await rows.nth(0).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Opa Tjahjadi Lim' })).toBeVisible();
    await expect(rows.nth(0)).toHaveAttribute('aria-current', 'true');
  }
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('search by name or family name, and pages: ten at a time, a search goes back to page 1', async ({ page }) => {
  const c = watchConsole(page);
  await addMembers(page, 12); // 17 members in all
  await signIn(page, 's8');
  const rows = page.getByTestId('station-row');
  const list = page.getByTestId('station-list');
  await expect(page.getByText('17 members')).toBeVisible();
  await expect(rows).toHaveCount(10);
  await expect(rows.nth(0)).toContainText('Opa Tjahjadi Lim'); // the ones in the club stay first
  await expect(list.getByRole('navigation')).toBeVisible();
  await goToPage(page, 2);
  await expect(rows).toHaveCount(7);
  await expect(rows.last()).toContainText('Pager Test11');
  await expect(page.getByText('Not in today', { exact: true })).toBeVisible(); // the second page starts inside a group: it says which
  // a search goes back to page 1, matches the first name or the family name in any order, and shows how many were found
  const search = page.getByLabel('Search members');
  await search.fill('pager test03');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Opa Pager Test03');
  await expect(page.getByText('1 found')).toBeVisible();
  await expect(list.getByRole('navigation')).toHaveCount(0);
  await search.fill('gunawan');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Opa Hendra Gunawan');
  await search.fill('wijaya');
  await expect(rows).toHaveCount(2); // Budi and Lina, whose family name is Wijaya
  await search.fill('zzz');
  await expect(rows).toHaveCount(0);
  await expect(page.getByText('No matches')).toBeVisible();
  await expect(page.getByText('Check the spelling, or search by first or family name.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(rows).toHaveCount(10);
  await expect(search).toHaveValue('');
  // someone found by search can be opened and checked, whatever page they were on
  await search.fill('pager test11');
  await rows.first().click();
  await expect(page.getByRole('heading', { level: 2, name: /Pager Test11/ })).toBeVisible();
  await expect(detail(page, 'Opa Pager Test11').getByText('Not checked in today')).toBeVisible();
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('care flags: allergies, mobility, diet, lunchtime medicines and the staff-only instructions (lock tag)', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's8');
  await openPerson(page, 'Opa Tjahjadi');
  const d = detail(page, 'Opa Tjahjadi Lim');
  await expect(flag(d, 'Walker')).toHaveCount(1);
  await expect(flag(d, 'Soft food')).toHaveCount(1);
  await expect(flag(d, 'Metformin 500 mg · lunch')).toHaveCount(1);
  await expect(d.getByText('Staff only:')).toBeVisible();
  await expect(d.getByText(/Diabetic: offer the sugar-free snack at tea/)).toBeVisible();
  await expect(d.getByText('88 · Gold · arrived 09:38')).toBeVisible();
  await expect(d.getByText('In the club since 09:38')).toBeVisible();
  await backToList(page);
  await openPerson(page, 'Opa Hendra');
  const h = detail(page, 'Opa Hendra Gunawan');
  await expect(flag(h, 'Walker')).toHaveCount(1);
  await expect(flag(h, 'Low salt')).toHaveCount(1);
  await expect(h.getByText(/On watch for blood pressure since 14 Oct/)).toBeVisible();
  // the 4-week systolic chart is in the header
  await expect(h.getByText('Systolic, last 4 weeks')).toBeVisible();
  await backToList(page);
  // Bapak Bambang's seafood allergy shows, and his reading of today is on his detail
  await openPerson(page, 'Bapak Bambang');
  const b = detail(page, 'Bapak Bambang Purnomo');
  await expect(flag(b, 'Seafood')).toHaveCount(1);
  await expect(b.getByText(/Speak slowly and face him/)).toBeVisible();
  await expect(b.getByText('Today’s readings · 1')).toBeVisible();
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('the header links open the Trends screen on that member, and the member’s health record', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's8');
  await openPerson(page, 'Opa Hendra');
  await detail(page, 'Opa Hendra Gunawan').getByRole('button', { name: 'Trends' }).click();
  await expect(page).toHaveURL(/\/readings$/);
  await expect(page.getByRole('heading', { name: 'Readings', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Opa Hendra Gunawan' })).toBeVisible(); // selected from the link
  await page.goBack();
  await expect(page).toHaveURL(/\/today$/);
  await openPerson(page, 'Opa Hendra');
  c.assertClean();
  await detail(page, 'Opa Hendra Gunawan').getByRole('button', { name: 'Health record' }).click();
  await expect(page).toHaveURL(/\/members\/m2\/health$/);
});

// ---------- the reading form ----------
test('Hendra: Read PC-303 gives 164/98 (Alert), tell-the-family is on (no re-check switch), save: the row shows the reading, Cynthia has a nurse message', async ({ page, browser }, info) => {
  const c = watchConsole(page);
  await signIn(page, 's8');
  await openPerson(page, 'Opa Hendra');
  // the first reading of the day: the arrival check is suggested
  // nothing to save yet: the footer says what is missing and Save is not available
  await expect(saveBtn(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(group(page, 'bp').getByText(/^Last \d+\/\d+ · /)).toBeVisible(); // the last arrival reading
  await readDevice(page, 'bp');
  await expectValue(page, 'bp', 'sys', '164');
  await expectValue(page, 'bp', 'dia', '98');
  await expectValue(page, 'bp', 'pulse', '84');
  await expect(group(page, 'bp').getByTestId('status-badge')).toHaveAttribute('data-status', 'alert');
  await readDevice(page, 'vit');
  await expect(group(page, 'vit').getByTestId('status-badge')).toHaveAttribute('data-status', 'normal');
  // the result banner and its two switches
  const banner = page.getByRole('status').filter({ hasText: 'Above the alert line' });
  await expect(banner.getByTestId('status-badge')).toHaveAttribute('data-status', 'alert');
  await expect(banner).toContainText('Blood pressure 164/98.');
  const tell = page.getByRole('switch', { name: 'Tell Cynthia and Stephanie now' });
  await expect(tell).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('switch', { name: /Re-check in/ })).toHaveCount(0); // no re-check reminder: nothing is "due"
  // a quick note and a free-text note
  await page.getByRole('button', { name: 'Rested 5 minutes first' }).click();
  await expect(page.getByRole('button', { name: 'Rested 5 minutes first' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Note', { exact: true }).fill('Sat down first, felt fine');
  await expect(saveBtn(page)).not.toHaveAttribute('aria-disabled', 'true');
  await assertNoHorizontalScroll(page);
  await saveBtn(page).click(); // "Save and next": Tjahjadi is still waiting for his arrival check
  await expect(toast(page, /Saved for Opa Hendra: 164\/98, Alert\. Cynthia and Stephanie got a message\./)).toBeVisible();

  // server state: the reading, the re-check time, the messages
  const s = await stateOf(page, 's8');
  const rd = Object.values<any>(s.readings).find((r) => r.memberId === 'm2' && r.date === T);
  expect(rd).toMatchObject({ kind: 'arrival', sys: 164, dia: 98, pulse: 84, status: 'alert', takenBy: 's8', createdBy: 'staff:s8', noteKeys: ['rested'], note: 'Sat down first, felt fine', shared: true });
  expect(rd.familyTold.familyIds).toEqual(['fm2_0', 'fm2_1']);
  expect(s.attendance[`${T}:m2`].recheckDueAt).toBeUndefined();
  const th = Object.values<any>(s.threads).find((x) => x.familyId === 'fm2_0' && x.topic === 'nurse');
  const msgs = Object.values<any>(s.messages).filter((m) => m.threadId === th.id).sort((a, b) => a.seq - b.seq);
  expect(msgs.length).toBe(3);
  expect(msgs[2]).toMatchObject({ kind: 'healthAlert', from: 'staff:s8', ref: { type: 'reading', id: rd.id } });
  expect(msgs[2].text).toContain('164/98');
  expect(th.familyReadSeq).toBe(2); // unread for Cynthia
  const fam = await stateOf(page, 'fm2_0'); // what Cynthia’s own app receives
  expect(Object.values<any>(fam.messages).some((m) => m.threadId === th.id && m.seq === 3)).toBe(true);
  expect(Object.values<any>(fam.notifications).some((n) => n.kind === 'health.notif.fam.alert' && n.severity === 'urgent')).toBe(true);

  // "Save and next" moved on to the next person with something due: Tjahjadi
  if (isPhone(page)) await expect(page.getByRole('dialog', { name: 'Opa Tjahjadi Lim' })).toBeVisible();
  else await expect(page.getByRole('heading', { level: 2, name: 'Opa Tjahjadi Lim' })).toBeVisible();
  await backToList(page);
  // the list: Hendra's row has today's reading with its status and the chip with the re-check time; Tjahjadi stays on top
  await expect(page.getByTestId('station-row').nth(0)).toContainText('Opa Tjahjadi');
  const mine = row(page, 'Opa Hendra');
  await expect(mine).toContainText(/Today \d\d:\d\d · 164\/98/);
  await expect(mine.getByTestId('status-badge')).toHaveAttribute('data-status', 'alert');

  // today's readings on his detail: the real author, the notes, who was told
  await openPerson(page, 'Opa Hendra');
  const d = detail(page, 'Opa Hendra Gunawan');
  await expect(d.getByText('Today’s readings · 1')).toBeVisible();
  const card = await openCard(d, 'Arrival check');
  await expect(card.getByText(/Saved at \d\d:\d\d by Ns\. Dewi/)).toBeVisible();
  await expect(card.getByText('Rested 5 minutes first', { exact: true })).toBeVisible();
  await expect(card.getByText('Sat down first, felt fine')).toBeVisible();
  await expect(card.getByText(/Family told at \d\d:\d\d: Cynthia and Stephanie/)).toBeVisible();
  await expect(card.getByText('164/98', { exact: true })).toBeVisible();
  // and the next check suggested for him is the re-check
  c.assertClean();

  // management sees the Alert in their "Needs action" list, live, on another device
  const mgmt = await another(browser, info, 's9', '/today');
  await mgmt.page.getByRole('button', { name: /Notifications/ }).first().click();
  await expect(mgmt.page.getByRole('dialog', { name: 'Notifications' }).getByText('Alert reading: Opa Hendra · 164/98')).toBeVisible();
  await mgmt.close();
});

test('monthly values given with the vitals are saved as a monthly row and judged on their own (glucose 196 is Watch); both are in today’s readings', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's8');
  await openPerson(page, 'Opa Tjahjadi');
  await readDevice(page, 'bp');
  await readDevice(page, 'vit');
  await typeValue(page, 'glu', 'glucose', '196');
  await expect(group(page, 'glu').getByTestId('status-badge')).toHaveAttribute('data-status', 'watch');
  await typeValue(page, 'wt', 'weight', '54.6');
  await typeValue(page, 'wt', 'grip', '16');
  const banner = page.getByRole('status').filter({ hasText: 'A little outside the usual range' });
  await expect(banner).toContainText('Glucose 196 mg/dL.');
  await saveBtn(page).click();
  await expect(toast(page, /Saved for Opa Tjahjadi: \d+\/\d+, Watch\./)).toBeVisible();
  const s = await stateOf(page, 's8');
  const mine = Object.values<any>(s.readings).filter((r) => r.memberId === 'm20' && r.date === T);
  expect(mine.map((r) => r.kind).sort()).toEqual(['arrival', 'monthly']);
  expect(mine.find((r) => r.kind === 'arrival').status).toBe('normal');
  expect(mine.find((r) => r.kind === 'monthly')).toMatchObject({ glucose: 196, weight: 54.6, grip: 16, status: 'watch' });
  expect(s.attendance[`${T}:m20`].monthlyDeferred).toBeFalsy();
  await backToList(page);
  await expect(chips(row(page, 'Opa Tjahjadi'))).toHaveCount(0);
  // today's readings list both, the monthly one on its own so it can be corrected
  await openPerson(page, 'Opa Tjahjadi');
  const d = detail(page, 'Opa Tjahjadi Lim');
  await expect(d.getByText('Today’s readings · 2')).toBeVisible();
  await expect(d.getByTestId('reading-card').filter({ hasText: 'Monthly check' })).toContainText('Glucose 196 · weight 54.6 kg · grip 16 kg');
  c.assertClean();
});

test('keypad on tablet and laptop, native inputs on the phone: typed values give a live status; wrong numbers are refused; Close keeps each person’s numbers', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's8');
  await openPerson(page, 'Opa Hendra');
  await typeValue(page, 'bp', 'sys', '128');
  await typeValue(page, 'bp', 'dia', '80');
  await typeValue(page, 'bp', 'pulse', '74');
  await expectValue(page, 'bp', 'sys', '128');
  await expectValue(page, 'bp', 'dia', '80');
  await expect(group(page, 'bp').getByTestId('status-badge')).toHaveAttribute('data-status', 'normal');
  await typeValue(page, 'vit', 'spo2', '97');
  await typeValue(page, 'vit', 'temp', '36.6');
  await expectValue(page, 'vit', 'temp', '36.6');
  const banner = page.getByRole('status').filter({ hasText: 'All readings in the normal range.' });
  await expect(banner.getByTestId('status-badge')).toHaveAttribute('data-status', 'normal');
  await expect(page.getByRole('switch', { name: /Re-check in 15 minutes/ })).toHaveCount(0); // only a flagged result offers it
  const del = page.getByRole('button', { name: 'Delete', exact: true });
  if (!isPhone(page)) {
    await del.click(); // backspace on the focused field (temp)
    await expectValue(page, 'vit', 'temp', '36.');
    await page.getByRole('button', { name: '6', exact: true }).click();
    await expectValue(page, 'vit', 'temp', '36.6');
    await page.getByRole('button', { name: '.', exact: true }).click();
    await page.getByRole('button', { name: '9', exact: true }).click();
    await expectValue(page, 'vit', 'temp', '36.6'); // a second point is ignored, four characters at most
    await group(page, 'bp').getByRole('button', { name: /^Sys/ }).click();
    await expect(page.getByText('Keypad · Sys')).toBeVisible();
  }
  // an implausible number is not a result: it is flagged and blocks saving
  if (isPhone(page)) await field(page, 'bp', 'sys').fill('600');
  else { for (let i = 0; i < 3; i++) await del.click(); for (const ch of '600') await page.getByRole('button', { name: ch, exact: true }).click(); }
  await expectValue(page, 'bp', 'sys', '600');
  await expect(page.getByText('Check the highlighted value').first()).toBeVisible();
  await expect(saveBtn(page)).toHaveAttribute('aria-disabled', 'true');
  if (isPhone(page)) await field(page, 'bp', 'sys').fill('128');
  else { for (let i = 0; i < 3; i++) await del.click(); for (const ch of '128') await page.getByRole('button', { name: ch, exact: true }).click(); }
  await expectValue(page, 'bp', 'sys', '128');
  await expect(saveBtn(page)).not.toHaveAttribute('aria-disabled', 'true');
  // Close: nothing is saved, the form closes
  await detail(page, 'Opa Hendra Gunawan').getByRole('button', { name: 'Close', exact: true }).click();
  if (isPhone(page)) await expect(page.getByRole('dialog')).toHaveCount(0);
  else await expect(page.getByText('Choose someone from the list')).toBeVisible();
  const s = await stateOf(page, 's8');
  expect(Object.values<any>(s.readings).filter((r) => r.date === T && r.memberId === 'm2')).toHaveLength(0);
  // another person has an empty form, and each person keeps their own numbers: Hendra's are still there
  await openPerson(page, 'Opa Tjahjadi');
  await expect(group(page, 'bp').getByTestId('status-badge')).toHaveCount(0);
  await expect(saveBtn(page)).toHaveAttribute('aria-disabled', 'true');
  await backToList(page);
  await openPerson(page, 'Opa Hendra');
  await expectValue(page, 'bp', 'sys', '128');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

// ---------- today's readings: correct or remove ----------
test('today’s readings: a reading corrected with a reason and an audit line, then removed with a reason; the arrival check is due again', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's8');
  await openPerson(page, 'Bapak Bambang');
  const d = detail(page, 'Bapak Bambang Purnomo');
  const card = await openCard(d, 'Arrival check');
  await expect(card.getByText('Saved at 09:55 by Ns. Dewi')).toBeVisible();
  await expect(card.getByText('122/73', { exact: true })).toBeVisible();
  // edit: a reason is required, and the numbers must make sense
  await card.getByRole('button', { name: 'Edit reading' }).click();
  const dlg = page.getByRole('dialog', { name: 'Edit reading' });
  await expect(dlg).toBeVisible();
  await expect(dlg.getByText(/Bapak Bambang Purnomo · Arrival check · 09:55/)).toBeVisible();
  const save = dlg.getByRole('button', { name: 'Save correction' });
  await expect(save).toHaveAttribute('aria-disabled', 'true');
  await dlg.getByLabel('Sys · mmHg').fill('152');
  await expect(save).toHaveAttribute('aria-disabled', 'true'); // still no reason
  await dlg.getByRole('button', { name: 'Typing mistake' }).click();
  await expect(save).not.toHaveAttribute('aria-disabled', 'true');
  await dlg.getByLabel('Dia · mmHg').fill('160'); // the lower number above the upper one
  await expect(dlg.getByText('The lower blood pressure number must be below the upper number.')).toBeVisible();
  await expect(save).toHaveAttribute('aria-disabled', 'true');
  await dlg.getByLabel('Sys · mmHg').fill('900'); // not a plausible number
  await expect(dlg.getByText('Between 50 and 260')).toBeVisible();
  await dlg.getByLabel('Sys · mmHg').fill('152');
  await dlg.getByLabel('Dia · mmHg').fill('73');
  await expect(save).not.toHaveAttribute('aria-disabled', 'true');
  await save.click();
  await expect(toast(page, /Reading corrected\./)).toBeVisible();
  await expect(dlg).toHaveCount(0);
  await expect(card.getByText('152/73', { exact: true })).toBeVisible();
  await expect(card.getByText(/Corrected at \d\d:\d\d by Ns\. Dewi · Typing mistake/)).toBeVisible();
  const s = await stateOf(page, 's8');
  const rd = Object.values<any>(s.readings).find((r) => r.memberId === 'm10' && r.date === T);
  expect(rd.sys).toBe(152);
  expect(rd.status).toBe('watch');
  expect(rd.edits).toHaveLength(1);
  expect(rd.edits[0]).toMatchObject({ by: 's8', fields: ['sys'], reason: 'typo', from: { sys: 122 } });
  // remove: a reason is required; "Other" also needs a note
  await card.getByRole('button', { name: 'Remove reading' }).click();
  const vd = page.getByRole('dialog', { name: 'Remove this reading?' });
  await expect(vd).toBeVisible();
  const go = vd.getByRole('button', { name: 'Remove reading' });
  await expect(go).toHaveAttribute('aria-disabled', 'true');
  await vd.getByRole('button', { name: 'Other' }).click();
  await expect(go).toHaveAttribute('aria-disabled', 'true');
  await vd.getByLabel('Note · required').fill('Cuff was on the wrong arm');
  await expect(go).not.toHaveAttribute('aria-disabled', 'true');
  await go.click();
  await expect(toast(page, /Reading removed\./)).toBeVisible();
  const s2 = await stateOf(page, 's8');
  expect(Object.values<any>(s2.readings).find((r) => r.id === rd.id).voided).toMatchObject({ by: 's8', reason: 'other', note: 'Cuff was on the wrong arm' });
  // nothing is left of today's readings on his detail; the arrival check is suggested and due again on his row
  await expect(d.getByTestId('today-block')).toHaveCount(0);
  await backToList(page);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('management saves a reading from "Health checks": the author is shown by the name they go by', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/hchecks');
  await expect(page.getByRole('heading', { name: 'Health checks', level: 1 })).toBeVisible();
  await expect(page.getByTestId('station-row')).toHaveCount(5);
  await openPerson(page, 'Opa Hendra');
  await typeValue(page, 'bp', 'sys', '126');
  await typeValue(page, 'bp', 'dia', '78');
  await typeValue(page, 'bp', 'pulse', '72');
  await typeValue(page, 'vit', 'spo2', '97');
  await typeValue(page, 'vit', 'temp', '36.5');
  await saveBtn(page).click();
  await expect(toast(page, /Saved for Opa Hendra: 126\/78, Normal\./)).toBeVisible();
  await backToList(page);
  await openPerson(page, 'Opa Hendra');
  const card = await openCard(detail(page, 'Opa Hendra Gunawan'), 'Arrival check');
  await expect(card.getByText(/Saved at \d\d:\d\d by Ega/)).toBeVisible();
  const s = await stateOf(page, 's9');
  expect(Object.values<any>(s.readings).find((r) => r.memberId === 'm2' && r.date === T)).toMatchObject({ takenBy: 's9', createdBy: 'staff:s9' });
  c.assertClean();
});

// ---------- anyone can be checked: not in the club, reminders, the lobby, guests ----------
test('someone who is not checked in can be checked at any time: the reading is saved, their attendance is left to the lobby', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's8');
  await openPerson(page, 'Oma Lina');
  const d = detail(page, 'Oma Lina Wijaya');
  await expect(d.getByText('Not checked in today')).toBeVisible();
  await readDevice(page, 'bp');
  await readDevice(page, 'vit');
  await saveBtn(page).click();
  await expect(toast(page, /Saved for Oma Lina: \d+\/\d+, \w+\./)).toBeVisible();
  const s = await stateOf(page, 's8');
  expect(Object.values<any>(s.readings).find((r) => r.memberId === 'm1' && r.date === T)).toMatchObject({ kind: 'arrival', takenBy: 's8' });
  expect(s.attendance[`${T}:m1`]?.checkIn).toBeUndefined(); // the lobby checks people in, not the nurse
  await backToList(page);
  const mine = row(page, 'Oma Lina');
  await expect(mine).toHaveAttribute('data-presence', 'no');
  await expect(mine).toContainText(/Today \d\d:\d\d · \d+\/\d+/);
  c.assertClean();
});

test('a closed day: the list is still there, with a note that the club is closed and when it opens again', async ({ page }) => {
  const c = watchConsole(page);
  const closure = await act(page, 's9', 'calendarEvent.create', { date: T, kind: 'closed', title: 'Club closed: water supply', titleId: 'Klub tutup: pasokan air' });
  expect(closure.ok()).toBeTruthy();
  await signIn(page, 's8');
  await expect(page.getByText('Club closed', { exact: true })).toBeVisible();
  await expect(page.getByText('The club is closed today. We open again on Thursday 22 October.')).toBeVisible();
  await expect(page.getByTestId('station-row')).toHaveCount(5); // anyone can still be checked
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('a trial guest checked in by the lobby is in the list with their allergies and mobility; the reading is saved for the guest', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's8');
  await expect(row(page, 'Siu Lan')).toHaveCount(0);
  const r = await act(page, 's1', 'guest.checkIn', { guestId: 'g-e1' });
  expect(r.ok()).toBeTruthy();
  const g = row(page, 'Oma Siu Lan Tjandra');
  await expect(g).toHaveCount(1);
  await expect(g).toHaveAttribute('data-presence', 'in');
  await expect(page.getByText('4 in the club')).toBeVisible();
  await expect(page.getByText('5 members')).toBeVisible(); // guests are not members
  await g.click();
  const d = detail(page, 'Oma Siu Lan Tjandra');
  await expect(d.getByRole('heading', { level: 2, name: 'Oma Siu Lan Tjandra' })).toBeVisible();
  await expect(d.getByText(/Trial guest · arrived \d\d:\d\d$/)).toBeVisible();
  await expect(flag(d, 'Shellfish')).toHaveCount(1);
  await expect(flag(d, 'Walking stick')).toHaveCount(1);
  await expect(flag(d, 'Penicillin allergy')).toHaveCount(1);
  await expect(d.getByRole('button', { name: 'Health record' })).toHaveCount(0); // a guest has no member record
  await expect(kindBtn(page, /^Monthly check/)).toHaveCount(0); // nor a departure check
  await expect(kindBtn(page, /^Departure check/)).toHaveCount(0);
  await readDevice(page, 'bp');
  await readDevice(page, 'vit');
  await expect(page.getByRole('switch', { name: /^Tell / })).toHaveCount(0); // nobody to tell
  await saveBtn(page).click();
  await expect(toast(page, /Saved for Oma Siu Lan Tjandra: \d+\/\d+, \w+\./)).toBeVisible();
  const s = await stateOf(page, 's8');
  const rd = Object.values<any>(s.readings).find((x) => x.guestId === 'g-e1');
  expect(rd).toMatchObject({ memberId: null, guestId: 'g-e1', kind: 'arrival', takenBy: 's8', date: T });
  await backToList(page);
  await expect(chips(row(page, 'Siu Lan'))).toHaveCount(0); // the guest stays in the list (they are in the club), with today's reading
  await expect(row(page, 'Siu Lan')).toContainText(/Today \d\d:\d\d · \d+\/\d+/);
  c.assertClean();
});

// ---------- guided-demo deep link ----------
test('deep link ?member=m1&demo=high: opens Oma Lina, runs Read PC-303 once (152/94 from her script), then drops the query', async ({ page }) => {
  const c = watchConsole(page);
  await checkIn(page, 'm1');
  await signIn(page, 's8', '/today?member=m1&demo=high');
  await expect(page).toHaveURL(/\/today$/); // the query is removed once applied: a reload does not repeat it
  await expect(page.getByRole('heading', { level: 2, name: 'Oma Lina Wijaya' })).toBeVisible();
  if (isPhone(page)) await expect(page.getByRole('dialog', { name: 'Oma Lina Wijaya' })).toBeVisible(); // the sheet is open on the phone
  await expectValue(page, 'bp', 'sys', '152');
  await expectValue(page, 'bp', 'dia', '94');
  await expectValue(page, 'bp', 'pulse', '82');
  await expectValue(page, 'vit', 'spo2', '97');
  await expectValue(page, 'vit', 'temp', '36.6');
  const banner = page.getByRole('status').filter({ hasText: 'A little outside the usual range' });
  await expect(banner).toContainText('Blood pressure 152/94.');
  await expect(page.getByRole('switch', { name: 'Tell Maria and Daniel now' })).toHaveAttribute('aria-checked', 'true');
  // the user reviews and saves ("Save and next": Tjahjadi and Hendra are still due)
  await expect(saveBtn(page)).not.toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('button', { name: 'Save and next', exact: true })).toBeVisible();
  await saveBtn(page).click();
  await expect(toast(page, /Saved for Oma Lina: 152\/94, Watch\. Maria and Daniel got a message\./)).toBeVisible();
  const s = await stateOf(page, 's8');
  expect(Object.values<any>(s.readings).find((x) => x.memberId === 'm1' && x.kind === 'arrival' && x.date === T)).toMatchObject({ sys: 152, dia: 94, pulse: 82, spo2: 97, temp: 36.6, status: 'watch', source: 'device' });
  await page.reload(); // no second automatic reading
  await expect(page.locator('#main')).toBeVisible();
  await expect(row(page, 'Oma Lina')).toContainText(/Today \d\d:\d\d · 152\/94/);
  const s2 = await stateOf(page, 's8');
  expect(Object.values<any>(s2.readings).filter((x) => x.memberId === 'm1' && x.date === T && x.kind === 'arrival')).toHaveLength(1);
  c.assertClean();
});

test('deep link ?member=: anyone in the list is opened (checked in or not) and the station waits for the PC-303; someone already checked shows today’s reading; an unknown id is ignored; Health checks takes it too', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's8', '/today?member=m2');
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Opa Hendra Gunawan' })).toBeVisible();
  if (isPhone(page)) await expect(page.getByRole('dialog', { name: 'Opa Hendra Gunawan' })).toBeVisible();
  // opening someone waits for the PC-303, and its values arrive (Hendra's arrival is scripted 164/98)
  await expect(group(page, 'bp').getByRole('button', { name: /Stop waiting/ })).toBeVisible();
  await expectValue(page, 'bp', 'sys', '164');
  await expect(group(page, 'bp').getByRole('button', { name: 'Read PC-303' })).toBeVisible();
  // already checked today: their reading is on the detail, the next check is a spot check
  await page.goto('/today?member=m10');
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Bapak Bambang Purnomo' })).toBeVisible();
  await expect(detail(page, 'Bapak Bambang Purnomo').getByText('Today’s readings · 1')).toBeVisible();
  // an active member who is not in the club today: opened too
  await page.goto('/today?member=m46');
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Opa Budi Wijaya' })).toBeVisible();
  await expect(detail(page, 'Opa Budi Wijaya').getByText('Not checked in today')).toBeVisible();
  // an id that is nobody: ignored, and the query is dropped
  await page.goto('/today?member=nobody');
  await expect(page).toHaveURL(/\/today$/, { timeout: 10_000 });
  await expect(page.getByTestId('station-row')).toHaveCount(5);
  if (isPhone(page)) await expect(page.getByRole('dialog')).toHaveCount(0);
  else await expect(page.getByText('Choose someone from the list')).toBeVisible();
  c.assertClean();
  // management's "Health checks" takes the same link
  const m = await page.context().newPage();
  await signIn(m, 's9', '/hchecks?member=m20');
  await expect(m).toHaveURL(/\/hchecks$/);
  await expect(m.getByRole('heading', { level: 2, name: 'Opa Tjahjadi Lim' })).toBeVisible();
});

test('opening someone waits for the PC-303; tapping a box stops it; blood pressure alone is enough to save', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's8', '/today?member=m46');
  await expect(page.getByRole('heading', { level: 2, name: 'Opa Budi Wijaya' })).toBeVisible();
  await expect(group(page, 'bp').getByRole('button', { name: /Stop waiting/ })).toBeVisible();
  await typeValue(page, 'bp', 'sys', '126'); // typing stops the wait
  await expect(group(page, 'bp').getByRole('button', { name: 'Read PC-303' })).toBeVisible();
  await typeValue(page, 'bp', 'dia', '78');
  await expect(page.getByText(/Finish or clear: Blood pressure/)).toBeVisible();
  await typeValue(page, 'bp', 'pulse', '72');
  await expectValue(page, 'vit', 'spo2', isPhone(page) ? '' : '—'); // oxygen never arrived: not needed
  await page.getByRole('button', { name: /^Save/ }).click();
  await expect.poll(async () => {
    const st = (await (await page.request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': 's8' } })).json()).state;
    return Object.values(st.readings as Record<string, { memberId: string; date: string; sys?: number; spo2?: number }>).some((r) => r.memberId === 'm46' && r.date === '2026-10-21' && r.sys === 126 && r.spo2 === undefined);
  }, { timeout: 10_000 }).toBe(true);
  c.assertClean();
});

test('Limits: the nurse changes when a reading is Watch; a reading saved after that uses it', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's8');
  await page.getByRole('button', { name: 'Watch and Alert limits' }).click();
  const sheet = page.getByRole('dialog', { name: 'Watch and Alert limits' });
  const sys = sheet.locator('[data-limit="sysHigh"]');
  await sys.getByRole('textbox', { name: 'Watch from' }).fill('125');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toHaveCount(0);
  await expect.poll(async () => (await (await page.request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': 's8' } })).json()).state.club.settings.limits?.sysHigh?.watch).toBe(125);
  await page.getByRole('button', { name: 'Watch and Alert limits' }).click();
  await expect(sheet.locator('[data-limit="sysHigh"]').getByRole('textbox', { name: 'Watch from' })).toHaveValue('125');
  await sheet.locator('[data-limit="sysHigh"]').getByRole('textbox', { name: 'Alert from' }).fill('120');
  await expect(sheet.getByText('Alert must be past Watch.')).toBeVisible();
  await sheet.getByRole('button', { name: 'Use the standard limits' }).click();
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toHaveCount(0);
  c.assertClean();
});

// ---------- Readings: trends ----------
test('Readings: filters and search, the member’s six chart cards; phone: a full-screen sheet', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's8', '/readings');
  await expect(page.getByRole('heading', { name: 'Readings', level: 1 })).toBeVisible();
  await expect(page.getByText('Health station · last 4 weeks')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Trends' })).toHaveAttribute('aria-selected', 'true');
  const filters = page.getByRole('group', { name: 'Filter' });
  await expect(filters.getByRole('button', { name: 'All · 5' })).toHaveAttribute('aria-pressed', 'true');
  await expect(filters.getByRole('button', { name: 'Watch · 1' })).toBeVisible();
  await expect(filters.getByRole('button', { name: 'Alert · 1' })).toBeVisible();
  const rows = page.getByTestId('reading-row');
  await expect(rows).toHaveCount(5);
  await expect(rows.nth(0)).toContainText('Opa Hendra Gunawan'); // worst first
  await expect(rows.nth(0).getByTestId('status-badge')).toHaveAttribute('data-status', 'alert');
  await expect(rows.nth(1)).toContainText('Opa Tjahjadi Lim');
  await expect(rows.nth(0)).toContainText(/Last BP \d+\/\d+ · /);
  // filter Watch: only the people whose worst reading in the last 4 weeks is Watch
  await filters.getByRole('button', { name: 'Watch · 1' }).click();
  await expect(filters.getByRole('button', { name: 'Watch · 1' })).toHaveAttribute('aria-pressed', 'true');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Opa Tjahjadi Lim');
  await expect(rows.first().getByTestId('status-badge')).toHaveAttribute('data-status', 'watch');
  await filters.getByRole('button', { name: 'Alert · 1' }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Opa Hendra Gunawan');
  await filters.getByRole('button', { name: 'All · 5' }).click();
  await expect(rows).toHaveCount(5);
  // search by name or family name
  await page.getByLabel('Search members').fill('wijaya');
  await expect(rows).toHaveCount(2);
  await page.getByLabel('Search members').fill('zzz');
  await expect(rows).toHaveCount(0);
  await expect(page.getByTestId('readings-list').getByText('No matches')).toBeVisible();
  await page.getByLabel('Search members').fill('');
  await expect(rows).toHaveCount(5);
  if (isPhone(page)) {
    // phone: the list alone; the detail opens as a full-screen sheet, never under the list
    await expect(page.locator('[data-chart]')).toHaveCount(0);
    await readingRow(page, 'Opa Hendra').click();
    const sheet = page.getByRole('dialog', { name: 'Opa Hendra Gunawan' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('1 of 5')).toBeVisible();
    await expect(sheet.locator('[data-chart]')).toHaveCount(6);
    await assertNoHorizontalScroll(page);
    await sheet.getByRole('button', { name: 'Readings' }).click();
    await expect(sheet).toHaveCount(0);
    await expect(rows.first()).toBeVisible();
    await expect(page.locator('[data-chart]')).toHaveCount(0);
  }
  // Hendra's detail
  await readingRow(page, 'Opa Hendra').click();
  const view = isPhone(page) ? page.getByRole('dialog', { name: 'Opa Hendra Gunawan' }) : page.locator('#main');
  await expect(view.getByRole('heading', { level: 2, name: 'Opa Hendra Gunawan' })).toBeVisible();
  await expect(view.getByText('84 · High blood pressure')).toBeVisible();
  await expect(view.locator('[data-chart]')).toHaveCount(6);
  for (const [id, title] of [['bp', 'Blood pressure'], ['pulse', 'Pulse'], ['spo2', 'SpO₂'], ['temp', 'Temperature'], ['glucose', 'Glucose'], ['weight', 'Weight']] as const) {
    const card = view.locator(`[data-chart="${id}"]`);
    await expect(card.getByText(title, { exact: true })).toBeVisible();
    await expect(card.locator('svg')).toBeVisible();
  }
  const bp = view.locator('[data-chart="bp"]');
  await expect(bp.getByText('Solid line: arrival · dashed: departure · shaded: normal range')).toBeVisible();
  await expect(bp.getByText(/\w{3} \d+ \w+ – \w{3} \d+ \w+/)).toBeVisible(); // the date range comes from the readings, not from a fixed month
  await expect(view.locator('[data-chart="glucose"]').getByText('Since September · shaded: 70–180')).toBeVisible();
  await expect(view.locator('[data-chart="weight"]').getByText('Since September · watch on a 3 kg change')).toBeVisible();
  await expect(view.getByText('History', { exact: true })).toBeVisible();
  await assertNoHorizontalScroll(page);
  c.assertClean();
  await view.getByRole('button', { name: 'Open health record' }).click();
  await expect(page).toHaveURL(/\/members\/m2\/health$/);
});

test('Readings: a member’s record day by day, back in time: the arrows go to the nearest day with readings, the calendar to any date', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's8', '/readings');
  await readingRow(page, 'Opa Hendra').click();
  const view = isPhone(page) ? page.getByRole('dialog', { name: 'Opa Hendra Gunawan' }) : page.locator('#main');
  const hist = view.getByTestId('history');
  const state = await stateOf(page, 's8');
  const mine = Object.values<any>(state.readings).filter((r) => r.memberId === 'm2' && !r.voided);
  const days = Array.from(new Set(mine.map((r) => r.date as string))).sort();
  const on = (d: string) => mine.filter((r) => r.date === d).length;
  expect(days.at(-1)).toBe('2026-10-20');
  // opens on the latest day with readings; the position among the days is shown
  await expect(fieldText(page, /^Reading day,/)).toContainText('Tue 20 Oct 2026');
  await expect(hist.getByTestId('reading-card')).toHaveCount(on('2026-10-20'));
  await expect(hist.getByText(`Reading day ${days.length} of ${days.length}`)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Later reading day' })).toHaveAttribute('aria-disabled', 'true'); // nothing after the latest
  await expect(hist.getByRole('button', { name: 'Latest' })).toHaveCount(0);
  // one day back
  await page.getByRole('button', { name: 'Earlier reading day' }).click();
  const prev = days[days.length - 2];
  await expect(hist.getByTestId('reading-card')).toHaveCount(on(prev));
  await expect(hist.getByText(`Reading day ${days.length - 1} of ${days.length}`)).toBeVisible();
  await expect(hist.getByRole('button', { name: 'Latest' })).toBeVisible();
  // a card opens to every number, who took it, and the buttons to correct or remove
  const card = await openCard(hist, /Arrival|Departure|Monthly|Spot|Re-check/);
  await expect(card.getByText(/Saved at \d\d:\d\d by /)).toBeVisible();
  await expect(card.getByRole('button', { name: 'Edit reading' })).toBeVisible();
  // any date: a month ago (23 Sep), and a day without readings (a Saturday)
  await pickDate(page, /^Reading day,/, '2026-09-23');
  await expect(fieldText(page, /^Reading day,/)).toContainText(/Wed 23 Sept? 2026/);
  await expect(hist.getByTestId('reading-card')).toHaveCount(on('2026-09-23'));
  expect(on('2026-09-23')).toBeGreaterThan(0);
  await pickDate(page, /^Reading day,/, '2026-10-17');
  await expect(fieldText(page, /^Reading day,/)).toContainText('Sat 17 Oct 2026');
  await expect(hist.getByTestId('history-empty')).toContainText('No readings on Sat 17 Oct.');
  await expect(hist.getByTestId('reading-card')).toHaveCount(0);
  await expect(hist.getByText('Use the arrows to jump to the nearest day with readings.')).toBeVisible();
  await page.getByRole('button', { name: 'Earlier reading day' }).click(); // from a day without readings: the nearest before
  await expect(fieldText(page, /^Reading day,/)).toContainText('Fri 16 Oct 2026');
  await pickDate(page, /^Reading day,/, '2026-10-17');
  await page.getByRole('button', { name: 'Later reading day' }).click();
  await expect(fieldText(page, /^Reading day,/)).toContainText('Mon 19 Oct 2026');
  await hist.getByRole('button', { name: 'Latest' }).click();
  await expect(fieldText(page, /^Reading day,/)).toContainText('Tue 20 Oct 2026');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('Readings by day: pick any date to see that day’s readings for everyone, a month ago included; paged; a row opens that member’s record on that day', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's8', '/readings');
  await page.getByRole('tab', { name: 'By day' }).click();
  await expect(page.getByRole('tab', { name: 'By day' })).toHaveAttribute('aria-selected', 'true');
  const state = await stateOf(page, 's8');
  const valid = Object.values<any>(state.readings).filter((r) => !r.voided);
  const of = (d: string) => valid.filter((r) => r.date === d);
  const people = (d: string) => new Set(of(d).map((r) => r.memberId ?? r.guestId)).size;
  const rows = page.getByTestId('day-row');
  // today: Bambang's arrival check
  await expect(fieldText(page, /^Day,/)).toContainText('Wed 21 Oct 2026');
  await expect(page.getByTestId('day-summary')).toContainText(`Readings: ${of(T).length} · People: ${people(T)}`);
  await expect(rows).toHaveCount(of(T).length);
  await expect(rows.first()).toContainText('Bapak Bambang Purnomo');
  await expect(rows.first()).toContainText('122/73');
  await expect(page.getByRole('button', { name: 'Next day' })).toHaveAttribute('aria-disabled', 'true'); // nothing after today
  await expect(page.getByRole('button', { name: 'Today', exact: true })).toHaveCount(0);
  // step back a day
  await page.getByRole('button', { name: 'Previous day' }).click();
  await expect(fieldText(page, /^Day,/)).toContainText('Tue 20 Oct 2026');
  await expect(page.getByTestId('day-summary')).toContainText(`Readings: ${of('2026-10-20').length} · People: ${people('2026-10-20')}`);
  await expect(page.getByRole('button', { name: 'Today', exact: true })).toBeVisible();
  // a month ago, picked from the calendar: more than a page
  const D = '2026-09-23';
  expect(of(D).length).toBeGreaterThan(10);
  await pickDate(page, /^Day,/, D);
  await expect(fieldText(page, /^Day,/)).toContainText(/Wed 23 Sept? 2026/);
  await expect(page.getByTestId('day-summary')).toContainText(`Readings: ${of(D).length} · People: ${people(D)}`);
  await expect(rows).toHaveCount(10);
  await goToPage(page, 2);
  await expect(rows).toHaveCount(of(D).length - 10);
  // a search narrows the day to one person, and goes back to page 1
  await page.getByLabel('Search members').fill('hendra');
  await expect(rows).toHaveCount(of(D).filter((r) => r.memberId === 'm2').length);
  await expect(rows.first()).toContainText('Opa Hendra Gunawan');
  // a row opens that member with their record on that day
  await rows.first().click();
  const view = isPhone(page) ? page.getByRole('dialog', { name: 'Opa Hendra Gunawan' }) : page.locator('#main');
  await expect(view.getByRole('heading', { level: 2, name: 'Opa Hendra Gunawan' })).toBeVisible();
  await expect(fieldText(page, /^Reading day,/)).toContainText(/Wed 23 Sept? 2026/);
  await expect(view.getByTestId('history').getByTestId('reading-card')).toHaveCount(of(D).filter((r) => r.memberId === 'm2').length);
  await assertNoHorizontalScroll(page);
  if (isPhone(page)) await view.getByRole('button', { name: 'Readings' }).click();
  // a day with nothing
  await page.getByLabel('Search members').fill('');
  await pickDate(page, /^Day,/, '2026-10-17');
  await expect(page.getByText('No readings on Sat 17 Oct.')).toBeVisible();
  await expect(page.getByTestId('day-summary')).toContainText('Readings: 0 · People: 0');
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(fieldText(page, /^Day,/)).toContainText('Wed 21 Oct 2026');
  // switching back to Trends clears the choice
  await page.getByRole('tab', { name: 'Trends' }).click();
  await expect(page.getByTestId('reading-row')).toHaveCount(5);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('Readings follow what the nurse saves today: a new Alert shows on the list, the charts and the history (today is the latest day)', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's8');
  const ok = await act(page, 's8', 'reading.save', { memberId: 'm20', kind: 'arrival', sys: 166, dia: 100, pulse: 80, spo2: 96, temp: 36.7, glucose: 260, weight: 54.4, noteKeys: [], note: 'Very thirsty', shared: false, tellFamily: false, recheck: false, deferMonthly: false, source: 'keypad' });
  expect(ok.ok()).toBeTruthy();
  await page.goto('/readings');
  await expect(readingRow(page, 'Opa Tjahjadi').getByTestId('status-badge')).toHaveAttribute('data-status', 'alert');
  await expect(page.getByRole('group', { name: 'Filter' }).getByRole('button', { name: 'Alert · 2' })).toBeVisible();
  await readingRow(page, 'Opa Tjahjadi').click();
  const view = isPhone(page) ? page.getByRole('dialog', { name: 'Opa Tjahjadi Lim' }) : page.locator('#main');
  await expect(view.locator('[data-chart="bp"]').getByText('166/100')).toBeVisible();
  await expect(view.locator('[data-chart="glucose"]').getByText('260 mg/dL')).toBeVisible();
  await expect(fieldText(page, /^Reading day,/)).toContainText('Wed 21 Oct 2026'); // the record opens on today
  const hist = view.getByTestId('history');
  await expect(hist.getByTestId('reading-card')).toHaveCount(2); // the arrival check and the monthly one saved with it
  await expect(hist.getByTestId('reading-card').filter({ hasText: /Arrival check · today \d\d:\d\d/ })).toContainText('Normal'.length ? '166/100' : '');
  await expect(hist.getByTestId('reading-card').filter({ hasText: /Monthly check · today \d\d:\d\d/ })).toBeVisible();
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

// ---------- Indonesian ----------
test('Indonesian: the list, the chips, the result banner, the dialogs and the readings by day have no raw keys', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's8', '/today', 'en');
  if (isPhone(page)) {
    await page.getByRole('button', { name: 'Account' }).click(); // the account sheet has the language switch on the phone
    await page.getByRole('tab', { name: 'Bahasa Indonesia' }).click();
    await page.keyboard.press('Escape');
  } else {
    await page.getByRole('button', { name: 'ID', exact: true }).click(); // the sidebar's language toggle
  }
  await expect(page.getByRole('heading', { name: 'Cek kesehatan', level: 1 })).toBeVisible();
  await expect(page.getByText('Pos kesehatan · Rabu, 21 Oktober')).toBeVisible();
  await expect(page.getByText('LEPU PC-303 · terhubung')).toBeVisible();
  await expect(page.getByText('3 di klub')).toBeVisible();
  await expect(page.getByText('5 anggota')).toBeVisible();
  await expect(page.getByText('Di klub hari ini', { exact: true })).toBeVisible();
  await expect(page.getByText('Tidak hadir hari ini', { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('Cari nama atau nama keluarga')).toBeVisible();
  await expect(row(page, 'Bambang')).toContainText(/Hari ini 09:55 · 122\/73/);
  await assertNoRawKeys(page);
  await openPerson(page, 'Opa Hendra');
  const d = detail(page, 'Opa Hendra Gunawan');
  await expect(flag(d, 'Rendah garam')).toHaveCount(1);
  await expect(d.getByText('Hanya staf:')).toBeVisible();
  await expect(d.getByText('Sistolik, 4 minggu terakhir')).toBeVisible();
  await expect(d.getByText('Di klub sejak 09:40')).toBeVisible();
  await expect(page.getByText(/Menunggu|Isi satu pengukuran|Lengkapi atau kosongkan/).first()).toBeVisible();
  await readDevice(page, 'bp');
  await readDevice(page, 'vit');
  const banner = page.getByRole('status').filter({ hasText: 'Di atas batas waspada' });
  await expect(banner.getByTestId('status-badge')).toContainText('Waspada');
  await expect(banner).toContainText('Tekanan darah 164/98.');
  await expect(page.getByRole('switch', { name: 'Kabari Cynthia dan Stephanie sekarang' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Istirahat 5 menit dulu' })).toBeVisible();
  await expect(page.getByText('Bagikan catatan ke keluarga')).toBeVisible();
  await expect(d.getByRole('button', { name: 'Tutup', exact: true })).toBeVisible();
  if (!isPhone(page)) await expect(page.getByText('Papan angka · Sis')).toBeVisible();
  await assertNoRawKeys(page);
  await saveBtn(page).click();
  await expect(toast(page, /Tersimpan untuk Opa Hendra: 164\/98, Waspada\. Cynthia dan Stephanie sudah dikabari\./)).toBeVisible();
  await backToList(page, 'Cek kesehatan');
  await assertNoRawKeys(page);
  // today's readings, edit and remove, clear a reminder
  await openPerson(page, 'Opa Hendra');
  const dd = detail(page, 'Opa Hendra Gunawan');
  await expect(dd.getByText('Hasil ukur hari ini · 1')).toBeVisible();
  const card = await openCard(dd, 'Cek kedatangan');
  await expect(card.getByText(/Disimpan \d\d:\d\d oleh Ns\. Dewi/)).toBeVisible();
  await expect(card.getByText(/Keluarga dikabari pukul \d\d:\d\d: Cynthia dan Stephanie/)).toBeVisible();
  await card.getByRole('button', { name: 'Ubah hasil ukur' }).click();
  const ed = page.getByRole('dialog', { name: 'Ubah hasil ukur' });
  await expect(ed.getByRole('button', { name: 'Salah ketik' })).toBeVisible();
  await expect(ed.getByText('Angka lama tetap tercatat dengan nama Anda dan alasannya.')).toBeVisible();
  await assertNoRawKeys(page);
  await ed.getByRole('button', { name: 'Batal' }).click();
  await card.getByRole('button', { name: 'Hapus hasil ukur' }).click();
  const vd = page.getByRole('dialog', { name: 'Hapus hasil ukur ini?' });
  await expect(vd.getByRole('button', { name: 'Salah orang' })).toBeVisible();
  await expect(vd.getByText('Keluarga sudah dikabari soal hasil ukur ini. Mereka akan menerima pesan koreksi.')).toBeVisible();
  await assertNoRawKeys(page);
  await vd.getByRole('button', { name: 'Batal' }).click();
  await backToList(page, 'Cek kesehatan');
  await page.getByRole('button', { name: 'Batas Pantau dan Waspada' }).click();
  const lim = page.getByRole('dialog', { name: 'Batas Pantau dan Waspada' });
  await expect(lim.getByText('Tekanan darah, angka atas tinggi')).toBeVisible();
  await assertNoRawKeys(page);
  await lim.getByRole('button', { name: 'Tutup' }).first().click();
  await assertNoHorizontalScroll(page);
  // readings (through the navigation: a new page load would sign in again with English)
  await page.locator('[data-nav-key="readings"]').first().click();
  await expect(page.getByRole('heading', { name: 'Hasil ukur', level: 1 })).toBeVisible();
  await expect(page.getByText('Pos kesehatan · 4 minggu terakhir')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Filter' }).getByRole('button', { name: 'Pantau · 1' })).toBeVisible();
  await readingRow(page, 'Opa Hendra').click();
  const view = isPhone(page) ? page.getByRole('dialog', { name: 'Opa Hendra Gunawan' }) : page.locator('#main');
  await expect(view.getByText('Sejak September · area berwarna: 70–180')).toBeVisible();
  await expect(view.getByText('Riwayat', { exact: true })).toBeVisible();
  await expect(view.getByText(/Hari hasil ukur \d+ dari \d+/)).toBeVisible();
  await expect(view.getByRole('button', { name: 'Buka rekam kesehatan' })).toBeVisible();
  await expect(fieldText(page, /^Hari hasil ukur,/)).toBeVisible();
  await assertNoRawKeys(page);
  if (isPhone(page)) await view.getByRole('button', { name: 'Hasil ukur', exact: true }).click();
  await page.getByRole('tab', { name: 'Per hari' }).click();
  await expect(fieldText(page, /^Hari,/)).toBeVisible();
  await expect(page.getByTestId('day-summary')).toContainText('Hasil ukur: 2 · Orang: 2'); // today in Indonesian: Hendra's and Bambang's
  await page.getByRole('button', { name: 'Hari sebelumnya' }).click();
  await assertNoRawKeys(page);
  await pickDate(page, /^Hari,/, '2026-10-17');
  await expect(page.getByText('Tidak ada hasil ukur pada Sab 17 Okt.')).toBeVisible();
  await expect(page.getByText('Pilih tanggal lain, atau mundur satu hari.')).toBeVisible();
  await assertNoRawKeys(page);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});
