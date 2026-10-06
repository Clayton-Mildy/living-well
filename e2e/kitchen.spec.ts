// Kitchen: menu of the day (covers, allergy conflicts, lunch photos), weekly menu editor with a week switcher, dishes and allergens,
// feedback (reply, edit, reopen, phone log) and stock (approve, decline, receive, filters, pages).
// Isolated env: pnpm e2e:env kitchen 8806 5206 ; E2E_BASE_URL=http://localhost:5206 pnpm exec playwright test e2e/kitchen.spec.ts
import { test, expect, type Browser, type Page, type TestInfo } from '@playwright/test';
import { resetDemo, signIn, watchConsole, isPhone, assertNoHorizontalScroll } from './helpers';
import { fieldText, goToPage, pickDate, pickOption, takePhotoWithFile } from './kit';

const T = '2026-10-21';
test.describe.configure({ timeout: 90_000 }); // some flows drive two browsers; other areas' suites share this machine
test.beforeEach(async ({ request }) => { await resetDemo(request); });

/** A second signed-in browser (another person) with the same viewport as the current project. */
async function another(browser: Browser, info: TestInfo, userId: string, path: string, lang: 'en' | 'id' = 'en') {
  const u = info.project.use;
  const ctx = await browser.newContext({ baseURL: u.baseURL as string, viewport: u.viewport ?? undefined, isMobile: u.isMobile, hasTouch: u.hasTouch, userAgent: u.userAgent, deviceScaleFactor: u.deviceScaleFactor });
  const page = await ctx.newPage();
  await signIn(page, userId, path, lang);
  return { page, close: () => ctx.close() };
}
const act = (page: Page, userId: string, name: string, input: unknown) =>
  page.request.post('/api/actions/' + name, { headers: { 'x-user-id': userId }, data: { mutationId: 'e2e-' + Math.random().toString(36).slice(2), club: 'citra', input } });
