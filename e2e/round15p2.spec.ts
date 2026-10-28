// Round 15 phase 2 story (phone, small seed, demo day Wed 21 Oct 2026).
//  Dinar sends a changed week; Ega adds the plan "Flex 8" (Start from Flex) and approves the proposed week inside the Calendar.
//  Caca registers a member on the new plan and the family signs on the pad at the review; the Docs tab says "Signed by family"; Contacts lists the two AC vendors with call buttons.
//  Ega approves the new member, countersigns, and the server stamps the e-Meterai. Chef Agus changes the photo of tomorrow's main dish; Maria sees it on tomorrow's timeline.
// Isolated env: E2E_NAME=e5 E2E_PORT=8891 scripts/e2e-all.sh 1 phone round15p2
import { test, expect, type Page } from '@playwright/test';
import { resetDemo, signIn, watchConsole, assertNoHorizontalScroll, uiZoom } from './helpers';
import { pickDate, pickOption, regNext, takePhotoWithFile } from './kit';

test.describe.configure({ timeout: 180_000 });
test.beforeEach(async ({ request }) => { await resetDemo(request); });

/** Draw one stroke across a canvas signature pad. */
async function draw(page: Page, pad: ReturnType<Page['locator']>) {
  await pad.scrollIntoViewIfNeeded();
  const box = (await pad.boundingBox())!;
  const x = box.x + box.width * 0.2, y = box.y + box.height * 0.6;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + box.width * 0.2, y - box.height * 0.3, { steps: 6 });
  await page.mouse.move(x + box.width * 0.4, y + box.height * 0.1, { steps: 6 });
  await page.mouse.move(x + box.width * 0.55, y - box.height * 0.2, { steps: 6 });
  await page.mouse.up();
}

