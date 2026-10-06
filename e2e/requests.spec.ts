// Requests (section staff): stock request, budget request, snap a receipt, "My requests" with edit and cancel while pending.
// Isolated env: pnpm e2e:env kitchen 8806 5206 ; E2E_BASE_URL=http://localhost:5206 pnpm exec playwright test e2e/requests.spec.ts
import { test, expect, type Browser, type Page, type TestInfo } from '@playwright/test';
import { resetDemo, signIn, watchConsole, isPhone, assertNoHorizontalScroll } from './helpers';
import { goToPage } from './kit';

test.describe.configure({ timeout: 90_000 }); // other areas' suites share this machine
test.beforeEach(async ({ request }) => { await resetDemo(request); });

async function another(browser: Browser, info: TestInfo, userId: string, path: string, lang: 'en' | 'id' = 'en') {
  const u = info.project.use;
  const ctx = await browser.newContext({ baseURL: u.baseURL as string, viewport: u.viewport ?? undefined, isMobile: u.isMobile, hasTouch: u.hasTouch, userAgent: u.userAgent, deviceScaleFactor: u.deviceScaleFactor });
  const page = await ctx.newPage();
  await signIn(page, userId, path, lang);
  return { page, close: () => ctx.close() };
}
const act = (page: Page, userId: string, name: string, input: unknown) =>
  page.request.post('/api/actions/' + name, { headers: { 'x-user-id': userId }, data: { mutationId: 'e2e-' + Math.random().toString(36).slice(2), club: 'citra', input } });