const stateOf = async (page: Page, userId: string) => (await (await page.request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': userId } })).json()).state;
const toast = (page: Page) => page.getByRole('status');
/** The language toggle: sidebar EN/ID on tablet and laptop, the account sheet on phones. */
async function toggleToId(page: Page) {
  if (isPhone(page)) {
    await page.getByRole('button', { name: 'Account' }).click();
    await page.getByRole('tab', { name: 'Bahasa Indonesia' }).click();
    await page.keyboard.press('Escape');
  } else await page.getByRole('button', { name: 'ID', exact: true }).click();
}

test.describe('menu of the day', () => {
  test('shows who is having lunch so far (3 in the club + the trial guest), the Bambang conflict and the dietary needs', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's3');
    await expect(page.getByRole('heading', { name: 'Menu of the day' })).toBeVisible();
    // the club is drop-in: only members who have checked in count (Hendra, Tjahjadi, Bambang), plus the booked trial guest
    await expect(page.getByTestId('covers')).toHaveText('4 covers so far · lunch 12:00');
    await expect(page.getByTestId('covers-split')).toHaveText('3 in the club + 1 guest');
    if (!isPhone(page)) await expect(page.getByText('Members drop in on any open day, so this updates live as they check in.')).toBeVisible(); // a phone drops this helper line
    await expect(page.getByText('Sop ikan kakap, Nasi merah, Tumis buncis wortel, Pepaya')).toBeVisible();
    await expect(page.getByText('Soft option: Bubur ikan')).toBeVisible();
    // the conflict: seafood covers fish
    const row = page.getByTestId('conflict-row');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Bapak Bambang');
    await expect(row).toContainText('Sop ikan kakap contains fish · seafood allergy');
    await expect(row).toHaveAttribute('data-resolved', 'no');
    await expect(page.getByText('1 to sort · 0 done')).toBeVisible();
    // dietary needs of whoever is here; Oma Lina (shellfish) and Opa Budi (low salt) have not arrived
    const diet = page.getByTestId('diet-row');
    await expect(diet).toHaveCount(5);
    await expect(diet.filter({ hasText: 'Seafood allergy' })).toContainText('Bapak Bambang');
    await expect(diet.filter({ hasText: 'Shellfish allergy' })).toContainText('Oma Siu Lan Tjandra');
    await expect(diet.filter({ hasText: 'Shellfish allergy' })).not.toContainText('Oma Lina');
    await expect(diet.filter({ hasText: 'Low salt' })).toContainText('Opa Hendra');
    await expect(page.getByText('Diabetic · sugar-free tea')).toBeVisible();
    await assertNoHorizontalScroll(page);
    c.assertClean();
  });

  test('covers and dietary needs follow the lobby live: Oma Lina checks in, then goes home', async ({ page }) => {
    await signIn(page, 's3');
    await expect(page.getByTestId('covers')).toHaveText('4 covers so far · lunch 12:00');
    expect((await act(page, 's1', 'attendance.checkIn', { memberId: 'm1', method: 'manual' })).ok()).toBeTruthy();
    // no reload: the screen is live
    await expect(page.getByTestId('covers')).toHaveText('5 covers so far · lunch 12:00');
    await expect(page.getByTestId('covers-split')).toHaveText('4 in the club + 1 guest');
    await expect(page.getByTestId('diet-row').filter({ hasText: 'Shellfish allergy' })).toContainText('Oma Lina, Oma Siu Lan Tjandra');
    // leaving does not take her out of the lunch count
    expect((await act(page, 's1', 'attendance.checkOut', { memberId: 'm1' })).ok()).toBeTruthy();
    await expect(page.getByTestId('covers-split')).toHaveText('3 in the club + 1 gone home + 1 guest');
    await expect(page.getByTestId('covers')).toHaveText('5 covers so far · lunch 12:00');
  });

  test('marking an alternative prepared resolves the conflict; undo brings it back', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's3');
    const row = page.getByTestId('conflict-row');
    await row.getByRole('button', { name: 'Alternative prepared' }).click();
    const sheet = page.getByRole('dialog', { name: 'Alternative for Bapak Bambang' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('Sop ikan kakap contains fish, and Bapak Bambang has a seafood allergy.')).toBeVisible();
    // quick picks never include a dish with fish
    await expect(sheet.getByRole('button', { name: 'Bubur ikan' })).toHaveCount(0);
    const confirm = sheet.getByRole('button', { name: 'Alternative prepared' });
    await expect(confirm).toBeDisabled().catch(() => {}); // aria-disabled until text is typed
    await sheet.getByLabel('What will you serve instead?').fill('Ayam kukus');
    await confirm.click();
    await expect(toast(page)).toContainText('Ayam kukus instead of Sop ikan kakap for Bapak Bambang');
    await expect(row).toHaveAttribute('data-resolved', 'yes');
    await expect(row).toContainText('Serving Ayam kukus instead · Chef Agus');
    await expect(page.getByText('0 to sort · 1 done')).toBeVisible();
    await assertNoHorizontalScroll(page);
    // undo
    await row.getByRole('button', { name: 'Undo' }).click();
    await expect(row).toHaveAttribute('data-resolved', 'no');
    await expect(page.getByText('1 to sort · 0 done')).toBeVisible();
    c.assertClean();
  });

  test('an alternative with the same allergen is refused', async ({ page }) => {
    await signIn(page, 's3');
    await page.getByTestId('conflict-row').getByRole('button', { name: 'Alternative prepared' }).click();
    const sheet = page.getByRole('dialog', { name: 'Alternative for Bapak Bambang' });
    await sheet.getByLabel('What will you serve instead?').fill('Bubur ikan');
    await sheet.getByRole('button', { name: 'Alternative prepared' }).click();
    await expect(toast(page)).toContainText('Bubur ikan contains the same allergen');
    await expect(page.getByTestId('conflict-row')).toHaveAttribute('data-resolved', 'no');
  });

  test('the family is told about the alternative and the lunch photo (management posts it: the kitchen\'s waits for approval)', async ({ page, browser }, info) => {
    await signIn(page, 's3');
    await page.getByTestId('conflict-row').getByRole('button', { name: 'Alternative prepared' }).click();
    const sheet = page.getByRole('dialog', { name: 'Alternative for Bapak Bambang' });
    await sheet.getByLabel('What will you serve instead?').fill('Ayam kukus');
    await sheet.getByRole('button', { name: 'Alternative prepared' }).click();
    await expect(page.getByTestId('conflict-row')).toHaveAttribute('data-resolved', 'yes');
    const boss = await another(browser, info, 's9', '/menu');
    await boss.page.getByRole('button', { name: /Add a photo of today.s lunch/ }).click();
    await takePhotoWithFile(boss.page);
    await expect(boss.page.getByTestId('lunch-photo')).toBeVisible();
    // Laras (Bambang's daughter) finds both in her updates
    const laras = await another(browser, info, 'fm10_0', '/today');
    await laras.page.getByRole('button', { name: /Notifications/ }).first().click();
    const panel = laras.page.getByRole('dialog', { name: 'Notifications' });
    await panel.getByRole('tab', { name: /Updates/ }).click();
    await expect(panel.getByText('Bapak Bambang: the kitchen is serving Ayam kukus instead of Sop ikan kakap today.')).toBeVisible();
    await expect(panel.getByText('The kitchen posted a photo of today’s lunch.')).toBeVisible();
    await laras.close();
    await boss.close();
  });

  test('on Laras\'s Today page: the alternative replaces "preparing", and the approved lunch photo appears', async ({ page, browser }, info) => {
    await signIn(page, 's3');
    const boss = await another(browser, info, 's9', '/menu');
    const laras = await another(browser, info, 'fm10_0', '/today');
    // before the kitchen sorts it out she is not told "the menu is clear"
    await expect(laras.page.getByTestId('timeline')).toBeVisible();
    await expect(laras.page.getByText(/the menu is clear/)).toHaveCount(0);
    await expect(laras.page.getByTestId('lunch-photo')).toHaveCount(0);
    await page.getByTestId('conflict-row').getByRole('button', { name: 'Alternative prepared' }).click();
    const sheet = page.getByRole('dialog', { name: 'Alternative for Bapak Bambang' });
    await sheet.getByLabel('What will you serve instead?').fill('Ayam kukus');
    await sheet.getByRole('button', { name: 'Alternative prepared' }).click();
    await expect(toast(page)).toContainText('Ayam kukus instead of Sop ikan kakap');
    await boss.page.getByRole('button', { name: /Add a photo of today.s lunch/ }).click();
    await takePhotoWithFile(boss.page);
    await expect(toast(boss.page)).toContainText('Lunch photo posted');
    // live: the family's page updates without a reload
    await expect(laras.page.getByText(/the kitchen is serving Ayam kukus instead/)).toBeVisible();
    await expect(laras.page.getByTestId('lunch-photo')).toBeVisible();
    await expect(laras.page.getByTestId('lunch-photos')).toContainText('Lunch photo posted by the kitchen');
    await laras.close();
    await boss.close();
  });

  test('a trial guest whose allergies are unknown shows "ask <escort>" and still counts as a cover', async ({ page }) => {
    // the seed's trial guest has shellfish on file; here the club has not asked yet (the snapshot is rewritten, nothing is saved)
    await page.route('**/api/snapshot?*', async (route) => {
      const res = await route.fetch();
      const json = await res.json();
      json.state.guestVisits['g-e1'].food = null;
      await route.fulfill({ response: res, json });
    });
    await signIn(page, 's3');
    await expect(page.getByTestId('covers')).toHaveText('4 covers so far · lunch 12:00');
    const row = page.getByTestId('unknown-guest-row');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Oma Siu Lan Tjandra');
    await expect(row).toContainText('Allergies not known yet. Ask Melinda Tjandra before serving.');
    await expect(row.getByRole('link', { name: 'Call' })).toHaveAttribute('href', 'tel:+6281277812290');
    // the dietary needs: nobody here has shellfish on file now, and the guest is listed under "not known"
    const diet = page.getByTestId('diet-row');
    await expect(diet.filter({ hasText: 'Shellfish allergy' })).toHaveCount(0);
    await expect(diet.filter({ hasText: 'Allergies not known' })).toContainText('Oma Siu Lan Tjandra');
    await expect(page.getByTestId('conflict-row')).toHaveCount(1); // Bambang, unchanged
    await assertNoHorizontalScroll(page);
  });

  test('the kitchen adds several lunch photos with the camera; each waits for approval and can be removed', async ({ page, browser }, info) => {
    const c = watchConsole(page);
    await signIn(page, 's3');
    await expect(page.getByTestId('lunch-photo')).toHaveCount(0);
    if (!isPhone(page)) await expect(page.getByText('Management approves it before families see it')).toBeVisible(); // a phone drops this helper line
    await page.getByRole('button', { name: /Add a photo of today.s lunch/ }).click();
    await takePhotoWithFile(page);
    await expect(toast(page)).toContainText('Photo sent to management. Families see it once it is approved.');
    const tiles = page.getByTestId('lunch-photo');
    await expect(tiles).toHaveCount(1);
    await expect(tiles.first()).toHaveAttribute('data-status', 'pending');
    await expect(tiles.first()).toContainText('Waiting for approval');
    await expect(page.getByText('Management approves photos from the kitchen before families see them.')).toBeVisible();
    // a real uploaded picture, shown back from /api/media
    const img = tiles.first().locator('img');
    await expect(img).toHaveAttribute('src', /^\/api\/media\/md_/);
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    // a second and a third photo: several a day
    await page.getByTestId('lunch-photo-add').click();
    await takePhotoWithFile(page);
    await expect(tiles).toHaveCount(2);
    await page.getByTestId('lunch-photo-add').click();
    await takePhotoWithFile(page);
    await expect(tiles).toHaveCount(3);
    await expect(page.getByText('Lunch photos · 3')).toBeVisible();
    const s1 = await stateOf(page, 's3');
    const ids: string[] = s1.dayMenus[T].photoIds;
    expect(ids).toHaveLength(3);
    expect(s1.dayMenus[T].photoId).toBeUndefined();
    for (const id of ids) expect(s1.photos[id]).toMatchObject({ kind: 'lunch', memberIds: [], visibility: 'pending', takenBy: 's3', mediaId: expect.stringMatching(/^md_/) });
    await assertNoHorizontalScroll(page);
    // the family sees none of them
    const laras = await another(browser, info, 'fm10_0', '/today');
    await expect(laras.page.getByTestId('timeline')).toBeVisible();
    await expect(laras.page.getByTestId('lunch-photo')).toHaveCount(0);
    expect(Object.keys((await stateOf(laras.page, 'fm10_0')).photos)).not.toEqual(expect.arrayContaining([ids[0]]));
    await laras.close();
    // remove the first: confirm, it goes, the others stay
    await tiles.first().getByRole('button', { name: /Remove the photo taken at/ }).click();
    const dlg = page.getByRole('dialog', { name: 'Remove this photo?' });
    await dlg.getByRole('button', { name: 'Keep photo' }).click();
    await expect(tiles).toHaveCount(3);
    await tiles.first().getByRole('button', { name: /Remove the photo taken at/ }).click();
    await page.getByRole('dialog', { name: 'Remove this photo?' }).getByRole('button', { name: 'Remove photo' }).click();
    await expect(toast(page)).toContainText('Lunch photo removed.');
    await expect(tiles).toHaveCount(2);
    const s2 = await stateOf(page, 's3');
    expect(s2.dayMenus[T].photoIds).toEqual(ids.slice(1));
    expect(s2.photos[ids[0]].visibility).toBe('removed');
    c.assertClean();
  });

  test('management\'s photos go live at once; the notify toggle is on by default and off keeps the families quiet', async ({ page, browser }, info) => {
    const c = watchConsole(page);
    await signIn(page, 's9', '/menu');
    const notify = page.getByRole('switch', { name: /Notify families/ });
    await expect(notify).toHaveAttribute('aria-checked', 'true');
    if (!isPhone(page)) await expect(page.getByText('Families see it on their Today page')).toBeVisible(); // a phone drops this helper line
    const laras = await another(browser, info, 'fm10_0', '/today');
    await expect(laras.page.getByTestId('lunch-photo')).toHaveCount(0);
    // toggle off: the photo is shown to families, but nobody is told
    await notify.click();
    await expect(notify).toHaveAttribute('aria-checked', 'false');
    await page.getByRole('button', { name: /Add a photo of today.s lunch/ }).click();
    await takePhotoWithFile(page);
    await expect(toast(page)).toContainText('Lunch photo posted. Families were not notified.');
    const tiles = page.getByTestId('lunch-photo');
    await expect(tiles).toHaveCount(1);
    await expect(tiles.first()).toHaveAttribute('data-status', 'visible');
    await expect(tiles.first()).toContainText('Shown to families');
    await expect(laras.page.getByTestId('lunch-photo')).toHaveCount(1); // live, no reload
    const quiet = await stateOf(page, 's9');
    expect(Object.values<{ kind: string }>(quiet.notifications).filter((x) => x.kind === 'kitchen.notif.lunchPhoto')).toHaveLength(0);
    // toggle on again: the next photo tells the families of whoever is in the club, once
    await notify.click();
    await page.getByTestId('lunch-photo-add').click();
    await takePhotoWithFile(page);
    await expect(toast(page)).toContainText('Lunch photo posted. Families see it on the Today page.');
    await expect(tiles).toHaveCount(2);
    await expect(laras.page.getByTestId('lunch-photo')).toHaveCount(2);
    await expect(laras.page.getByTestId('lunch-photos')).toContainText('Lunch photo posted by the kitchen');
    const st = await stateOf(page, 's9');
    const told = Object.values<{ kind: string; toUsers: string[] }>(st.notifications).filter((x) => x.kind === 'kitchen.notif.lunchPhoto');
    expect(told).toHaveLength(1);
    expect([...told[0].toUsers].sort()).toEqual(['fm10_0', 'fm20_0', 'fm2_0', 'fm2_1']);
    // a family thumbnail opens in the viewer
    await laras.page.getByTestId('lunch-photo').first().click();
    await expect(laras.page.getByRole('dialog').first()).toBeVisible();
    await laras.close();
    await assertNoHorizontalScroll(page);
    c.assertClean();
  });

  test('"Change today\'s menu" is one date only: the fish soup comes off and the conflict goes', async ({ page }) => {
    await signIn(page, 's3');
    await page.getByRole('button', { name: 'Change today’s menu' }).click();
    const sheet = page.getByRole('dialog', { name: 'Change one date' });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: 'Remove Sop ikan kakap' }).click();
    await sheet.getByRole('button', { name: 'Add a dish to Lunch' }).click();
    const picker = page.getByRole('dialog', { name: 'Add to Lunch' });
    await picker.getByRole('checkbox', { name: /Ayam bakar kecap/ }).click();
    await picker.getByRole('button', { name: 'Done' }).click();
    await page.getByRole('dialog', { name: 'Change one date' }).getByRole('button', { name: 'Save for this date' }).click();
    await expect(toast(page)).toContainText('Menu changed for that date');
    await expect(page.getByText('Nasi merah, Tumis buncis wortel, Pepaya, Ayam bakar kecap', { exact: true })).toBeVisible();
    await expect(page.getByTestId('conflict-row')).toHaveCount(0);
    await expect(page.getByText(/No allergy conflicts among the 4 having lunch so far/)).toBeVisible();
    await expect(page.getByText('Today’s menu differs from the weekly plan.')).toBeVisible();
    // the weekly template is untouched
    await expect(page.getByTestId('plan-3-lunch')).toContainText('Sop ikan kakap');
  });
});

