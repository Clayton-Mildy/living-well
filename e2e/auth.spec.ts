// Accounts: sign in with username + password, wrong password, change password then sign in with the new one,
// change name, the one-tap demo accounts, and that the browser proves who it is with a signed token (never a bare user id).
import { test, expect, type Browser, type Page } from '@playwright/test';
import { resetDemo, signIn, watchConsole, assertNoHorizontalScroll } from './helpers';

const REFUSED = /status of (401|403|422)/; // the browser logs an expected refusal (wrong password, wrong current password)
const RAW = /\blogin\.[A-Za-z]+|\bshell\.[A-Za-z]+/;

test.beforeEach(async ({ request }) => { await resetDemo(request); });

async function login(page: Page, username: string, password: string) {
  await page.getByLabel(/^(Username|Nama pengguna)$/).fill(username);
  await page.getByLabel(/^(Password|Kata sandi)$/).fill(password);
  await page.getByRole('button', { name: /^(Sign in|Masuk)$/ }).click();
}
const sessionOf = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('cp.session') || '{}') as { user?: { id: string; name: string }; token?: string });
async function openAccount(page: Page) {
  await page.getByRole('button', { name: /^(Account|Akun)$/ }).click();
  const sheet = page.getByRole('dialog', { name: /^(Account|Akun)$/ });
  await expect(sheet).toBeVisible();
  return sheet;
}
const toast = (page: Page, text: string) => page.getByRole('status').filter({ hasText: text });
/** A second signed-in user in their own browser context, with the same device settings as the running project. */
async function otherUser(browser: Browser, uid: string) {
  const o = test.info().project.use as Record<string, unknown>;
  const ctx = await browser.newContext({ baseURL: o.baseURL as string, viewport: o.viewport as { width: number; height: number }, hasTouch: o.hasTouch as boolean | undefined, isMobile: o.isMobile as boolean | undefined, deviceScaleFactor: o.deviceScaleFactor as number | undefined, userAgent: o.userAgent as string | undefined });
  const page = await ctx.newPage();
  await signIn(page, uid);
  return { page, ctx };
}
const stateOf = async (page: Page, userId: string) => (await (await page.request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': userId } })).json()).state;

test('staff sign in with their username and password, stay signed in after a reload, and sign out', async ({ page }) => {
  const c = watchConsole(page);
  const calls: { url: string; auth?: string; uid?: string }[] = [];
  page.on('request', (r) => { if (r.url().includes('/api/')) calls.push({ url: r.url(), auth: r.headers()['authorization'], uid: r.headers()['x-user-id'] }); });
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
  await expect(page.getByLabel('Username')).toBeVisible();
  await expect(page.getByLabel('Mobile number')).toHaveCount(0); // no phone sign-in any more
  await assertNoHorizontalScroll(page);
  await login(page, 'caca', 'citra123');
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.locator('#main')).toBeVisible();
  const s = await sessionOf(page);
  expect(s.user?.id).toBe('s1');
  expect(s.token).toMatch(/^[\w-]+\.[\w-]+$/); // body.signature
  // every call after sign-in carries the signed token; none names a user by id
  await expect.poll(() => calls.some((x) => x.url.includes('/api/snapshot'))).toBe(true);
  for (const x of calls.filter((x) => /\/api\/(snapshot|actions)/.test(x.url))) {
    expect(x.auth, x.url).toBe(`Bearer ${s.token}`);
    expect(x.uid, x.url).toBeUndefined();
  }
  await expect.poll(() => calls.find((x) => x.url.includes('/api/events'))?.url ?? '').toContain(`token=${encodeURIComponent(s.token!)}`);
  expect(calls.find((x) => x.url.includes('/api/events'))!.url).not.toContain('uid=');
  await page.reload();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.locator('#main')).toBeVisible();
  const sheet = await openAccount(page);
  await expect(sheet.getByLabel('Username')).toHaveValue('caca');
  await sheet.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await sessionOf(page)).token).toBeFalsy();
  await page.goto('/today');
  await expect(page).toHaveURL(/\/login$/); // signed out: the app asks again
  c.assertClean();
});

test('families sign in too; the username ignores capitals and spaces', async ({ page }) => {
  const c = watchConsole(page);
  await page.goto('/login');
  await login(page, '  Maria ', 'citra123');
  await expect(page).toHaveURL(/\/today$/);
  expect((await sessionOf(page)).user?.id).toBe('f1');
  await expect(page.locator('#main')).toContainText('Oma Lina');
  c.assertClean();
});

