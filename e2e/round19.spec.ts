// Round 19 story (phone, small seed, demo day Wed 21 Oct 2026): Settings for the upgrade notice and Leave in a row, one Contacts menu item,
// the field trip block in the weekly schedule builder, and the Few visits button on Next month.
// Screenshots: E2E_SHOTS=1 scripts/e2e-all.sh 1 "phone tablet laptop" round19 ; PNGs go to artifacts/shots/round19/.
// Isolated env: E2E_NAME=r19 E2E_PORT=8931 scripts/e2e-all.sh 1 phone round19
import { test, expect, type Page } from '@playwright/test';
import { resetDemo, signIn, watchConsole, assertNoHorizontalScroll, isPhone } from './helpers';

test.describe.configure({ timeout: 90_000 });
test.beforeEach(async ({ request }) => { await resetDemo(request); });

const toast = (page: Page, text: string | RegExp) => expect(page.getByRole('status').filter({ hasText: text }).first()).toBeVisible();
const snap = async (page: Page, user: string) => (await (await page.request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': user } })).json()).state;
const tripOf = async (page: Page) => { const evs = (await snap(page, 's9')).calendarEvents as Record<string, { id: string; date: string }> | Array<{ id: string; date: string }>; const t = (Array.isArray(evs) ? evs : Object.values(evs)).find((e) => e.id === 'ev-outing-1029'); expect(t, 'seeded Bogor trip').toBeTruthy(); return t!; };
/** The Contacts nav item: a tab or sidebar item, or under More on a phone. */
async function navKeys(page: Page) {
  const keys = async () => page.locator('[data-nav-key]').evaluateAll((els) => els.map((e) => e.getAttribute('data-nav-key')!));
  let all = await keys();
  if (all.includes('more') && !all.includes('contacts')) { await page.locator('[data-nav-key="more"]').first().click(); await expect(page.getByRole('dialog')).toBeVisible(); all = await keys(); }
  return all;
}

test('Benjamin sets Upgrade 3 days and Leave in a row 3 months: the lines read "ask by 29 Oct" and "3 months"', async ({ page }) => {
  test.skip(!isPhone(page), 'phone story');
  const c = watchConsole(page);
  await signIn(page, 's11', '/settings');
  await expect(page.locator('[data-setting="upgrade"] input')).toHaveValue('1');
  await expect(page.locator('[data-setting="leaveRun"] input')).toHaveValue('2');
  await page.locator('[data-setting="upgrade"] input').fill('3');
  await page.locator('[data-setting="leaveRun"] input').fill('3');
  await expect(page.locator('[data-setting="upgrade"]')).toContainText('ask by 29 Oct'); // November is still open on 21 Oct; the live line moves before saving
  await assertNoHorizontalScroll(page);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await toast(page, /Saved/);
  await page.reload();
  await expect(page.locator('[data-setting="upgrade"] input')).toHaveValue('3');
  await expect(page.locator('[data-setting="upgrade"]')).toContainText('ask by 29 Oct');
  await expect(page.locator('[data-setting="leaveRun"] input')).toHaveValue('3');
  await expect(page.locator('[data-setting="leaveRun"]')).toContainText('months');
  c.assertClean();
});

for (const [id, who] of [['s10', 'Fransiska'], ['s1', 'Caca']] as const) {
  test(`${who} sees one Contacts menu item and no Directory`, async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, id, '/today');
    const keys = await navKeys(page);
    expect(keys.filter((k) => k === 'contacts')).toHaveLength(1);
    expect(keys).not.toContain('directory');
    await expect(page.getByRole('link', { name: 'Directory', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Directory', exact: true })).toHaveCount(0);
    c.assertClean();
  });
}

test('Ega’s weekly schedule shows the Bogor field trip block on its day', async ({ page }) => {
  test.skip(!isPhone(page), 'phone story');
  const c = watchConsole(page);
  const trip = await tripOf(page);
  await signIn(page, 's9', `/calendar?week=${trip.date}`);
  await page.getByRole('heading', { name: 'Weekly schedule' }).scrollIntoViewIfNeeded();
  const day = new Date(trip.date + 'T00:00:00Z').getUTCDay(); // 1 = Mon … 5 = Fri
  const block = page.locator('[data-trip-block="ev-outing-1029"]');
  if (!(await block.first().isVisible())) await page.getByRole('tab', { name: new RegExp('^' + ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]) }).click(); // a phone shows one day at a time
  await expect(block.first()).toBeVisible();
  await expect(block.first()).toContainText('Bogor');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('Ega’s Next month Members tab has the Few visits button and tapping it opens the list', async ({ page }) => {
  test.skip(!isPhone(page), 'phone story');
  const c = watchConsole(page);
  await signIn(page, 's9', '/renewals');
  const btn = page.getByTestId('few-btn');
  await expect(btn).toBeVisible();
  await assertNoHorizontalScroll(page);
  await btn.click();
  await expect(page.getByTestId('few-list')).toBeVisible();
  c.assertClean();
});

// ---- screenshots (E2E_SHOTS=1) ----
test('screenshots', async ({ page }, info) => {
  test.skip(!process.env.E2E_SHOTS, 'only with E2E_SHOTS=1');
  const shot = async (name: string) => { await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(500); await page.screenshot({ path: `artifacts/shots/round19/${info.project.name}-${name}.png`, fullPage: false }); };
  await signIn(page, 's11', '/settings');
  await expect(page.locator('[data-setting="upgrade"]')).toBeVisible();
  await shot('1-settings');
  await signIn(page, 's1', '/today');
  if (isPhone(page)) { await page.locator('[data-nav-key="more"]').first().click(); await expect(page.getByRole('dialog')).toBeVisible(); }
  await shot('2-contacts-nav');
  const trip = await tripOf(page);
  await signIn(page, 's9', `/calendar?week=${trip.date}`);
  await page.getByRole('heading', { name: 'Weekly schedule' }).scrollIntoViewIfNeeded();
  const block = page.locator('[data-trip-block="ev-outing-1029"]');
  if (!(await block.first().isVisible())) await page.getByRole('tab', { name: new RegExp('^' + ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(trip.date + 'T00:00:00Z').getUTCDay()]) }).click();
  await expect(block.first()).toBeVisible();
  await shot('3-builder-trip');
  await signIn(page, 's9', '/renewals');
  await expect(page.getByTestId('few-btn')).toBeVisible();
  await shot('4-few-visits-button');
});