test('phase 2 story: a new plan, the programme review, signing at registration, the AC vendors, and a dish photo on the family timeline', async ({ page }) => {
  const c = watchConsole(page);

  // 0. Dinar sends the activity week with one change (Friday 13:30), so Ega has a proposal waiting
  await signIn(page, 's5', '/calendar');
  await page.getByRole('heading', { name: 'Weekly schedule' }).scrollIntoViewIfNeeded();
  await page.getByRole('tab', { name: /^Fri/ }).click();
  await page.getByRole('button', { name: 'Friday 13:30: Cooking demo with Chef Agus' }).click();
  await pickOption(page, 'Activity', 'Reading circle');
  await page.getByRole('button', { name: 'Send to Ega' }).click();
  await page.getByRole('dialog', { name: 'Send the weekly schedule to Ega' }).getByRole('button', { name: 'Send to Ega' }).click();
  await expect(page.getByTestId('programme-waiting')).toContainText('Waiting for Ega');

  // 1. Ega: Plans and pricing → Add plan → Start from Flex → "Flex 8", 8 days, Rp 2,000,000
  await signIn(page, 's9', '/plans');
  await page.getByRole('button', { name: 'Add plan' }).click();
  const sheet = page.getByRole('dialog', { name: 'Add plan' });
  await sheet.getByRole('button', { name: 'Start from Flex' }).click();
  await sheet.getByLabel('Plan name', { exact: true }).fill('Flex 8');
  await sheet.getByLabel('Days a month').fill('8');
  await sheet.getByLabel('Price per month').fill('2000000');
  await sheet.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Add plan' })).toHaveCount(0);
  await expect(page.getByLabel('Flex 8 price in rupiah')).toHaveValue('2.000.000');
  await assertNoHorizontalScroll(page);

  // 2. Ega: Calendar → the waiting bar → See proposed week → Approve
  await page.goto('/calendar');
  await page.getByRole('heading', { name: 'Weekly schedule' }).scrollIntoViewIfNeeded();
  const bar = page.getByTestId('programme-waiting');
  await bar.getByRole('button', { name: 'See proposed week' }).click();
  await page.getByRole('tab', { name: /^Fri/ }).click();
  await expect(page.locator('[data-proposed-cell="5|13:30"] s')).toContainText('Cooking demo with Chef Agus');
  await bar.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByTestId('programme-waiting')).toHaveCount(0);
  await page.getByRole('tab', { name: /^Fri/ }).click();
  await expect(page.getByRole('button', { name: 'Friday 13:30: Reading circle' })).toBeVisible();

  // 3. Caca: Add member on Flex 8, the family signs on the pad at the review (no scan)
  await signIn(page, 's1', '/members');
  await page.getByRole('button', { name: 'Add member' }).click();
  const d = page.getByRole('dialog').last();
  await d.getByLabel('Full name, as on the KTP').fill('Siti Rahma');
  await pickDate(page, 'Date of birth', '1946-03-12');
  await regNext(d);
  await d.getByRole('textbox', { name: /^Name/ }).fill('Rudi Rahma');
  await d.getByLabel('Mobile (WhatsApp)').fill('0813 4000 7777');
  await regNext(d);
  await regNext(d); // Health
  await expect(d.getByRole('radio', { name: /^Flex 8/ })).toBeVisible(); // the new catalogue plan is in the picker
  await d.getByRole('radio', { name: /^Flex 8/ }).click();
  await regNext(d);
  await regNext(d); // Form: the scan is optional, the pad at the review can stand in
  await d.getByRole('switch', { name: /Use of information/ }).click();
  await expect(d.getByText('Rudi Rahma signs the form here')).toBeVisible();
  await draw(page, d.locator('[data-reg-sign] canvas'));
  await d.getByRole('button', { name: 'Create member' }).click();
  await expect(page).toHaveURL(/\/members\/m47$/);

  // 4. the member's Docs tab says "Signed by family"
  await page.goto('/members/m47/docs');
  await expect(page.getByTestId('sign-badge')).toHaveAccessibleName(/^Signed by family/);

  // 5. Caca: Contacts → AC and electrical lists two vendors with call buttons
  await page.goto('/contacts');
  await expect(page.getByRole('heading', { name: 'AC and electrical', level: 2 })).toBeVisible();
  for (const name of ['Dingin Jaya AC Service', 'Kemang Teknik AC']) {
    const row = page.locator(`[data-dir-row="${name}"]`);
    await expect(row).toBeVisible();
    await expect(row.getByRole('link', { name: `Call ${name}` })).toHaveAttribute('href', /^tel:\+?\d+$/);
    const box = (await row.getByRole('link', { name: `Call ${name}` }).boundingBox())!;
    expect(box.height / (await uiZoom(page))).toBeGreaterThanOrEqual(43.5); // 44 CSS px (boundingBox is in screen px, the phone UI is zoomed .875)
  }
  await assertNoHorizontalScroll(page);

  // 6. Ega: approve the new member, then Approvals → Signing → Countersign; the form is stamped
  await signIn(page, 's9', '/reviews');
  const card = page.locator('[data-cr]').filter({ hasText: 'Siti Rahma' });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Approve' }).click();
  await expect(card).toHaveCount(0);
  await page.goto('/reviews?tab=signing');
  const item = page.locator('[data-approval="m47"][data-type="signing"]');
  await expect(item).toBeVisible();
  await expect(item).toContainText('Siti Rahma');
  await item.getByRole('button', { name: 'Countersign' }).click();
  await expect(item).toHaveCount(0);
  await page.goto('/members/m47/docs');
  await expect(page.getByTestId('sign-badge')).toHaveAccessibleName(/^Stamped/, { timeout: 30_000 });
  await expect(page.getByText(/e-Meterai · Serial \S+/)).toBeVisible();

  // 7. Chef Agus: change the photo of tomorrow's main dish (Semur tahu tempe, Thu 22 Oct)
  await signIn(page, 's3', '/today');
  await page.getByLabel('Search dishes').fill('semur');
  await page.getByTestId('dish-row').filter({ hasText: 'Semur tahu tempe' }).click();
  const dish = page.getByRole('dialog', { name: 'Semur tahu tempe' });
  const before = await dish.getByTestId('dish-photo-img').getAttribute('data-media');
  expect(before).toMatch(/^md_demo_/);
  await dish.getByRole('button', { name: 'Change photo' }).click();
  await takePhotoWithFile(page);
  await expect(dish.getByTestId('dish-photo-img')).not.toHaveAttribute('data-media', before!);
  await dish.getByRole('button', { name: 'Save dish' }).click();
  await expect(page.getByRole('dialog', { name: 'Semur tahu tempe' })).toHaveCount(0);
  await expect(page.getByTestId('dish-row').filter({ hasText: 'Semur tahu tempe' }).getByTestId('dish-thumb')).not.toHaveAttribute('data-media', before!);

  // 8. Maria: tomorrow's timeline shows that dish photo
  await signIn(page, 'f1', '/today');
  const ahead = page.locator('[data-testid="day-strip"] [data-plan]');
  await expect(ahead).toBeVisible();
  await ahead.click();
  const tl = page.getByTestId('timeline');
  await expect(tl).toHaveAttribute('data-kind', 'plan');
  await expect(tl).toContainText('Semur tahu tempe');
  const pic = tl.getByTestId('lunch-picture');
  await expect(pic).toBeVisible();
  await expect(pic).toHaveAttribute('data-source', 'dish');
  await expect(pic).not.toHaveAttribute('data-media', before!);
  await expect(pic).toHaveAttribute('data-media', /^md_(?!demo_)/);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});