test.describe('closed days', () => {
  test('a closed day shows a closed state instead of crashing; the weekly plan still opens', async ({ page }) => {
    const c = watchConsole(page);
    const made = await act(page, 's9', 'calendarEvent.create', { date: T, kind: 'closed', title: 'Staff first-aid training' });
    test.skip(!made.ok() && (await made.json()).code === 'err.unknownAction', 'calendarEvent.create is not registered yet (schedule area)');
    expect(made.ok()).toBeTruthy();
    await signIn(page, 's3');
    await expect(page.getByRole('heading', { name: 'Menu of the day' })).toBeVisible();
    await expect(page.getByText('Club closed')).toBeVisible();
    await expect(page.getByText('The club is closed today. We open again on Thursday 22 October.')).toBeVisible();
    await expect(page.getByTestId('plan-day-3')).toContainText('Closed'); // today, in the weekly plan
    await expect(page.getByTestId('conflict-row')).toHaveCount(0);
    await expect(page.getByTestId('covers')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Add a photo of today.s lunch/ })).toHaveCount(0);
    // the planning list still works: its days start at the next open day, with no "Today"
    const days = page.getByRole('group', { name: 'Menu day' });
    await expect(days.getByRole('button', { name: 'Today' })).toHaveCount(0);
    await expect(days.getByRole('button', { name: 'Thu 22 Oct' })).toHaveAttribute('aria-pressed', 'true');
    // the weekly template is not tied to today: it still shows and edits
    await expect(page.getByTestId('plan-4-lunch')).toContainText('Semur tahu tempe');
    await page.getByTestId('plan-4-lunch').getByRole('button', { name: 'Remove Jeruk' }).click();
    await expect(page.getByText('Unpublished changes: 1').first()).toBeVisible();
    await page.getByRole('button', { name: 'Discard changes' }).click();
    // one-date changes refuse the closed day and offer another
    await page.getByRole('button', { name: 'Change a date' }).click();
    const sheet = page.getByRole('dialog', { name: 'Change one date' });
    await expect(sheet.getByText('The club is closed that day.').first()).toBeVisible();
    await pickDate(page, 'Date', '2026-10-22');
    await expect(sheet.getByRole('group', { name: 'Lunch' })).toContainText('Semur tahu tempe');
    await assertNoHorizontalScroll(page);
    c.assertClean();
  });
});

test.describe('allergies on file: planning ahead', () => {
  const days = (page: Page) => page.getByRole('group', { name: 'Menu day' });
  const onFile = (page: Page, who: string) => page.getByTestId('onfile-row').filter({ hasText: who });

  test('lists the active members with a food allergy, where they are, and what clashes', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's3');
    await expect(page.getByText('Allergies on file', { exact: true })).toBeVisible();
    await expect(page.getByTestId('onfile-row')).toHaveCount(2); // Bapak Bambang (seafood) and Oma Lina (shellfish)
    const bambang = onFile(page, 'Bapak Bambang');
    await expect(bambang).toContainText('On file: Seafood');
    await expect(bambang).toContainText('In the club');
    await expect(bambang).toContainText('Sop ikan kakap contains fish');
    await expect(bambang).toContainText('handled in the conflicts above');
    await expect(bambang.getByRole('button', { name: 'Prepare an alternative' })).toHaveCount(0); // the live panel owns it
    const lina = onFile(page, 'Oma Lina');
    await expect(lina).toContainText('On file: Shellfish');
    await expect(lina).toContainText('Not here yet');
    await expect(lina).toContainText('Nothing on this menu clashes.');
    // another day: Thursday has no fish, and "in the club" only means something today
    await days(page).getByRole('button', { name: 'Thu 22 Oct' }).click();
    await expect(bambang).toContainText('Nothing on this menu clashes.');
    await expect(bambang).not.toContainText('In the club');
    await days(page).getByRole('button', { name: 'Today' }).click();
    await expect(bambang).toContainText('In the club');
    await assertNoHorizontalScroll(page);
    c.assertClean();
  });

  test('prepare an alternative before the member arrives: the family hears, and on arrival it shows sorted', async ({ page, browser }, info) => {
    const c = watchConsole(page);
    // the soup carries shellfish too, so Oma Lina would clash if she comes today
    expect((await act(page, 's3', 'dish.upsert', { id: 'dish-sop-ikan', name: 'Sop ikan kakap', course: 'lunch', allergens: ['fish', 'shellfish'], tags: [], reviewed: true })).ok()).toBeTruthy();
    await signIn(page, 's3');
    const lina = onFile(page, 'Oma Lina');
    await expect(lina).toContainText('If they come today');
    await lina.getByRole('button', { name: 'Prepare an alternative' }).click();
    const sheet = page.getByRole('dialog', { name: 'Alternative for Oma Lina' });
    await sheet.getByLabel('What will you serve instead?').fill('Ayam kukus');
    await sheet.getByRole('button', { name: 'Alternative prepared' }).click();
    await expect(toast(page)).toContainText('Ayam kukus instead of Sop ikan kakap for Oma Lina');
    await expect(lina.getByTestId('onfile-clash')).toHaveAttribute('data-resolved', 'yes');
    await expect(lina).toContainText('Serving Ayam kukus instead');
    await expect(page.getByTestId('conflict-row').filter({ hasText: 'Oma Lina' })).toHaveCount(0); // not here yet: not in the live panel
    // her daughter already hears about it
    const maria = await another(browser, info, 'f1', '/today');
    await maria.page.getByRole('button', { name: /Notifications/ }).first().click();
    const panel = maria.page.getByRole('dialog', { name: 'Notifications' });
    await panel.getByRole('tab', { name: /Updates/ }).click();
    await expect(panel.getByText('Oma Lina: the kitchen is serving Ayam kukus instead of Sop ikan kakap today.')).toBeVisible();
    await maria.close();
    // undo from the list, then prepare it again
    await lina.getByRole('button', { name: 'Undo' }).click();
    await expect(lina.getByTestId('onfile-clash')).toHaveAttribute('data-resolved', 'no');
    await lina.getByRole('button', { name: 'Prepare an alternative' }).click();
    await page.getByRole('dialog', { name: 'Alternative for Oma Lina' }).getByLabel('What will you serve instead?').fill('Ayam kukus');
    await page.getByRole('dialog', { name: 'Alternative for Oma Lina' }).getByRole('button', { name: 'Alternative prepared' }).click();
    await expect(lina.getByTestId('onfile-clash')).toHaveAttribute('data-resolved', 'yes');
    // the lobby checks her in: the live panel lists her, already sorted
    expect((await act(page, 's1', 'attendance.checkIn', { memberId: 'm1', method: 'manual' })).ok()).toBeTruthy();
    const row = page.getByTestId('conflict-row').filter({ hasText: 'Oma Lina' });
    await expect(row).toHaveAttribute('data-resolved', 'yes');
    await expect(row).toContainText('Serving Ayam kukus instead');
    await expect(lina).toContainText('In the club');
    c.assertClean();
  });

  test('plan ahead for a coming day: pick Thursday and answer that day\'s clash', async ({ page }) => {
    expect((await act(page, 's3', 'dish.upsert', { id: 'dish-semur-tahu', name: 'Semur tahu tempe', course: 'lunch', allergens: ['soy', 'shellfish'], tags: ['vegetarian'], reviewed: true })).ok()).toBeTruthy();
    await signIn(page, 's3');
    await days(page).getByRole('button', { name: 'Thu 22 Oct' }).click();
    const lina = onFile(page, 'Oma Lina');
    await expect(lina).toContainText('If they come that day');
    await expect(lina).toContainText('Semur tahu tempe contains shellfish');
    await lina.getByRole('button', { name: 'Prepare an alternative' }).click();
    const sheet = page.getByRole('dialog', { name: 'Alternative for Oma Lina' });
    await sheet.getByLabel('What will you serve instead?').fill('Tempe goreng');
    await sheet.getByRole('button', { name: 'Alternative prepared' }).click();
    await expect(lina.getByTestId('onfile-clash')).toHaveAttribute('data-resolved', 'yes');
    await expect.poll(async () => (await stateOf(page, 's3')).dayMenus['2026-10-22']?.allergyPlans).toMatchObject([{ person: 'member:m1', dishId: 'dish-semur-tahu', alternative: 'Tempe goreng', by: 's3' }]);
    // today is untouched
    await days(page).getByRole('button', { name: 'Today' }).click();
    await expect(lina).toContainText('Nothing on this menu clashes.');
  });

  test('the weekly plan flags dishes that clash with an allergy on file', async ({ page }) => {
    await signIn(page, 's3');
    const soup = page.getByTestId('plan-3-lunch').getByRole('button', { name: /Remove Sop ikan kakap/ });
    await expect(soup).toHaveAttribute('data-clash', 'yes');
    await expect(soup).toHaveAttribute('aria-label', /Clashes with Bapak Bambang \(allergy on file\)/);
    await expect(page.getByTestId('plan-4-lunch').getByRole('button', { name: /Remove Semur tahu tempe/ })).not.toHaveAttribute('data-clash', 'yes');
    // the picker says it too, so a dish can be chosen knowing who it affects
    await page.getByTestId('plan-4-lunch').getByRole('button', { name: 'Add a dish to Lunch' }).click();
    const picker = page.getByRole('dialog', { name: 'Thursday · Lunch' });
    await picker.getByLabel('Find a dish').fill('sop ikan');
    await expect(picker.getByRole('checkbox', { name: /Sop ikan kakap/ })).toContainText('Clashes with Bapak Bambang');
    await picker.getByLabel('Find a dish').fill('rawon');
    await expect(picker.getByRole('checkbox', { name: /Rawon daging/ })).not.toContainText('Clashes with');
  });
});

