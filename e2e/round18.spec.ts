// Round 18 story (phone, small seed, demo day Wed 21 Oct 2026): the Owner quick login, the Roles page, charges on a new celebration, field trips found by search,
// a PDF and a photo proof that open, notice per kind in Settings, the few-visits line, and the welcome page of a newly registered contact.
// The e2e servers use the small seed, so Ratna (the seed's welcome-page contact) is not there: test 8 registers a member through the API instead.
// Screenshots (phone, tablet, laptop): E2E_SHOTS=1 scripts/e2e-all.sh 1 "phone tablet laptop" round18 ; PNGs go to artifacts/shots/round18/.
// Isolated env: E2E_NAME=r18 E2E_PORT=8931 scripts/e2e-all.sh 1 phone round18
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { resetDemo, signIn, watchConsole, assertNoHorizontalScroll, isPhone } from './helpers';
import { pickDate, pickOption, proofFields } from './kit';

test.describe.configure({ timeout: 90_000 });
test.beforeEach(async ({ request }) => { await resetDemo(request); });

let seq = 0;
const api = (request: APIRequestContext, user: string, name: string, input: unknown) =>
  request.post(`/api/actions/${name}`, { headers: { 'x-user-id': user }, data: { mutationId: `r18-${Date.now().toString(36)}-${++seq}`, club: 'citra', input } });
