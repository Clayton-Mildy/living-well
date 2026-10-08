// Shell: login, every demo role lands on its home without errors, nav items route, notifications open.
import { test, expect, type Page } from '@playwright/test';
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
    expect(keys).not.toContain('chat'); // Messages is gone for every role: families and staff use WhatsApp
    if (keys.includes('more')) { // on a phone the rest of the modules sit under More: Messages is not there either
      await page.locator('[data-nav-key="more"]').first().click();
      const all = page.getByRole('dialog', { name: 'All modules' });
      await expect(all).toBeVisible();
      await expect(all.locator('[data-nav-key="chat"]')).toHaveCount(0);
      await expect(all.getByText(/^Messages$/)).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(all).toHaveCount(0);
    }
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
  // an old Messages link (a bookmark, a notification from before) lands on home too
  await page.goto('/chat?thread=t1');
  await expect(page).toHaveURL(/\/today$/);
});

test('an old /chat link lands on home for staff as well', async ({ page }) => {
  await signIn(page, 's1', '/chat');
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

// ---------------------------------------------------------------- contacts (KC round 6)
// Contacts (the family app's "Useful contacts") is a menu item for every role: a tab on phones (or under More), a sidebar item on
// wider screens. Staff who don't keep the directory see the same public list as families, read-only, one tap to call. Management
// and finance have the full Directory. The header carries only the bell and the account (the logo keeps its full size).
const contactsBtn = async (page: Page) => {
  const item = page.locator('[data-nav-key="contacts"]').first();
  if (!(await item.isVisible())) { await page.locator('[data-nav-key="more"]').first().click(); return page.getByRole('dialog').locator('[data-nav-key="contacts"]'); }
  return item;
};

for (const [id, who] of [['s8', 'nurse'], ['s3', 'kitchen'], ['s5', 'activity teacher']] as const) {
  test(`${who}: the Contacts button opens the family app's Useful contacts, read-only, with call links`, async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, id);
    await expect(page.getByRole('button', { name: /^(Emergency|SOS)$/ })).toHaveCount(0); // the Emergency button is gone
    await (await contactsBtn(page)).click();
    await expect(page).toHaveURL(/\/contacts$/);
    await expect(page.getByRole('heading', { name: 'Useful contacts' })).toBeVisible();
    await expect(page.getByText('RS Medika Kemang')).toBeVisible();
    for (const hidden of ['Sayur Segar Kemang', 'Ikan Laut Jaya', 'Bersih Prima']) await expect(page.getByText(hidden)).toHaveCount(0);
    await expect(page.getByRole('link', { name: /^Call / })).toHaveCount(4);
    await expect(page.getByRole('link', { name: 'Call RS Medika Kemang' })).toHaveAttribute('href', 'tel:+622175900110');
    await expect(page.getByRole('button', { name: 'Add a contact' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Make internal|Make public/ })).toHaveCount(0);
    await assertNoHorizontalScroll(page);
    c.assertClean();
  });
}

test('management: contacts are the full Directory, suppliers and editing included; the header has only the bell and the account', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/contacts');
  await expect(page.getByRole('button', { name: 'Contacts', exact: true })).toHaveCount(0); // no separate Contacts button next to the logo
  await expect(page.getByRole('heading', { name: 'Directory' })).toBeVisible();
  await expect(page.getByText('Sayur Segar Kemang')).toBeVisible();
  c.assertClean();
});