test('wrong password, unknown username, empty form and no app access each get a clear error; the password can be shown', async ({ page }) => {
  const c = watchConsole(page, REFUSED);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('Enter your username and password.');
  await login(page, 'caca', 'citra124');
  await expect(page.getByRole('alert')).toContainText('That username or password is not right');
  await expect(page).toHaveURL(/\/login$/);
  expect((await sessionOf(page)).token).toBeFalsy();
  await login(page, 'nobody', 'citra123');
  await expect(page.getByRole('alert')).toContainText('That username or password is not right');
  // housekeeping (siti) has a password but no app access
  await login(page, 'siti', 'citra123');
  await expect(page.getByRole('alert')).toContainText('no app access');
  // show and hide the password
  const pw = page.getByLabel('Password', { exact: true });
  await expect(pw).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(pw).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await expect(pw).toHaveAttribute('type', 'password');
  // typing clears the error; the right password signs in
  await login(page, 'caca', 'citra123');
  await expect(page).toHaveURL(/\/today$/);
  c.assertClean();
});

test('change your password in the Account sheet: wrong current, mismatch, too short and unchanged are refused; then only the new password signs in', async ({ page }) => {
  const c = watchConsole(page, REFUSED);
  await signIn(page, 'f2');
  const sheet = await openAccount(page);
  const username = sheet.getByLabel('Username');
  await expect(username).toHaveValue('daniel');
  await expect(username).toHaveAttribute('readonly', '');
  const cur = sheet.getByLabel('Current password', { exact: true });
  const nw = sheet.getByLabel('New password', { exact: true });
  const cf = sheet.getByLabel('Confirm new password', { exact: true });
  const go = sheet.getByRole('button', { name: 'Change password' });
  await expect(go).toHaveAttribute('aria-disabled', 'true'); // nothing typed yet
  await cur.fill('not-my-password'); await nw.fill('brand-new-pass'); await cf.fill('brand-new-pass');
  await go.click();
  await expect(sheet.getByRole('alert')).toContainText('current password is not right');
  await cur.fill('citra123'); await cf.fill('brand-new-pasx');
  await go.click();
  await expect(sheet.getByRole('alert')).toContainText('don’t match');
  await nw.fill('short'); await cf.fill('short');
  await go.click();
  await expect(sheet.getByRole('alert')).toContainText('at least 8 characters');
  await nw.fill('citra123'); await cf.fill('citra123');
  await go.click();
  await expect(sheet.getByRole('alert')).toContainText('different from the current one');
  await nw.fill('brand-new-pass'); await cf.fill('brand-new-pass');
  await go.click();
  await expect(toast(page, 'Your password is changed.')).toBeVisible();
  await expect(cur).toHaveValue('');
  await expect(nw).toHaveValue('');
  await expect(username).toHaveValue('daniel'); // the username never changes
  await sheet.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, 'daniel', 'citra123');
  await expect(page.getByRole('alert')).toContainText('not right'); // the old password is gone
  await login(page, 'daniel', 'brand-new-pass');
  await expect(page).toHaveURL(/\/today$/);
  expect((await sessionOf(page)).user?.id).toBe('f2');
  c.assertClean();
});

test('management resets a password to the default (nobody else can), and the demo reset restores everyone', async ({ page, request }) => {
  const asToken = async (username: string, password: string) => (await (await request.post('/api/login', { data: { username, password } })).json()).token as string;
  // Dinar changes her password through the sheet's route
  const dinar = await asToken('dinar', 'citra123');
  const change = await request.post('/api/account/password', { headers: { authorization: `Bearer ${dinar}` }, data: { current: 'citra123', next: 'dinar-own-secret' } });
  expect(change.status()).toBe(200);
  expect((await request.post('/api/login', { data: { username: 'dinar', password: 'citra123' } })).status()).toBe(401);
  // a teacher cannot reset it; the club manager can
  const denied = await request.post('/api/account/reset-password', { headers: { authorization: `Bearer ${await asToken('dimas', 'citra123')}` }, data: { userId: 's5' } });
  expect(denied.status()).toBe(403);
  const done = await request.post('/api/account/reset-password', { headers: { authorization: `Bearer ${await asToken('ega', 'citra123')}` }, data: { userId: 's5' } });
  expect(done.status()).toBe(200);
  expect((await done.json()).username).toBe('dinar');
  expect((await request.post('/api/login', { data: { username: 'dinar', password: 'citra123' } })).status()).toBe(200);
  // then she signs in through the page
  await page.goto('/login');
  await login(page, 'dinar', 'citra123');
  await expect(page).toHaveURL(/\/today$/);
  // a forged or unsigned token gets nothing, whatever the x-user-id header says
  for (const bad of ['forged.token', `${dinar.split('.')[0]}.AAAA`]) {
    const r = await request.get('/api/snapshot?club=citra', { headers: { authorization: `Bearer ${bad}`, 'x-user-id': 's9' } });
    expect(r.status(), bad).toBe(401);
  }
});

