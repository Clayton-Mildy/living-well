// Round 20 story (phone, small seed, demo day Wed 21 Oct 2026): a field trip on the demo day. Arrivals shows the banner; checking in Oma Lina puts her on the trip
// ("on the trip" in her row, ticked in Who went); the kitchen menu reads "menu optional"; Maria's Today reads "On the field trip".
// Screenshots: E2E_SHOTS=1 scripts/e2e-all.sh 1 "phone tablet laptop" round20 ; PNGs go to artifacts/shots/round20/.
// Isolated env: E2E_NAME=r20 E2E_PORT=8931 scripts/e2e-all.sh 1 phone round20
import { test, expect, type Page } from '@playwright/test';
import { resetDemo, signIn, watchConsole, assertNoHorizontalScroll, isPhone, confirmCheckIn } from './helpers';

test.describe.configure({ timeout: 90_000 });
test.beforeEach(async ({ request }) => { await resetDemo(request); });

const act = async (page: Page, userId: string, name: string, input: unknown) => {
  const r = await page.request.post(`/api/actions/${name}`, { headers: { 'x-user-id': userId }, data: { mutationId: `e2e-${Date.now()}-${Math.random()}`, club: 'citra', input } });
  expect(r.ok(), `${name}: ${await r.text()}`).toBeTruthy();
};
/** Ega adds a field trip on the demo day (08:30 to 15:00; round 21: no fee per trip). */
const addTrip = (page: Page) => act(page, 's9', 'calendarEvent.create', { date: '2026-10-21', kind: 'outing', title: 'Kebun Raya Bogor day trip', titleId: 'Wisata Kebun Raya Bogor', from: '08:30', to: '15:00', fee: 250_000, notify: false });
const rowOf = (page: Page, name: string) => page.getByRole('button', { name: new RegExp(`^(Check in|Check out): ${name}`) });

test('Caca sees the trip banner, checks in Oma Lina (on the trip), and Who went shows her; the kitchen and Maria see the trip', async ({ page }) => {
  test.skip(!isPhone(page), 'phone story');
  const c = watchConsole(page);
  await addTrip(page);

  await signIn(page, 's1', '/today');
  await expect(page.getByText('Field trip today').first()).toBeVisible();
  await expect(page.getByText(/Kebun Raya Bogor day trip · 08:30–15:00/).first()).toBeVisible();
  await rowOf(page, 'Oma Lina Wijaya').click();
  await confirmCheckIn(page);
  await expect(page.getByRole('status').filter({ hasText: /Oma Lina checked in/ }).first()).not.toContainText('Field trip fee'); // round 21: no fee per trip (paid monthly)
  await page.getByRole('tab', { name: /^Check out/ }).click();
  await expect(page.getByRole('button', { name: /^Open full size · Oma Lina Wijaya/ }).first()).toContainText(/Arrived \d\d:\d\d · on the trip/);
  await assertNoHorizontalScroll(page);

  await signIn(page, 's5', '/calendar');
  await page.getByRole('button', { name: /^Who went · \d+/ }).click(); // round 20 fix (I1): the members already in the club when Ega made the trip are on it too
  const sheet = page.getByRole('dialog', { name: /Who went on/ });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Oma Lina Wijaya', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await signIn(page, 's3', '/today');
  await expect(page.getByText('Field trip · menu optional')).toBeVisible();
  await assertNoHorizontalScroll(page);

  await signIn(page, 'f1', '/today');
  await expect(page.getByText(/Oma Lina is on the field trip/).first()).toBeVisible();
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

// ---- screenshots (E2E_SHOTS=1) ----
test('screenshots', async ({ page }, info) => {
  test.skip(!process.env.E2E_SHOTS, 'only with E2E_SHOTS=1');
  await addTrip(page);
  const shot = async (name: string) => { await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(500); await page.screenshot({ path: `artifacts/shots/round20/${info.project.name}-${name}.png`, fullPage: false }); };
  await signIn(page, 's1', '/today');
  await expect(page.getByText('Field trip today').first()).toBeVisible();
  await rowOf(page, 'Oma Lina Wijaya').click();
  await confirmCheckIn(page);
  await expect(page.getByRole('status').filter({ hasText: /Oma Lina checked in/ }).first()).toBeVisible();
  await page.getByRole('tab', { name: /^Check out/ }).click();
  await expect(page.getByRole('button', { name: /^Open full size · Oma Lina Wijaya/ }).first()).toContainText('on the trip');
  await shot('arrivals');
  await signIn(page, 's3', '/today');
  await expect(page.getByText('Field trip · menu optional')).toBeVisible();
  await shot('kitchen-menu');
  await signIn(page, 'f1', '/today');
  await expect(page.getByText(/Oma Lina is on the field trip/).first()).toBeVisible();
  await shot('family-today');
});
