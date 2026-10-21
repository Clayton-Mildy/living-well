// Quick camera and Drafts (KC round 7, "shoot first, sort later"): a camera button on every page for the activity team, the kitchen and management; every shot is a
// private draft with the (simulated) AI's suggestion; the taker fixes what is wrong and sends; management's go out at once, everyone else's wait in Approvals.
// There is no camera in the test browser, so the screen shows its fallback and the gallery button takes the pictures (several at a time).
import { test, expect, type Browser, type Page } from '@playwright/test';
import { resetDemo, signIn, watchConsole, assertNoHorizontalScroll } from './helpers';
import { TINY_PNG } from './kit';

test.beforeEach(async ({ request }) => {
  await resetDemo(request);
  const r = await request.post('/api/demo/clock', { data: { hm: '09:58', allowBack: true } });
  expect(r.ok()).toBeTruthy();
});

type Photo = { id: string; visibility: string; kind: string; takenBy: string; ai?: { kind: string }; deletedAt?: string; memberIds: string[] };
async function photos(page: Page, uid: string): Promise<Photo[]> {
  const r = await page.request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': uid } });
  expect(r.ok()).toBeTruthy();
  return Object.values((await r.json()).state.photos as Record<string, Photo>);
}
async function otherUser(browser: Browser, uid: string, path: string, lang: 'en' | 'id' = 'en') {
  const o = test.info().project.use as Record<string, unknown>;
  const ctx = await browser.newContext({ baseURL: o.baseURL as string, viewport: o.viewport as { width: number; height: number }, hasTouch: o.hasTouch as boolean | undefined, isMobile: o.isMobile as boolean | undefined, deviceScaleFactor: o.deviceScaleFactor as number | undefined, userAgent: o.userAgent as string | undefined });
  const page = await ctx.newPage();
  await signIn(page, uid, path, lang);
  return { page, ctx };
}
const png = (name: string) => ({ name, mimeType: 'image/png', buffer: TINY_PNG });
/** Open the quick camera from its button, take pictures from the gallery, wait until each is a draft, press Done. */
async function shoot(page: Page, n: number, how: 'button' | 'page' = 'button') {
  if (how === 'button') await page.getByTestId('quick-camera').click();
  else await page.getByTestId('drafts-open-camera').getByRole('button', { name: 'Open camera' }).click();
  const cam = page.getByRole('dialog', { name: 'Quick camera' });
  await expect(cam).toBeVisible();
  await cam.getByTestId('qc-gallery').waitFor();
  await cam.locator('input[type="file"]').setInputFiles(Array.from({ length: n }, (_, i) => png(`shot${i}.png`)));
  await expect(cam.getByTestId('qc-count')).toHaveText(String(n));
  await expect(cam.locator('[data-shot][data-state="saved"]')).toHaveCount(n); // each one uploaded and saved as a draft in the background
  await cam.getByTestId('qc-done').click();
  await expect(cam).toBeHidden();
}