test('change your display name in the Account sheet: saved at once for staff, sent for approval for families', async ({ page, browser }) => {
  const c = watchConsole(page);
  await signIn(page, 's1');
  let sheet = await openAccount(page);
  await sheet.getByLabel('Your name').fill('Caca Putri');
  await sheet.getByRole('button', { name: 'Save changes' }).click();
  await expect(toast(page, 'Your details are saved.')).toBeVisible();
  await expect.poll(async () => (await stateOf(page, 's1')).staff.s1.name).toBe('Caca Putri');
  expect((await stateOf(page, 's1')).staff.s1.username).toBe('caca');
  await expect(sheet.getByLabel('Username')).toHaveValue('caca');
  await expect(sheet).toContainText('Caca Putri');
  await page.keyboard.press('Escape');
  // a family member's change goes to management first; the name stays until approved
  const { page: fp, ctx: fam } = await otherUser(browser, 'f1');
  sheet = await openAccount(fp);
  await sheet.getByLabel('Your name').fill('Maria W. Wijaya');
  await sheet.getByRole('button', { name: 'Submit for review' }).click();
  await expect(toast(fp, 'Sent to the club for approval')).toBeVisible();
  expect((await stateOf(fp, 's9')).familyContacts.f1.name).toBe('Maria Wijaya');
  expect((await stateOf(fp, 's9')).familyContacts.f1.username).toBe('maria');
  await fam.close();
  c.assertClean();
});

test('the demo account buttons still sign in without a password: on the login page and in the Demo panel', async ({ page }) => {
  const c = watchConsole(page);
  await page.goto('/login');
  await expect(page.getByText('Demo accounts', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Caca/ }).click();
  await expect(page).toHaveURL(/\/today$/);
  const first = await sessionOf(page);
  expect(first.user?.id).toBe('s1');
  expect(first.token).toBeTruthy();
  // switch account from the Demo panel
  await page.getByRole('button', { name: /^Demo$/ }).click();
  const panel = page.getByRole('dialog', { name: 'Demo tools' });
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: /Maria Wijaya/ }).click();
  await expect.poll(async () => (await sessionOf(page)).user?.id).toBe('f1');
  const second = await sessionOf(page);
  expect(second.token).toBeTruthy();
  expect(second.token).not.toBe(first.token);
  await expect(page.locator('#main')).toContainText('Oma Lina');
  c.assertClean();
});

test('a saved session without a token, or with a forged one, sends you back to sign in', async ({ page }) => {
  const c = watchConsole(page, REFUSED);
  await signIn(page, 's1');
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('cp.session')!); s.token = 'forged.token'; localStorage.setItem('cp.session', JSON.stringify(s)); });
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  expect((await sessionOf(page)).token).toBeFalsy();
  // an old session saved before sign-in tokens existed
  await page.evaluate(() => localStorage.setItem('cp.session', JSON.stringify({ user: { kind: 'staff', id: 's1', name: 'Caca', role: 'lobby', clubId: 'citra', clubs: ['citra'] }, lang: 'en', club: 'citra' })));
  await page.goto('/today');
  await expect(page).toHaveURL(/\/login$/);
  c.assertClean();
});

test('Indonesian: the sign-in page and the account sheet have no raw keys', async ({ page }) => {
  const c = watchConsole(page, REFUSED);
  await page.goto('/login');
  await page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'ID' }).click();
  await expect(page.getByLabel('Nama pengguna')).toBeVisible();
  await expect(page.getByLabel('Kata sandi', { exact: true })).toBeVisible();
  await expect(page.getByText('Akun demo', { exact: true })).toBeVisible();
  await login(page, 'caca', 'salah-sandi');
  await expect(page.getByRole('alert')).toContainText('Nama pengguna atau kata sandi salah');
  expect(await page.locator('body').innerText()).not.toMatch(RAW);
  await login(page, 'caca', 'citra123');
  await expect(page).toHaveURL(/\/today$/);
  const sheet = await openAccount(page);
  await expect(sheet.getByRole('button', { name: 'Ubah kata sandi' })).toBeVisible();
  await expect(sheet.getByLabel('Nama pengguna')).toHaveValue('caca');
  await expect(sheet.getByLabel('Kata sandi saat ini', { exact: true })).toBeVisible();
  expect(await sheet.innerText()).not.toMatch(RAW);
  c.assertClean();
});