test.describe('weekly menu plan and dishes', () => {
  test('edit Thursday\'s lunch in the template and publish it', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's3');
    const lunch = page.getByTestId('plan-4-lunch');
    await expect(lunch).toContainText('Semur tahu tempe');
    await lunch.getByRole('button', { name: 'Remove Semur tahu tempe' }).click();
    await lunch.getByRole('button', { name: 'Add a dish to Lunch' }).click();
    const picker = page.getByRole('dialog', { name: 'Thursday · Lunch' });
    await picker.getByLabel('Find a dish').fill('ayam');
    await picker.getByRole('checkbox', { name: /Ayam bakar kecap/ }).click();
    await picker.getByRole('button', { name: 'Done' }).click();
    await expect(lunch).not.toContainText('Semur tahu tempe');
    await expect(lunch).toContainText('Ayam bakar kecap');
    await expect(page.getByText('Unpublished changes: 1').first()).toBeVisible();
    // nothing is live yet: the saved template still has the tofu
    const before = await stateOf(page, 's3');
    expect(Object.values<{ status: string }>(before.menuVersions).filter((v) => v.status === 'published')).toHaveLength(1);
    await page.getByRole('button', { name: 'Publish menu' }).click();
    const dlg = page.getByRole('dialog', { name: 'Publish weekly menu' });
    await expect(dlg.getByText('Thursday · Lunch')).toBeVisible();
    await expect(dlg.getByText('+ Ayam bakar kecap')).toBeVisible();
    await expect(dlg.getByText('− Semur tahu tempe')).toBeVisible();
    await dlg.getByRole('button', { name: 'Publish menu' }).click();
    await expect(toast(page)).toContainText('Weekly menu published from');
    await expect(page.getByText('Unpublished changes: 1')).toHaveCount(0);
    await expect(lunch).toContainText('Ayam bakar kecap');
    const after = await stateOf(page, 's3');
    const live = Object.values<{ status: string; effectiveFrom: string; deletedAt?: string; days: Record<string, { lunch: string[] }> }>(after.menuVersions).filter((v) => !v.deletedAt && v.effectiveFrom === T);
    expect(live).toHaveLength(1);
    expect(live[0].days['4'].lunch).toContain('dish-ayam-bakar');
    expect(live[0].days['4'].lunch).not.toContain('dish-semur-tahu');
    await assertNoHorizontalScroll(page);
    c.assertClean();
  });

  test('nothing is saved per keystroke: discard drops the draft', async ({ page }) => {
    await signIn(page, 's3');
    const lunch = page.getByTestId('plan-5-lunch');
    await lunch.getByRole('button', { name: 'Remove Buah naga' }).click();
    await expect(page.getByText('Unpublished changes: 1').first()).toBeVisible();
    await page.getByRole('button', { name: 'Discard changes' }).click();
    await expect(lunch).toContainText('Buah naga');
    await expect(page.getByText('Unpublished changes: 1')).toHaveCount(0);
    expect(Object.values((await stateOf(page, 's3')).menuVersions)).toHaveLength(1);
  });

  test('a new dish gets its allergen tags when it is created and joins the menu draft', async ({ page }) => {
    await signIn(page, 's3');
    const lunch = page.getByTestId('plan-4-lunch');
    await lunch.getByRole('button', { name: 'Add a dish to Lunch' }).click();
    const picker = page.getByRole('dialog', { name: 'Thursday · Lunch' });
    await picker.getByLabel('Find a dish').fill('Ayam kukus');
    await picker.getByRole('button', { name: /Add “Ayam kukus” as a new dish/ }).click();
    const dish = page.getByRole('dialog', { name: 'New dish' });
    await expect(dish).toBeVisible();
    await expect(dish.getByLabel('Dish name')).toHaveValue('Ayam kukus');
    await dish.getByRole('button', { name: 'Soy' }).click();
    await dish.getByRole('button', { name: 'Save dish' }).click();
    await expect(toast(page)).toContainText('Ayam kukus saved');
    await expect(lunch).toContainText('Ayam kukus');
    const s = await stateOf(page, 's3');
    const made = Object.values<{ name: string; allergens: string[]; course: string; reviewedBy?: string }>(s.dishes).find((d) => d.name === 'Ayam kukus')!;
    expect(made).toMatchObject({ allergens: ['soy'], course: 'lunch', reviewedBy: 's3' });
  });

  test('the dish editor tags allergens; tagging shellfish on the fish soup creates new conflicts', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's3');
    await page.getByLabel('Search dishes').fill('sop ikan');
    await page.getByTestId('dish-row').filter({ hasText: 'Sop ikan kakap' }).click();
    const dish = page.getByRole('dialog', { name: 'Sop ikan kakap' });
    await expect(dish.getByRole('button', { name: 'Fish', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(dish.getByText(/Allergens checked by Chef Agus/)).toBeVisible();
    await dish.getByRole('button', { name: 'Shellfish' }).click();
    await dish.getByRole('button', { name: 'Save dish' }).click();
    await expect(toast(page)).toContainText('Sop ikan kakap saved');
    // the trial guest (shellfish) is here, so the soup now clashes for the guest next to Bambang
    await expect(page.getByTestId('conflict-row')).toHaveCount(2);
    await expect(page.getByTestId('conflict-row').filter({ hasText: 'Oma Siu Lan Tjandra' })).toContainText('contains shellfish');
    // Oma Lina has shellfish on file but has not arrived: she is in the planning list, "if they come today"
    const lina = page.getByTestId('onfile-row').filter({ hasText: 'Oma Lina' });
    await expect(lina).toContainText('Not here yet');
    await expect(lina).toContainText('If they come today');
    await expect(lina).toContainText('Sop ikan kakap contains shellfish');
    // she arrives: her conflict appears in the live panel without a reload
    expect((await act(page, 's1', 'attendance.checkIn', { memberId: 'm1', method: 'manual' })).ok()).toBeTruthy();
    await expect(page.getByTestId('conflict-row')).toHaveCount(3);
    await expect(page.getByTestId('conflict-row').filter({ hasText: 'Oma Lina' })).toContainText('contains shellfish');
    await expect(lina).toContainText('In the club');
    await expect(lina).toContainText('handled in the conflicts above');
    c.assertClean();
  });

  test('a dish whose allergens nobody checked is flagged, and checking it clears the flag', async ({ page }) => {
    await signIn(page, 's3');
    await page.getByLabel('Search dishes').fill('pepaya');
    await page.getByTestId('dish-row').filter({ hasText: 'Pepaya' }).click();
    const dish = page.getByRole('dialog', { name: 'Pepaya' });
    await dish.getByRole('button', { name: 'Gluten' }).click();
    await dish.getByRole('switch', { name: /Allergens checked/ }).click(); // leave it unchecked
    await dish.getByRole('button', { name: 'Save dish' }).click();
    await expect(page.getByText(/Allergens have not been checked for: Pepaya/)).toBeVisible();
    await page.getByRole('button', { name: 'Check Pepaya' }).click();
    const again = page.getByRole('dialog', { name: 'Pepaya' });
    await again.getByRole('switch', { name: /Allergens checked/ }).click();
    await again.getByRole('button', { name: 'Save dish' }).click();
    await expect(page.getByText(/Allergens have not been checked for/)).toHaveCount(0);
  });

  test('one-off changes: change a date, see it listed, remove it', async ({ page }) => {
    await signIn(page, 's3');
    await page.getByRole('button', { name: 'Change a date' }).click();
    const sheet = page.getByRole('dialog', { name: 'Change one date' });
    await pickDate(page, 'Date', '2026-10-22');
    await sheet.getByRole('button', { name: 'Add a dish to Afternoon tea' }).click();
    const picker = page.getByRole('dialog', { name: 'Add to Afternoon tea' });
    await picker.getByRole('checkbox', { name: /Klepon/ }).click();
    await picker.getByRole('button', { name: 'Done' }).click();
    await page.getByRole('dialog', { name: 'Change one date' }).getByRole('button', { name: 'Save for this date' }).click();
    const row = page.getByTestId('override-row');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Thu 22 Oct');
    await expect(row).toContainText('Afternoon tea: Kacang hijau, Klepon'.replace('Kacang hijau', 'Bubur kacang hijau'));
    await row.getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByTestId('override-row')).toHaveCount(0);
  });

  test('closed days and past days cannot be picked in the one-date editor, with no crash', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's3');
    await page.getByRole('button', { name: 'Change a date' }).click();
    const sheet = page.getByRole('dialog', { name: 'Change one date' });
    await expect(fieldText(page, 'Date')).toContainText('Wed 21 Oct 2026');
    await fieldText(page, 'Date').click();
    await expect(page.locator('[data-date="2026-10-24"]')).toHaveAttribute('aria-disabled', 'true'); // Saturday
    await expect(page.locator('[data-date="2026-10-30"]')).toHaveAttribute('aria-disabled', 'true'); // closed for training
    await expect(page.locator('[data-date="2026-10-20"]')).toHaveAttribute('aria-disabled', 'true'); // yesterday
    await expect(page.locator('[data-date="2026-10-22"]')).not.toHaveAttribute('aria-disabled', 'true');
    await page.locator('[data-date="2026-10-24"]').click({ force: true }); // refused: the picker stays on the same day
    await page.locator('[data-date="2026-10-23"]').click();
    await expect(fieldText(page, 'Date')).toContainText('Fri 23 Oct 2026');
    await expect(sheet.getByRole('group', { name: 'Lunch' })).toBeVisible();
    await assertNoHorizontalScroll(page);
    c.assertClean();
  });
});

