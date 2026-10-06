// Messages: staff by topic, families with a member switcher, replies and unread per side, new message sheet, automatic reply,
// nurse health updates and kitchen replies, billing, profile links, Indonesian, every viewport.
// Isolated env: pnpm e2e:env lobby 8802 5202 && E2E_BASE_URL=http://localhost:5202 pnpm exec playwright test e2e/chat.spec.ts
import { test, expect, type APIRequestContext, type Browser, type Page, type TestInfo } from '@playwright/test';
import { resetDemo, signIn, watchConsole, isPhone, assertNoHorizontalScroll } from './helpers';
import { pickOption } from './kit';

test.beforeEach(async ({ request }) => { await resetDemo(request); });

const RAW_KEY = /\b(?:lobby|chat|common|status|err|nav|roles|shell|notif|feed|family|health|review|inv)\.[A-Za-z][A-Za-z0-9.]*/;
const GENERIC_KEY = /\b[a-z]+\.[a-zA-Z]+\b/;
const row = (page: Page, id: string) => page.locator(`[data-thread="${id}"]`);
const unreadDot = (page: Page, id: string) => row(page, id).locator('[data-unread]');
const navBadge = (page: Page, key = 'chat') => page.locator(`[data-nav-key="${key}"]`).first();
const composer = (page: Page) => page.getByRole('textbox', { name: 'Message' });
const toast = (page: Page, re: RegExp) => page.getByText(re).first();
const log = (page: Page) => page.getByRole('log');
/** A team filter chip in the main area (the side navigation has its own "Billing" and "Nurse" items). */
const chip = (page: Page, name: string) => page.locator('#main').getByRole('button', { name, exact: true });
/** The team filter: chips on tablet and laptop, one dropdown on a phone. */
const pickTeam = async (page: Page, name: string) => { if (isPhone(page)) await pickOption(page, 'Filter by team', name); else await chip(page, name).click(); };
/** Page text compared without letter case: eyebrows are drawn in capitals, which innerText reports. */
const has = (text: string, part: string) => text.toLowerCase().includes(part.toLowerCase());

/** A second signed-in user in a fresh browser context with the same viewport as the project. */
async function asUser(browser: Browser, info: TestInfo, userId: string, path: string, lang: 'en' | 'id' = 'en') {
  const u = info.project.use;
  const ctx = await browser.newContext({ baseURL: u.baseURL, viewport: u.viewport ?? undefined, isMobile: u.isMobile, hasTouch: u.hasTouch, userAgent: u.userAgent, deviceScaleFactor: u.deviceScaleFactor });
  const page = await ctx.newPage();
  await signIn(page, userId, path, lang);
  return { ctx, page };
}
/** Open a conversation from the list (a no-op beyond the click on wide screens, where the list stays beside the thread). */
async function openThread(page: Page, id: string) {
  await row(page, id).click();
  await expect(page.getByRole('log')).toBeVisible();
}

