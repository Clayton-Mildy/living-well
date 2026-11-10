// Round 17 phase 1 story (phone, small seed, demo day Wed 21 Oct 2026): money features that land on the next monthly invoice, and the spouse.
//  - Caca adds a charge to Opa Budi's birthday party: "On next bill"; Maria sees it under "On your next bill" in Bills (with the seeded cake and pick-up).
//  - Dinar ticks Opa Budi on today's outing: the family calendar shows "Field trip · 08:30–15:00" (round 21: no fee per trip; field trips are paid monthly).
//  - Fransiska makes Daniel the billing contact of Oma Lina (after a confirm); Caca sees the invoice email to Daniel under Documents › Emails.
//  - Oma Lina's Family tab shows Opa Budi as her spouse (the first row).
// Screenshots (phone, tablet, laptop): E2E_SHOTS=1 scripts/e2e-all.sh 1 "phone tablet laptop" round17p1 ; PNGs go to artifacts/shots/round17p1/.
// Isolated env: E2E_NAME=r17 E2E_PORT=8931 scripts/e2e-all.sh 1 phone round16p1 round17p1
import { test, expect, type Page } from '@playwright/test';
import { resetDemo, signIn, watchConsole, assertNoHorizontalScroll } from './helpers';

test.describe.configure({ timeout: 90_000 });
test.beforeEach(async ({ request }) => { await resetDemo(request); });

async function act(page: Page, userId: string, name: string, input: unknown) {
  const r = await page.request.post(`/api/actions/${name}`, { headers: { 'x-user-id': userId }, data: { mutationId: `e2e-${Date.now()}-${Math.random()}`, club: 'citra', input } });
  expect(r.ok(), `${name}: ${await r.text()}`).toBeTruthy();
  return r.json();
}
const goTab = (page: Page, key: 'today' | 'photos' | 'calendar' | 'health' | 'me') => page.locator(`[data-nav-key="${key}"]`).click();
/** A past or present outing today (21 Oct) so that "Who went" is open; Ega's calendar edits that touch an outing need no owner. */
const addOuting = (page: Page) => act(page, 's9', 'calendarEvent.create', { date: '2026-10-21', kind: 'outing', title: 'Taman Mini day trip', titleId: 'Wisata Taman Mini', notify: false });

test('Caca adds a birthday charge: it waits for the next bill; Maria sees it under "On your next bill"', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's1', '/venue?tab=celebrations');
  const party = page.locator('[data-celebration]').filter({ hasText: 'Budi' }).first();
  await expect(party.getByTestId('celebration-charges')).toContainText('Total Rp 350.000'); // the seeded cake
  await party.getByRole('button', { name: 'Charges' }).click();
  const dlg = page.getByRole('dialog').last();
  await expect(dlg).toContainText('On next bill'); // the seeded cake: no invoice of its own
  await dlg.getByLabel('Item').fill('Birthday cake');
  await dlg.getByLabel('Price').fill('350000');
  await dlg.getByRole('button', { name: 'Add charge' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Birthday cake added.' }).first()).toBeVisible();
  const added = dlg.locator('[data-charge]').filter({ hasText: /^Birthday cake · Rp 350\.000/ });
  await expect(added).toContainText('On next bill');
  await expect(dlg.getByTestId('charges-total')).toContainText('Total Rp 700.000');
  await expect(dlg.getByText(/On invoice/)).toHaveCount(0);
  await assertNoHorizontalScroll(page);

  await signIn(page, 'f1', '/billing');
  const next = page.getByTestId('next-bill').filter({ hasText: 'Budi' });
  await expect(next).toContainText('On your next bill');
  await expect(next.getByTestId('next-item').filter({ hasText: /^Birthday · Birthday cake \(chocolate, no nuts\)/ })).toContainText('Rp 350.000');
  await expect(next.getByTestId('next-item').filter({ hasText: /^Birthday · Birthday cake\s*Rp/ })).toContainText('Rp 350.000');
  await expect(next.getByTestId('next-item').filter({ hasText: /^Pick-up/ })).toContainText('Rp 70.000'); // round 21: 6.4 km
  await expect(next.getByTestId('next-total')).toContainText('Rp 770.000'); // two cakes and the pick-up
  await expect(page.getByText('Birthday invoice')).toHaveCount(0);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('Dinar ticks Opa Budi on an outing: the family calendar shows the trip (round 21: no fee per trip, nothing added to the next bill)', async ({ page }) => {
  const c = watchConsole(page);
  await addOuting(page);
  await signIn(page, 's5', '/calendar');
  await page.getByRole('button', { name: /^Who went · 0/ }).click();
  const sheet = page.getByRole('dialog', { name: /Who went on/ });
  await expect(sheet).not.toContainText('Field trip fee');
  await sheet.getByPlaceholder('Search by name').fill('budi');
  await sheet.getByRole('button', { name: 'Opa Budi Wijaya', exact: true }).click();
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved who went.' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^Who went · 1/ })).toBeVisible();
  await assertNoHorizontalScroll(page);

  await signIn(page, 'f1', '/today');
  await goTab(page, 'calendar');
  await expect(page.getByText(/Field trip · \d\d:\d\d–\d\d:\d\d/).first()).toBeVisible();
  await assertNoHorizontalScroll(page);
  await page.goto('/billing');
  const next = page.getByTestId('next-bill').filter({ hasText: 'Budi' });
  await expect(next.getByTestId('next-item').filter({ hasText: /Taman Mini/ })).toHaveCount(0); // round 21: no fee per trip
  await expect(next.getByTestId('next-total')).toContainText('Rp 420.000'); // cake 350 and pick-up 70 (round 21: 6.4 km)
  c.assertClean();
});

test('Fransiska makes Daniel the billing contact (after a confirm); Caca sees the invoice email under Documents › Emails', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's10', '/members/m1/family');
  const daniel = page.locator('[data-testid="fam-contact"]').filter({ hasText: 'Daniel' });
  await expect(page.locator('[data-testid="fam-contact"]').filter({ hasText: 'Maria' })).toContainText('Primary billing contact');
  await expect(daniel.getByRole('button', { name: 'Make billing contact' })).toBeVisible();
  await daniel.getByRole('button', { name: 'Make billing contact' }).click();
  const ask = page.getByRole('dialog').last();
  await expect(ask).toContainText('Make Daniel the billing contact? Unpaid invoices move to Daniel.');
  await assertNoHorizontalScroll(page);
  await ask.getByRole('button', { name: 'Make billing contact' }).click();
  await expect(page.getByRole('status').filter({ hasText: /Daniel/ }).first()).toBeVisible();
  await expect(daniel).toContainText('Primary billing contact');
  await expect(daniel.getByRole('button', { name: 'Make billing contact' })).toHaveCount(0);
  await assertNoHorizontalScroll(page);

  await signIn(page, 's1', '/members/m1/documents');
  const emails = page.getByTestId('member-emails');
  await expect(emails).toContainText('Emails');
  await expect(emails.getByTestId('member-email').first()).toContainText(/To Daniel Wijaya · daniel\.wijaya@example\.com/);
  await expect(emails.getByTestId('member-email').first()).toContainText(/^Invoice INV-/);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('Oma Lina\'s Family tab lists Opa Budi as her spouse, first', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's1', '/members/m1/family');
  const spouse = page.getByTestId('fam-spouse');
  await expect(spouse).toContainText('Opa Budi Wijaya');
  await expect(spouse).toContainText('Spouse');
  await expect(spouse).toContainText('Member');
  const top = (await spouse.boundingBox())!.y;
  for (const row of await page.getByTestId('fam-contact').all()) expect((await row.boundingBox())!.y).toBeGreaterThan(top); // above every contact
  await assertNoHorizontalScroll(page);
  await spouse.getByTestId('fam-spouse-open').click();
  await expect(page).toHaveURL(/\/members\/m46/);
  c.assertClean();
});

