// Activity area: teacher Today, camera (real camera flow with the file-picker fallback, member search, photos waiting for approval), daily log (today and the last 7 days, search),
// photo library, moderation and review, Indonesian, no console errors, no horizontal scroll.
// Isolated env: pnpm e2e:env activity 8805 5205 ; E2E_BASE_URL=http://localhost:5205 pnpm exec playwright test e2e/activity.spec.ts
import { test, expect, type Browser, type Page } from '@playwright/test';
import { resetDemo, signIn, watchConsole, isPhone, assertNoHorizontalScroll } from './helpers';
import { TINY_PNG, goToPage, pickOption, takePhotoWithFile } from './kit';

/** Reset the demo data and pin the shared clock to 09:58 so "Next · 10:30" is stable. */
test.beforeEach(async ({ request }) => {
  await resetDemo(request);
  const r = await request.post('/api/demo/clock', { data: { hm: '09:58', allowBack: true } });
  expect(r.ok()).toBeTruthy();
});

type State = { attendance: Record<string, Record<string, unknown>>; dailyLogs: Record<string, Record<string, unknown>>; photos: Record<string, Record<string, unknown>>; notifications: Record<string, Record<string, unknown>>; messages: Record<string, Record<string, unknown>> };
/** What a user's browser receives (the family projection for family users). */
async function snapshot(page: Page, uid: string): Promise<State> {
  const r = await page.request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': uid } });
  expect(r.ok()).toBeTruthy();
  return (await r.json()).state;
}
/** Run an action as another user straight against the API (the same call the app makes). */
async function actAs(page: Page, uid: string, name: string, input: object, mutationId: string) {
  const r = await page.request.post(`/api/actions/${name}`, { headers: { 'x-user-id': uid }, data: { mutationId, club: 'citra', input } });
  expect(r.ok(), await r.text()).toBeTruthy();
  return (await r.json()) as { result: Record<string, unknown> };
}
/** No horizontal scroll, measured once the fonts are in (before the icon font loads, icon names briefly render as long words). */
async function noHScroll(page: Page) {
  await page.evaluate(async () => { await document.fonts.load("20px 'Material Symbols Rounded'"); await document.fonts.load('16px Inter'); await document.fonts.ready; });
  await assertNoHorizontalScroll(page);
}
const RAW_KEY = /\b(activity|cal|common|nav|status|lobby)\.[A-Za-z_]+/;
/** Another signed-in user in their own browser context (same device settings as the running project), so sessions never mix. */
async function otherUser(browser: Browser, uid: string, path: string, lang: 'en' | 'id' = 'en') {
  const o = test.info().project.use as Record<string, unknown>;
  const ctx = await browser.newContext({ baseURL: o.baseURL as string, viewport: o.viewport as { width: number; height: number }, hasTouch: o.hasTouch as boolean | undefined, isMobile: o.isMobile as boolean | undefined, deviceScaleFactor: o.deviceScaleFactor as number | undefined, userAgent: o.userAgent as string | undefined });
  const page = await ctx.newPage();
  await signIn(page, uid, path, lang);
  return { page, ctx };
}
/** A real, playable ~1 s WebM made in the page (a canvas recorded with MediaRecorder), so the repo needs no video file. */
async function tinyWebm(page: Page) {
  const b64 = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 48;
    const ctx = c.getContext('2d')!;
    const rec = new MediaRecorder(c.captureStream(10), { mimeType: 'video/webm' });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    const done = new Promise<void>((r) => { rec.onstop = () => r(); });
    rec.start();
    let i = 0;
    const iv = setInterval(() => { ctx.fillStyle = `hsl(${i++ * 30},70%,50%)`; ctx.fillRect(0, 0, 64, 48); }, 100);
    await new Promise((r) => setTimeout(r, 1000));
    clearInterval(iv); rec.stop(); await done;
    const buf = new Uint8Array(await new Blob(chunks).arrayBuffer());
    let bin = '';
    for (const x of buf) bin += String.fromCharCode(x);
    return btoa(bin);
  });
  return { name: 'clip.webm', mimeType: 'video/webm', buffer: Buffer.from(b64, 'base64') };
}
/** CameraCapture in video mode in a browser with no camera: the file picker takes over. Choose a video, preview it, "Use video". The dialog must already be open. */
async function takeVideoWithFile(page: Page) {
  const cam = page.getByRole('dialog', { name: 'Camera' });
  await expect(cam).toBeVisible();
  await expect(cam.getByText('No camera was found here. Choose a video instead.')).toBeVisible({ timeout: 20_000 }); // the browser may take a while to say there is no microphone
  await expect(cam.locator('input[type="file"]')).toHaveAttribute('accept', 'video/*');
  await cam.locator('input[type="file"]').setInputFiles(await tinyWebm(page));
  await expect(cam.getByLabel('Preview of the video')).toBeVisible();
  await cam.getByRole('button', { name: 'Use video' }).click();
  await expect(cam).toBeHidden();
}
/** One member's row in the open round of the Daily log (a chip row in the session and lunch rounds, a card in Mood & notes). */
const logRow = (page: Page, name: string) => page.getByTestId('log-row').filter({ hasText: name });
/** The progress line of the open round, e.g. "1 of 3 marked". */
const progress = (page: Page) => page.getByTestId('round-progress');
/** "Mark the rest as …" (a pin on phones, a button elsewhere), then its confirmation. `n` is how many people the sheet says it will mark. */
async function markTheRest(page: Page, label: string, n: number, what: string) {
  await page.getByRole('button', { name: label, exact: true }).click();
  const ask = page.getByRole('dialog').filter({ hasText: n === 1 ? `Mark 1 person as ${what}?` : `Mark ${n} people as ${what}?` });
  await expect(ask).toBeVisible();
  await ask.getByRole('button', { name: 'Mark them' }).click();
  await expect(ask).toBeHidden();
}
async function openLangMenu(page: Page) {
  if (isPhone(page)) await page.getByRole('button', { name: 'Account' }).click();
}

test('s5 Today: the 10:30 Keroncong session, who is in the club, the day’s programme; rows open the daily log', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's5');
  await expect(page.getByRole('heading', { level: 1, name: 'Hello, Dinar' })).toBeVisible();
  await expect(page.getByText('Next · 10:30')).toBeVisible();
  await expect(page.getByText('Keroncong sing-along').first()).toBeVisible(); // the hero (its row in the programme is checked below)
  await expect(page.getByText(/Music room · with Dinar · 3 members in the club/)).toBeVisible();
  // in the club: the three members who have checked in, none logged yet
  for (const n of ['Bapak Bambang Purnomo', 'Opa Hendra Gunawan', 'Opa Tjahjadi Lim']) await expect(page.getByRole('button', { name: new RegExp(`${n}: Not logged`) })).toBeVisible();
  await expect(page.getByText('Oma Lina')).toHaveCount(0); // not here yet
  // the day's programme: the whole day as a timeline, the hero session is its first row; at 09:58 nothing has started
  await expect(page.getByText('Today’s programme')).toBeVisible();
  const plan = page.getByTestId('today-plan');
  for (const n of ['Keroncong sing-along', 'Lunch', 'Batik painting', 'Afternoon tea']) await expect(plan.getByText(n, { exact: true })).toBeVisible();
  await expect(plan.locator('li')).toHaveCount(4);
  await expect(plan.locator('li[data-state="up"]')).toHaveCount(4);
  await expect(page.getByText('Keroncong sing-along')).toHaveCount(2); // the hero and its row in the programme
  await noHScroll(page);
  // the hero buttons lead to Camera and Daily log
  await page.getByRole('button', { name: 'Daily log' }).first().click();
  await expect(page).toHaveURL(/\/log$/);
  await page.goBack();
  // a row opens that member's entry in the daily log
  await page.getByRole('button', { name: /Bapak Bambang Purnomo: Not logged/ }).click();
  await expect(page).toHaveURL(/\/log\?member=m10$/);
  await expect(page.getByRole('button', { name: /Bapak Bambang Purnomo/ })).toHaveAttribute('aria-expanded', 'true');
  c.assertClean();
});