test('the teacher shoots from any page, the AI links each shot, she fixes one, sends some and then the rest for approval; management sees them marked "AI suggested"', async ({ page, browser }) => {
  const c = watchConsole(page);
  await signIn(page, 's5', '/today');
  // Dinar has five drafts from this morning; the camera button says so on every page
  const fab = page.getByTestId('quick-camera');
  await expect(fab).toBeVisible();
  await expect(page.getByTestId('quick-camera-badge')).toHaveText('5');
  await shoot(page, 3);
  await expect(page.getByTestId('quick-camera-badge')).toHaveText('8');
  const toast = page.getByRole('status').filter({ hasText: '3 photos in Drafts' });
  await expect(toast).toBeVisible();
  await toast.getByRole('button', { name: 'Review' }).click();
  await expect(page).toHaveURL(/\/camera$/);
  const tiles = page.getByTestId('draft-tile');
  await expect(tiles).toHaveCount(8);
  await expect(page.locator('[data-testid="draft-tile"][data-linking]')).toHaveCount(0, { timeout: 8000 }); // "Linking…" is only for a moment
  await expect(page.getByRole('tab', { name: /Drafts/ })).toHaveAttribute('aria-selected', 'true');

  // the seeded shots show the AI's chips: the best of the burst, "Check" on the unsure one, "Blurry?" on the shaky one
  await expect(page.getByTestId('draft-best')).toHaveCount(1);
  const three = page.locator('[data-draft-id="p-draft-3"]');
  await expect(three).toContainText('Check');
  await expect(three).toContainText('Blurry?');
  await expect(page.locator('[data-draft-id="p-draft-2"]')).toContainText('Session · ');
  await assertNoHorizontalScroll(page);

  // fix one: open it, look at what the AI said, save it: the doubt is gone
  await three.click();
  const sheet = page.getByRole('dialog', { name: 'Edit draft' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('AI suggested')).toBeVisible();
  await expect(sheet.getByText('About 78% sure')).toBeVisible();
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toBeHidden();
  await expect(three).not.toContainText('Check');
  await expect(three).not.toContainText('Blurry?');

  // nothing has been sent: no family has them, and neither has anyone else's Drafts
  const mine = (await photos(page, 's5')).filter((p) => p.visibility === 'draft' && !p.deletedAt && p.takenBy === 's5');
  expect(mine).toHaveLength(8);
  for (const fam of ['fm10_0', 'fm2_0', 'f1']) {
    const seen = await photos(page, fam);
    for (const p of mine) expect(seen.some((x) => x.id === p.id)).toBe(false);
  }

  // select two and send them: they wait for approval
  await page.getByTestId('drafts-select').click();
  await page.locator('[data-draft-id="p-draft-1"]').click();
  await page.locator('[data-draft-id="p-draft-2"]').click();
  await page.getByTestId('drafts-send').filter({ hasText: 'Send (2)' }).click();
  await expect(page.getByRole('status').filter({ hasText: '2 photos sent for approval.' })).toBeVisible();
  await expect(tiles).toHaveCount(6);
  const afterTwo = await photos(page, 's9');
  expect(afterTwo.filter((p) => ['p-draft-1', 'p-draft-2'].includes(p.id)).map((p) => p.visibility)).toEqual(['pending', 'pending']);

  // Ega sees them in Approvals with the AI mark
  const ega = await otherUser(browser, 's9', '/reviews?tab=photos');
  await expect(ega.page.getByText('AI suggested').first()).toBeVisible();
  await expect(ega.page.locator('[data-photo-review]')).toHaveCount(2);

  // the rest: "Send for approval (6)"
  await page.getByTestId('drafts-send').filter({ hasText: 'Send for approval (6)' }).click();
  await expect(page.getByRole('status').filter({ hasText: /6 photos sent for approval\./ })).toBeVisible();
  await expect(page.getByText('No drafts')).toBeVisible();
  await expect(page.getByTestId('quick-camera-badge')).toHaveCount(0);
  const sent = (await photos(page, 's9')).filter((p) => p.takenBy === 's5' && p.visibility === 'pending');
  expect(sent).toHaveLength(8);
  expect(sent.every((p) => !!p.ai)).toBe(true); // the suggestion stays on the photo
  await ega.ctx.close();
  c.assertClean();
});

test('management’s quick camera: Send all goes out at once, with no approval', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/camera');
  await expect(page.getByTestId('quick-camera')).toBeVisible();
  await expect(page.getByTestId('quick-camera-badge')).toHaveCount(0);
  await expect(page.getByText('No drafts')).toBeVisible();
  await shoot(page, 2, 'page');
  await expect(page.getByTestId('draft-tile')).toHaveCount(2);
  await expect(page.getByTestId('drafts-send')).toContainText('Send all (2)');
  await page.getByTestId('drafts-send').click();
  await expect(page.getByRole('status').filter({ hasText: '2 photos sent.' })).toBeVisible();
  const mine = (await photos(page, 's9')).filter((p) => p.takenBy === 's9' && !p.deletedAt && p.ai);
  expect(mine.map((p) => p.visibility)).toEqual(['visible', 'visible']);
  c.assertClean();
});