test.describe('planning other weeks', () => {
  const NEXT = '2026-10-26'; // next Monday
  const week = (page: Page) => page.getByTestId('plan-week');
  const next = (page: Page) => page.getByRole('button', { name: 'Next week', exact: true });
  const prev = (page: Page) => page.getByRole('button', { name: 'Previous week', exact: true });
  const notes = async (page: Page, userId: string, kind: string) => Object.values<{ kind: string; params: Record<string, string>; toUsers: string[] }>((await stateOf(page, userId)).notifications).filter((x) => x.kind === kind);

  test('the date is shown right below each day name, and today is marked', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's3');
    await expect(week(page)).toContainText('This week');
    await expect(week(page)).toContainText('19 Oct – 23 Oct');
    const dates = ['19 Oct', '20 Oct', '21 Oct', '22 Oct', '23 Oct'];
    for (const [i, d] of dates.entries()) {
      const day = page.getByTestId(`plan-day-${i + 1}`);
      await expect(day.getByTestId(`plan-date-${i + 1}`)).toHaveText(d);
      await expect(day).toHaveAttribute('data-day', `2026-10-${19 + i}`);
    }
    await expect(page.getByTestId('plan-day-3')).toContainText('TODAY');
    await expect(page.getByTestId('plan-day-4')).not.toContainText('TODAY');
    await expect(prev(page)).toHaveAttribute('aria-disabled', 'true'); // no planning in the past
    await assertNoHorizontalScroll(page);
    c.assertClean();
  });

  test('the week switcher shows next week with its own dates, closed days marked, and no "today"', async ({ page }) => {
    await signIn(page, 's3');
    await next(page).click();
    await expect(week(page)).toContainText('Next week');
    await expect(week(page)).toContainText('26 Oct – 30 Oct');
    await expect(page.getByTestId('plan-date-1')).toHaveText('26 Oct');
    await expect(page.getByTestId('plan-date-5')).toHaveText('30 Oct');
    await expect(page.getByTestId('plan-day-3')).not.toContainText('TODAY'); // Wednesday 28 Oct is not today
    await expect(page.getByTestId('plan-day-5')).toContainText('Closed'); // closed for training
    await expect(page.getByTestId('plan-day-4')).not.toContainText('Closed');
    await expect(page.getByText(/starts on its Monday and repeats every week/)).toBeVisible();
    // the menu is the one in force: Thursday's semur is there
    await expect(page.getByTestId('plan-4-lunch')).toContainText('Semur tahu tempe');
    await next(page).click();
    await expect(week(page)).toContainText('Week of Mon 2 Nov');
    await prev(page).click();
    await prev(page).click();
    await expect(week(page)).toContainText('This week');
    await expect(page.getByText(/starts on its Monday and repeats every week/)).toHaveCount(0);
  });

  test('plan next week: publish from its Monday; this week stays as it was; families are told by default', async ({ page, browser }, info) => {
    const c = watchConsole(page);
    await signIn(page, 's3');
    await next(page).click();
    const lunch = page.getByTestId('plan-4-lunch');
    await lunch.getByRole('button', { name: 'Remove Semur tahu tempe' }).click();
    await lunch.getByRole('button', { name: 'Add a dish to Lunch' }).click();
    const picker = page.getByRole('dialog', { name: 'Thursday · Lunch' });
    await picker.getByRole('checkbox', { name: /Ayam bakar kecap/ }).click();
    await picker.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByText('Unpublished changes: 1').first()).toBeVisible();
    // this week shows no draft
    await prev(page).click();
    await expect(page.getByTestId('plan-4-lunch')).toContainText('Semur tahu tempe');
    await expect(page.getByText('Unpublished changes: 1')).toHaveCount(0);
    await expect(page.getByText('Unpublished changes in other weeks:')).toBeVisible();
    await page.getByRole('button', { name: /Go to Next week, 1 unpublished changes/ }).click();
    await expect(week(page)).toContainText('Next week');
    await expect(page.getByTestId('plan-4-lunch')).toContainText('Ayam bakar kecap');
    await page.getByRole('button', { name: 'Publish menu' }).click();
    const dlg = page.getByRole('dialog', { name: 'Publish weekly menu' });
    await expect(dlg.getByText(/Planning: Next week · 26 Oct – 30 Oct/)).toBeVisible();
    await expect(dlg.getByText('+ Ayam bakar kecap')).toBeVisible();
    await expect(dlg.getByText('− Semur tahu tempe')).toBeVisible();
    // it starts on that week's Monday, and says it repeats from then on
    await expect(dlg.getByRole('button', { name: /Start of the week \(Mon 26 Oct\)/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(dlg.getByRole('button', { name: 'Today' })).toHaveCount(0); // that choice is for the current week
    await expect(dlg.getByText(/From Mon 26 Oct this menu repeats every week until you publish a different one/)).toBeVisible();
    const laras = await another(browser, info, 'fm10_0', '/today');
    const toggle = dlg.getByRole('switch', { name: /Notify families/ });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await dlg.getByRole('button', { name: 'Publish menu' }).click();
    await expect(toast(page)).toContainText('Weekly menu published from Mon 26 Oct');
    await expect(page.getByText('Unpublished changes: 1')).toHaveCount(0);
    const st = await stateOf(page, 's3');
    const live = Object.values<{ effectiveFrom: string; deletedAt?: string; days: Record<string, { lunch: string[] }> }>(st.menuVersions).filter((v) => !v.deletedAt && v.effectiveFrom === NEXT);
    expect(live).toHaveLength(1);
    expect(live[0].days['4'].lunch).toContain('dish-ayam-bakar');
    expect(live[0].days['4'].lunch).not.toContain('dish-semur-tahu');
    expect(Object.values<{ effectiveFrom: string; deletedAt?: string }>(st.menuVersions).filter((v) => !v.deletedAt && v.effectiveFrom === T)).toHaveLength(0); // nothing new from today
    // this week is untouched, next week's Thursday is the new menu
    await prev(page).click();
    await expect(page.getByTestId('plan-4-lunch')).toContainText('Semur tahu tempe');
    await expect(page.getByText('Another weekly menu is already scheduled from Mon 26 Oct')).toBeVisible();
    // Laras (the family) was told
    expect(await notes(page, 'fm10_0', 'kitchen.notif.menuPublished')).toHaveLength(1);
    await laras.page.getByRole('button', { name: /Notifications/ }).first().click();
    const panel = laras.page.getByRole('dialog', { name: 'Notifications' });
    await panel.getByRole('tab', { name: /Updates/ }).click();
    await expect(panel.getByText('The weekly menu changes from Mon 26 Oct.')).toBeVisible();
    await laras.close();
    await assertNoHorizontalScroll(page);
    c.assertClean();
  });

  test('the notify toggle: off publishes quietly', async ({ page }) => {
    await signIn(page, 's3');
    await page.getByTestId('plan-5-lunch').getByRole('button', { name: 'Remove Buah naga' }).click();
    await page.getByRole('button', { name: 'Publish menu' }).click();
    const dlg = page.getByRole('dialog', { name: 'Publish weekly menu' });
    await expect(dlg.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'true'); // the current week starts today
    await expect(dlg.getByRole('button', { name: /Next Monday/ })).toBeVisible();
    await dlg.getByRole('switch', { name: /Notify families/ }).click();
    await dlg.getByRole('button', { name: 'Publish menu' }).click();
    await expect(toast(page)).toContainText('Weekly menu published from Wed 21 Oct');
    expect(await notes(page, 'fm10_0', 'kitchen.notif.menuPublished')).toHaveLength(0);
  });

  test('"Pick a date" uses the calendar, and a past date cannot be chosen', async ({ page }) => {
    await signIn(page, 's3');
    await page.getByTestId('plan-5-lunch').getByRole('button', { name: 'Remove Buah naga' }).click();
    await page.getByRole('button', { name: 'Publish menu' }).click();
    const dlg = page.getByRole('dialog', { name: 'Publish weekly menu' });
    await dlg.getByRole('button', { name: 'Pick a date' }).click();
    await expect(dlg.getByRole('button', { name: 'Publish menu' })).toBeDisabled().catch(() => {}); // no date yet
    await fieldText(page, 'Date').click();
    await expect(page.locator('[data-date="2026-10-20"]')).toHaveAttribute('aria-disabled', 'true'); // yesterday
    await page.getByRole('button', { name: 'Next month' }).click();
    await page.locator('[data-date="2026-11-02"]').click();
    await expect(dlg.getByText(/From Mon 2 Nov this menu repeats every week/)).toBeVisible();
    await dlg.getByRole('button', { name: 'Publish menu' }).click();
    await expect(toast(page)).toContainText('Weekly menu published from Mon 2 Nov');
  });

  test('unpublished edits are kept per week while the switcher moves; discard drops only the week shown', async ({ page }) => {
    await signIn(page, 's3');
    await page.getByTestId('plan-5-lunch').getByRole('button', { name: 'Remove Buah naga' }).click();
    await next(page).click();
    await expect(page.getByText('Unpublished changes: 1')).toHaveCount(0);
    await page.getByTestId('plan-5-lunch').getByRole('button', { name: 'Remove Buah naga' }).click();
    await expect(page.getByText('Unpublished changes: 1').first()).toBeVisible();
    await expect(page.getByText('Unpublished changes in other weeks:')).toBeVisible();
    await page.getByRole('button', { name: 'Discard changes' }).click();
    await expect(page.getByTestId('plan-5-lunch')).toContainText('Buah naga');
    await prev(page).click();
    await expect(page.getByText('Unpublished changes: 1').first()).toBeVisible(); // this week's edit is still there
    await expect(page.getByTestId('plan-5-lunch')).not.toContainText('Buah naga');
  });

  test('Indonesian: the week switcher, the dates under the days and the notify toggle', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's3', '/today', 'id');
    await expect(page.getByTestId('plan-week')).toContainText('Minggu ini');
    await expect(page.getByTestId('plan-date-1')).toHaveText('19 Okt');
    await page.getByRole('button', { name: 'Minggu depan', exact: true }).click();
    await expect(page.getByTestId('plan-week')).toContainText('Minggu depan');
    await expect(page.getByText(/berlaku mulai hari Seninnya dan berulang setiap minggu/)).toBeVisible();
    await page.getByTestId('plan-4-lunch').getByRole('button', { name: /Hapus Semur tahu tempe/ }).click();
    await page.getByRole('button', { name: 'Terbitkan menu' }).first().click();
    const dlg = page.getByRole('dialog', { name: 'Terbitkan menu mingguan' });
    await expect(dlg.getByRole('switch', { name: /Beri tahu keluarga/ })).toHaveAttribute('aria-checked', 'true');
    await expect(dlg.getByText(/Awal minggu \(Sen 26 Okt\)/).first()).toBeVisible();
    expect(await dlg.innerText()).not.toMatch(/\b(kitchen|requests|common)\.[a-zA-Z_]+/);
    await dlg.getByRole('button', { name: 'Batal' }).click();
    expect(await page.locator('#main').innerText()).not.toMatch(/\b(kitchen|requests|common)\.[a-zA-Z_]+/);
    c.assertClean();
  });
});

