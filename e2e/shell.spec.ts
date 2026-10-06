// Shell: login, every demo role lands on its home without errors, nav items route, notifications open.
import { test, expect } from '@playwright/test';
import { resetDemo, signIn, watchConsole, isPhone, assertNoHorizontalScroll } from './helpers';

const ROLES = ['s1', 's8', 's5', 's3', 's10', 's9', 'f1', 'f2', 's2', 's6'];
test.beforeAll(async ({ request }) => { await resetDemo(request); });

test('login page shows the form and demo accounts', async ({ page }) => {
  const c = watchConsole(page, /status of 401/); // the wrong password below is answered 401, which the browser logs
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Caca/ })).toBeVisible();
  await page.getByLabel('Username').fill('maria');
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('not right');
  await page.getByLabel('Password', { exact: true }).fill('citra123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/today$/);
  c.assertClean();
});

for (const id of ROLES) {
  test(`role ${id}: home and every nav item load`, async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, id);
    await expect(page).toHaveURL(/\/today$/);
    const keys = await page.locator('[data-nav-key]').evaluateAll((els) => els.map((e) => e.getAttribute('data-nav-key')!));
    for (const key of keys) {
      if (key === 'more') continue;
      await page.locator(`[data-nav-key="${key}"]`).first().click();
      if (key !== 'today') await expect(page).toHaveURL(new RegExp(`/${key}$`));
      await expect(page.locator('#main')).toBeVisible();
      await expect(page.getByText('Planned for the next design pass')).toHaveCount(0);
      await assertNoHorizontalScroll(page);
    }
    c.assertClean();
  });
}

test('unknown and forbidden keys redirect home', async ({ page }) => {
  await signIn(page, 'f1', '/payments');
  await expect(page).toHaveURL(/\/today$/);
  await page.goto('/nonsense');
  await expect(page).toHaveURL(/\/today$/);
});

test('notifications panel opens and lists items', async ({ page }) => {
  await signIn(page, 's9');
  await page.getByRole('button', { name: /Notifications/ }).first().click();
  await expect(page.getByRole('dialog', { name: 'Notifications' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Needs action/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Notifications' })).toHaveCount(0);
  if (isPhone(page)) await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
});