test('the kitchen’s quick camera files lunch photos: Review opens Drafts, the send waits for approval in today’s lunch gallery', async ({ page, request }) => {
  const c = watchConsole(page);
  await signIn(page, 's3', '/today');
  await expect(page.getByTestId('quick-camera')).toBeVisible();
  await shoot(page, 1);
  await page.getByRole('status').filter({ hasText: '1 photo in Drafts' }).getByRole('button', { name: 'Review' }).click();
  await expect(page).toHaveURL(/\/drafts$/);
  const tile = page.getByTestId('draft-tile');
  await expect(tile).toHaveCount(1);
  await expect(tile).toContainText('Lunch photo'); // before 14:00
  await tile.click();
  const sheet = page.getByRole('dialog', { name: 'Edit draft' });
  await sheet.getByRole('tab', { name: 'Afternoon tea' }).click();
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(tile).toContainText('Tea photo');
  await page.getByTestId('drafts-send').filter({ hasText: 'Send for approval (1)' }).click();
  await expect(page.getByRole('status').filter({ hasText: '1 photo sent for approval.' })).toBeVisible();
  const snap = await request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': 's9' } });
  const state = (await snap.json()).state as { dayMenus: Record<string, { teaPhotoIds?: string[]; photoIds?: string[] }>; photos: Record<string, Photo> };
  const ids = state.dayMenus['2026-10-21'].teaPhotoIds ?? [];
  expect(ids).toHaveLength(1);
  expect(state.photos[ids[0]]).toMatchObject({ kind: 'lunch', visibility: 'pending', takenBy: 's3' });
  c.assertClean();
});

test('drafts are private: another teacher has none and sees no badge; nobody else has the camera button', async ({ page, browser }) => {
  const c = watchConsole(page);
  await signIn(page, 's6', '/camera');
  await expect(page.getByText('No drafts')).toBeVisible();
  await expect(page.getByTestId('quick-camera')).toBeVisible();
  await expect(page.getByTestId('quick-camera-badge')).toHaveCount(0);
  for (const uid of ['s1', 's8', 's10']) {
    const o = await otherUser(browser, uid, '/today');
    await expect(o.page.getByTestId('quick-camera')).toHaveCount(0);
    await o.ctx.close();
  }
  c.assertClean();
});

for (const [uid, path, text] of [['s5', '/camera', 'Buka kamera'], ['s3', '/drafts', 'Belum ada draf'], ['s9', '/drafts', 'Draf']] as const) {
  test(`Indonesian: ${uid} ${path} has no raw keys and no English leftovers, and the camera screen is Indonesian too`, async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, uid, path, 'id');
    await expect(page.locator('#main')).toContainText(text);
    const body = await page.locator('#main').innerText();
    expect(body).not.toMatch(/\b(drafts|activity|common|nav)\.[A-Za-z_]+/);
    expect(body).not.toMatch(/Open camera|Send all|Send for approval|Drafts|More ways|Linking|Select all/);
    await page.getByTestId('quick-camera').click();
    const cam = page.getByRole('dialog', { name: 'Kamera cepat' });
    await expect(cam).toBeVisible();
    await expect(cam.getByRole('button', { name: 'Selesai' })).toBeVisible();
    await expect(cam.getByRole('button', { name: 'Foto', exact: true })).toBeVisible();
    expect(await cam.innerText()).not.toMatch(/Done|Photo\b|Drafts/);
    await cam.getByRole('button', { name: 'Selesai' }).click();
    await assertNoHorizontalScroll(page);
    c.assertClean();
  });
}
