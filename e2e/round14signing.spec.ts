// Round 14 phase D story (phone): online signing of the membership form. Caca sent Oma Lina's form to Maria yesterday (seed). Maria opens Me → Documents, reads the form,
// draws her signature, types a code and signs. Ega finds it in Approvals → Signing, views the signed form and countersigns; the server then stamps the e-Meterai (a serial
// shows in the timeline on the member's Documents tab). On another member Caca takes the paper route: Physical meterai, upload the scan; management approves it
// (the front desk's upload is reviewed) and the row reads Physical meterai.
import { test, expect, type Page } from '@playwright/test';
import { resetDemo, signIn, watchConsole } from './helpers';
import { TINY_PNG } from './kit';

test.describe.configure({ timeout: 120_000 });
test.beforeEach(async ({ request }) => { await resetDemo(request); });

/** Draw one stroke across the signature pad. */
async function draw(page: Page, pad: ReturnType<Page['locator']>) {
  await pad.scrollIntoViewIfNeeded();
  const box = (await pad.boundingBox())!;
  const x = box.x + box.width * 0.2, y = box.y + box.height * 0.6;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + box.width * 0.2, y - box.height * 0.3, { steps: 6 });
  await page.mouse.move(x + box.width * 0.4, y + box.height * 0.1, { steps: 6 });
  await page.mouse.move(x + box.width * 0.55, y - box.height * 0.2, { steps: 6 });
  await page.mouse.up();
}

test('phase D story: the family signs, management countersigns, the e-Meterai is stamped; the front desk takes the physical route', async ({ page }) => {
  const c = watchConsole(page);

  // 1. Maria: Me shows one form to sign; the row opens Oma Lina's Documents with the sign sheet
  await signIn(page, 'f1', '/me');
  const row = page.getByTestId('me-docs');
  await expect(row).toContainText('Documents');
  await expect(row).toContainText('1 to sign');
  await row.click();
  const sheet = page.getByTestId('sign-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('Read and sign').first()).toBeVisible();

  // Read: the box stays off until the form has been opened
  const read = sheet.getByTestId('sign-read');
  await expect(read).toBeDisabled();
  await sheet.getByRole('button', { name: 'Read the form' }).click();
  const form = page.getByTestId('application-form');
  await expect(form).toBeVisible();
  await form.getByRole('button', { name: 'Close' }).first().click();
  await expect(form).toHaveCount(0);
  await expect(read).toBeEnabled();
  await read.click();
  await expect(read).toHaveAttribute('aria-checked', 'true');

  // Sign stays off until the pad has ink and the code has six digits
  const go = sheet.getByTestId('sign-go');
  await expect(go).toBeDisabled();
  await draw(page, sheet.locator('canvas'));
  await sheet.getByTestId('sign-code').fill('123456');
  await expect(go).toBeEnabled();
  await go.click();
  await expect(sheet.getByTestId('sign-done')).toContainText('Signed. The club will countersign it.');
  await sheet.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByTestId('pf-doc').filter({ hasText: 'Signed by family' })).toBeVisible();

  // 2. Ega: Approvals → Signing; View shows the signature on the form; Countersign
  await signIn(page, 's9', '/reviews?tab=signing');
  const ep = page;
  const item = ep.locator('[data-approval="m1"][data-type="signing"]');
  await expect(item).toBeVisible();
  await expect(item).toContainText('Oma Lina');
  await item.getByRole('button', { name: 'View' }).click();
  const signed = ep.getByTestId('application-form');
  await expect(signed).toBeVisible();
  await expect(signed.locator('img.cp-fsig').first()).toBeVisible();
  await signed.getByRole('button', { name: 'Close' }).first().click();
  await item.getByRole('button', { name: 'Countersign' }).click();
  await expect(item).toHaveCount(0);

  // 3. back on Oma Lina's Documents: the server stamps it (a moment later) and the timeline carries the e-Meterai serial
  await ep.goto('/members/m1/docs');
  const badge = ep.getByTestId('sign-badge');
  await expect(badge).toHaveAccessibleName(/^Stamped/, { timeout: 20_000 });
  await expect(ep.getByText(/e-Meterai · Serial \S+/)).toBeVisible();
  await badge.click();
  const trail = ep.getByTestId('sign-trail');
  await expect(trail.locator('li')).toHaveCount(5);
  await expect(trail).toContainText('Signed by family');
  await expect(trail).toContainText('Countersigned');
  await expect(ep.getByRole('button', { name: 'View signed form' })).toBeVisible();

  // 4. Caca, another member: Physical meterai opens the print view, then the signed scan is uploaded; management approves the front desk's upload
  await signIn(page, 's1', '/members/m46/docs');
  const cp = page;
  await expect(cp.getByTestId('sign-badge')).toHaveCount(0);
  await cp.getByRole('button', { name: 'Physical meterai', exact: true }).click();
  const print = cp.getByTestId('application-form');
  await expect(print).toBeVisible();
  await print.getByRole('button', { name: 'Close' }).first().click();
  const scan = cp.getByTestId('physical-scan');
  await expect(scan).toBeVisible();
  await scan.getByTestId('doc-file').setInputFiles({ name: 'form-meterai.png', mimeType: 'image/png', buffer: TINY_PNG });
  await expect(cp.getByRole('group', { name: 'Pending review' })).toContainText(/form-meterai\.\w+/);
  await signIn(page, 's9', '/reviews');
  const card = page.locator('[data-cr]').filter({ hasText: 'Budi' });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Approve' }).click();
  await expect(card).toHaveCount(0);
  await signIn(page, 's1', '/members/m46/docs');
  await expect(cp.getByTestId('sign-badge')).toHaveAccessibleName(/^Stamped · Physical meterai/);
  await expect(cp.getByRole('button', { name: 'Physical meterai', exact: true })).toHaveCount(0); // a stamped form is closed to a second send
  c.assertClean();
});