const stateOf = async (page: Page, userId: string) => (await (await page.request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': userId } })).json()).state;
const toast = (page: Page) => page.getByRole('status');
const mine = (page: Page) => page.getByTestId('my-request');
/** The language toggle: sidebar EN/ID on tablet and laptop, the account sheet on phones. */
async function toggleToId(page: Page) {
  if (isPhone(page)) {
    await page.getByRole('button', { name: 'Account' }).click();
    await page.getByRole('tab', { name: 'Bahasa Indonesia' }).click();
    await page.keyboard.press('Escape');
  } else await page.getByRole('button', { name: 'ID', exact: true }).click();
}
/** The finance actions are owned by the finance area: skip with a clear reason while a tile is still disabled. */
async function needsTile(page: Page, id: 'budget' | 'receipt') {
  const disabled = await page.getByTestId(`tile-${id}`).getAttribute('aria-disabled');
  test.skip(disabled === 'true', `the ${id === 'budget' ? 'budget.request' : 'receipt.add'} action is not registered yet (finance area)`);
}

test.describe('requests screen', () => {
  test('the nurse sees the three parts and what she already sent', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's8', '/requests');
    await expect(page.getByRole('heading', { name: 'Requests' })).toBeVisible();
    await expect(page.getByTestId('tile-stock')).toContainText('Stock request');
    await expect(page.getByTestId('tile-budget')).toContainText('Budget request');
    await expect(page.getByTestId('tile-receipt')).toContainText('Snap a receipt (nota)');
    await expect(page.getByText('My requests')).toBeVisible();
    // her seeded requests: glucose strips (waiting) and the pharmacy receipt (already approved)
    await expect(mine(page)).toHaveCount(2);
    await expect(mine(page).filter({ hasText: 'Test strips (glucose) · 2 boxes' })).toContainText('Requested');
    await expect(mine(page).filter({ hasText: 'Apotek Sehat Selalu · Rp 410.000' })).toContainText('Approved');
    await expect(page.getByText('1 waiting')).toBeVisible();
    await assertNoHorizontalScroll(page);
    c.assertClean();
  });

  test('My requests is paged: eight to a page, the open ones first', async ({ page }) => {
    const c = watchConsole(page);
    for (let i = 1; i <= 9; i++) expect((await act(page, 's8', 'stock.request', { item: `Gloves ${i}`, qty: i, unit: 'boxes', area: 'health', sectionId: 'operations' })).ok()).toBeTruthy();
    await signIn(page, 's8', '/requests');
    await expect(mine(page)).toHaveCount(8); // 11 requests in all
    await expect(page.getByRole('navigation', { name: 'My requests' })).toBeVisible();
    await goToPage(page, 2, 'My requests');
    await expect(mine(page)).toHaveCount(3);
    await expect(mine(page).filter({ hasText: 'Apotek Sehat Selalu' })).toContainText('Approved'); // approved ones come after the open ones
    await assertNoHorizontalScroll(page);
    c.assertClean();
  });

  test('request test strips, edit the quantity, then cancel while pending', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's8', '/requests');
    await page.getByTestId('tile-stock').click();
    await expect(page.getByText('New request')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Health', exact: true })).toHaveAttribute('aria-pressed', 'true'); // the nurse's own section
    await page.getByLabel('Item', { exact: true }).fill('Glucose test strips');
    await page.getByLabel('Quantity').fill('3');
    await page.getByRole('button', { name: 'boxes', exact: true }).click();
    await page.getByRole('button', { name: 'Send request' }).click();
    await expect(toast(page)).toContainText('Request sent for approval');
    await expect(page.getByText('New request')).toHaveCount(0); // the panel closes
    const row = mine(page).filter({ hasText: 'Glucose test strips' });
    await expect(row).toContainText('Glucose test strips · 3 boxes');
    await expect(row).toContainText('Requested');
    await expect(row).toContainText('Stock · Health');
    // edit while pending
    await row.getByRole('button', { name: 'Edit' }).click();
    const dlg = page.getByRole('dialog', { name: 'Edit request' });
    await dlg.getByLabel('Quantity').fill('4');
    await dlg.getByRole('button', { name: 'Save changes' }).click();
    await expect(row).toContainText('Glucose test strips · 4 boxes');
    // cancel: kept, as Cancelled, and no longer editable
    await row.getByRole('button', { name: 'Cancel request' }).click();
    await page.getByRole('dialog', { name: 'Cancel this request?' }).getByRole('button', { name: 'Cancel request' }).click();
    await expect(toast(page)).toContainText('Request cancelled');
    await expect(row).toContainText('Cancelled');
    await expect(row.getByRole('button', { name: 'Edit' })).toHaveCount(0);
    await expect(row.getByRole('button', { name: 'Cancel request' })).toHaveCount(0);
    const k = Object.values<{ item: string; status: string; requestedBy: string }>((await stateOf(page, 's8')).stockRequests).find((x) => x.item === 'Glucose test strips')!;
    expect(k).toMatchObject({ status: 'cancelled', requestedBy: 's8' });
    await assertNoHorizontalScroll(page);
    c.assertClean();
  });

  test('management approves; the nurse is told, sees the new status and marks it received', async ({ page, browser }, info) => {
    await signIn(page, 's8', '/requests');
    await page.getByTestId('tile-stock').click();
    await page.getByLabel('Item', { exact: true }).fill('Alcohol swabs');
    await page.getByLabel('Quantity').fill('10');
    await page.getByRole('button', { name: 'packs', exact: true }).click();
    await page.getByRole('button', { name: 'Send request' }).click();
    await expect(toast(page)).toContainText('Request sent for approval');
    const boss = await another(browser, info, 's9', '/stock');
    const b = boss.page.getByTestId('stock-row').filter({ hasText: 'Alcohol swabs' });
    await expect(b).toContainText('Ns. Dewi');
    await b.getByRole('button', { name: 'Approve' }).click();
    await expect(b).toHaveAttribute('data-status', 'approved');
    await boss.close();
    // the nurse: an update, the new status, and Mark received (her own request)
    await page.reload();
    const row = mine(page).filter({ hasText: 'Alcohol swabs' });
    await expect(row).toContainText('Approved · to order');
    await page.getByRole('button', { name: /Notifications/ }).first().click();
    const panel = page.getByRole('dialog', { name: 'Notifications' });
    await panel.getByRole('tab', { name: /Updates/ }).click();
    await expect(panel.getByText('Your stock request was approved: Alcohol swabs (10 packs).')).toBeVisible();
    await page.keyboard.press('Escape');
    await row.getByRole('button', { name: 'Mark received' }).click();
    await expect(row).toContainText('Received');
    await expect.poll(async () => Object.values<{ item: string; status: string; receivedBy?: string }>((await stateOf(page, 's8')).stockRequests).find((x) => x.item === 'Alcohol swabs')).toMatchObject({ status: 'received', receivedBy: 'staff:s8' });
  });

  test('a declined request keeps its reason in My requests', async ({ page }) => {
    // finance declines through the action (the Stock screen is not in finance's menu)
    expect((await act(page, 's10', 'stock.reject', { id: 'k1', note: 'We still have four boxes.' })).ok()).toBeTruthy();
    await signIn(page, 's8', '/requests');
    const row = mine(page).filter({ hasText: 'Test strips (glucose)' });
    await expect(row).toContainText('Declined');
    await expect(row).toContainText('We still have four boxes.');
    await expect(row.getByRole('button', { name: 'Edit' })).toHaveCount(0); // decided: nothing left to edit
  });

  test('budget request: sections come from the data; send, edit and cancel', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's5', '/requests');
    await needsTile(page, 'budget');
    await page.getByTestId('tile-budget').click();
    await expect(page.getByText('Request from a section')).toBeVisible();
    // chips are the budget sections in the data (design: F&B, Activities, Operations)
    for (const name of ['F&B', 'Activities', 'Operations']) await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Activities', exact: true })).toHaveAttribute('aria-pressed', 'true'); // the teacher's section
    await page.getByLabel('Item', { exact: true }).fill('Angklung strings');
    await page.getByLabel('Amount', { exact: true }).fill('120000');
    await expect(page.getByLabel('Amount', { exact: true })).toHaveValue('120.000');
    await page.getByRole('button', { name: 'Send request' }).click();
    await expect(toast(page)).toContainText('Request sent to finance');
    const row = mine(page).filter({ hasText: 'Angklung strings' });
    await expect(row).toContainText('Angklung strings · Rp 120.000');
    await expect(row).toContainText('Waiting');
    const st = await stateOf(page, 's5');
    expect(Object.values<{ item: string; status: string; requestedBy: string; sectionId: string; amount: number }>(st.budgetRequests).find((b) => b.item === 'Angklung strings')).toMatchObject({ status: 'pending', requestedBy: 's5', sectionId: 'activities', amount: 120000 });
    await row.getByRole('button', { name: 'Edit' }).click();
    const dlg = page.getByRole('dialog', { name: 'Edit budget request' });
    await dlg.getByLabel('Amount').fill('150000');
    await dlg.getByRole('button', { name: 'Save changes' }).click();
    await expect(row).toContainText('Angklung strings · Rp 150.000');
    await row.getByRole('button', { name: 'Cancel request' }).click();
    await page.getByRole('dialog', { name: 'Cancel this request?' }).getByRole('button', { name: 'Cancel request' }).click();
    await expect(row).toContainText('Cancelled');
    await assertNoHorizontalScroll(page);
    c.assertClean();
  });

  test('a budget request reaches finance as something to approve', async ({ page, browser }, info) => {
    await signIn(page, 's5', '/requests');
    await needsTile(page, 'budget');
    await page.getByTestId('tile-budget').click();
    await page.getByLabel('Item', { exact: true }).fill('Keroncong ukulele');
    await page.getByLabel('Amount', { exact: true }).fill('300000');
    await page.getByRole('button', { name: 'Send request' }).click();
    await expect(toast(page)).toContainText('Request sent to finance');
    const fin = await another(browser, info, 's10', '/today');
    await fin.page.getByRole('button', { name: /Notifications/ }).first().click();
    const panel = fin.page.getByRole('dialog', { name: 'Notifications' });
    await expect(panel.getByText('Budget request to approve: Keroncong ukulele')).toBeVisible();
    await fin.close();
  });

  test('snap a receipt: simulated photo, supplier from the directory, amount, section', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's8', '/requests');
    await needsTile(page, 'receipt');
    await page.getByTestId('tile-receipt').click();
    await expect(page.getByTestId('snap-photo')).toBeVisible();
    // the send button waits for the photo, a supplier and an amount
    await page.getByTestId('snap-photo').click();
    await expect(page.getByText('nota_2110.jpg')).toBeVisible(); // 21 Oct: nota_<day><month>.jpg
    // suppliers are the directory's suppliers; free text works too
    for (const name of ['Sayur Segar Kemang', 'Ikan Laut Jaya', 'Bersih Prima']) await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Bersih Prima', exact: true }).click();
    await expect(page.getByLabel('Supplier', { exact: true })).toHaveValue('Bersih Prima');
    await page.getByLabel('Amount (Rp)').fill('85000');
    await expect(page.getByLabel('Amount (Rp)')).toHaveValue('85.000');
    await expect(page.getByRole('button', { name: 'Operations', exact: true })).toHaveAttribute('aria-pressed', 'true'); // the nurse's section
    await page.getByRole('button', { name: 'Send to finance' }).click();
    await expect(toast(page)).toContainText('Receipt sent to finance, counted against the Operations budget.');
    const row = mine(page).filter({ hasText: 'Bersih Prima' });
    await expect(row).toContainText('Bersih Prima · Rp 85.000');
    await expect(row).toContainText('With finance');
    const st = await stateOf(page, 's8');
    const rc = Object.values<{ supplier: string; directoryId?: string; fileName: string; status: string; by: string; sectionId: string; amount: number }>(st.receipts).find((r) => r.supplier === 'Bersih Prima' && r.by === 's8')!;
    expect(rc).toMatchObject({ directoryId: 'd9', fileName: 'nota_2110.jpg', status: 'submitted', sectionId: 'operations', amount: 85000 });
    // cancel (void) while it is with finance
    await row.getByRole('button', { name: 'Cancel request' }).click();
    await page.getByRole('dialog', { name: 'Cancel this request?' }).getByRole('button', { name: 'Cancel request' }).click();
    await expect(row).toContainText('Cancelled');
    await assertNoHorizontalScroll(page);
    c.assertClean();
  });

  test('a receipt from a supplier that is not in the directory keeps the typed name', async ({ page }) => {
    await signIn(page, 's3', '/requests');
    await needsTile(page, 'receipt');
    await page.getByTestId('tile-receipt').click();
    await page.getByTestId('snap-photo').click();
    await page.getByLabel('Supplier', { exact: true }).fill('Toko Maju Jaya');
    await page.getByLabel('Amount (Rp)').fill('45000');
    await expect(page.getByRole('button', { name: 'F&B', exact: true })).toHaveAttribute('aria-pressed', 'true'); // the kitchen's section
    await page.getByRole('button', { name: 'Send to finance' }).click();
    await expect(toast(page)).toContainText('counted against the F&B budget');
    const st = await stateOf(page, 's3');
    const rc = Object.values<{ supplier: string; directoryId?: string }>(st.receipts).find((r) => r.supplier === 'Toko Maju Jaya')!;
    expect(rc.directoryId).toBeUndefined();
  });

  test('a rejected receipt can be fixed and sent again by whoever snapped it', async ({ page }) => {
    await signIn(page, 's8', '/requests');
    await needsTile(page, 'receipt');
    await page.getByTestId('tile-receipt').click();
    await page.getByTestId('snap-photo').click();
    await page.getByLabel('Supplier', { exact: true }).fill('Toko Obat Sentosa');
    await page.getByLabel('Amount (Rp)').fill('50000');
    await page.getByRole('button', { name: 'Send to finance' }).click();
    await expect(toast(page)).toContainText('Receipt sent to finance');
    const find = async () => Object.values<{ id: string; supplier: string; by: string }>((await stateOf(page, 's8')).receipts).find((r) => r.supplier === 'Toko Obat Sentosa' && r.by === 's8')?.id;
    await expect.poll(find).toBeTruthy(); // the server has it
    const id = (await find())!;
    expect((await act(page, 's10', 'receipt.reject', { id, note: 'The nota is unreadable.' })).ok()).toBeTruthy();
    await page.reload();
    const row = mine(page).filter({ hasText: 'Toko Obat Sentosa' });
    await expect(row).toContainText('Rejected');
    await expect(row).toContainText('The nota is unreadable.');
    await row.getByRole('button', { name: 'Fix and resend' }).click();
    const dlg = page.getByRole('dialog', { name: 'Edit receipt' });
    await dlg.getByLabel('Amount (Rp)').fill('55000');
    await dlg.getByRole('button', { name: 'Save changes' }).click();
    await expect(row).toContainText('With finance');
    await expect(row).toContainText('Rp 55.000');
  });
});