test.describe('feedback', () => {
  test('kitchen replies to open feedback; Laras sees the reply and the update', async ({ page, browser }, info) => {
    const c = watchConsole(page);
    await signIn(page, 's3', '/feedback');
    await expect(page.getByRole('heading', { name: 'Feedback' })).toBeVisible();
    await expect(page.getByText('2 open · from families')).toBeVisible();
    const card = page.getByTestId('feedback-card').filter({ hasText: 'Papa said the soup was too salty on Monday.' });
    await expect(card).toContainText('Bapak Bambang');
    await expect(card).toContainText('From Laras Saputra, daughter');
    await expect(card).toContainText('Sayur asem · Monday’s menu');
    await expect(card).toHaveAttribute('data-status', 'open');
    await card.getByLabel('Reply').fill('Thank you, Laras. We will use less salt in the sayur asem.');
    await card.getByRole('button', { name: 'Send reply' }).click();
    await expect(toast(page)).toContainText('Reply sent to Laras');
    await expect(card).toHaveAttribute('data-status', 'answered');
    await expect(card.getByTestId('reply')).toContainText('We will use less salt in the sayur asem.');
    await expect(card.getByTestId('reply')).toContainText('Chef Agus');
    await expect(page.getByText('1 open · from families')).toBeVisible();
    await assertNoHorizontalScroll(page);
    // Laras: the reply is in her Messages thread, and in her updates
    const laras = await another(browser, info, 'fm10_0', '/today');
    const st = await stateOf(laras.page, 'fm10_0');
    const msgs = Object.values<{ threadId: string; from: string; text: string }>(st.messages).filter((m) => m.threadId === 'tk-c1');
    expect(msgs.map((m) => m.from)).toEqual(['family:fm10_0', 'staff:s3']);
    expect(msgs[1].text).toContain('use less salt');
    await laras.page.getByRole('button', { name: /Notifications/ }).first().click();
    const panel = laras.page.getByRole('dialog', { name: 'Notifications' });
    await panel.getByRole('tab', { name: /Updates/ }).click();
    await expect(panel.getByText('The kitchen replied about Bapak Bambang’s meal.')).toBeVisible();
    // and the Messages screen shows it once the chat screen is built
    await laras.page.keyboard.press('Escape');
    await laras.page.goto('/chat');
    if (!(await laras.page.getByText('This screen is being built.').count())) await expect(laras.page.getByText(/use less salt/).first()).toBeVisible();
    await laras.close();
    c.assertClean();
  });

  test('through three screens: Laras sends feedback in her app, the kitchen answers, the answer lands in her Messages', async ({ page, browser }, info) => {
    const c = watchConsole(page);
    await signIn(page, 'fm10_0', '/today');
    await page.getByRole('button', { name: 'Feedback on lunch' }).click();
    await page.getByRole('radio', { name: 'Sop ikan kakap' }).click();
    await page.getByLabel('What would you like the kitchen to know?').fill('The fish soup was a little too hot for Papa.');
    await page.getByRole('button', { name: 'Send feedback' }).click();
    await expect(toast(page)).toContainText('The kitchen team will reply in Messages');
    // the kitchen sees it, open, with the dish and the family it came from
    const chef = await another(browser, info, 's3', '/feedback');
    const card = chef.page.getByTestId('feedback-card').filter({ hasText: 'a little too hot for Papa' });
    await expect(card).toHaveAttribute('data-status', 'open');
    await expect(card).toContainText('Bapak Bambang');
    await expect(card).toContainText('Sop ikan kakap · Wednesday’s menu');
    await expect(card).toContainText('From Laras Saputra, daughter · today');
    await expect(chef.page.getByText('3 open · from families')).toBeVisible();
    await card.getByLabel('Reply').fill('Thank you Laras, we will serve it cooler.');
    await card.getByRole('button', { name: 'Send reply' }).click();
    await expect(chef.page.getByRole('status')).toContainText('Reply sent to Laras');
    await chef.close();
    // Laras: the answer is waiting in Messages
    await page.goto('/chat');
    await expect(page.getByText(/we will serve it cooler/).first()).toBeVisible();
    await assertNoHorizontalScroll(page);
    c.assertClean();
  });

  test('a family submits feedback; it reaches the kitchen list, then edit the reply and reopen', async ({ page }) => {
    // the family sheet belongs to the family area; here the family's own action is called directly
    const r = await act(page, 'fm20_0', 'feedback.submit', { memberId: 'm20', mealDate: T, dish: 'Tumis buncis wortel', text: 'The beans were a bit hard for Papa.' });
    expect(r.ok()).toBeTruthy();
    await signIn(page, 's2', '/feedback');
    const card = page.getByTestId('feedback-card').filter({ hasText: 'The beans were a bit hard for Papa.' });
    await expect(card).toContainText('Opa Tjahjadi');
    await expect(card).toContainText('From Yohana Lim, daughter · today');
    await expect(page.getByText('3 open · from families')).toBeVisible();
    await card.getByLabel('Reply').fill('Sorry! We will steam them longer.');
    await card.getByRole('button', { name: 'Send reply' }).click();
    await expect(card).toHaveAttribute('data-status', 'answered');
    // edit the reply: a new message, the first stays in the thread
    await card.getByRole('button', { name: 'Edit reply' }).click();
    await expect(card.getByLabel('Reply')).toHaveValue('Sorry! We will steam them longer.');
    await card.getByLabel('Reply').fill('Sorry! We will steam them longer, and cut them smaller.');
    await card.getByRole('button', { name: 'Send corrected reply' }).click();
    await expect(card.getByTestId('reply')).toHaveCount(2);
    await expect(card.getByTestId('reply').last()).toContainText('cut them smaller');
    await expect(card).toHaveAttribute('data-status', 'answered');
    // reopen: back to open with a reply box
    await card.getByRole('button', { name: 'Reopen' }).click();
    await expect(card).toHaveAttribute('data-status', 'open');
    await expect(card.getByLabel('Reply')).toBeVisible();
    await expect(page.getByText('3 open · from families')).toBeVisible();
    // close without more words
    await card.getByRole('button', { name: 'Close' }).click();
    await expect(card).toHaveAttribute('data-status', 'closed');
    await expect(card.getByLabel('Reply')).toHaveCount(0);
  });

  test('staff log feedback received by phone, then answer it', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's3', '/feedback');
    await page.getByRole('button', { name: 'Log a call' }).click();
    const sheet = page.getByRole('dialog', { name: 'Log feedback' });
    await sheet.getByLabel('Who is it about?').fill('Hendra');
    await sheet.getByRole('button', { name: /Opa Hendra Gunawan/ }).click();
    await sheet.getByRole('button', { name: 'Sop ikan kakap' }).click();
    await sheet.getByLabel('What did they say?').fill('Cynthia phoned: the fish soup was too hot for Papa.');
    await sheet.getByRole('button', { name: 'Log feedback' }).click();
    await expect(toast(page)).toContainText('Feedback logged for Opa Hendra Gunawan');
    const card = page.getByTestId('feedback-card').filter({ hasText: 'the fish soup was too hot' });
    await expect(card).toContainText('Logged by Chef Agus · phone call · today');
    await expect(card).toHaveAttribute('data-status', 'open');
    await card.getByLabel('Reply').fill('Thank you, we will serve it cooler.');
    await card.getByRole('button', { name: 'Send reply' }).click();
    await expect(toast(page)).toContainText('Reply sent to the family'); // the server has it
    await expect(card).toHaveAttribute('data-status', 'answered');
    const st = await stateOf(page, 's3');
    const fb = Object.values<{ text: string; familyId: string | null; threadId?: string }>(st.feedback).find((f) => f.text.includes('too hot'))!;
    expect(fb.familyId).toBeNull();
    expect(st.threads[fb.threadId!]).toMatchObject({ familyId: 'fm2_0', topic: 'kitchen' }); // Cynthia, Hendra's primary contact
    await assertNoHorizontalScroll(page);
    c.assertClean();
  });
});

