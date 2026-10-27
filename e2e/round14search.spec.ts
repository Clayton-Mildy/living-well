// Round 14 phase E story (phone): super search. Finance finds Billing by its Indonesian keyword and opens a seeded invoice's sheet by its number;
// the lobby host finds the Add member action, which opens the flow; nobody finds a screen their role cannot open; the kitchen cannot find invoices.
// Finance reaches Billing through its `today` key (R-P1), so its Billing result goes to /today, not /billing.
import { test, expect, type Page } from '@playwright/test';
import { resetDemo, signIn, watchConsole, assertNoHorizontalScroll } from './helpers';

test.describe.configure({ timeout: 90_000 });
test.beforeEach(async ({ request }) => { await resetDemo(request); });

const stateOf = async (page: Page, userId: string) => (await (await page.request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': userId } })).json()).state;
type Inv = { id: string; number: string; voided?: boolean; deleted?: unknown };

/** Tap the search icon in the phone header and type the query. */
async function search(page: Page, q: string) {
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const overlay = page.getByRole('dialog', { name: 'Search' });
  await expect(overlay).toBeVisible();
  await overlay.getByRole('textbox', { name: 'Search' }).fill(q);
  return overlay;
}

test('phase E story: search opens Billing and an invoice for finance, an action for the lobby, and respects roles', async ({ page }) => {
  const c = watchConsole(page);
  const st = await stateOf(page, 's10');
  const inv = Object.values<Inv>(st.invoices).find((i) => !i.voided && !i.deleted && i.number)!;
  expect(inv, 'a seeded invoice').toBeTruthy();

  // 1. Finance (Fransiska): "tagihan" finds Billing (a Screens result); finance's Billing is its Today
  await signIn(page, 's10', '/today');
  let overlay = await search(page, 'tagihan');
  await expect(overlay.getByRole('group', { name: 'Screens' })).toBeVisible();
  await assertNoHorizontalScroll(page);
  await overlay.getByRole('group', { name: 'Screens' }).getByTestId('ss-row').filter({ hasText: 'Billing' }).first().click();
  await expect(overlay).toHaveCount(0);
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole('heading', { name: 'Billing' }).first()).toBeVisible();

  // 2. her invoice number finds a Records result; opening it shows the invoice sheet with that number
  overlay = await search(page, inv.number);
  const rec = overlay.getByRole('group', { name: 'Records' }).getByTestId('ss-row').filter({ hasText: inv.number }).first();
  await expect(rec).toBeVisible();
  await rec.click();
  await expect(page).toHaveURL(/\/today(\?|$)/);
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText(inv.number).first()).toBeVisible();
  await expect(page).not.toHaveURL(/inv=/); // the parameter is consumed, so Back does not reopen the sheet

  // 3. Caca (lobby): "tambah anggota" finds the Add member action; it opens the stepped flow
  await signIn(page, 's1', '/today');
  overlay = await search(page, 'tambah anggota');
  const act = overlay.getByRole('group', { name: 'Actions' }).getByTestId('ss-row').filter({ hasText: 'Add member' }).first();
  await expect(act).toBeVisible();
  await act.click();
  await expect(page).toHaveURL(/\/members$/);
  const flow = page.getByRole('dialog');
  await expect(flow).toBeVisible();
  await expect(flow.getByLabel('Full name, as on the KTP')).toBeVisible();

  // 4. the lobby has no Spending screen: searching it shows no Screens group
  await signIn(page, 's1', '/today');
  overlay = await search(page, 'Spending');
  await expect(overlay.getByRole('group', { name: 'Screens' })).toHaveCount(0);
  await expect(overlay.getByRole('group', { name: 'Records' })).toHaveCount(0);

  // 5. the kitchen cannot see invoices at all
  await signIn(page, 's3', '/today');
  overlay = await search(page, inv.number);
  await expect(overlay.getByText(`Nothing found for "${inv.number}"`)).toBeVisible();
  await expect(overlay.getByTestId('ss-row')).toHaveCount(0);
  c.assertClean();
});