const ok = async (request: APIRequestContext, user: string, name: string, input: unknown) => { const r = await api(request, user, name, input); expect(r.ok(), `${name}: ${await r.text()}`).toBeTruthy(); return (await r.json()) as { result: Record<string, unknown> }; };
const snap = async (request: APIRequestContext, user = 's9') => (await (await request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': user } })).json()).state;
const toast = (page: Page, text: string | RegExp) => expect(page.getByRole('status').filter({ hasText: text }).first()).toBeVisible();
const planCard = (page: Page, memberId: string) => page.locator(`[data-testid="plan-card"][data-member="${memberId}"]`);

/** A tiny but real PDF (the server sniffs the bytes: "%PDF-"). */
const TINY_PDF = Buffer.from('%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 100]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
/** Upload the PDF as a user (the way uploadProof does for a photo) and return the payment.record proof fields. */
async function pdfProofFields(request: APIRequestContext, userId = 's10'): Promise<{ proofMediaId: string; proofKind: 'pdf' }> {
  const r = await request.post('/api/media', { headers: { 'x-user-id': userId }, data: { mime: 'application/pdf', data: TINY_PDF.toString('base64') } });
  expect(r.ok(), `upload pdf: ${await r.text()}`).toBeTruthy();
  return { proofMediaId: ((await r.json()) as { id: string }).id, proofKind: 'pdf' };
}
/** The Search overlay on a phone. */
async function search(page: Page, q: string) {
  await page.getByTestId('search-fab').click();
  const overlay = page.getByRole('dialog', { name: 'Search' });
  await expect(overlay).toBeVisible();
  await overlay.getByRole('textbox', { name: 'Search' }).fill(q);
  return overlay;
}
/** Management books Oma Lina's birthday (Mon 26 Oct, the morning) in the New celebration sheet, up to the charges: the sheet is left open. */
async function openCelebrationSheet(page: Page) {
  await page.goto('/venue?tab=celebrations');
  await page.getByRole('button', { name: 'New celebration' }).first().click();
  const sheet = page.getByRole('dialog', { name: 'New celebration' });
  await expect(sheet).toBeVisible();
  await pickOption(page, 'Member', /Lina/);
  await pickDate(page, 'Day', '2026-10-26');
  await sheet.getByRole('button', { name: /^08:00–12:00/ }).click();
  return sheet;
}
async function addCharge(sheet: ReturnType<Page['getByRole']>, item: string, price: string) {
  await sheet.getByLabel('Item').fill(item);
  await sheet.getByLabel('Price').fill(price);
  await sheet.getByRole('button', { name: 'Add charge' }).click();
}
/** Register Oma Sri Baru with a new contact (Ratna Sari) the way the front desk would; returns the ids. The contact has not agreed to the terms. */
async function registerNewMember(request: APIRequestContext) {
  const made = await ok(request, 's9', 'members.create', {
    title: 'Oma', name: 'Sri Baru', dob: '1946-04-12', usualArrival: '10:00', plan: 'flex', start: '2026-10-22',
    contact: { name: 'Ratna Sari', phone: '+62 812 9300 1818', relation: 'daughter', primary: true },
    formMediaId: 'md_e2eregistrationform0001', formFileName: 'registration-form.jpg', consent: { data: true, face: true },
  });
  return made.result as { memberId: string; familyId: string };
}

test('Benjamin, the Owner, signs in from the quick list and lands on his home', async ({ page }) => {
  const c = watchConsole(page);
  await page.goto('/login');
  await expect(page.getByText('Demo accounts', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Benjamin/ }).click();
  await expect(page).toHaveURL(/\/today$/);
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('cp.session') || '{}') as { user?: { id: string; name: string } });
  expect(session.user?.id).toBe('s11');
  expect(session.user?.name).toMatch(/Benjamin/);
  await expect(page.locator('#main')).toBeVisible();
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('Roles: two columns on a laptop; the Front desk page folds a hidden group on a phone', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's11', '/roles');
  await expect(page.locator('[data-role-row="lobby"]')).toBeVisible();
  await page.locator('[data-role-row="lobby"]').click();
  await expect(page.locator('[data-role-page="lobby"]')).toBeVisible();
  if (isPhone(page)) {
    const hidden = page.getByRole('button', { name: /^Care · hidden/ });
    await expect(hidden).toBeVisible(); // Front desk does not see any of Care
    await assertNoHorizontalScroll(page);
    await hidden.click(); // tapping opens the group
    await expect(page.getByRole('button', { name: /^Care · hidden/ })).toHaveCount(0);
  } else if ((page.viewportSize()?.width ?? 0) >= 1200) {
    await expect(page.locator('[data-columns]')).toHaveAttribute('data-columns', '2');
    await expect(page.locator('[data-column]')).toHaveCount(2);
  } else {
    await expect(page.locator('[data-columns]')).toHaveAttribute('data-columns', '1');
  }
  c.assertClean();
});

test('Ega books Oma Lina’s party with a cake and balloons; Maria sees both under "On your next bill"', async ({ page, request }) => {
  test.skip(!isPhone(page), 'phone story');
  const c = watchConsole(page);
  await signIn(page, 's9', '/venue?tab=celebrations');
  const sheet = await openCelebrationSheet(page);
  await expect(sheet).toContainText('Charges · next monthly bill');
  await addCharge(sheet, 'Birthday cake', '350000');
  await addCharge(sheet, 'Balloons', '120000');
  await expect(sheet.getByTestId('charges-total')).toContainText('Total Rp 470.000');
  await expect(sheet.locator('[data-charge]')).toHaveCount(2);
  await assertNoHorizontalScroll(page);
  await sheet.getByRole('button', { name: 'Book it' }).click();
  await expect(page.getByRole('dialog', { name: 'New celebration' })).toHaveCount(0);
  const party = Object.values<{ memberId: string; charges?: { item: string; amount: number }[]; deletedAt?: string }>((await snap(request)).celebrations).find((x) => x.memberId === 'm1' && !x.deletedAt);
  expect(party?.charges?.map((x) => [x.item, x.amount])).toEqual([['Birthday cake', 350_000], ['Balloons', 120_000]]);

  await signIn(page, 'f1', '/billing');
  const next = page.getByTestId('next-bill').filter({ hasText: 'Lina' });
  await expect(next).toContainText('On your next bill');
  await expect(next.getByTestId('next-item').filter({ hasText: 'Birthday cake' })).toContainText('Rp 350.000');
  await expect(next.getByTestId('next-item').filter({ hasText: 'Balloons' })).toContainText('Rp 120.000');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('Search for "field trip": the New field trip action first, then the Bogor trip, which opens its day in Calendar', async ({ page, request }) => {
  test.skip(!isPhone(page), 'phone story');
  const c = watchConsole(page);
  const trip = Object.values<{ id: string; date: string; kind: string; title: string }>((await snap(request)).calendarEvents).find((e) => e.kind === 'outing' && e.title.includes('Bogor'))!;
  expect(trip, 'the seeded Bogor trip').toBeTruthy();
  await signIn(page, 's9', '/today');
  const overlay = await search(page, 'field trip');
  await expect(overlay.getByRole('group', { name: 'Actions' }).getByTestId('ss-row').first()).toContainText('New field trip');
  const row = overlay.getByRole('group', { name: 'Records' }).getByTestId('ss-row').filter({ hasText: 'Kebun Raya Bogor' }).first();
  await expect(row).toBeVisible();
  await row.click();
  await expect(overlay).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/calendar\\?date=${trip.date}`));
  await expect(page.locator('#main')).toContainText('Kebun Raya Bogor botanical garden');
  await assertNoHorizontalScroll(page);
  // the action opens the editor on Field trip
  await page.goto('/today');
  const o2 = await search(page, 'field trip');
  await o2.getByRole('group', { name: 'Actions' }).getByTestId('ss-row').first().click();
  await expect(page).toHaveURL(/\/calendar/);
  await expect(page.getByRole('dialog').last()).toBeVisible();
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('Fransiska’s payments: a PDF proof opens in a new tab (/api/media), a photo proof in the viewer', async ({ page, request }) => {
  test.skip(!isPhone(page), 'phone story');
  const c = watchConsole(page);
  await ok(request, 's10', 'payment.record', { ...(await pdfProofFields(request)), memberId: 'm1', amount: 2_700_000, method: 'cash', invoiceId: 'INV-2610-001' });
  await ok(request, 's10', 'payment.record', { ...(await proofFields(request)), memberId: 'm46', amount: 3_950_000, method: 'cash', invoiceId: 'INV-2610-046' });
  const pays = Object.values<{ memberId: string; proofKind?: string; proofMediaId?: string }>((await snap(request, 's10')).payments).filter((p) => p.proofMediaId);
  expect(pays.map((p) => [p.memberId, p.proofKind]).sort()).toEqual([['m1', 'pdf'], ['m46', 'image']]);

  await signIn(page, 's10', '/payments');
  const pdf = page.locator('[data-testid="proof-open"][data-kind="pdf"]');
  const photo = page.locator('[data-testid="proof-open"][data-kind="image"]');
  await expect(pdf).toHaveCount(1);
  await expect(pdf).toContainText('PDF');
  await expect(photo).toHaveCount(1);
  await assertNoHorizontalScroll(page);
  // headless Chromium has no PDF viewer (the new tab turns into a download), so the tab's URL is read from the window.open call as well
  await page.evaluate(() => { const w = window as unknown as { __opened: string[] }; const open = window.open.bind(window); w.__opened = []; window.open = (u, ...rest) => { w.__opened.push(String(u)); return open(u, ...rest); }; });
  const [popup] = await Promise.all([page.waitForEvent('popup'), pdf.click()]);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __opened: string[] }).__opened)).toHaveLength(1);
  const opened = await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened[0]);
  expect(new URL(opened, page.url()).pathname).toBe(`/api/media/${pays.find((p) => p.proofKind === 'pdf')!.proofMediaId}`);
  expect(new URL(opened, page.url()).pathname).toMatch(/^\/api\/media\/md_/);
  await popup.close();
  await expect(page.getByTestId('image-lightbox')).toHaveCount(0); // the PDF did not open the viewer
  await photo.click();
  const viewer = page.getByRole('dialog', { name: 'Proof of payment' });
  await expect(viewer).toBeVisible();
  await expect(viewer.getByTestId('image-lightbox-img')).toBeVisible();
  await page.getByTestId('image-lightbox-close').click();
  await expect(viewer).toHaveCount(0);
  c.assertClean();
});

test('Notice per kind: Benjamin sets leave to 30 days; Maria’s November leave is refused (deadline 2 Oct), December is accepted (1 Nov)', async ({ page, request }) => {
  test.skip(!isPhone(page), 'phone story');
  const c = watchConsole(page);
  await signIn(page, 's11', '/settings');
  for (const [kind, text] of [['downgrade', 'ask by 17 Nov'], ['stop', 'ask by 17 Nov'], ['leave', 'ask by 17 Nov']] as const) {
    await expect(page.locator(`[data-setting="${kind}"]`)).toContainText(text);
    await expect(page.locator(`[data-setting="${kind}"] input`)).toHaveValue('14');
  }
  await expect(page.locator('[data-setting="upgrade"] input')).toHaveCount(0);
  await page.locator('[data-setting="leave"] input').fill('30');
  await expect(page.locator('[data-setting="leave"]')).toContainText('December off · ask by 1 Nov'); // before saving, the live line moves
  await expect(page.locator('[data-setting="stop"] input')).toHaveValue('14');
  await assertNoHorizontalScroll(page);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await toast(page, /Saved/);
  await page.reload();
  await expect(page.locator('[data-setting="leave"] input')).toHaveValue('30');
  await expect(page.locator('[data-setting="stop"] input')).toHaveValue('14'); // the other kinds kept their days

  // November: 30 days before 1 Nov is 2 Oct, long gone on 21 Oct. The server refuses with the deadline.
  const late = await api(request, 'f1', 'membership.requestLeave', { memberId: 'm1', month: '2026-11' });
  expect(late.status()).toBe(422);
  const body = (await late.json()) as { code: string; params?: { deadline?: string } };
  expect(body.code).toBe('err.leaveLate');
  expect(body.params?.deadline).toBe('2026-10-02');
  // Maria's sheet says 30 days and offers December only, with its deadline
  await signIn(page, 'f1', '/billing');
  await planCard(page, 'm1').getByTestId('leave-ask').click();
  const sheet = page.getByRole('dialog', { name: 'Leave for Oma Lina' });
  await expect(sheet).toContainText('Ask in writing 30 days before the 1st of that month');
  await expect(sheet).not.toContainText('14 days');
  await expect(sheet.getByRole('radio', { name: /^November/ })).toHaveCount(0);
  const dec = sheet.getByRole('radio', { name: 'December · ask by Sun 1 Nov' });
  await expect(dec).toBeVisible();
  await dec.click();
  await sheet.getByRole('button', { name: 'Send', exact: true }).click();
  await toast(page, 'Leave for December asked.');
  await expect(planCard(page, 'm1').getByTestId('leave-row')).toContainText('Leave in December');
  c.assertClean();
});

test('Few visits: on 21 Oct, Settings reads "December: alert 15 Nov · changes close 17 Nov"', async ({ page }) => {
  test.skip(!isPhone(page), 'phone story');
  const c = watchConsole(page);
  await signIn(page, 's9', '/settings');
  const row = page.locator('[data-setting="days"]');
  await expect(row).toContainText('Alert before next month');
  await expect(row).toContainText('December: alert 15 Nov · changes close 17 Nov');
  await expect(row.locator('input')).toHaveValue('16');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('First login: a newly registered contact meets the welcome and terms page with the member’s name', async ({ page, request }) => {
  test.skip(!isPhone(page), 'phone story');
  const c = watchConsole(page);
  const { familyId } = await registerNewMember(request);
  await signIn(page, familyId, '/today');
  const gate = page.getByTestId('terms-gate');
  await expect(gate).toHaveAttribute('data-kind', 'first');
  await expect(gate).toContainText('Welcome, Ratna');
  await expect(gate).toContainText('Oma Sri');
  await expect(page.getByTestId('terms-scroll')).toBeVisible();
  await expect(page.getByTestId('terms-agree')).toBeDisabled();
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

// ---- screenshots (E2E_SHOTS=1): the new screens at the project's width ----
test('screenshots', async ({ page, request }, info) => {
  test.skip(!process.env.E2E_SHOTS, 'only with E2E_SHOTS=1');
  const shot = async (name: string) => { await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(500); await page.screenshot({ path: `artifacts/shots/round18/${info.project.name}-${name}.png`, fullPage: false }); };
  const phone = isPhone(page);

  // Settings
  await signIn(page, 's11', '/settings');
  await expect(page.locator('[data-setting="leave"]')).toBeVisible();
  await shot('1-settings');

  // Roles: the list, then Front desk (a phone folds Care)
  await signIn(page, 's11', '/roles');
  await expect(page.locator('[data-role-row="lobby"]')).toBeVisible();
  await page.locator('[data-role-row="lobby"]').click();
  await expect(page.locator('[data-role-page="lobby"]')).toBeVisible();
  await shot('2-roles');

  // The celebration sheet with two charges
  await signIn(page, 's9', '/venue?tab=celebrations');
  const sheet = await openCelebrationSheet(page);
  await addCharge(sheet, 'Birthday cake', '350000');
  await addCharge(sheet, 'Balloons', '120000');
  await expect(sheet.getByTestId('charges-total')).toContainText('Rp 470.000');
  await sheet.getByTestId('charge-list-editor').scrollIntoViewIfNeeded();
  await shot('3-celebration-charges');
  await page.keyboard.press('Escape');

  // Calendar with New field trip (a phone: the row above the List view; wider: the button), and the editor on Field trip
  await page.goto('/calendar');
  if (phone) await expect(page.getByTestId('new-field-trip-row')).toBeVisible(); else await expect(page.getByRole('button', { name: 'New field trip' })).toBeVisible();
  await shot('4-calendar-new-field-trip');
  await (phone ? page.getByTestId('new-field-trip-row').getByText('New field trip') : page.getByRole('button', { name: 'New field trip' })).click();
  await expect(page.getByRole('dialog').last()).toBeVisible();
  await shot('5-field-trip-editor');
  await page.keyboard.press('Escape');

  // Proofs: a PDF tile and a photo thumbnail on Payments, then the photo in the viewer
  await ok(request, 's10', 'payment.record', { ...(await pdfProofFields(request)), memberId: 'm1', amount: 2_700_000, method: 'cash', invoiceId: 'INV-2610-001' });
  await ok(request, 's10', 'payment.record', { ...(await proofFields(request)), memberId: 'm46', amount: 3_950_000, method: 'cash', invoiceId: 'INV-2610-046' });
  await signIn(page, 's10', '/payments');
  await expect(page.locator('[data-testid="proof-open"][data-kind="pdf"]')).toBeVisible();
  await expect(page.locator('[data-testid="proof-open"][data-kind="image"]')).toBeVisible();
  await shot('6-proof-thumbnails');
  await page.locator('[data-testid="proof-open"][data-kind="image"]').click();
  await expect(page.getByTestId('image-lightbox-img')).toBeVisible();
  await shot('7-proof-viewer');

  // The welcome page of a newly registered contact
  const { familyId } = await registerNewMember(request);
  await signIn(page, familyId, '/today');
  await expect(page.getByTestId('terms-gate')).toBeVisible();
  await shot('8-welcome-page');
});