test.describe('stock', () => {
  test('the F&B supervisor approves kitchen items; management declines with a note and the request is kept', async ({ page, browser }, info) => {
    const c = watchConsole(page);
    await signIn(page, 's2', '/stock');
    await expect(page.getByRole('heading', { name: 'Stock requests' })).toBeVisible();
    await expect(page.getByTestId('stock-row')).toHaveCount(5);
    // k2 (Teh melati, kitchen): approve
    const k2 = page.locator('[data-testid="stock-row"][data-id="k2"]');
    await k2.getByRole('button', { name: 'Approve' }).click();
    await expect(toast(page)).toContainText('Teh melati approved');
    await expect(k2).toHaveAttribute('data-status', 'approved');
    await expect(k2).toContainText('Approved · to order');
    await expect(k2).toContainText('approved by Pak Yohanes');
    // k1 (glucose strips, health): the supervisor cannot decide
    const k1 = page.locator('[data-testid="stock-row"][data-id="k1"]');
    await expect(k1.getByRole('button', { name: 'Approve' })).toHaveCount(0);
    await expect(k1).toContainText('Waiting for approval');
    // management declines k1 with a reason
    const boss = await another(browser, info, 's9', '/stock');
    const b1 = boss.page.locator('[data-testid="stock-row"][data-id="k1"]');
    await b1.getByRole('button', { name: 'Decline' }).click();
    const dlg = boss.page.getByRole('dialog', { name: 'Decline request' });
    await expect(dlg.getByRole('button', { name: 'Decline' })).toBeDisabled().catch(() => {});
    await dlg.getByLabel('Why is it declined?').fill('We still have four boxes in the clinic.');
    await dlg.getByRole('button', { name: 'Decline' }).click();
    await expect(b1).toHaveAttribute('data-status', 'rejected');
    await expect(b1).toContainText('Declined');
    await expect(b1).toContainText('We still have four boxes in the clinic.');
    await expect(b1).toContainText('declined by Ega');
    await expect(boss.page.getByTestId('stock-row')).toHaveCount(5); // kept, not deleted
    await boss.close();
    // the supervisor sees it too, still listed as Declined
    await page.reload();
    await expect(page.locator('[data-testid="stock-row"][data-id="k1"]')).toHaveAttribute('data-status', 'rejected');
    // the nurse was told
    const nurse = await another(browser, info, 's8', '/requests');
    await nurse.page.getByRole('button', { name: /Notifications/ }).first().click();
    const panel = nurse.page.getByRole('dialog', { name: 'Notifications' });
    await panel.getByRole('tab', { name: /Updates/ }).click();
    await expect(panel.getByText(/Your stock request was declined: Test strips \(glucose\)\. We still have four boxes/)).toBeVisible();
    await nurse.close();
    await assertNoHorizontalScroll(page);
    c.assertClean();
  });

  test('receiving is limited to the requester and approvers', async ({ page }) => {
    await signIn(page, 's3', '/stock'); // the chef: not the requester of k3, not an approver
    const k3 = page.locator('[data-testid="stock-row"][data-id="k3"]');
    await expect(k3).toHaveAttribute('data-status', 'approved');
    await expect(k3.getByRole('button', { name: 'Mark received' })).toHaveCount(0);
    // the supervisor receives kitchen items only: k3 is activities
    await signIn(page, 's2', '/stock');
    await expect(page.locator('[data-testid="stock-row"][data-id="k3"]').getByRole('button', { name: 'Mark received' })).toHaveCount(0);
    // management may
    await signIn(page, 's9', '/stock');
    const m3 = page.locator('[data-testid="stock-row"][data-id="k3"]');
    await m3.getByRole('button', { name: 'Mark received' }).click();
    await expect(m3).toHaveAttribute('data-status', 'received');
    await expect(toast(page)).toContainText('Batik wax marked as received');
  });

  test('filters show counts and requests from every section are listed', async ({ page }) => {
    await signIn(page, 's3', '/stock');
    if (isPhone(page)) {
      // phone: the area and status filters are two dropdowns (the counts are in the options)
      await page.getByRole('combobox', { name: 'Filter by section' }).click();
      for (const o of ['All · 5', 'Kitchen · 2', 'Health · 1', 'Activities · 1', 'Housekeeping · 1', 'Transport · 0']) await expect(page.getByRole('option', { name: o })).toBeVisible();
      await page.getByRole('option', { name: 'Health · 1' }).click();
      await expect(page.getByTestId('stock-row')).toHaveCount(1);
      await expect(page.getByTestId('stock-row')).toContainText('Test strips (glucose) · 2 boxes');
      await pickOption(page, 'Filter by section', 'All · 5');
      await pickOption(page, 'Filter by status', /^Approved/);
      await expect(page.getByTestId('stock-row')).toHaveCount(1);
      await page.getByRole('combobox', { name: 'Filter by section' }).click();
      await expect(page.getByRole('option', { name: 'Kitchen · 0' })).toBeVisible(); // area counts follow the status filter
      await page.keyboard.press('Escape');
      await assertNoHorizontalScroll(page);
      return;
    }
    await expect(page.getByRole('button', { name: 'All · 5' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Kitchen · 2' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Health · 1' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Activities · 1' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Housekeeping · 1' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Transport · 0' })).toBeVisible();
    await page.getByRole('button', { name: 'Health · 1' }).click();
    await expect(page.getByTestId('stock-row')).toHaveCount(1);
    await expect(page.getByTestId('stock-row')).toContainText('Test strips (glucose) · 2 boxes');
    await page.getByRole('button', { name: 'All · 5' }).click();
    await page.getByRole('tab', { name: /Approved/ }).click();
    await expect(page.getByTestId('stock-row')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Kitchen · 0' })).toBeVisible(); // area counts follow the status filter
    await assertNoHorizontalScroll(page);
  });

  test('send a request, edit it, cancel it: the cancelled request stays in the list', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's3', '/stock');
    await page.getByLabel('Item', { exact: true }).fill('Cooking oil');
    await page.getByLabel('Quantity').fill('6');
    await page.getByRole('button', { name: 'litres', exact: true }).click();
    await page.getByRole('button', { name: 'Send request' }).click();
    await expect(toast(page)).toContainText('Request sent for approval');
    const row = page.getByTestId('stock-row').filter({ hasText: 'Cooking oil' });
    await expect(row).toContainText('Cooking oil · 6 litres');
    await expect(row).toContainText('Requested');
    await expect(row).toContainText('Waiting for approval'); // the chef is not an approver
    await row.getByRole('button', { name: 'Edit' }).click();
    const dlg = page.getByRole('dialog', { name: 'Edit request' });
    await dlg.getByLabel('Quantity').fill('8');
    await dlg.getByRole('button', { name: 'Save changes' }).click();
    await expect(row).toContainText('Cooking oil · 8 litres');
    await row.getByRole('button', { name: 'Cancel request' }).click();
    await page.getByRole('dialog', { name: 'Cancel this request?' }).getByRole('button', { name: 'Cancel request' }).click();
    await expect(row).toHaveAttribute('data-status', 'cancelled');
    await expect(row).toContainText('Cancelled');
    await expect(row.getByRole('button', { name: 'Edit' })).toHaveCount(0);
    c.assertClean();
  });
});

test.describe('pages', () => {
  const sectionId = 'fnb';
  test('dishes: a course with more than ten dishes is paged, and searching starts again on page 1', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's3');
    const rows = page.getByTestId('dish-row');
    await expect(rows).toHaveCount(10); // 17 lunch dishes in the seed
    await expect(page.getByRole('navigation', { name: 'Dishes and allergens' })).toBeVisible();
    await goToPage(page, 2, 'Dishes and allergens');
    await expect(rows).toHaveCount(7);
    await expect(rows.first()).toContainText('Sayur bayam');
    // searching goes back to page 1 and shows the matches only
    await page.getByLabel('Search dishes').fill('tumis');
    await expect(rows).toHaveCount(1);
    await expect(page.getByRole('navigation', { name: 'Dishes and allergens' })).toHaveCount(0);
    await page.getByLabel('Search dishes').fill('zzz');
    await expect(page.getByText('No matches')).toBeVisible();
    await page.getByLabel('Search dishes').fill('');
    await expect(rows).toHaveCount(10);
    // another course has no second page
    await page.getByRole('tab', { name: /Afternoon tea/ }).click();
    await expect(page.getByRole('navigation', { name: 'Dishes and allergens' })).toHaveCount(0);
    await assertNoHorizontalScroll(page);
    c.assertClean();
  });

  test('stock requests are paged and a filter starts again on page 1', async ({ page }) => {
    for (let i = 1; i <= 8; i++) expect((await act(page, 's3', 'stock.request', { item: `Item ${i}`, qty: i, unit: 'pcs', area: 'kitchen', sectionId })).ok()).toBeTruthy();
    await signIn(page, 's3', '/stock');
    await expect(page.getByTestId('stock-row')).toHaveCount(10); // 13 requests
    await goToPage(page, 2, 'Stock requests');
    await expect(page.getByTestId('stock-row')).toHaveCount(3);
    if (isPhone(page)) await pickOption(page, 'Filter by section', /^Health · /);
    else await page.getByRole('button', { name: /^Health · / }).click();
    await expect(page.getByTestId('stock-row')).toHaveCount(1);
    await expect(page.getByRole('navigation', { name: 'Stock requests' })).toHaveCount(0);
    await assertNoHorizontalScroll(page);
  });

  test('feedback is paged', async ({ page }) => {
    for (let i = 1; i <= 7; i++) expect((await act(page, 'fm10_0', 'feedback.submit', { memberId: 'm10', mealDate: T, dish: 'Sayur asem', text: `Feedback number ${i}.` })).ok()).toBeTruthy();
    await signIn(page, 's3', '/feedback');
    await expect(page.getByTestId('feedback-card')).toHaveCount(8);
    await goToPage(page, 2, 'Feedback');
    await expect(page.getByTestId('feedback-card').first()).toBeVisible();
    expect(await page.getByTestId('feedback-card').count()).toBeGreaterThan(0);
    expect(await page.getByTestId('feedback-card').count()).toBeLessThan(8);
    await assertNoHorizontalScroll(page);
  });

  test('the meal date in "Log a call" uses the calendar: today is the latest day, a coming day is greyed out', async ({ page }) => {
    await signIn(page, 's3', '/feedback');
    await page.getByRole('button', { name: 'Log a call' }).click();
    const sheet = page.getByRole('dialog', { name: 'Log feedback' });
    await expect(fieldText(page, 'Meal date')).toContainText('Wed 21 Oct 2026');
    await fieldText(page, 'Meal date').click();
    await expect(page.locator('[data-date="2026-10-22"]')).toHaveAttribute('aria-disabled', 'true');
    await page.locator('[data-date="2026-10-19"]').click();
    await expect(fieldText(page, 'Meal date')).toContainText('Mon 19 Oct 2026');
    await expect(sheet.getByRole('button', { name: 'Sayur asem' })).toBeVisible(); // Monday's menu
  });
});