test('s1 sees the lobby conversations, reads Maria’s thread, replies, and the unread count drops; Maria sees the reply', async ({ page, browser }, info) => {
  const c = watchConsole(page);
  await signIn(page, 's1');
  await expect(navBadge(page)).toContainText('2'); // two unread lobby conversations
  await navBadge(page).click();
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByRole('heading', { name: 'Messages', level: 1 })).toBeVisible();
  // staff see only their own team's topic: Maria (about Oma Lina) and Laras (about Bapak Bambang), not the nurse or kitchen threads
  if (isPhone(page)) {
    await expect(row(page, 't1')).toContainText('Maria Wijaya');
    await expect(row(page, 't1')).toContainText('About Oma Lina · Lobby');
    await expect(row(page, 't2')).toContainText('Laras Saputra');
    await expect(unreadDot(page, 't1')).toHaveCount(1);
    await expect(unreadDot(page, 't2')).toHaveCount(1);
    await expect(row(page, 't3')).toHaveCount(0);
    // nothing is marked read just because the list is on screen
    await expect(navBadge(page)).toContainText('2');
  } else {
    // wide: the newest conversation is open beside the list, so it is read; the other is still unread
    await expect(row(page, 't2')).toContainText('Laras Saputra');
    await expect(unreadDot(page, 't2')).toHaveCount(0);
    await expect(unreadDot(page, 't1')).toHaveCount(1);
    await expect(navBadge(page)).toContainText('1');
  }
  await openThread(page, 't1');
  await expect(unreadDot(page, 't1')).toHaveCount(0);
  await expect(log(page).getByText('Mama forgot her cardigan on Monday, is it at the lobby?')).toBeVisible();
  await expect(log(page).getByText('Is Mama’s blood pressure okay this week?')).toBeVisible();
  await expect(page.getByText(/Daughter of Oma Lina Wijaya/)).toBeVisible();
  await expect(page.locator('a[href="tel:+6281210904471"]')).toBeVisible();
  if (isPhone(page)) {
    await expect(page.getByRole('button', { name: 'Back to conversations' })).toBeVisible();
    await expect(row(page, 't2')).toHaveCount(0); // list and thread are separate on phone
  } else {
    await expect(row(page, 't2')).toBeVisible();
  }
  if (isPhone(page)) await expect(navBadge(page)).toContainText('1'); // Laras’s conversation is still unread
  else await expect(navBadge(page)).not.toContainText(/\d/);
  // reply
  await composer(page).fill('Yes, it is at the lobby. We kept it safe for you.');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(log(page).getByText('Yes, it is at the lobby. We kept it safe for you.')).toBeVisible();
  await expect(log(page).getByText(/Caca · Today \d\d:\d\d/)).toBeVisible();
  await expect(composer(page)).toHaveValue('');
  await assertNoHorizontalScroll(page);

  // Maria sees it: unread on her Messages tab, then in the thread
  const maria = await asUser(browser, info, 'f1', '/today');
  await expect(navBadge(maria.page)).toContainText('1');
  await navBadge(maria.page).click();
  await expect(row(maria.page, 't1')).toContainText('Yes, it is at the lobby. We kept it safe for you.');
  if (isPhone(maria.page)) await expect(unreadDot(maria.page, 't1')).toHaveCount(1);
  await openThread(maria.page, 't1');
  await expect(log(maria.page).getByText('Yes, it is at the lobby. We kept it safe for you.')).toBeVisible();
  await expect(log(maria.page).getByText(/Caca · Today/)).toBeVisible();
  await expect(unreadDot(maria.page, 't1')).toHaveCount(0);
  await expect(navBadge(maria.page)).not.toContainText(/\d/);
  await maria.ctx.close();
  c.assertClean();
});

test('quick replies send at once; staff can reopen a thread by link (?thread=)', async ({ page }) => {
  await signIn(page, 's1', '/chat?thread=t1');
  await expect(log(page).getByText('Mama forgot her cardigan on Monday, is it at the lobby?')).toBeVisible();
  await page.getByRole('button', { name: 'Thank you, noted.' }).click();
  await expect(log(page).getByText('Thank you, noted.')).toBeVisible();
  await expect(unreadDot(page, 't1')).toHaveCount(0);
});

test('a family message gets one automatic reply (stored as a key, shown translated); the lobby sees it as unread', async ({ page, browser }, info) => {
  const c = watchConsole(page);
  const laras = await asUser(browser, info, 'fm10_0', '/chat');
  if (isPhone(laras.page)) await openThread(laras.page, 't2');
  await expect(log(laras.page).getByText('Papa has a dentist appointment Friday, he will leave at 14:00.')).toBeVisible();
  await composer(laras.page).fill('Please also tell him to bring his hearing aid.');
  await laras.page.getByRole('button', { name: 'Send' }).click();
  await expect(log(laras.page).getByText('Please also tell him to bring his hearing aid.')).toBeVisible();
  await expect(log(laras.page).getByText('Thanks Laras, noted. We’ll take care of it.')).toBeVisible(); // chat.autoAck.lobby, translated
  await expect(log(laras.page).getByText('Automatic reply').first()).toBeVisible();
  // a second message right after gets none
  await composer(laras.page).fill('Thank you!');
  await laras.page.getByRole('button', { name: 'Send' }).click();
  await expect(log(laras.page).getByText('Thank you!', { exact: true })).toBeVisible();
  await expect(log(laras.page).getByText('Thanks Laras, noted. We’ll take care of it.')).toHaveCount(1);
  await assertNoHorizontalScroll(laras.page);

  await signIn(page, 's1', '/chat?thread=t2');
  await expect(log(page).getByText('Please also tell him to bring his hearing aid.')).toBeVisible();
  await expect(log(page).getByText(/Automatic reply: Thanks Laras, noted/)).toBeVisible(); // staff see it as a quiet system line
  await laras.ctx.close();
  c.assertClean();
});