test('drop-in: a member who checks in shows on Today, in the Camera faces and the Daily log; once she goes home she leaves Today but stays in the log', async ({ page, request }) => {
  const c = watchConsole(page);
  await signIn(page, 's5');
  await expect(page.getByText(/3 members in the club/)).toBeVisible();
  await expect(page.getByText('Oma Lina')).toHaveCount(0);
  // nobody is "expected": the lobby simply checks Oma Lina in when she walks through the door
  const lobby = async (name: string, input: object, mutationId: string) => {
    const r = await request.post(`/api/actions/${name}`, { headers: { 'x-user-id': 's1' }, data: { mutationId, club: 'citra', input } });
    expect(r.ok(), await r.text()).toBeTruthy();
  };
  await lobby('attendance.checkIn', { memberId: 'm1', method: 'manual' }, 'e2e-dropin-in');
  // the open Today screen updates by itself
  await expect(page.getByRole('button', { name: /Oma Lina[^:]*: Not logged/ })).toBeVisible();
  await expect(page.getByText(/4 members in the club/)).toBeVisible();
  // the camera lists her (solo list and the suggested faces), and the daily log lists her
  await page.goto('/camera');
  await expect(page.getByRole('button', { name: 'Take a photo of Oma Lina' })).toBeVisible();
  await page.getByRole('button', { name: 'Take group photo' }).click();
  await takePhotoWithFile(page);
  const faces = page.getByRole('dialog', { name: 'Who is in this photo?' });
  await faces.getByRole('button', { name: /Add suggested faces \(4\)/ }).click();
  await expect(faces.getByRole('button', { name: 'Remove Oma Lina' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto('/log');
  await expect(progress(page)).toHaveText('0 of 4 marked');
  await expect(logRow(page, 'Oma Lina')).toBeVisible();
  await expect(page.getByText('Went home', { exact: true })).toHaveCount(0);
  // she goes home: no longer "in the club", but still part of today's log (under "Went home")
  await lobby('attendance.checkOut', { memberId: 'm1' }, 'e2e-dropin-out');
  await page.goto('/today');
  await expect(page.getByText(/3 members in the club/)).toBeVisible();
  await expect(page.getByText('Oma Lina')).toHaveCount(0);
  await page.goto('/log');
  await expect(progress(page)).toHaveText('0 of 4 marked');
  await expect(logRow(page, 'Oma Lina')).toBeVisible();
  await expect(page.getByText('Went home', { exact: true })).toBeVisible();
  c.assertClean();
});

test('Today: Camera opens Camera ▸ Activity pictures on the Now / Next session (KC round 6)', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's5');
  await page.locator('#main').getByRole('button', { name: 'Camera', exact: true }).click(); // the Now / Next card's button, not the menu item
  await expect(page).toHaveURL(/\/camera\?tab=activity&act=Keroncong%20sing-along/);
  await expect(page.getByRole('combobox', { name: 'Activity' })).toContainText('Keroncong sing-along');
  c.assertClean();
});

test('Today follows the clock: Now, then the next session, then done for the day', async ({ page, request }) => {
  const c = watchConsole(page);
  await request.post('/api/demo/clock', { data: { hm: '10:45', allowBack: true } });
  await signIn(page, 's5');
  const row = (name: string) => page.getByTestId('today-plan').locator('li', { hasText: name });
  await expect(page.getByText('Now · 10:30')).toBeVisible();
  await expect(row('Keroncong sing-along')).toHaveAttribute('data-state', 'now');
  await expect(row('Lunch')).toHaveAttribute('data-state', 'up');
  await request.post('/api/demo/clock', { data: { hm: '12:10', allowBack: true } });
  await page.reload();
  await expect(page.getByText('Next · 13:30')).toBeVisible();
  // the programme keeps the whole day: the session is done, lunch has started (now), the rest is still to come
  await expect(row('Keroncong sing-along')).toHaveAttribute('data-state', 'done');
  await expect(row('Lunch')).toHaveAttribute('data-state', 'now');
  await expect(row('Batik painting')).toHaveAttribute('data-state', 'up');
  await expect(row('Afternoon tea')).toHaveAttribute('data-state', 'up');
  await request.post('/api/demo/clock', { data: { hm: '14:50', allowBack: true } });
  await page.reload();
  await expect(page.getByText('Done for today')).toBeVisible();
  await expect(page.getByText('Keroncong sing-along')).toHaveCount(1); // only its (done) row in the programme: the hero does not fall back to the first session
  for (const n of ['Keroncong sing-along', 'Lunch', 'Batik painting']) await expect(row(n)).toHaveAttribute('data-state', 'done');
  await expect(row('Afternoon tea')).toHaveAttribute('data-state', 'up'); // tea is at 15:00
  await expect(page.getByText(/Next session: Thu 22 Oct · 10:30 · Gardening club/)).toBeVisible();
  await noHScroll(page);
  c.assertClean();
});

test('Camera: a teacher takes a group photo with the camera, picks who is in it with a search, and it waits for approval', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's5', '/camera');
  await expect(page.getByText('Next · 10:30 · Keroncong sing-along · Music room')).toBeVisible();
  await expect(page.getByText('Sent today')).toHaveCount(0);
  await expect(page.getByText(/go to management for approval first/)).toBeVisible();
  await noHScroll(page);
  // the real camera dialog (no camera in the test browser: the file picker takes over); then who is in it
  await page.getByRole('button', { name: 'Take group photo' }).click();
  await takePhotoWithFile(page);
  const sheet = page.getByRole('dialog', { name: 'Who is in this photo?' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('img', { name: 'Preview of the photo' })).toBeVisible();
  await expect(sheet.getByText('Nobody added yet.')).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Pick who is in the photo' })).toBeDisabled();
  await noHScroll(page);
  // a search finds one member; adding him puts a removable chip on top
  await sheet.getByLabel('Search members').fill('hend');
  await expect(sheet.getByRole('button', { name: 'Opa Hendra Gunawan' })).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Bapak Bambang Purnomo' })).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Opa Hendra Gunawan' }).click();
  await expect(sheet.getByRole('button', { name: 'Remove Opa Hendra' })).toBeVisible();
  await sheet.getByLabel('Search members').fill('zzz');
  await expect(sheet.getByText('Nobody matches “zzz”.')).toBeVisible();
  await sheet.getByLabel('Search members').fill('');
  // the face suggestions add the rest in one tap; one of them is taken out again
  await sheet.getByRole('button', { name: 'Add suggested faces (2)' }).click();
  await expect(sheet.getByRole('button', { name: 'Remove Opa Tjahjadi' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Remove Opa Tjahjadi' }).click();
  await expect(sheet.getByRole('button', { name: 'Remove Opa Tjahjadi' })).toHaveCount(0);
  await noHScroll(page);
  await sheet.getByRole('button', { name: 'Send for approval' }).click();
  await expect(page.getByRole('status')).toContainText('Group photo sent for approval');
  await expect(sheet).toHaveCount(0);
  await expect(page.getByText('Sent today')).toBeVisible();
  const tile = page.getByRole('button', { name: /Waiting for approval · Group · Opa Hendra, Bapak Bambang/ });
  await expect(tile).toBeVisible();
  await expect(tile.locator('img[src^="/api/media/"]')).toBeVisible(); // the real uploaded image, not the placeholder
  // stored as pending with the uploaded image; families see nothing and are told nothing
  const staff = await snapshot(page, 's5');
  const p = Object.values(staff.photos).find((x) => x.kind === 'group' && x.date === '2026-10-21')!;
  expect(p).toMatchObject({ activity: 'Keroncong sing-along', media: 'photo', takenBy: 's5', visibility: 'pending' });
  expect(p.mediaId).toBeTruthy();
  expect(new Set(p.memberIds as string[])).toEqual(new Set(['m2', 'm10']));
  const fam = await snapshot(page, 'fm10_0');
  expect(Object.keys(fam.photos)).not.toContain(p.id as string);
  expect(Object.values(fam.notifications).some((n) => String(n.kind).startsWith('activity.notif.new'))).toBe(false);
  // the tile opens the staff viewer: the picture, a "waiting" badge, tags and Remove, no Hide and no Approve for a teacher
  await tile.click();
  const viewer = page.getByRole('dialog', { name: 'Keroncong sing-along' });
  await expect(viewer).toBeVisible();
  await expect(viewer.locator('img[src^="/api/media/"]')).toBeVisible();
  await expect(viewer.getByText('Waiting for approval').first()).toBeVisible();
  await expect(viewer.getByText(/Tagged: Opa Hendra, Bapak Bambang/)).toBeVisible();
  await expect(viewer.getByRole('button', { name: 'Edit tags' })).toBeVisible();
  await expect(viewer.getByRole('button', { name: 'Remove photo' })).toBeVisible();
  await expect(viewer.getByRole('button', { name: /Hide from families|Approve|Reject/ })).toHaveCount(0);
  await expect(viewer.getByRole('button', { name: 'Save' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(viewer).toHaveCount(0);
  c.assertClean();
});

test('Camera: a solo photo with the camera and a short video, found by searching for the member', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's5', '/camera');
  await expect(page.getByText('No photos yet today').first()).toBeVisible();
  await page.getByLabel('Search members').fill('opa hendra');
  await expect(page.getByRole('button', { name: 'Take a photo of Opa Tjahjadi' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Take a photo of Opa Hendra' }).click();
  await takePhotoWithFile(page);
  await expect(page.getByRole('status')).toContainText('Photo of Opa Hendra sent for approval');
  await page.getByRole('button', { name: 'Record a short video of Opa Hendra' }).click();
  await takeVideoWithFile(page); // a real file, uploaded to /api/media (no 5 MB image limit, no downscale)
  await expect(page.getByRole('status')).toContainText('Short video of Opa Hendra sent for approval');
  await expect(page.getByText('2 today', { exact: true })).toBeVisible();
  const s = await snapshot(page, 's5');
  const mine = Object.values(s.photos).filter((x) => x.date === '2026-10-21' && x.kind === 'solo');
  expect(mine.map((x) => x.media).sort()).toEqual(['photo', 'video']);
  expect(mine.every((x) => x.visibility === 'pending' && x.takenBy === 's5')).toBe(true);
  expect(mine.find((x) => x.media === 'photo')!.mediaId).toBeTruthy();
  // the video is a real file: served back as video/webm, and its tile opens the viewer with a playable <video controls>
  const vid = mine.find((x) => x.media === 'video')!;
  expect(vid.mediaId).toBeTruthy();
  const file = await page.request.get(`/api/media/${vid.mediaId}`);
  expect(file.status()).toBe(200);
  expect(file.headers()['content-type']).toBe('video/webm');
  await page.getByRole('button', { name: /Waiting for approval · Video · Opa Hendra/ }).click();
  const viewer = page.getByRole('dialog', { name: /Keroncong sing-along/ });
  const player = viewer.locator('video[controls]');
  await expect(player).toBeVisible();
  await expect(player).toHaveAttribute('src', `/api/media/${vid.mediaId}`);
  await expect(viewer.getByRole('button', { name: /^Play video$/ })).toHaveCount(0); // not the simulated player
  await noHScroll(page);
  await page.keyboard.press('Escape');
  c.assertClean();
});

test('Camera: a group video is recorded, who is in it is picked, it waits for approval and then the family sees a real video', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's5', '/camera');
  await page.getByRole('button', { name: 'Record a short group video' }).click();
  await takeVideoWithFile(page);
  const sheet = page.getByRole('dialog', { name: 'Who is in this video?' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel('Preview of the video')).toBeVisible(); // a player, not a still
  await expect(sheet.getByText('Nobody added yet.')).toBeVisible();
  await noHScroll(page);
  await sheet.getByLabel('Search members').fill('hend');
  await sheet.getByRole('button', { name: 'Opa Hendra Gunawan' }).click();
  await sheet.getByRole('button', { name: 'Send for approval' }).click();
  await expect(page.getByRole('status')).toContainText('Group video sent for approval');
  await expect(sheet).toHaveCount(0);
  const staff = await snapshot(page, 's5');
  const v = Object.values(staff.photos).find((x) => x.kind === 'group' && x.media === 'video' && x.mediaId)!; // (the seed has simulated videos without a file)
  expect(v).toMatchObject({ media: 'video', visibility: 'pending', takenBy: 's5', date: '2026-10-21' });
  expect(v.mediaId).toBeTruthy();
  expect(v.memberIds).toEqual(['m2']);
  // pending: the family sees nothing; once management approves it the family gets it with its file
  expect(Object.keys((await snapshot(page, 'fm10_0')).photos)).not.toContain(v.id as string);
  await actAs(page, 's9', 'photo.approve', { photoIds: [v.id], notify: true }, 'e2e-vid-approve');
  const fam = (await snapshot(page, 'fm2_0')).photos[v.id as string];
  expect(fam).toMatchObject({ media: 'video', visibility: 'visible', mediaId: v.mediaId });
  expect(Object.values((await snapshot(page, 'fm2_0')).notifications).some((n) => n.kind === 'activity.notif.newVideo')).toBe(true);
  c.assertClean();
});

test('Camera: a member who opted out of face tagging is never suggested, but can still be added by name', async ({ page, request }) => {
  const c = watchConsole(page);
  const r = await request.post('/api/actions/members.setConsent', { headers: { 'x-user-id': 's9' }, data: { mutationId: 'e2e-face-optout', club: 'citra', input: { memberId: 'm10', face: false } } });
  expect(r.ok()).toBeTruthy();
  await signIn(page, 's5', '/camera');
  await expect(page.getByText('Tagged by name')).toBeVisible(); // Bambang's row in the solo list
  await page.getByRole('button', { name: 'Take group photo' }).click();
  await takePhotoWithFile(page);
  const sheet = page.getByRole('dialog', { name: 'Who is in this photo?' });
  await sheet.getByRole('button', { name: 'Add suggested faces (2)' }).click(); // Hendra and Tjahjadi, not Bambang
  await expect(sheet.getByRole('button', { name: 'Remove Opa Hendra' })).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Remove Bapak Bambang' })).toHaveCount(0);
  await expect(sheet.getByText('No face tagging')).toBeVisible();
  await noHScroll(page);
  await sheet.getByLabel('Search members').fill('bambang');
  await sheet.getByRole('button', { name: 'Bapak Bambang Purnomo' }).click(); // still taggable by name
  await sheet.getByRole('button', { name: 'Send for approval' }).click();
  await expect(page.getByRole('status')).toContainText('Group photo sent for approval');
  const s = await snapshot(page, 's5');
  const p = Object.values(s.photos).find((x) => x.kind === 'group' && x.date === '2026-10-21')!;
  expect(new Set(p.memberIds as string[])).toEqual(new Set(['m2', 'm10', 'm20']));
  c.assertClean();
});

test('Activity pictures (KC round 7): a picture of a session shows on that session for the teacher at once, and for the family of a member who came once approved; a family whose member did not come never gets it', async ({ page, request }) => {
  const c = watchConsole(page);
  expect((await request.post('/api/demo/clock', { data: { hm: '10:45' } })).ok()).toBe(true);
  // a solo photo of Bambang tagged with the same activity is his photo: it is not a picture of the session
  const solo = await actAs(page, 's9', 'photo.take', { kind: 'solo', memberIds: ['m10'], media: 'photo', activity: 'Keroncong sing-along' }, 'e2e-session-solo');
  const a = await actAs(page, 's5', 'photo.addActivity', { date: '2026-10-21', activity: 'Keroncong sing-along' }, 'e2e-session-a');
  const pid = a.result.photoId as string;
  expect(Object.values((await snapshot(page, 's5')).photos).find((x) => x.id === pid)).toMatchObject({ kind: 'activity', memberIds: [], visibility: 'pending', takenBy: 's5' });
  // the teacher: on the Keroncong row of today's programme at once (waiting for approval); not on Batik; not the solo photo
  await signIn(page, 's5', '/today');
  const row = page.getByTestId('today-plan').locator('li').filter({ hasText: 'Keroncong sing-along' });
  await expect(row.getByTestId('session-photos').locator(`[data-photo-id="${pid}"]`)).toBeVisible();
  await expect(row.getByTestId('session-photos').locator('[data-photo-id]')).toHaveCount(1);
  await expect(row.locator(`[data-photo-id="${solo.result.photoId}"]`)).toHaveCount(0);
  await expect(page.getByTestId('today-plan').locator('li').filter({ hasText: 'Batik painting' }).getByTestId('session-photos')).toHaveCount(0);
  // Bambang came today, so his family is a family of the day: not before management approves it…
  await signIn(page, 'fm10_0', '/today');
  const session = page.getByTestId('timeline').locator('[data-tl="session-10:30"]');
  await expect(session).toBeVisible();
  await expect(session.locator(`[data-photo-id="${pid}"]`)).toHaveCount(0);
  await expect(session.locator(`[data-photo-id="${solo.result.photoId}"]`)).toHaveCount(0);
  expect(Object.keys((await snapshot(page, 'fm10_0')).photos)).not.toContain(pid);
  // …then it is on Keroncong in his timeline, and opens in the viewer
  await actAs(page, 's9', 'photo.approve', { photoIds: [pid], notify: false }, 'e2e-session-ok'); // actAs checks the answer
  await expect(session.getByTestId('session-photos').locator(`[data-photo-id="${pid}"]`)).toBeVisible();
  await session.locator(`[data-photo-id="${pid}"]`).click();
  await expect(page.getByRole('dialog', { name: 'Keroncong sing-along' })).toBeVisible();
  expect(Object.keys((await snapshot(page, 'fm10_0')).photos)).toContain(pid);
  // nobody is told (nobody is tagged)
  expect(Object.values((await snapshot(page, 'fm10_0')).notifications).filter((n) => String(n.kind).startsWith('activity.notif.new')).map((n) => (n.ref as { id: string } | undefined)?.id)).not.toContain(pid);
  // Oma Lina and Opa Budi did not come today: their family's data holds no activity picture and their timeline shows none
  expect(Object.keys((await snapshot(page, 'f1')).photos)).not.toContain(pid);
  await signIn(page, 'f1', '/today');
  await expect(page.getByTestId('timeline').locator('[data-tl="session-10:30"]')).toBeVisible();
  await expect(page.locator(`[data-photo-id="${pid}"]`)).toHaveCount(0);
  c.assertClean();
});

test('Camera ▸ Activity pictures: pick a day and an activity, add a picture with the camera or a file, see it wait for approval; a rejected one shows its reason, the bell leads back, and the teacher uploads another', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's5', '/camera');
  await page.getByRole('tab', { name: /^Activity( pictures)?$/ }).click();
  await expect(page).toHaveURL(/tab=activity/);
  await expect(page.getByRole('tab', { name: /^Activity( pictures)?$/ })).toHaveAttribute('aria-selected', 'true');
  // today and the session that is next (10:30 Keroncong) are picked
  await expect(page.getByRole('combobox', { name: 'Day' })).toContainText('Today');
  await expect(page.getByRole('combobox', { name: 'Activity' })).toContainText('Keroncong sing-along');
  await expect(page.getByText('No pictures for this session yet.')).toBeVisible();
  await expect(page.getByText(/Management approves your pictures first/)).toBeVisible();
  await noHScroll(page);
  // the days on offer: today and the open days of the last 7 (a Saturday has no session, the 13th is 8 days back)
  await page.getByRole('combobox', { name: 'Day' }).click();
  for (const d of ['Tue 20 Oct', 'Mon 19 Oct', 'Fri 16 Oct', 'Wed 14 Oct']) await expect(page.getByRole('option', { name: new RegExp(d) })).toBeVisible();
  for (const d of ['Sat 17 Oct', 'Sun 18 Oct', 'Tue 13 Oct']) await expect(page.getByRole('option', { name: new RegExp(d) })).toHaveCount(0);
  await page.keyboard.press('Escape');
  // add one with the camera dialog (no camera here: the file picker takes over)
  await page.getByRole('button', { name: 'Add picture' }).click();
  await takePhotoWithFile(page);
  await expect(page.getByRole('status').filter({ hasText: 'Picture sent for approval' })).toBeVisible();
  const tile = page.getByRole('button', { name: /^Keroncong sing-along, \d\d:\d\d, Waiting for approval$/ });
  await expect(tile).toBeVisible();
  await expect(tile.locator('img[src^="/api/media/"]')).toBeVisible(); // the real uploaded image
  await expect(page.getByText('1 picture')).toBeVisible();
  // the seed already holds a month of session pictures (all before today), so pick out the one just added: today's, still waiting
  const mine = Object.values(await snapshot(page, 's5').then((x) => x.photos)).find((x) => x.kind === 'activity' && x.date === '2026-10-21')!;
  expect(mine).toMatchObject({ date: '2026-10-21', activity: 'Keroncong sing-along', memberIds: [], takenBy: 's5', visibility: 'pending' });
  expect(mine.mediaId).toBeTruthy();
  expect(Object.keys((await snapshot(page, 'fm10_0')).photos)).not.toContain(mine.id as string);
  await noHScroll(page);
  // it opens in the viewer: waiting badge, nothing about tags (nobody is tagged), the teacher can still remove it
  await tile.click();
  const viewer = page.getByRole('dialog', { name: 'Keroncong sing-along' });
  await expect(viewer.getByText('Waiting for approval').first()).toBeVisible();
  await expect(viewer.getByRole('button', { name: 'Edit tags' })).toHaveCount(0);
  await expect(viewer.getByRole('button', { name: 'Remove photo' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(viewer).toHaveCount(0);
  // another activity of the day has none; an earlier day starts on its first session and takes a picture for that day
  await pickOption(page, 'Activity', 'Batik painting');
  await expect(page.getByText('No pictures for this session yet.')).toBeVisible();
  await pickOption(page, 'Day', /Tue 20 Oct/);
  await expect(page.getByRole('combobox', { name: 'Day' })).toContainText('Tue 20 Oct');
  await expect(page.getByRole('combobox', { name: 'Activity' })).toContainText('Batik painting');
  // that day already has its seeded pictures (approved ones from the history); the new one is counted on top of them
  const seeded = await page.locator('[data-picture]').count();
  await expect(page.locator('[data-picture][data-state="pending"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Add picture' }).click();
  await takePhotoWithFile(page);
  await expect(page.locator('[data-picture][data-state="pending"]')).toHaveCount(1);
  await expect(page.locator('[data-picture]')).toHaveCount(seeded + 1);
  // the row shows at once (optimistic); wait for the server to have it before reading it back
  const pastOf = async () => Object.values((await snapshot(page, 's5')).photos).find((x) => x.kind === 'activity' && x.date === '2026-10-20' && x.visibility === 'pending');
  await expect.poll(async () => !!(await pastOf())).toBe(true);
  const past = (await pastOf())!;
  expect(past).toMatchObject({ activity: 'Batik painting', memberIds: [], visibility: 'pending', takenBy: 's5' });
  // management rejects it with a reason: the teacher sees the reason on that session
  await actAs(page, 's9', 'photo.reject', { photoIds: [past.id], reason: 'Blurry' }, 'e2e-actpic-rej');
  const rejected = page.locator(`[data-picture="${past.id}"]`);
  await expect(rejected).toHaveAttribute('data-state', 'rejected');
  await expect(rejected).toContainText('Rejected');
  await expect(rejected).toContainText('Reason: Blurry');
  await expect(rejected.getByRole('button', { name: /Keroncong|Batik/ })).toHaveCount(0); // a rejected picture no longer opens
  // the bell tells her too, and leads back to that session (from anywhere)
  await page.goto('/today');
  await page.getByRole('button', { name: /Notifications/ }).first().click();
  const bell = page.getByRole('dialog', { name: 'Notifications' });
  await bell.getByRole('tab', { name: /Updates/ }).click();
  await bell.getByRole('button', { name: /Your picture for Batik painting was not approved: Blurry/ }).click();
  await expect(page).toHaveURL(/\/camera\?tab=activity&date=2026-10-20&act=Batik%20painting/);
  await expect(page.getByRole('combobox', { name: 'Day' })).toContainText('Tue 20 Oct');
  await expect(page.getByRole('combobox', { name: 'Activity' })).toContainText('Batik painting');
  await expect(page.locator(`[data-picture="${past.id}"]`)).toContainText('Reason: Blurry');
  // upload another on that session
  await page.locator(`[data-picture="${past.id}"]`).getByRole('button', { name: 'Upload another' }).click();
  await takePhotoWithFile(page);
  await expect(page.locator('[data-picture][data-state="pending"]')).toHaveCount(1);
  await expect(page.locator('[data-picture]')).toHaveCount(seeded + 2); // the rejected one stays, with its reason, beside the new one and the seeded ones
  await noHScroll(page);
  c.assertClean();
});

test('Today: the picture of the session (the Now / Next banner and the dot) opens in the viewer, an uploaded one or the activity’s own', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's5', '/camera?tab=activity');
  await page.getByRole('button', { name: 'Add picture' }).click();
  await takePhotoWithFile(page);
  await expect(page.locator('[data-picture][data-state="pending"]')).toHaveCount(1);
  // the banner of the Next session now shows that picture; tapping it shows it in full
  await page.goto('/today');
  const banner = page.getByTestId('hero-photo');
  await expect(banner).toBeVisible();
  await banner.click();
  const viewer = page.getByRole('dialog', { name: 'Keroncong sing-along' });
  await expect(viewer).toBeVisible();
  await expect(viewer.locator('img[src^="/api/media/"]')).toBeVisible();
  await expect(viewer.getByText('Waiting for approval').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(viewer).toHaveCount(0);
  // the session's picture beside the line on the programme row opens it too (KC round 7: the dots on the line are icons only)
  await page.getByTestId('today-plan').locator('li').filter({ hasText: 'Keroncong sing-along' }).getByTestId('session-photos').locator('[data-photo-id]').first().click();
  await expect(page.getByRole('dialog', { name: 'Keroncong sing-along' })).toBeVisible();
  await page.keyboard.press('Escape');
  // an activity with its own picture in the catalog but none from the day: the banner opens that picture on its own, with no actions
  const up = await page.request.post('/api/media', { headers: { 'x-user-id': 's9' }, data: { mime: 'image/png', data: TINY_PNG.toString('base64') } });
  const mediaId = String((await up.json()).id);
  const st = await snapshot(page, 's9') as unknown as { activities: Record<string, { id: string; name: string; icon: string; roomId: string }> };
  const batik = Object.values(st.activities).find((x) => x.name === 'Batik painting')!;
  await actAs(page, 's9', 'activity.upsert', { id: batik.id, name: batik.name, icon: batik.icon, roomId: batik.roomId, photoMediaId: mediaId }, 'e2e-catalog-pic');
  await page.request.post('/api/demo/clock', { data: { hm: '12:10', allowBack: true } });
  await page.reload();
  await expect(page.getByText('Next · 13:30')).toBeVisible();
  await page.getByTestId('hero-photo').click();
  const plain = page.getByRole('dialog', { name: 'Batik painting' });
  await expect(plain).toBeVisible();
  await expect(plain.locator('img[src^="/api/media/"]')).toBeVisible();
  await expect(plain.getByRole('button', { name: /Remove photo|Hide from families|Edit tags/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(plain).toHaveCount(0);
  c.assertClean();
});

test('Photo library: filter to activity pictures; they open in the viewer with no tags; management approves one there', async ({ page }) => {
  const c = watchConsole(page);
  const a = await actAs(page, 's5', 'photo.addActivity', { date: '2026-10-21', activity: 'Keroncong sing-along' }, 'e2e-lib-a');
  const b = await actAs(page, 's9', 'photo.addActivity', { date: '2026-10-21', activity: 'Batik painting' }, 'e2e-lib-b');
  const pa = a.result.photoId as string, pb = b.result.photoId as string;
  await signIn(page, 's9', '/photos');
  await expect(page.locator(`[data-photo-id="${pb}"]`)).toBeVisible();
  const all = await page.locator('[data-photo-id]').count();
  await pickOption(page, 'Show', 'Activity pictures');
  // the seed has a month of session pictures too (and group photos of members): the filter leaves only pictures of sessions, today's two among them
  await expect(page.locator(`[data-photo-id="${pa}"]`)).toHaveAttribute('aria-label', /Activity picture/);
  await expect(page.locator(`[data-photo-id="${pb}"]`)).toBeVisible();
  await expect(page.locator('[data-photo-id]:not([aria-label*="Activity picture"])')).toHaveCount(0);
  expect(await page.locator('[data-photo-id]').count()).toBeGreaterThanOrEqual(2);
  await noHScroll(page);
  await page.locator(`[data-photo-id="${pa}"]`).click();
  const viewer = page.getByRole('dialog', { name: 'Keroncong sing-along' });
  await expect(viewer.getByText('Waiting for approval').first()).toBeVisible();
  await expect(viewer.getByRole('button', { name: 'Edit tags' })).toHaveCount(0);
  await viewer.getByRole('button', { name: 'Approve' }).click();
  await page.getByRole('dialog', { name: 'Approve this photo?' }).getByRole('button', { name: 'Approve photo' }).click();
  await expect(page.getByRole('status').first()).toContainText('Photo approved');
  expect((await snapshot(page, 's9')).photos[pa]).toMatchObject({ visibility: 'visible', approved: { by: 's9' } });
  await page.keyboard.press('Escape');
  // the filter clears back to everything
  await pickOption(page, 'Show', 'All photos');
  expect(await page.locator('[data-photo-id]').count()).toBe(all);
  c.assertClean();
});

test('Review: management approves a teacher’s photo from the library; the family sees it and is told (or not, with notify off)', async ({ page, browser }) => {
  const c = watchConsole(page);
  const a = await actAs(page, 's5', 'photo.take', { kind: 'solo', memberIds: ['m10'], media: 'photo' }, 'e2e-rev-a');
  const b = await actAs(page, 's5', 'photo.take', { kind: 'solo', memberIds: ['m10'], media: 'photo' }, 'e2e-rev-b');
  const pa = a.result.photoId as string, pb = b.result.photoId as string;
  expect(Object.keys((await snapshot(page, 'fm10_0')).photos)).not.toContain(pa);
  await signIn(page, 's9', '/photos');
  await page.getByRole('tab', { name: /Pending/ }).click();
  await expect(page.locator(`[data-photo-id="${pa}"]`)).toBeVisible();
  await expect(page.locator(`[data-photo-id="${pb}"]`)).toBeVisible();
  await noHScroll(page);
  // the first: approve with notify on (the default)
  await page.locator(`[data-photo-id="${pa}"]`).click();
  const viewer = page.getByRole('dialog').first();
  await expect(viewer.getByText(/Taken by Dinar/)).toBeVisible();
  await viewer.getByRole('button', { name: 'Approve' }).click();
  const sheet = page.getByRole('dialog', { name: 'Approve this photo?' });
  await expect(sheet.getByRole('switch', { name: /Notify families/ })).toHaveAttribute('aria-checked', 'true');
  await sheet.getByRole('button', { name: 'Approve photo' }).click();
  await expect(page.getByRole('status').first()).toContainText('Photo approved. The families are told.');
  let fam = await snapshot(page, 'fm10_0');
  expect(Object.keys(fam.photos)).toContain(pa);
  expect(Object.values(fam.notifications).filter((n) => n.kind === 'activity.notif.newPhoto')).toHaveLength(1);
  // the second: notify switched off, still approved
  await page.keyboard.press('Escape');
  await page.locator(`[data-photo-id="${pb}"]`).click();
  await page.getByRole('dialog').first().getByRole('button', { name: 'Approve' }).click();
  const sheet2 = page.getByRole('dialog', { name: 'Approve this photo?' });
  await sheet2.getByRole('switch', { name: /Notify families/ }).click();
  await expect(sheet2.getByRole('switch', { name: /Notify families/ })).toHaveAttribute('aria-checked', 'false');
  await sheet2.getByRole('button', { name: 'Approve photo' }).click();
  await expect(page.getByRole('status').first()).toContainText('Photo approved.');
  fam = await snapshot(page, 'fm10_0');
  expect(Object.keys(fam.photos)).toEqual(expect.arrayContaining([pa, pb]));
  expect(Object.values(fam.notifications).filter((n) => n.kind === 'activity.notif.newPhoto')).toHaveLength(1); // still just the first
  const staff = await snapshot(page, 's9');
  expect(staff.photos[pa]).toMatchObject({ visibility: 'visible', approved: { by: 's9' } });
  expect(staff.photos[pb]).toMatchObject({ visibility: 'visible', approved: { by: 's9' } });
  c.assertClean();
  // the teacher no longer sees a "waiting" badge on them
  const { page: t, ctx } = await otherUser(browser, 's5', '/camera');
  await expect(t.getByRole('button', { name: /Waiting for approval/ })).toHaveCount(0);
  await ctx.close();
});

test('Review: management rejects a photo with a reason; the family never sees it and the teacher is told why', async ({ page }) => {
  const c = watchConsole(page);
  const a = await actAs(page, 's5', 'photo.take', { kind: 'solo', memberIds: ['m2'], media: 'photo' }, 'e2e-rej-a');
  const pid = a.result.photoId as string;
  await signIn(page, 's9', '/photos');
  await page.getByRole('tab', { name: /Pending/ }).click();
  await page.locator(`[data-photo-id="${pid}"]`).click();
  await page.getByRole('dialog').first().getByRole('button', { name: 'Reject' }).click();
  const dlg = page.getByRole('dialog', { name: 'Reject this photo?' });
  await dlg.getByRole('button', { name: 'Blurry' }).click();
  await dlg.getByRole('button', { name: 'Reject photo' }).click();
  await expect(page.getByRole('status').first()).toContainText('Photo rejected.');
  const staff = await snapshot(page, 's9');
  expect(staff.photos[pid]).toMatchObject({ visibility: 'removed', moderated: { by: 's9', reason: 'Blurry' } });
  expect(Object.keys((await snapshot(page, 'fm2_0')).photos)).not.toContain(pid);
  const dinar = await snapshot(page, 's5');
  expect(Object.values(dinar.notifications).find((n) => n.kind === 'activity.notif.photoRejected')).toMatchObject({ toUsers: ['s5'], params: { reason: 'Blurry' } });
  c.assertClean();
});

test('Daily log: no family comments or reply box (Messages is gone), and the old message actions are refused', async ({ page, request }) => {
  const c = watchConsole(page);
  // Oma Lina's log of Monday 19 Oct opens for editing: the fields, who saved it, Save changes. Families can no longer comment on it.
  await signIn(page, 's5', '/log?date=2026-10-19&member=m1');
  await expect(page.getByText(/You are editing the log of Monday 19 October/)).toBeVisible();
  const card = page.locator('#log-card-m1');
  await expect(card.getByRole('button', { name: 'Save changes' })).toBeVisible();
  await expect(card.getByText(/Saved by /)).toBeVisible();
  await expect(page.getByText(/family comment/i)).toHaveCount(0);
  await expect(page.getByLabel('Reply to the family')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reply', exact: true })).toHaveCount(0);
  await noHScroll(page);
  // the message actions are gone from the server, and nothing is seeded or stored in Messages
  const r = await request.post('/api/actions/message.send', { headers: { 'x-user-id': 'f1' }, data: { mutationId: 'e2e-log-comment', club: 'citra', input: { memberId: 'm1', topic: 'care', text: 'Thank you Dinar!', ref: { type: 'dailyLog', id: 'log-m1-2026-10-19' } } } });
  expect(r.status()).toBe(422);
  expect((await r.json()).code).toBe('err.unknownAction');
  const s = await snapshot(page, 's5');
  expect(Object.keys(s.messages)).toHaveLength(0);
  c.assertClean();
});

test('Daily log: a search finds a member by name', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's5', '/log');
  // at 09:58 the log opens on the first session; the rounds are a switch above the people
  await expect(page.getByRole('tab', { name: /^10:30 · Keroncong sing-along/ })).toHaveAttribute('aria-selected', 'true');
  await expect(progress(page)).toHaveText('0 of 3 marked');
  const search = page.getByLabel('Search members');
  await expect(search).toBeVisible();
  await noHScroll(page);
  for (const n of ['Bapak Bambang Purnomo', 'Opa Hendra Gunawan', 'Opa Tjahjadi Lim']) await expect(logRow(page, n)).toBeVisible();
  await search.fill('hendra');
  await expect(logRow(page, 'Opa Hendra Gunawan')).toBeVisible();
  await expect(logRow(page, 'Bapak Bambang Purnomo')).toHaveCount(0);
  await expect(progress(page)).toHaveText('0 of 3 marked'); // the counts are for the whole day, not the search
  // a found member can be marked as usual: one tap in the round, then the form in Mood & notes
  await logRow(page, 'Opa Hendra Gunawan').getByRole('button', { name: 'Joined', exact: true }).click();
  await expect(progress(page)).toHaveText('1 of 3 marked');
  await page.getByRole('tab', { name: /^Mood & notes/ }).click();
  await expect(page).toHaveURL(/round=mood/);
  await expect(search).toHaveValue(''); // a new round starts with a clear search
  await search.fill('hendra');
  await expect(logRow(page, 'Bapak Bambang Purnomo')).toHaveCount(0);
  await logRow(page, 'Opa Hendra Gunawan').getByRole('button', { name: /Opa Hendra Gunawan/ }).click();
  await page.getByRole('button', { name: 'Cheerful', exact: true }).click();
  await page.getByRole('button', { name: 'Save log' }).click();
  await expect(page.getByRole('status')).toContainText('Log saved for Opa Hendra');
  await expect(progress(page)).toHaveText('1 of 3 marked');
  await search.fill('nobody called this');
  await expect(page.getByText('Nobody matches “nobody called this”.')).toBeVisible();
  await search.fill('');
  await expect(logRow(page, 'Bapak Bambang Purnomo')).toBeVisible();
  c.assertClean();
});

test('Daily log: save Bambang as quiet / ate most, then everyone else as normal (in rounds: session, lunch, mood & notes)', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's5', '/log');
  await expect(page.getByRole('heading', { level: 1, name: 'Daily log' })).toBeVisible();
  // the rounds of today's programme, in the order of the day (the app opens on the first session at 09:58)
  const rounds = page.getByRole('tablist', { name: 'Log rounds' }).getByRole('tab');
  await expect(rounds).toHaveText([/^10:30 · Keroncong sing-along/, /^Lunch/, /^13:30 · Batik painting/, /^Mood & notes/]);
  await expect(progress(page)).toHaveText('0 of 3 marked');
  await noHScroll(page);
  const bambang = logRow(page, 'Bapak Bambang Purnomo');
  const log = async (uid = 's5') => (await snapshot(page, uid)).dailyLogs['log-m10-2026-10-21'];

  // round 1, the session: Joined / Sat out per person; he sat out
  await expect(bambang.getByRole('button')).toHaveText(['Joined', 'Sat out']);
  await bambang.getByRole('button', { name: 'Sat out', exact: true }).click();
  await expect(bambang.getByRole('button', { name: 'Sat out', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(progress(page)).toHaveText('1 of 3 marked');
  await expect.poll(async () => (await log())?.sessions).toEqual({ '10:30': 'satOut' });
  expect(await log()).toMatchObject({ joined: 'satOut', status: 'saved', by: 's5' });
  // the rest of the people: Joined, after a confirmation that says how many (Cancel changes nothing)
  await page.getByRole('button', { name: 'Mark the rest as Joined', exact: true }).click();
  const ask = page.getByRole('dialog').filter({ hasText: 'Mark 2 people as Joined?' });
  await expect(ask).toBeVisible();
  await ask.getByRole('button', { name: 'Cancel' }).click();
  await expect(ask).toBeHidden();
  await expect(progress(page)).toHaveText('1 of 3 marked');
  await markTheRest(page, 'Mark the rest as Joined', 2, 'Joined');
  await expect(progress(page)).toHaveText('All marked');
  await expect(page.getByRole('button', { name: 'Mark the rest as Joined', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: /^10:30 · Keroncong sing-along/ }).locator('.ms', { hasText: 'check_circle' })).toHaveCount(1); // a finished round carries a tick
  await expect.poll(async () => (await snapshot(page, 's5')).dailyLogs['log-m2-2026-10-21']?.sessions).toEqual({ '10:30': 'joined' });
  expect((await snapshot(page, 's5')).dailyLogs['log-m10-2026-10-21']).toMatchObject({ joined: 'satOut' }); // untouched by "the rest"

  // round 2, lunch: one tap per person, five amounts; he ate most
  await page.getByRole('tab', { name: /^Lunch/ }).click();
  await expect(page).toHaveURL(/round=lunch/);
  await expect(progress(page)).toHaveText('0 of 3 marked');
  await expect(bambang.getByRole('button')).toHaveText(['All', 'Most', 'Half', 'Little', 'None']);
  await bambang.getByRole('button', { name: 'Most', exact: true }).click();
  await expect(bambang.getByRole('button', { name: 'Most', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(progress(page)).toHaveText('1 of 3 marked');
  await expect.poll(async () => (await log())?.lunch).toBe('most');
  await markTheRest(page, 'Mark the rest as Ate all', 2, 'Ate all');
  await expect(progress(page)).toHaveText('All marked');
  await expect(logRow(page, 'Opa Hendra Gunawan').getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(bambang.getByRole('button', { name: 'Most', exact: true })).toHaveAttribute('aria-pressed', 'true'); // still his
  // tapping the chosen amount again clears it (Opa Tjahjadi stays without a lunch mark)
  await logRow(page, 'Opa Tjahjadi Lim').getByRole('button', { name: 'All', exact: true }).click();
  await expect(logRow(page, 'Opa Tjahjadi Lim').getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(progress(page)).toHaveText('2 of 3 marked');
  await expect.poll(async () => (await snapshot(page, 's5')).dailyLogs['log-m20-2026-10-21']?.lunch).toBeUndefined();

  // round 3, mood & notes: the form per person (mood, communicative, content, a note for the family); there is no lunch or session in it any more
  await page.getByRole('tab', { name: /^Mood & notes/ }).click();
  await expect(progress(page)).toHaveText('0 of 3 marked');
  await bambang.getByRole('button', { name: /Bapak Bambang Purnomo/ }).click();
  for (const m of ['Cheerful', 'Calm', 'Quiet', 'Unsettled']) await expect(page.getByRole('button', { name: m, exact: true })).toBeVisible();
  for (const m of ['Ate most', 'Ate all', 'Joined']) await expect(page.getByRole('button', { name: m, exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Quiet', exact: true }).click();
  await expect(page.getByText('Quiet · not saved')).toBeVisible();
  await page.getByPlaceholder('Short note for the family (optional)').fill('Quiet but enjoyed the tea.');
  await noHScroll(page);
  await page.getByRole('button', { name: 'Save log' }).click();
  await expect(page.getByRole('status')).toContainText('Log saved for Bapak Bambang: quiet');
  await expect(page.getByText('Saved · Quiet')).toBeVisible();
  await expect(progress(page)).toHaveText('1 of 3 marked');
  const s = await snapshot(page, 's5');
  expect(s.dailyLogs['log-m10-2026-10-21']).toMatchObject({ mood: 'quiet', lunch: 'most', joined: 'satOut', note: 'Quiet but enjoyed the tea.', status: 'saved', by: 's5' });
  // a teacher's log waits for management: the family sees nothing and is not told yet
  await expect(page.getByRole('status')).toContainText('Waiting for management approval.');
  expect(s.dailyLogs['log-m10-2026-10-21'].approval).toMatchObject({ status: 'pending' });
  const before = await snapshot(page, 'fm10_0');
  expect(before.dailyLogs['log-m10-2026-10-21']).toBeUndefined();
  expect(Object.values(before.notifications).filter((n) => n.kind === 'activity.notif.logSaved')).toHaveLength(0);
  // management approves: the family sees it, and is told once (after the Mood & notes round, not after each mark)
  await actAs(page, 's9', 'approval.approve', { type: 'logs', ids: ['log-m10-2026-10-21'] }, 'e2e-ap-log-m10');
  const fam = await snapshot(page, 'fm10_0');
  expect(fam.dailyLogs['log-m10-2026-10-21']).toMatchObject({ mood: 'quiet', lunch: 'most' });
  expect(Object.values(fam.notifications).filter((n) => n.kind === 'activity.notif.logSaved')).toHaveLength(1);
  // the rest of the people, normal, in one confirmed tap that leaves his entry alone
  await markTheRest(page, 'Mark the rest as normal', 2, 'normal');
  await expect(progress(page)).toHaveText('All marked');
  await expect(page.getByRole('status').filter({ hasText: '2 people marked.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark the rest as normal', exact: true })).toHaveCount(0);
  await expect.poll(async () => (await snapshot(page, 's5')).dailyLogs['log-m20-2026-10-21']?.mood).toBe('calm');
  const s2 = await snapshot(page, 's5');
  expect(s2.dailyLogs['log-m10-2026-10-21']).toMatchObject({ mood: 'quiet', lunch: 'most', joined: 'satOut' }); // untouched
  expect(s2.dailyLogs['log-m2-2026-10-21']).toMatchObject({ mood: 'calm', communicative: 'normal', content: 'normal', lunch: 'all', joined: 'yes', sessions: { '10:30': 'joined' } });
  expect(s2.dailyLogs['log-m20-2026-10-21']).toMatchObject({ mood: 'calm', communicative: 'normal', content: 'normal', joined: 'yes' });
  expect(s2.dailyLogs['log-m20-2026-10-21'].lunch).toBeUndefined(); // cleared in the lunch round above
  expect(s2.dailyLogs['log-m1-2026-10-21']).toBeUndefined(); // Oma Lina has not arrived
  c.assertClean();
});

test('Daily log: edit yesterday’s log (the last 7 days are editable)', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's5', '/log');
  const days = page.getByRole('group', { name: 'Pick a day' });
  await days.getByRole('button', { name: 'Yesterday' }).click();
  await expect(page.getByText(/You are editing the log of Tuesday 20 October/)).toBeVisible();
  await expect(page).toHaveURL(/date=2026-10-20/);
  // drop-in club: the day's list is whoever checked in on Tuesday (all of them already have a Mood & notes entry)
  const there = Object.values((await snapshot(page, 's5')).attendance).filter((a) => a.date === '2026-10-20' && a.checkIn).length;
  expect(there).toBeGreaterThanOrEqual(3);
  await page.getByRole('tab', { name: /^Mood & notes/ }).click();
  await expect(progress(page)).toHaveText('All marked');
  await expect(page.getByTestId('log-row')).toHaveCount(there);
  // lunch is its own round: Opa Hendra ate half
  await page.getByRole('tab', { name: /^Lunch/ }).click();
  const lunch = (await snapshot(page, 's5')).dailyLogs['log-m2-2026-10-20'].lunch === 'half' ? { v: 'little', label: 'Little' } : { v: 'half', label: 'Half' }; // a different amount than the seeded one (tapping the chosen one clears it)
  await logRow(page, 'Opa Hendra Gunawan').getByRole('button', { name: lunch.label, exact: true }).click();
  await expect(logRow(page, 'Opa Hendra Gunawan').getByRole('button', { name: lunch.label, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await snapshot(page, 's5')).dailyLogs['log-m2-2026-10-20']?.lunch).toBe(lunch.v);
  // and his Mood & notes entry is edited in place
  await page.getByRole('tab', { name: /^Mood & notes/ }).click();
  await logRow(page, 'Opa Hendra Gunawan').getByRole('button', { name: /Opa Hendra Gunawan/ }).click();
  await page.getByRole('button', { name: 'Cheerful', exact: true }).click();
  await page.getByPlaceholder('Short note for the family (optional)').fill('Late edit from the notes.');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status')).toContainText('Log updated for Opa Hendra');
  await expect(logRow(page, 'Opa Hendra Gunawan').getByText('Saved · Cheerful')).toBeVisible();
  const s = await snapshot(page, 's5');
  const l = s.dailyLogs['log-m2-2026-10-20'];
  expect(l).toMatchObject({ mood: 'cheerful', lunch: lunch.v, note: 'Late edit from the notes.' });
  expect((l.edits as { by: string }[]).map((e) => e.by)).toEqual(['s5']);
  // the edit waits for management; the family hears "updated" once it is approved
  expect(l.approval).toMatchObject({ status: 'pending' });
  expect(Object.values((await snapshot(page, 'fm2_0')).notifications).some((n) => n.kind === 'activity.notif.logUpdated')).toBe(false);
  await actAs(page, 's9', 'approval.approve', { type: 'logs', ids: ['log-m2-2026-10-20'] }, 'e2e-ap-log-m2');
  expect(Object.values((await snapshot(page, 'fm2_0')).notifications).some((n) => n.kind === 'activity.notif.logUpdated')).toBe(true);
  // today is unaffected, and the window ends 7 days back
  await days.getByRole('button', { name: 'Today' }).click();
  await expect(progress(page)).toHaveText('0 of 3 marked');
  expect(await days.getByRole('button').count()).toBe(6); // today + the five club days back to Wed 14 Oct
  await expect(days.getByRole('button', { name: 'Wed 14 Oct' })).toBeVisible();
  c.assertClean();
});

test('Photo library (s9): hide a photo, and the family no longer sees it on /photos; show it again', async ({ page, browser }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/photos');
  await expect(page.getByRole('heading', { level: 1, name: 'Photo library' })).toBeVisible();
  await noHScroll(page);
  const before = Object.keys((await snapshot(page, 'f1')).photos);
  expect(before.length).toBeGreaterThan(3);
  // filter to Oma Lina; the first photo is the one we hide
  await pickOption(page, 'Member', 'Oma Lina');
  const tile = page.getByRole('button', { name: /Oma Lina/ }).first();
  await expect(tile).toBeVisible();
  const id = (await tile.getAttribute('data-photo-id'))!;
  // her family sees it on /photos, in the family viewer (Save and Share, no staff actions)
  const { page: fam, ctx: famCtx } = await otherUser(browser, 'f1', '/photos');
  const fc = watchConsole(fam);
  const famTile = fam.locator(`[data-photo-id="${id}"]`);
  await expect(famTile).toHaveCount(1);
  await famTile.click();
  const famViewer = fam.getByRole('dialog');
  await expect(famViewer.getByRole('button', { name: 'Save' })).toBeVisible();
  await expect(famViewer.getByRole('button', { name: 'Share' })).toBeVisible();
  await expect(famViewer.getByRole('button', { name: /Hide from families|Edit tags|Remove photo/ })).toHaveCount(0);
  await famViewer.getByRole('button', { name: 'Save' }).click();
  await expect(fam.getByRole('status')).toContainText('Photo saved to your phone.');
  await famViewer.getByRole('button', { name: 'Share' }).click();
  await expect(fam.getByRole('status')).toContainText('Share sheet opened.');
  await fam.keyboard.press('Escape');
  await expect(famViewer).toHaveCount(0);
  // the teacher side: open it, hide it from families with a reason
  await tile.click();
  const viewer = page.getByRole('dialog').first();
  await expect(viewer.getByRole('button', { name: 'Hide from families' })).toBeVisible();
  await expect(viewer.getByRole('button', { name: 'Save' })).toHaveCount(0); // staff never get Save
  await viewer.getByRole('button', { name: 'Hide from families' }).click();
  const sheet = page.getByRole('dialog', { name: 'Hide from families' });
  await sheet.getByRole('button', { name: 'Blurry' }).click();
  await sheet.getByRole('button', { name: 'Hide photo' }).click();
  await expect(page.getByRole('status')).toContainText('Hidden from families');
  await expect(viewer.getByText('Hidden from families')).toBeVisible();
  await expect(viewer.getByText(/Hidden by Ega · Blurry/)).toBeVisible();
  await expect(viewer.getByRole('button', { name: 'Show to families' })).toBeVisible();
  // the family no longer sees exactly that photo, live, and their data no longer holds it
  await expect(famTile).toHaveCount(0);
  const s = await snapshot(page, 's9');
  expect(s.photos[id]).toMatchObject({ visibility: 'hidden', moderated: { by: 's9', reason: 'blurry' } });
  const after = Object.keys((await snapshot(page, 'f1')).photos);
  expect(before).toContain(id);
  expect(after).not.toContain(id);
  expect(after).toHaveLength(before.length - 1);
  // staff still find it under "Hidden"; showing it again brings it back for the family
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: /Hidden/ }).click();
  await expect(page.getByRole('button', { name: /Hidden$/ })).toHaveCount(1);
  await page.getByRole('button', { name: /Hidden$/ }).click();
  await page.getByRole('dialog').first().getByRole('button', { name: 'Show to families' }).click();
  await expect(page.getByRole('status')).toContainText('Visible to families again');
  await expect(famTile).toHaveCount(1);
  expect(Object.keys((await snapshot(page, 'f1')).photos).sort()).toEqual([...before].sort());
  fc.assertClean();
  await famCtx.close();
  c.assertClean();
});

test('Photo library: retag (untag and tag), remove with undo', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's5', '/camera?tab=library');
  await expect(page.getByRole('tab', { name: 'Library' })).toHaveAttribute('aria-selected', 'true');
  await pickOption(page, 'Member', 'Opa Hendra');
  await page.getByRole('button', { name: /Opa Hendra/ }).first().click();
  const viewer = page.getByRole('dialog').first();
  const tagged = await viewer.getByText(/Tagged:/).innerText();
  await viewer.getByRole('button', { name: 'Edit tags' }).click();
  const sheet = page.getByRole('dialog', { name: 'Who is in this photo?' });
  await expect(sheet.getByRole('button', { name: 'Save tags' })).toBeDisabled();
  await sheet.getByLabel('Search members').fill('bambang');
  await sheet.getByRole('button', { name: 'Bapak Bambang Purnomo' }).click();
  await expect(sheet.getByRole('button', { name: 'Remove Bapak Bambang' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Save tags' }).click();
  await expect(page.getByRole('status')).toContainText('Tags saved');
  await expect(viewer.getByText(/Tagged:/)).not.toHaveText(tagged);
  // remove, then undo
  await viewer.getByRole('button', { name: 'Remove photo' }).click();
  const dlg = page.getByRole('dialog', { name: 'Remove this photo?' });
  await dlg.getByRole('button', { name: 'Duplicate' }).click();
  await dlg.getByRole('button', { name: 'Remove photo' }).click();
  await expect(page.getByRole('status')).toContainText('Photo removed.');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('status')).toContainText('Photo restored.');
  const s = await snapshot(page, 's5');
  expect(Object.values(s.photos).filter((p) => p.visibility === 'removed')).toHaveLength(0);
  c.assertClean();
});

test('Photo library: the days are paged and the "waiting" filter lists only photos waiting for approval', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/photos');
  await expect(page.getByRole('heading', { level: 1, name: 'Photo library' })).toBeVisible();
  // a month of session pictures in the seed: far more days than one page of five
  const nav = page.getByRole('navigation', { name: 'Photo days' });
  await expect(nav).toBeVisible();
  const pagesOf = async () => Number(((await nav.textContent()) ?? '').match(/Page \d+ of (\d+)/)?.[1]);
  expect(await pagesOf()).toBeGreaterThanOrEqual(2);
  // nothing is waiting in the seed (every seeded picture is approved)
  await page.getByRole('tab', { name: /Pending/ }).click();
  await expect(page.getByText('No photos match these filters')).toBeVisible();
  await expect(nav).toHaveCount(0);
  // a teacher's photo today is the only waiting photo
  await actAs(page, 's5', 'photo.take', { kind: 'solo', memberIds: ['m20'], media: 'photo' }, 'e2e-lib-pending');
  await expect(page.locator('[data-photo-id]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Waiting for approval/ })).toHaveCount(1);
  await expect(nav).toHaveCount(0); // one day: one page
  await page.getByRole('tab', { name: /^All/ }).click();
  await expect(nav).toBeVisible();
  const pages = await pagesOf(); // today's photo is one more day than the seed's, so it may be one more page
  expect(pages).toBeGreaterThanOrEqual(2);
  await noHScroll(page);
  const first = await page.locator('[data-photo-id]').first().getAttribute('data-photo-id');
  await goToPage(page, 2, 'Photo days');
  const onPage2 = page.locator('[data-photo-id]');
  expect(await onPage2.count()).toBeGreaterThan(0);
  expect(await onPage2.first().getAttribute('data-photo-id')).not.toBe(first);
  // the last page holds the oldest days: its photos are not the first page's, and there is nowhere further to go
  const second = await onPage2.first().getAttribute('data-photo-id');
  await goToPage(page, pages, 'Photo days');
  await expect(nav.getByRole('button', { name: 'Next page' })).toHaveAttribute('aria-disabled', 'true');
  expect(await page.locator('[data-photo-id]').count()).toBeGreaterThan(0);
  const last = await page.locator('[data-photo-id]').first().getAttribute('data-photo-id');
  expect(last).not.toBe(first);
  if (pages > 2) expect(last).not.toBe(second);
  await goToPage(page, 1, 'Photo days');
  expect(await page.locator('[data-photo-id]').first().getAttribute('data-photo-id')).toBe(first);
  c.assertClean();
});

for (const [uid, path, text] of [
  ['s5', '/today', 'Halo, Dinar'], ['s5', '/camera', 'Kamera'], ['s5', '/camera?tab=library', 'Pustaka'], ['s5', '/camera?tab=activity', 'Tambah foto'], ['s5', '/log', 'Catatan harian'], ['s9', '/photos', 'Pustaka foto'],
] as const) {
  test(`Indonesian: ${uid} ${path} shows no raw keys and no English leftovers`, async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, uid, path, 'id');
    await expect(page.locator('#main')).toContainText(text);
    const body = await page.locator('#main').innerText();
    expect(body).not.toMatch(RAW_KEY);
    expect(body).not.toMatch(/In the club|Later today|Take group photo|Save log|Photo library|Sent today|Daily log|All members/);
    await noHScroll(page);
    c.assertClean();
  });
}

test('the language switch turns the whole teacher screen Indonesian', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's5', '/log');
  await openLangMenu(page);
  if (isPhone(page)) await page.getByRole('tab', { name: 'Bahasa Indonesia' }).click();
  else await page.getByRole('button', { name: 'ID', exact: true }).click();
  if (isPhone(page)) await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { level: 1, name: 'Catatan harian' })).toBeVisible();
  const bambang = logRow(page, 'Bapak Bambang Purnomo');
  const english = /Log rounds|Mood & notes|Mark the rest|Joined|Sat out|\bmarked\b|Search members/;
  // the rounds are named in Indonesian; the first session offers Ikut / Tidak ikut
  await expect(page.getByRole('tablist', { name: 'Putaran catatan' })).toBeVisible();
  await expect(bambang.getByRole('button')).toHaveText(['Ikut', 'Tidak ikut']);
  await expect(page.getByRole('button', { name: /^Tandai sisanya/ })).toBeVisible();
  expect(await page.locator('#main').innerText()).not.toMatch(english);
  // lunch: the five amounts
  await page.getByRole('tab', { name: /^Makan siang/ }).click();
  await expect(bambang.getByRole('button')).toHaveText(['Habis', 'Sebagian besar', 'Setengah', 'Sedikit', 'Tidak makan']);
  expect(await page.locator('#main').innerText()).not.toMatch(english);
  // mood & notes: the form of one person
  await page.getByRole('tab', { name: /^Suasana hati dan catatan/ }).click();
  await bambang.getByRole('button', { name: /Bapak Bambang Purnomo/ }).click();
  for (const m of ['Ceria', 'Tenang', 'Pendiam', 'Gelisah']) await expect(page.getByRole('button', { name: m, exact: true })).toBeVisible();
  expect(await page.locator('#main').innerText()).not.toMatch(english);
  expect(await page.locator('#main').innerText()).not.toMatch(RAW_KEY);
  c.assertClean();
});

test('a closed day: Today, Camera and Daily log never crash', async ({ page, request, browser }) => {
  // the demo clock stays on Wed 21 Oct, so exercise the rules through the calendar: add a closure for today (management), then look as the teacher
  const c = watchConsole(page);
  await signIn(page, 's9', '/calendar');
  await expect(page.locator('#main')).toBeVisible();
  const r = await request.post('/api/actions/calendarEvent.create', { headers: { 'x-user-id': 's9' }, data: { mutationId: 'e2e-close-today', club: 'citra', input: { date: '2026-10-21', kind: 'closed', title: 'Water cut', titleId: 'Air mati' } } });
  expect(r.ok()).toBeTruthy();
  // drop-in club: a closed day just means nobody can be checked in (nothing to cancel)
  const blocked = await request.post('/api/actions/attendance.checkIn', { headers: { 'x-user-id': 's1' }, data: { mutationId: 'e2e-closed-checkin', club: 'citra', input: { memberId: 'm1', method: 'manual' } } });
  expect(blocked.status()).toBe(422);
  expect((await blocked.json()).code).toBe('err.closedDay');
  const { page: t, ctx: tCtx } = await otherUser(browser, 's5', '/today');
  const tc = watchConsole(t);
  await expect(t.getByText('Club closed', { exact: true })).toBeVisible();
  await expect(t.getByText(/Water cut/)).toBeVisible();
  await expect(t.getByText('Keroncong sing-along')).toHaveCount(0);
  await t.goto('/camera');
  await expect(t.getByRole('heading', { level: 1, name: 'Camera' })).toBeVisible();
  // activity pictures: today has no session, so the day on offer is the last open day, and the page does not crash
  await t.goto('/camera?tab=activity');
  await expect(t.getByRole('combobox', { name: 'Day' })).not.toContainText('Today');
  await expect(t.getByRole('combobox', { name: 'Activity' })).toBeVisible();
  await t.goto('/log');
  await expect(t.getByRole('heading', { level: 1, name: 'Daily log' })).toBeVisible();
  tc.assertClean();
  await tCtx.close();
  c.assertClean();
});