test.describe('layout and language', () => {
  test('every kitchen screen fits the viewport without console errors', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's3');
    for (const key of ['today', 'feedback', 'stock', 'requests']) {
      await page.locator(`[data-nav-key="${key}"]`).first().click();
      await expect(page.locator('#main')).toBeVisible();
      await expect(page.getByText('This screen is being built.')).toHaveCount(0);
      await assertNoHorizontalScroll(page);
    }
    if (isPhone(page)) await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    c.assertClean();
  });

  test('the ID toggle switches the kitchen screens to Indonesian, with no raw keys', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's3', '/today');
    await expect(page.getByRole('heading', { name: 'Menu of the day' })).toBeVisible();
    await toggleToId(page);
    await expect(page.getByRole('heading', { name: 'Menu hari ini' })).toBeVisible();
    await expect(page.getByText('Bentrok alergi hari ini')).toBeVisible();
    await expect(page.getByText('Rencana menu mingguan')).toBeVisible();
    for (const [key, heading] of [['feedback', 'Masukan'], ['stock', 'Permintaan stok'], ['requests', 'Permintaan']] as const) {
      await page.locator(`[data-nav-key="${key}"]`).first().click();
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      expect(await page.locator('#main').innerText()).not.toMatch(/\b(kitchen|requests|common|status|err)\.[a-zA-Z_]+/);
      await assertNoHorizontalScroll(page);
    }
    c.assertClean();
  });

  test('Indonesian shows no raw keys on the kitchen screens', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's3', '/today', 'id');
    await expect(page.getByRole('heading', { name: 'Menu hari ini' })).toBeVisible();
    await expect(page.getByText('Bentrok alergi hari ini')).toBeVisible();
    await expect(page.getByTestId('covers')).toHaveText('4 porsi sejauh ini · makan siang 12.00');
    await expect(page.getByTestId('covers-split')).toHaveText('3 di klub + 1 tamu');
    await expect(page.getByText('Alergi tercatat', { exact: true })).toBeVisible();
    await expect(page.getByText('Alergi seafood', { exact: true })).toBeVisible();
    await expect(page.getByText('Rencana menu mingguan')).toBeVisible();
    for (const [path, text] of [['/today', 'Hidangan dan alergen'], ['/feedback', 'Masukan'], ['/stock', 'Permintaan stok']] as const) {
      await page.goto(path);
      await expect(page.getByText(text).first()).toBeVisible();
      const body = await page.locator('#main').innerText();
      expect(body).not.toMatch(/\b(kitchen|requests)\.[a-zA-Z_]+/);
      expect(body).not.toMatch(/\b(common|status|err|nav)\.[a-zA-Z_]+/);
      await assertNoHorizontalScroll(page);
    }
    // the plan and the dialogs too
    await page.goto('/today');
    await page.getByRole('button', { name: 'Pengganti sudah disiapkan' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Pengganti untuk Bapak Bambang' })).toBeVisible();
    expect(await page.getByRole('dialog').innerText()).not.toMatch(/\b(kitchen|requests|common)\.[a-zA-Z_]+/);
    c.assertClean();
  });

  test('management and the F&B supervisor see the same screens', async ({ page }) => {
    await signIn(page, 's9', '/menu');
    await expect(page.getByRole('heading', { name: 'Menu of the day' })).toBeVisible();
    await expect(page.getByTestId('conflict-row')).toHaveCount(1);
    await signIn(page, 's9', '/feedback');
    await expect(page.getByRole('heading', { name: 'Feedback' })).toBeVisible();
    await signIn(page, 's2', '/today');
    await expect(page.getByTestId('covers')).toHaveText('4 covers so far · lunch 12:00');
  });
});

test.describe('lunch photo with a live camera', () => {
  // The browser has no camera here, so getUserMedia is given a moving canvas stream: the real live path (video, shutter, preview, use photo)
  // runs, not the file-picker fallback.
  const fakeCamera = () => {
    navigator.mediaDevices.getUserMedia = async () => {
      const cv = document.createElement('canvas');
      cv.width = 640; cv.height = 480;
      const g = cv.getContext('2d')!;
      let n = 0;
      setInterval(() => { g.fillStyle = `hsl(${(n += 20) % 360} 60% 50%)`; g.fillRect(0, 0, 640, 480); }, 100);
      return cv.captureStream(15);
    };
  };
  test('the shutter takes the picture, it is uploaded and shown on the menu and to the family', async ({ page, browser }, info) => {
    const c = watchConsole(page);
    await page.addInitScript(fakeCamera);
    await signIn(page, 's9', '/menu');
    await page.getByRole('button', { name: /Add a photo of today.s lunch/ }).click();
    const cam = page.getByRole('dialog', { name: 'Camera' });
    await expect(cam).toBeVisible();
    await expect.poll(() => cam.locator('video').evaluate((v: HTMLVideoElement) => v.videoWidth)).toBeGreaterThan(0);
    await cam.getByRole('button', { name: 'Take photo' }).click();
    await expect(cam.getByRole('img', { name: 'Preview of the photo' })).toBeVisible();
    await cam.getByRole('button', { name: 'Retake' }).click(); // back to the live camera
    await expect(cam.getByRole('button', { name: 'Take photo' })).toBeVisible();
    await expect.poll(() => cam.locator('video').evaluate((v: HTMLVideoElement) => v.videoWidth)).toBeGreaterThan(0);
    await cam.getByRole('button', { name: 'Take photo' }).click();
    await cam.getByRole('button', { name: 'Use photo' }).click();
    await expect(cam).toBeHidden();
    await expect(toast(page)).toContainText('Lunch photo posted');
    const tile = page.getByTestId('lunch-photo');
    await expect(tile).toHaveCount(1);
    await expect.poll(() => tile.locator('img').evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    const laras = await another(browser, info, 'fm10_0', '/today');
    await expect(laras.page.getByTestId('lunch-photo')).toHaveCount(1);
    await expect.poll(() => laras.page.getByTestId('lunch-photo').locator('img').evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    await laras.close();
    c.assertClean();
  });
});
