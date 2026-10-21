// Round 12 in one pass (small seed, demo day Wed 21 Oct 2026): the mood face at the door (confirm waits for a face), no Check on block when
// nobody is quiet, the front desk books the venue from More, management's Month report (four groups, Send to owner), and the family sees how
// their parent arrived. Isolated env: E2E_NAME=r12 E2E_PORT=8851 scripts/e2e-all.sh 1 "phone" round12
import { test, expect } from '@playwright/test';
import { resetDemo, signIn, watchConsole, tapFace } from './helpers';
import { pickDate } from './kit';

test.beforeEach(async ({ request }) => { await resetDemo(request); });

test('front desk: Opa Budi’s check-in waits for a face; nobody is quiet; the venue is booked from More', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's1'); // Caca
  // nobody has been away long enough to need a call in the small seed
  await expect(page.locator('[data-check-on]')).toHaveCount(0);
  await expect(page.getByText(/^Check on \(/)).toHaveCount(0);
  // manual check-in: five faces, Confirm stays off until one is tapped
  await page.getByRole('button', { name: /^Check in: Opa Budi Wijaya/ }).click();
  const confirm = page.getByRole('button', { name: 'Confirm check-in' });
  await expect(page.getByRole('radio')).toHaveCount(5);
  await expect(confirm).toBeDisabled();
  await tapFace(page, 4);
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(page.getByRole('status').filter({ hasText: /Opa Budi checked in at \d\d:\d\d\./ }).first()).toBeVisible();
  // More → Venue: a booking by the front desk
  await page.locator('[data-nav-key="more"]').first().click();
  await page.getByRole('dialog', { name: 'All modules' }).locator('[data-nav-key="venue"]').click();
  await expect(page).toHaveURL(/\/venue$/);
  await page.getByRole('button', { name: 'New booking' }).click();
  await page.getByLabel('Organisation').fill('Ibu Wati birthday lunch');
  await page.getByLabel('Contact person').fill('Wati Hartono');
  await page.getByLabel('Mobile').fill('0813 6611 2291');
  await pickDate(page, /^Day/, '2027-03-13');
  await page.getByRole('button', { name: /^08:00–12:00/ }).click();
  await page.getByRole('button', { name: 'Music room', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm booking' }).click();
  await expect(page.getByRole('status').filter({ hasText: /Booked\./ }).first()).toBeVisible();
  await expect(page.getByText('Ibu Wati birthday lunch')).toBeVisible();
  c.assertClean();
});

test('management: the Month report shows four groups and Send to owner opens the summary', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/monthReport'); // Ega
  await expect(page.getByRole('heading', { name: 'Month report', level: 1 })).toBeVisible();
  for (const g of ['Money', 'Members', 'Care and mood', 'Pipeline and team']) await expect(page.getByRole('region', { name: g })).toBeVisible();
  await page.getByRole('button', { name: 'Send to owner' }).click();
  await expect(page.getByRole('dialog', { name: 'Summary for the owner' })).toBeVisible();
  c.assertClean();
});

test('family: after the front desk records a face at the door, Maria reads how Opa Budi arrived', async ({ page, request }) => {
  const r = await request.post('/api/actions/attendance.checkIn', { headers: { 'x-user-id': 's1' }, data: { mutationId: 'e2e-r12-budi-in', club: 'citra', input: { memberId: 'm46', method: 'manual', face: 4 } } });
  expect(r.ok(), await r.text()).toBeTruthy();
  const c = watchConsole(page);
  await signIn(page, 'f1', '/today'); // Maria
  await page.locator('[data-testid="parent-row"][data-member="m46"]').click();
  await expect(page.getByTestId('story-hero')).toContainText(/At the club since \d\d:\d\d, feeling good/);
  c.assertClean();
});
