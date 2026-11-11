// Round 21 story (phone, small seed, demo day Wed 21 Oct 2026, CP_GEO_FAKE=1 so the address search answers from fixed places):
//  - Opa Budi's pick-up is priced by distance (6.4 km → Rp 70.000); Oma Lina is on the monthly field trips.
//  - Ega makes a field trip at a new venue (trading name, contact person, number, address found by search) and the trip shows the venue.
//  - Caca rates an AC service; the best rated sits first.
//  - Ega opens Insights › Where from: the area table, then the exact pins.
import { test, expect } from '@playwright/test';
import { resetDemo, signIn, watchConsole, assertNoHorizontalScroll, isPhone } from './helpers';

test.describe.configure({ timeout: 90_000 });
test.beforeEach(async ({ request }) => { await resetDemo(request); });

test('pick-up by distance and the field trips switch on the plan tab', async ({ page }) => {
  test.skip(!isPhone(page), 'phone story');
  const c = watchConsole(page);
  await signIn(page, 's9', '/members/m46/plan');
  await expect(page.getByTestId('pickup-fact')).toContainText('6.4 km · Rp 70.000');
  await page.goto('/members/m1/plan');
  await expect(page.getByTestId('trips-fact')).toContainText('On · Rp 250.000 / month');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('a new field trip at a new venue: the venue is saved in Contacts and shows on the trip', async ({ page }) => {
  test.skip(!isPhone(page), 'phone story');
  const c = watchConsole(page);
  await signIn(page, 's9', '/calendar');
  await page.getByTestId('new-field-trip-row').click();
  await page.getByLabel('Event name').fill('Batik afternoon');
  await page.getByRole('combobox', { name: 'Venue' }).click();
  await page.getByRole('option', { name: '+ New venue' }).click();
  const form = page.getByRole('dialog', { name: 'Add a contact' });
  await form.getByLabel('Trading name').fill('Galeri Batik Citra');
  await form.getByLabel('Contact person').fill('Ibu Wulan');
  await form.getByLabel('Contact number').fill('0812 3344 5566');
  await form.getByLabel('Address').fill('citra garden');
  await form.getByRole('button', { name: 'Search' }).click();
  await form.getByTestId('geo-hit').first().click();
  await expect(form.getByTestId('geo-km')).toContainText('km from the club');
  await form.getByRole('button', { name: 'Add contact' }).click();
  await expect(page.getByRole('combobox', { name: 'Venue' })).toContainText('Galeri Batik Citra');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('[data-trip-venue]').filter({ hasText: 'Galeri Batik Citra' }).first()).toBeVisible();
  await assertNoHorizontalScroll(page);
  await page.goto('/directory');
  await expect(page.locator('[data-dir-group]').filter({ hasText: 'Field trip venues' })).toBeVisible();
  await page.locator('[data-dir-open="Galeri Batik Citra"]').click();
  await expect(page.getByRole('dialog')).toContainText('Batik afternoon');
  c.assertClean();
});

test('Caca changes an AC service\'s one rating; the change is logged with why', async ({ page }) => {
  test.skip(!isPhone(page), 'phone story');
  const c = watchConsole(page);
  await signIn(page, 's1', '/directory');
  await expect(page.locator('[data-rating="5"]').first()).toHaveText('5');
  await page.locator('[data-dir-open="Kemang Teknik AC"]').click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.locator('[data-rating-now="2"]')).toBeVisible();
  await sheet.getByRole('button', { name: 'Change', exact: true }).click();
  await sheet.getByRole('radio', { name: '3 stars' }).click();
  await sheet.getByLabel('Why (optional)').fill('On time this visit');
  await sheet.getByRole('button', { name: 'Save rating' }).click();
  await expect(sheet.locator('[data-rating-now="3"]')).toBeVisible();
  await expect(sheet.locator('[data-rating-row]').first()).toContainText('On time this visit');
  await expect(sheet.locator('[data-change]').first()).toHaveAttribute('data-change', '2>3');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('Insights › Where from: the area table, an area\'s people, then the exact pins', async ({ page }) => {
  test.skip(!isPhone(page), 'phone story');
  const c = watchConsole(page, /tile\.openstreetmap\.org/);
  await signIn(page, 's9', '/insights?tab=where');
  await expect(page.locator('[data-area="Kalideres"]')).toBeVisible();
  await page.locator('[data-area="Kalideres"]').click();
  await expect(page.getByRole('dialog').locator('[data-person]').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('combobox', { name: 'View' }).click();
  await page.getByRole('option', { name: 'Exact pins' }).click();
  await expect(page.locator('[data-person]').first()).toBeVisible();
  await assertNoHorizontalScroll(page);
  c.assertClean();
});
