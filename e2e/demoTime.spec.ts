// Demo time (KC, 11 Nov 2026): the Demo tools rebuild today as it was at a set time, on a club day or the field trip day, and go back to now.
// The app is installable: the manifest, icons, service worker and offline page are served. Phone only (small seed, demo day Wed 21 Oct 2026).
import { test, expect } from '@playwright/test';
import { resetDemo, signIn, isPhone } from './helpers';

test.afterAll(async ({ request }) => { await resetDemo(request); });

test('the app can be installed: manifest, icons, service worker and offline page are served', async ({ page, request }) => {
  test.skip(!isPhone(page), 'phone only');
  const m = await request.get('/manifest.webmanifest');
  expect(m.ok()).toBeTruthy();
  const man = await m.json();
  expect(man).toMatchObject({ name: 'CitraPremier', display: 'standalone', start_url: '/' });
  for (const icon of man.icons as { src: string }[]) expect((await request.get(icon.src)).ok(), icon.src).toBeTruthy();
  for (const p of ['/sw.js', '/offline.html', '/apple-touch-icon.png']) expect((await request.get(p)).ok(), p).toBeTruthy();
});

test('Demo time: 09:30 on the field trip day shows the trip on Arrivals; back to now is a live club day again', async ({ page }) => {
  test.skip(!isPhone(page), 'phone only');
  await resetDemo(page.request);
  await signIn(page, 's1', '/today');
  const pill = page.getByRole('button', { name: 'Demo', exact: true });
  const panel = page.getByTestId('demo-time');
  await pill.click();
  await expect(panel.getByTestId('demo-mode')).toHaveText('Live');
  await panel.getByRole('tab', { name: 'Field trip day' }).click();
  await panel.getByRole('button', { name: 'Set time' }).click(); // the time field starts at 09:30
  await page.getByRole('dialog', { name: 'Field trip day at 09:30?' }).getByRole('button', { name: 'Set time' }).click();
  await expect(page.getByText('Demo time set to 09:30.')).toBeVisible();
  await expect(page.getByText('Field trip today').first()).toBeVisible();
  await expect(page.getByText(/Kebun Raya Bogor botanical garden · 08:30–15:00/).first()).toBeVisible();

  await pill.click();
  await expect(panel.getByTestId('demo-now')).toHaveText(/^09:3\d$/);
  await expect(panel.getByTestId('demo-mode')).toContainText('Field trip'); // after the bus icon
  await panel.getByRole('button', { name: /Back to now/ }).click();
  await page.getByRole('dialog', { name: 'Back to now?' }).getByRole('button', { name: 'Back to now' }).click();
  await expect(page.getByText('The demo is back to now.')).toBeVisible();
  await expect(page.getByText('Field trip today')).toHaveCount(0);
  await pill.click();
  await expect(panel.getByTestId('demo-mode')).toHaveText('Live');
});