test('s1 starts a new message to Laras: member, then contact, then the lobby team, then the text', async ({ page, browser }, info) => {
  const c = watchConsole(page);
  await signIn(page, 's1', '/chat');
  await page.getByRole('button', { name: 'New message' }).click();
  const sheet = page.getByRole('dialog', { name: 'New message' });
  await expect(sheet.getByText('About which member?')).toBeVisible();
  const search = sheet.getByLabel('Search members');
  await expect(search).toBeFocused();
  expect((await search.boundingBox())?.height).toBeGreaterThan(48);
  await search.fill('zzz');
  await expect(sheet.getByText('No members match.')).toBeVisible();
  await search.fill('laras'); // finds the member through the family contact
  await sheet.getByRole('button', { name: /Bapak Bambang Purnomo/ }).click();
  await expect(sheet.getByText('Which family member?')).toBeVisible();
  await expect(sheet.getByRole('radio', { name: /Laras Saputra/ })).toHaveAttribute('aria-checked', 'true'); // the only contact is preselected
  await expect(sheet.getByText('Daughter · Primary billing contact')).toBeVisible();
  // the lobby has one team, so nothing to choose; the message box is ready
  await expect(sheet.getByText('Which team is writing?')).toHaveCount(0);
  const send = sheet.getByRole('button', { name: 'Send message' });
  await expect(send).toHaveAttribute('aria-disabled', 'true');
  await sheet.getByLabel('Your message').fill('Hello Laras, Papa’s dentist pickup is booked for 14:00.');
  await send.click();
  await expect(toast(page, /Message sent to Laras\./)).toBeVisible();
  await expect(log(page).getByText('Hello Laras, Papa’s dentist pickup is booked for 14:00.')).toBeVisible();
  await assertNoHorizontalScroll(page);

  const laras = await asUser(browser, info, 'fm10_0', '/today');
  await expect(navBadge(laras.page)).toContainText('1');
  await navBadge(laras.page).click();
  await expect(row(laras.page, 't2')).toContainText('Hello Laras, Papa’s dentist pickup is booked for 14:00.');
  await openThread(laras.page, 't2');
  await expect(log(laras.page).getByText('Hello Laras, Papa’s dentist pickup is booked for 14:00.')).toBeVisible();
  await laras.ctx.close();
  c.assertClean();
});