test.describe('who gets the screen', () => {
  for (const [id, label] of [['s5', 'activity teacher'], ['s3', 'kitchen'], ['s8', 'nurse']] as const) {
    test(`${label} has Requests in the menu`, async ({ page }) => {
      await signIn(page, id);
      const direct = page.locator('[data-nav-key="requests"]').first();
      if (await direct.isVisible()) await direct.click();
      else { // phones keep four tabs and "More": Requests sits behind it for the teacher
        await page.locator('[data-nav-key="more"]').first().click();
        await page.getByRole('dialog', { name: 'All modules' }).locator('[data-nav-key="requests"]').click();
      }
      await expect(page).toHaveURL(/\/requests$/);
      await expect(page.getByRole('heading', { name: 'Requests' })).toBeVisible();
    });
  }
  test('housekeeping and driver get Requests as their home once app access is on', async ({ page }) => {
    await signIn(page, 's9', '/today');
    for (const staffId of ['s4', 's7']) {
      const r = await act(page, 's9', 'staff.setAppAccess', { staffId, on: true });
      test.skip(!r.ok() && (await r.json()).code === 'err.unknownAction', 'staff.setAppAccess is not registered yet (people area)');
      expect(r.ok()).toBeTruthy();
    }
    for (const id of ['s4', 's7']) {
      await signIn(page, id, '/today');
      await expect(page).toHaveURL(/\/today$/);
      await expect(page.getByRole('heading', { name: 'Requests' })).toBeVisible();
      await expect(page.getByTestId('tile-stock')).toBeVisible();
    }
    // a housekeeping request goes to approvers, the same as everyone's
    await signIn(page, 's4', '/today');
    await page.getByTestId('tile-stock').click();
    await expect(page.getByRole('button', { name: 'Housekeeping', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByLabel('Item', { exact: true }).fill('Floor cleaner');
    await page.getByLabel('Quantity').fill('2');
    await page.getByRole('button', { name: 'litres', exact: true }).click();
    await page.getByRole('button', { name: 'Send request' }).click();
    await expect(toast(page)).toContainText('Request sent for approval');
    await expect(mine(page).filter({ hasText: 'Floor cleaner' })).toContainText('Requested');
  });
  test('finance and management requests wait for approval like everyone else\'s', async ({ page }) => {
    for (const id of ['s9', 's10']) {
      const r = await act(page, id, 'stock.request', { item: `Paper ${id}`, qty: 1, unit: 'packs', area: 'housekeeping', sectionId: 'operations' });
      expect(r.ok()).toBeTruthy();
    }
    const st = await stateOf(page, 's9');
    const rows = Object.values<{ item: string; status: string }>(st.stockRequests).filter((k) => k.item.startsWith('Paper '));
    expect(rows).toHaveLength(2);
    expect(rows.every((k) => k.status === 'requested')).toBe(true);
  });
});

test.describe('layout and language', () => {
  test('the ID toggle switches the Requests screen, its forms and its list to Indonesian', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's8', '/requests');
    await expect(page.getByRole('heading', { name: 'Requests' })).toBeVisible();
    await toggleToId(page);
    await expect(page.getByRole('heading', { name: 'Permintaan', exact: true })).toBeVisible();
    await expect(page.getByText('Permintaan saya')).toBeVisible();
    await expect(mine(page).filter({ hasText: 'Test strips (glucose) · 2 dus' })).toContainText('Diminta'); // the unit and the status are translated, the item name is data
    await page.getByTestId('tile-stock').click();
    await expect(page.getByRole('button', { name: 'Kirim permintaan' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Kesehatan', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(await page.locator('#main').innerText()).not.toMatch(/\b(requests|kitchen|common|status|err)\.[a-zA-Z_]+/);
    await assertNoHorizontalScroll(page);
    c.assertClean();
  });

  test('the Requests screen fits every viewport, in English and Indonesian, with no raw keys', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's8', '/requests', 'id');
    await expect(page.getByRole('heading', { name: 'Permintaan' })).toBeVisible();
    await expect(page.getByTestId('tile-stock')).toContainText('Permintaan stok');
    await expect(page.getByTestId('tile-budget')).toContainText('Permintaan anggaran');
    await expect(page.getByTestId('tile-receipt')).toContainText('Foto kuitansi (nota)');
    for (const id of ['stock', 'budget', 'receipt'] as const) {
      if ((await page.getByTestId(`tile-${id}`).getAttribute('aria-disabled')) === 'true') continue;
      await page.getByTestId(`tile-${id}`).click();
      const body = await page.locator('#main').innerText();
      expect(body).not.toMatch(/\b(requests|kitchen|common|status)\.[a-zA-Z_]+/);
      await assertNoHorizontalScroll(page);
    }
    expect(await page.locator('#main').innerText()).not.toMatch(/\b(requests|kitchen|common|status)\.[a-zA-Z_]+/);
    // English too
    await signIn(page, 's8', '/requests', 'en');
    await expect(page.getByRole('heading', { name: 'Requests' })).toBeVisible();
    if (isPhone(page)) await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    await assertNoHorizontalScroll(page);
    c.assertClean();
  });
});
