// Round 14 phase 2 story (phone): the lobby host snaps a receipt, the reader fills the items in, she corrects and sends;
// finance sees "N items", approves; the Spending screen shows the diapers' price history. The reader is simulated and picks the receipt from the photo,
// so nothing here depends on which supplier or items come back.
import { test, expect, type Page } from '@playwright/test';
import { resetDemo, signIn, watchConsole, assertNoHorizontalScroll } from './helpers';
import { takePhotoWithFile } from './kit';

test.describe.configure({ timeout: 120_000 });
test.beforeEach(async ({ request }) => { await resetDemo(request); });

const toast = (page: Page, text: string | RegExp) => expect(page.getByRole('status').filter({ hasText: text }).first()).toBeVisible();
const stateOf = async (page: Page, userId: string) => (await (await page.request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': userId } })).json()).state;
type Rc = { supplier: string; by: string; status: string; amount: number; lines?: { id: string; name: string }[] };

test('phase 2 story: snap a receipt, items read, send, finance approves, Spending shows the price of diapers', async ({ page }) => {
  const c = watchConsole(page);
  // 1. Caca at the lobby: Requests > Snap a receipt
  await signIn(page, 's1', '/requests');
  await page.getByTestId('tile-receipt').click();
  await page.getByRole('button', { name: 'Tap to take the photo' }).click();
  await takePhotoWithFile(page);
  await expect(page.getByText('Reading the receipt…')).toBeVisible();
  await expect(page.getByText('Filled in automatically: check before sending.')).toBeVisible();
  const items = page.locator('[data-line]');
  const n = await items.count();
  expect(n).toBeGreaterThanOrEqual(2);
  // 2. she removes the first item; a gap between the items and the total shows as a warning, never a block
  const first = await items.first().getByLabel('Item', { exact: true }).inputValue();
  await items.first().getByRole('button', { name: /^Remove/ }).click();
  await expect(items).toHaveCount(n - 1);
  await expect(page.getByText(/Items add up to .* short of the total/)).toBeVisible();
  await assertNoHorizontalScroll(page);
  const send = page.getByRole('button', { name: 'Send to finance' });
  await expect(send).not.toHaveAttribute('aria-disabled', 'true');
  await send.click();
  await toast(page, /Receipt sent to finance, counted against the .* budget\./);

  // what was sent: her receipt, one item fewer, waiting for finance
  const st = await stateOf(page, 's1');
  const mine = Object.values<Rc>(st.receipts).find((r) => r.by === 's1' && r.status === 'submitted')!;
  expect(mine).toBeTruthy();
  expect(mine.lines).toHaveLength(n - 1);
  expect(mine.lines!.map((l) => l.name)).not.toContain(first);

  // 3. Gabriel (finance): the receipt shows "N items"; expand it; approve
  await signIn(page, 's10', '/receipts');
  const approve = page.getByRole('button', { name: `Approve ${mine.supplier}` }).last();
  await expect(approve).toBeVisible();
  const row = page.locator('div').filter({ has: page.getByRole('button', { name: `Approve ${mine.supplier}` }) }).filter({ has: page.getByRole('button', { name: `${n - 1} items` }) }).last();
  const toggle = row.getByRole('button', { name: `${n - 1} items` });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(row.getByText(/Bought at/)).toBeVisible();
  await row.getByRole('button', { name: `Approve ${mine.supplier}` }).click();
  await toast(page, `${mine.supplier} receipt approved and sent to Xero.`);

  // 4. Spending: 6 months > Item > Popok dewasa > the purchases
  await signIn(page, 's10', '/spending');
  await expect(page.getByRole('heading', { name: 'Spending' })).toBeVisible();
  await page.getByRole('tab', { name: '6 months' }).click();
  await page.getByRole('tab', { name: 'Item', exact: true }).click();
  await page.getByTestId('sp-row').filter({ hasText: 'Popok dewasa' }).first().click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText('Purchases')).toBeVisible();
  await expect(sheet.getByTestId('sp-purchase').first()).toBeVisible();
  expect(await sheet.getByTestId('sp-purchase').count()).toBeGreaterThanOrEqual(3);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});