// ---- screenshots (E2E_SHOTS=1): the new screens at the project's width ----
test('screenshots', async ({ page }, info) => {
  test.skip(!process.env.E2E_SHOTS, 'only with E2E_SHOTS=1');
  const centre = (el: ReturnType<Page['locator']>) => el.evaluate((n) => n.scrollIntoView({ block: 'center' }));
  const shot = async (name: string) => { await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(400); await page.screenshot({ path: `artifacts/shots/round17p1/${info.project.name}-${name}.png`, fullPage: false }); };
  const snap = (await (await page.request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': 's1' } })).json()).state as { celebrations: Record<string, { id: string; memberId: string; deletedAt?: string }> };
  const party = Object.values(snap.celebrations).find((x) => x.memberId === 'm46' && !x.deletedAt);
  expect(party).toBeTruthy();
  await act(page, 's1', 'celebration.addCharge', { celebrationId: party!.id, item: 'Balloons', amount: 150_000 });
  const out = await addOuting(page);
  await act(page, 's5', 'calendarEvent.setWent', { eventId: out.result.eventId, memberIds: ['m46'] });

  await signIn(page, 's1', '/venue?tab=celebrations');
  await page.locator('[data-celebration]').filter({ hasText: 'Budi' }).first().getByRole('button', { name: 'Charges' }).click();
  await expect(page.getByRole('dialog').last().getByText('Balloons')).toBeVisible();
  await shot('1-celebration-charges');
  await page.keyboard.press('Escape');

  await signIn(page, 'f1', '/billing');
  await expect(page.getByTestId('next-bill').first()).toBeVisible();
  await centre(page.getByTestId('next-bill').first());
  await shot('2-next-bill-family');
  await page.goto('/today');
  await goTab(page, 'calendar');
  await expect(page.getByText(/Field trip · \d\d:\d\d–\d\d:\d\d/).first()).toBeVisible();
  await shot('3-family-calendar-trip');

  await signIn(page, 's10', '/members/m1/family');
  await expect(page.getByTestId('fam-spouse')).toBeVisible();
  await shot('4-family-tab-spouse-make-billing');
  await page.locator('[data-testid="fam-contact"]').filter({ hasText: 'Daniel' }).getByRole('button', { name: 'Make billing contact' }).click();
  await expect(page.getByRole('dialog').last()).toContainText('Unpaid invoices move to Daniel');
  await shot('5-make-billing-confirm');
  await page.getByRole('dialog').last().getByRole('button', { name: 'Make billing contact' }).click();
  await expect(page.getByRole('status').filter({ hasText: /Daniel/ }).first()).toBeVisible();

  await signIn(page, 's10', '/members/m46/plan');
  await expect(page.getByTestId('next-bill')).toBeVisible();
  await centre(page.getByTestId('next-bill'));
  await shot('6-next-bill-staff-plan');

  await signIn(page, 's1', '/members/m1/documents');
  await expect(page.getByTestId('member-email').first()).toBeVisible();
  await centre(page.getByTestId('member-emails'));
  await shot('7-documents-emails');
});