test('management chooses the team: nurse conversations stay with the nurse and management', async ({ page, browser }, info) => {
  await signIn(page, 's9', '/chat');
  if (isPhone(page)) {
    await expect(page.getByRole('combobox', { name: 'Filter by team' })).toContainText('All');
    await page.getByRole('combobox', { name: 'Filter by team' }).click();
    for (const team of ['Lobby', 'Nurse', 'Activity team', 'Kitchen', 'Billing']) await expect(page.getByRole('option', { name: team, exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
  } else {
    await expect(chip(page, 'All')).toHaveAttribute('aria-pressed', 'true');
    for (const team of ['Lobby', 'Nurse', 'Activity team', 'Kitchen', 'Billing']) await expect(chip(page, team)).toBeVisible();
  }
  await page.getByRole('button', { name: 'New message' }).click();
  const sheet = page.getByRole('dialog', { name: 'New message' });
  await sheet.getByLabel('Search members').fill('hendra');
  await sheet.getByRole('button', { name: /Opa Hendra Gunawan/ }).click();
  await expect(sheet.getByRole('radio', { name: /Cynthia Gunawan/ })).toBeVisible();
  await expect(sheet.getByRole('radio', { name: /Stephanie Gunawan/ })).toBeVisible();
  await sheet.getByRole('radio', { name: /Stephanie Gunawan/ }).click();
  await sheet.getByRole('button', { name: 'Nurse', exact: true }).click();
  await sheet.getByLabel('Your message').fill('Stephanie, could you bring Opa Hendra’s medicine list on Tuesday?');
  await sheet.getByRole('button', { name: 'Send message' }).click();
  await expect(log(page).getByText('Stephanie, could you bring Opa Hendra’s medicine list on Tuesday?')).toBeVisible();
  if (isPhone(page)) await page.getByRole('button', { name: 'Back to conversations' }).click();
  await pickTeam(page, 'Nurse');
  await expect(page.getByText('About Opa Hendra · Nurse').first()).toBeVisible();
  await pickTeam(page, 'Billing');
  await expect(page.getByText('No conversations yet')).toBeVisible();
  // the nurse sees it, the lobby does not
  const nurse = await asUser(browser, info, 's8', '/chat');
  await expect(nurse.page.getByText('Stephanie Gunawan').first()).toBeVisible();
  await nurse.ctx.close();
  const lobby = await asUser(browser, info, 's1', '/chat');
  await expect(lobby.page.getByText('Stephanie Gunawan')).toHaveCount(0);
  await lobby.ctx.close();
});

test('finance gets the Billing channel: it starts a billing thread and the family sees it under Billing', async ({ page, browser }, info) => {
  await signIn(page, 's10', '/chat');
  await expect(page.getByText('No conversations yet')).toBeVisible();
  await page.getByRole('button', { name: 'New message' }).click();
  const sheet = page.getByRole('dialog', { name: 'New message' });
  await sheet.getByLabel('Search members').fill('bambang');
  await sheet.getByRole('button', { name: /Bapak Bambang Purnomo/ }).click();
  await sheet.getByLabel('Your message').fill('Laras, your November invoice is ready. The virtual account is on the Billing tab.');
  await sheet.getByRole('button', { name: 'Send message' }).click();
  await expect(log(page).getByText(/November invoice is ready/)).toBeVisible();
  if (isPhone(page)) await page.getByRole('button', { name: 'Back to conversations' }).click();
  await expect(page.getByText('About Bapak Bambang · Billing').first()).toBeVisible();
  const laras = await asUser(browser, info, 'fm10_0', '/chat');
  const billing = laras.page.locator('[data-thread]').filter({ hasText: 'About Bapak Bambang · The finance team' }).first();
  await expect(billing).toContainText('Billing');
  await expect(billing).toContainText('November invoice is ready');
  await billing.click();
  await expect(log(laras.page).getByText(/November invoice is ready/)).toBeVisible();
  await laras.ctx.close();
});

test('the family sees the nurse’s health update and the kitchen’s reply, each in its own conversation', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 'fm2_0', '/chat'); // Cynthia, Opa Hendra's daughter
  const nurse = page.locator('[data-thread="t3"]');
  const kitchen = page.locator('[data-thread="tk-c2"]');
  await expect(nurse).toContainText('Ns. Dewi');
  await expect(kitchen).toContainText('Kitchen');
  await expect(kitchen).toContainText('Gado-gado');
  await openThread(page, 't3');
  await expect(log(page).getByText('Health update')).toBeVisible();
  await expect(log(page).getByText(/blood pressure was 164\/98 on arrival today/)).toBeVisible();
  await expect(log(page).getByText('Thank you Ns. Dewi. We will bring his medicine list.')).toBeVisible();
  if (isPhone(page)) await page.getByRole('button', { name: 'Back to conversations' }).click();
  await openThread(page, 'tk-c2');
  await expect(log(page).getByText('Lunch feedback · Gado-gado')).toBeVisible();
  await expect(log(page).getByText('Papa would like a vegetarian option on Fridays.')).toBeVisible();
  await expect(log(page).getByText(/Thank you\. From next Friday there is a tempeh and vegetable option/)).toBeVisible();
  await expect(log(page).getByText(/Chef Agus · Fri 16 Oct \d\d:\d\d/)).toBeVisible();
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('Open profile opens the right member: staff go to /members/:id, family to /health?member=:id', async ({ page, browser }, info) => {
  await signIn(page, 's1', '/chat?thread=t2');
  await page.getByRole('button', { name: 'Open Bapak Bambang’s profile' }).click();
  await expect(page).toHaveURL(/\/members\/m10$/);
  // Maria has two parents: the profile link follows the conversation she is in
  const maria = await asUser(browser, info, 'f1', '/chat');
  await maria.page.getByRole('tab', { name: 'Opa Budi' }).click();
  await maria.page.locator('[data-thread="v:m46:lobby"]').click();
  await maria.page.getByRole('button', { name: 'Open Opa Budi’s profile' }).click();
  await expect(maria.page).toHaveURL(/\/health(\?member=m46)?$/); // the family screen takes the member and tidies the address
  await maria.page.goBack();
  await maria.page.getByRole('tab', { name: 'Oma Lina' }).click();
  await maria.page.locator('[data-thread="t1"]').click();
  await maria.page.getByRole('button', { name: 'Open Oma Lina’s profile' }).click();
  await expect(maria.page).toHaveURL(/\/health(\?member=m1)?$/);
  await maria.ctx.close();
});

test('a family linked to two members gets a member switcher that filters the conversations and is remembered', async ({ page }) => {
  await signIn(page, 'f1', '/chat');
  const tabs = page.getByRole('tablist', { name: 'Member' });
  await expect(tabs.getByRole('tab', { name: 'Both' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('About Oma Lina').first()).toBeVisible();
  await expect(page.getByText('About Opa Budi').first()).toBeVisible();
  await tabs.getByRole('tab', { name: 'Opa Budi' }).click();
  await expect(page.getByText('About Oma Lina')).toHaveCount(0);
  await expect(page.getByText('About Opa Budi').first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('tablist', { name: 'Member' }).getByRole('tab', { name: 'Opa Budi' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('About Oma Lina')).toHaveCount(0);
  // a family with one member has no switcher
  await signIn(page, 'fm10_0', '/chat');
  await expect(page.getByRole('tablist', { name: 'Member' })).toHaveCount(0);
});

test('a family can start a conversation with the nurse for either parent; the nurse sees it and the family never sees the other team’s threads', async ({ page, browser }, info) => {
  await signIn(page, 'f1', '/chat');
  await page.getByRole('tablist', { name: 'Member' }).getByRole('tab', { name: 'Opa Budi' }).click();
  await page.locator('[data-thread="v:m46:nurse"]').click();
  await expect(log(page).getByText('No messages yet. Say hello below.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'How was Opa Budi’s blood pressure today?' })).toBeVisible();
  await composer(page).fill('Could you check Opa Budi’s blood pressure after lunch, please?');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(log(page).getByText('Could you check Opa Budi’s blood pressure after lunch, please?')).toBeVisible();
  await expect(log(page).getByText(/Thank you, Maria\. I’ll check on Opa Budi and reply here\./)).toBeVisible();
  const nurse = await asUser(browser, info, 's8', '/today');
  await expect(navBadge(nurse.page)).toContainText('1'); // one unread nurse conversation
  await navBadge(nurse.page).click();
  await expect(nurse.page.getByText('Maria Wijaya').first()).toBeVisible();
  await expect(nurse.page.getByText('About Opa Budi · Nurse').first()).toBeVisible();
  await nurse.ctx.close();
});

test('Indonesian: staff and family Messages show no raw keys', async ({ page, browser }, info) => {
  const c = watchConsole(page);
  await signIn(page, 's1', '/chat?thread=t1', 'id');
  await expect(page.getByRole('heading', { name: 'Pesan', level: 1 })).toBeVisible();
  const text = (p: Page) => p.locator('body').innerText();
  let t = await text(page);
  expect(t).not.toMatch(RAW_KEY);
  expect(t).not.toMatch(GENERIC_KEY);
  expect(has(t, 'Terima kasih, sudah dicatat.')).toBe(true);
  expect(has(t, 'Putri dari Oma Lina Wijaya')).toBe(true);
  await page.getByRole('button', { name: 'Pesan baru' }).click();
  await expect(page.getByRole('dialog', { name: 'Pesan baru' })).toBeVisible();
  t = await text(page);
  expect(t).not.toMatch(RAW_KEY);
  expect(has(t, 'Tentang anggota yang mana?')).toBe(true);
  await page.keyboard.press('Escape');

  const f = await asUser(browser, info, 'f1', '/chat', 'id');
  await expect(f.page.getByText('Mulai percakapan').first()).toBeVisible(); // wait for the list before reading the page text
  t = await text(f.page);
  expect(t).not.toMatch(RAW_KEY);
  expect(has(t, 'Mulai percakapan')).toBe(true);
  expect(has(t, 'Tentang Oma Lina')).toBe(true);
  await f.page.locator('[data-thread="v:m1:nurse"]').click();
  await f.page.getByRole('textbox', { name: 'Pesan' }).fill('Apakah tekanan darah Oma Lina baik hari ini?'); // the composer is labelled in Indonesian
  await f.page.getByRole('button', { name: 'Kirim' }).click();
  await expect(log(f.page).getByText(/Terima kasih, Maria\. Saya akan memeriksa Oma Lina dan membalas di sini\./)).toBeVisible(); // the thread, not the list preview beside it
  t = await text(f.page);
  expect(t).not.toMatch(RAW_KEY);
  expect(has(t, 'Balasan otomatis')).toBe(true);
  await f.ctx.close();

  const n = await asUser(browser, info, 'fm2_0', '/chat', 'id');
  await n.page.locator('[data-thread="t3"]').click();
  t = await text(n.page);
  expect(has(t, 'Kabar kesehatan')).toBe(true);
  expect(t).not.toMatch(RAW_KEY);
  await n.ctx.close();
  c.assertClean();
});

test('layout: no horizontal scroll with a long thread and the new-message sheet open; phone shows list or thread, wide shows both', async ({ page }) => {
  await signIn(page, 's9', '/chat');
  await page.evaluate(() => document.fonts.ready.then(() => true)); // icon names are wide text until the icon font has loaded
  await assertNoHorizontalScroll(page);
  if (isPhone(page)) {
    await expect(row(page, 't1')).toBeVisible();
    await openThread(page, 't1');
    await expect(row(page, 't2')).toHaveCount(0);
    await expect(composer(page)).toBeInViewport();
    await page.getByRole('button', { name: 'Back to conversations' }).click();
    await expect(row(page, 't2')).toBeVisible();
    await expect(page.getByRole('log')).toHaveCount(0);
  } else {
    await expect(page.getByRole('log')).toBeVisible();
    await expect(row(page, 't1')).toBeVisible();
    const list = await row(page, 't1').boundingBox();
    const thread = await page.getByRole('log').boundingBox();
    expect(list!.x + list!.width).toBeLessThanOrEqual(thread!.x + 1); // the list sits beside the thread
  }
  await page.getByRole('button', { name: 'New message' }).click();
  await assertNoHorizontalScroll(page);
  const sheet = page.getByRole('dialog', { name: 'New message' });
  const box = await sheet.boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual((page.viewportSize()?.width || 1440) + 1);
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Escape');
    if (!(await sheet.count())) break;
  }
  await row(page, 't1').click();
  for (let i = 0; i < 6; i++) { await composer(page).fill(`Long message number ${i} `.repeat(8)); await page.getByRole('button', { name: 'Send' }).click(); }
  await expect(composer(page)).toBeInViewport();
  await expect(composer(page)).toHaveValue('');
  await assertNoHorizontalScroll(page);
});

// ---------- long lists: conversations, a conversation, the member picker ----------
const as = (request: APIRequestContext, user: string, action: string, input: unknown, tag: string) =>
  request.post(`/api/actions/${action}`, { headers: { 'x-user-id': user }, data: { mutationId: `e2e-chat-${tag}`, club: 'citra', input } });
/** Management starts `n` more conversations (different member, family contact and team than the seeded ones). */
async function startThreads(request: APIRequestContext, n: number) {
  const state = (await (await request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': 's9' } })).json()).state;
  const links = Object.values<{ familyId: string; memberId: string; appAccess: boolean; deletedAt?: string; review?: { status: string } }>(state.familyLinks).filter((l) => l.appAccess && !l.deletedAt && (!l.review || l.review.status === 'approved'));
  let made = 0;
  for (const topic of ['nurse', 'care', 'billing', 'lobby']) {
    for (const l of links) {
      if (made >= n) return;
      if (topic === 'lobby' && ((l.memberId === 'm1' && l.familyId === 'f1') || (l.memberId === 'm10' && l.familyId === 'fm10_0'))) continue; // already have one
      const r = await as(request, 's9', 'thread.start', { memberId: l.memberId, familyId: l.familyId, topic, text: `Hello about ${topic} ${made}` }, `t-${topic}-${l.memberId}-${l.familyId}`);
      expect(r.ok(), await r.text()).toBeTruthy();
      made++;
    }
  }
  expect(made).toBe(n);
}

test('a long list of conversations is paged 10 at a time; opening one from the list keeps you on its page; the team filter goes back to page 1', async ({ page, request }) => {
  const c = watchConsole(page);
  await startThreads(request, 12); // 2 seeded lobby threads + the nurse seed + these: well over one page for management
  await signIn(page, 's9', '/chat');
  const list = page.getByRole('group', { name: 'Messages' });
  const pager = list.getByRole('navigation', { name: 'Pages of conversations' });
  await expect(pager).toBeVisible();
  const rows = list.locator('[data-thread]');
  await expect(rows).toHaveCount(10);
  await pager.getByRole('button', { name: 'Next page' }).click();
  const second = await rows.first().getAttribute('data-thread');
  expect(await rows.count()).toBeGreaterThan(0);
  expect(await rows.count()).toBeLessThanOrEqual(10);
  await rows.first().click();
  await expect(page.getByRole('log')).toBeVisible();
  if (isPhone(page)) await page.getByRole('button', { name: 'Back to conversations' }).click();
  await expect(list.locator(`[data-thread="${second}"]`)).toBeVisible(); // still the same page of the list
  await expect(pager.getByRole('button', { name: 'Previous page' })).not.toHaveAttribute('aria-disabled', 'true');
  await pager.getByRole('button', { name: 'Previous page' }).click();
  await expect(rows).toHaveCount(10);
  await pager.getByRole('button', { name: 'Next page' }).click();
  await pickTeam(page, 'Lobby'); // a different filter: back to page 1, and a short list needs no pager
  await expect(list.getByRole('navigation')).toHaveCount(0);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('a long conversation opens on its newest messages; "Show earlier messages" reveals the rest', async ({ page, request }) => {
  const c = watchConsole(page);
  for (let i = 0; i < 45; i++) {
    const r = await as(request, 's1', 'message.send', { threadId: 't1', text: `Bulk message ${String(i).padStart(2, '0')}` }, `bulk-${i}`);
    expect(r.ok(), await r.text()).toBeTruthy();
  }
  await signIn(page, 's1', '/chat?thread=t1');
  const more = log(page).getByRole('button', { name: /Show earlier messages/ });
  await expect(log(page).getByText('Bulk message 44')).toBeVisible(); // the newest is in view
  await expect(log(page).getByText('Bulk message 00')).toHaveCount(0); // the oldest is not loaded yet
  await expect(more).toBeVisible();
  await expect(more).toContainText('(8)'); // 3 seeded + 45 = 48 messages, 40 shown
  await more.click();
  await expect(log(page).getByText('Bulk message 00')).toBeVisible();
  await expect(log(page).getByText('Is Mama’s blood pressure okay this week?')).toBeVisible();
  await expect(more).toHaveCount(0);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('the new-message member picker is paged and a search goes back to page 1', async ({ page, request }) => {
  for (let i = 0; i < 12; i++) {
    const nn = String(i).padStart(2, '0');
    const r = await as(request, 's9', 'members.create', { title: 'Opa', name: `Pager Test${nn}`, dob: '1945-03-02', usualArrival: '11:00', plan: 'gold', start: '2026-10-21', contact: { name: `Pager Family${nn}`, phone: `+62 812 9000 00${nn}`, relation: 'daughter', primary: true }, consent: { data: true, face: true } }, `m-${i}`);
    expect(r.ok(), await r.text()).toBeTruthy();
  }
  await signIn(page, 's1', '/chat');
  await page.getByRole('button', { name: 'New message' }).click();
  const sheet = page.getByRole('dialog', { name: 'New message' });
  const picks = sheet.locator('button.h-row'); // one row per member
  await expect(picks).toHaveCount(8);
  const pager = sheet.getByRole('navigation', { name: 'Pages of members' });
  await pager.getByRole('button', { name: 'Next page' }).click();
  await expect(picks).toHaveCount(8);
  await pager.getByRole('button', { name: 'Next page' }).click();
  await expect(picks).toHaveCount(1); // 17 members: 8 + 8 + 1
  await sheet.getByLabel('Search members').fill('pager test03');
  await expect(picks).toHaveCount(1);
  await expect(pager).toHaveCount(0);
  await sheet.getByLabel('Search members').fill('pager');
  await expect(picks).toHaveCount(8); // a search starts again on page 1
  await assertNoHorizontalScroll(page);
});

test('Indonesian: the pager and "Show earlier messages" are translated', async ({ page, request }) => {
  await startThreads(request, 12);
  await signIn(page, 's9', '/chat', 'id');
  await expect(page.getByRole('navigation', { name: 'Halaman percakapan' })).toBeVisible();
  const t = await page.locator('body').innerText();
  expect(t).not.toMatch(RAW_KEY);
  expect(t).not.toMatch(GENERIC_KEY);
});
