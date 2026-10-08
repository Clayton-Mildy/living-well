// The UI kit (components/ui) in a real browser, through the finance screens: Select, DateField, Pager and CameraCapture's file fallback.
// Runs at phone and laptop: a popover floats under its field on the laptop and becomes a bottom sheet on the phone.
import { test, expect as baseExpect, type Locator, type Page } from '@playwright/test';
import { resetDemo, signIn, watchConsole, assertNoHorizontalScroll, isPhone } from './helpers';
import { calendarDay, fieldText, goToPage, pickDate, pickOption, takePhotoWithFile, TINY_PNG } from './kit';

const expect = baseExpect.configure({ timeout: 15_000 });
test.beforeEach(async ({ request }) => { test.setTimeout(90_000); await resetDemo(request); });

const toast = (page: Page, text: string | RegExp) => expect(page.getByRole('status').filter({ hasText: text }).first()).toBeVisible();
const post = (page: Page, userId: string, name: string, input: unknown) =>
  page.request.post(`/api/actions/${name}`, { headers: { 'x-user-id': userId }, data: { mutationId: `e2e-${Date.now()}-${Math.random()}`, club: 'citra', input } });
/** The element sits fully inside the visible screen (a sheet slides up, so wait for it to settle). */
async function inScreen(page: Page, loc: Locator) {
  const vp = page.viewportSize()!;
  let b: { x: number; y: number; width: number; height: number } | null = null;
  await expect(async () => {
    b = await loc.boundingBox();
    expect(b, 'element has a box').toBeTruthy();
    expect(b!.x).toBeGreaterThanOrEqual(-1);
    expect(b!.y).toBeGreaterThanOrEqual(-1);
    expect(b!.x + b!.width).toBeLessThanOrEqual(vp.width + 1);
    expect(b!.y + b!.height).toBeLessThanOrEqual(vp.height + 1);
  }).toPass();
  return b!;
}

test.describe('Select', () => {
  test('a labelled combobox: mouse, keyboard and search choose; Escape closes; the choice is used', async ({ page }) => {
    const c = watchConsole(page);
    for (const name of ['Transport', 'Laundry', 'Garden', 'Security', 'IT', 'Events']) {
      expect((await post(page, 's10', 'budget.addSection', { name, weekly: 500_000 })).ok()).toBeTruthy();
    }
    await signIn(page, 's10', '/budget'); // 3 sections + 6 new = 9, which is long enough for a search box
    const box = page.getByRole('combobox', { name: 'Section' });
    await expect(box).toBeVisible();
    await expect(box).toHaveAttribute('aria-expanded', 'false');
    await expect(box).toContainText('F&B');
    await expect(page.getByLabel('Section', { exact: true })).toBeVisible(); // the label is tied to the control
    await assertNoHorizontalScroll(page);

    // open: a listbox of options, the chosen one marked; a floating list under the field, or a bottom sheet on the phone
    await box.click();
    await expect(box).toHaveAttribute('aria-expanded', 'true');
    const options = page.getByRole('option');
    await expect(options).toHaveCount(9);
    await expect(page.getByRole('option', { name: 'F&B', exact: true })).toHaveAttribute('aria-selected', 'true');
    if (isPhone(page)) {
      const sheet = page.getByRole('dialog', { name: 'Section' });
      await expect(sheet).toBeVisible();
      const b = await inScreen(page, sheet);
      expect(b.y + b.height).toBeGreaterThan(page.viewportSize()!.height - 2); // docked to the bottom edge
    } else {
      const list = await inScreen(page, page.getByRole('listbox', { name: 'Section' }));
      const field = (await box.boundingBox())!;
      expect(Math.abs(list.x - field.x)).toBeLessThan(2); // lined up with the field
      // right under the field, or right above it when the screen has no room below
      expect(list.y >= field.y + field.height - 1 || list.y + list.height <= field.y + 8).toBe(true);
    }

    // search: type to narrow, Enter takes the highlighted option
    const search = page.getByRole('searchbox', { name: 'Search' });
    await expect(search).toBeFocused();
    await search.fill('gar');
    await expect(options).toHaveCount(1);
    await search.fill('zzz');
    await expect(page.getByText('No matches')).toBeVisible();
    await search.fill('gard');
    await page.keyboard.press('Enter');
    await expect(options).toHaveCount(0);
    await expect(box).toContainText('Garden');
    await expect(box).toBeFocused(); // focus comes back to the field

    // Escape closes without choosing
    await box.click();
    await page.getByRole('option', { name: 'Events', exact: true }).hover();
    await page.keyboard.press('Escape');
    await expect(options).toHaveCount(0);
    await expect(box).toContainText('Garden');
    await expect(box).toBeFocused();

    // keyboard: ArrowDown opens, Home / ArrowDown / Enter pick the second option
    await box.press('ArrowDown');
    await expect(options).toHaveCount(9);
    const second = (await options.nth(1).innerText()).split('\n')[0].trim();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(box).toContainText(second);

    // mouse, then use the choice: the request lands in that section's card
    await pickOption(page, 'Section', 'Garden');
    await page.getByLabel('Item', { exact: true }).fill('Weeding tools');
    await page.getByLabel('Amount', { exact: true }).fill('120000');
    await page.getByRole('button', { name: 'Send request' }).click();
    await toast(page, 'Request added. Approve it from the section card.');
    const garden = page.locator('div').filter({ has: page.getByText('Weeding tools · Rp 120.000') }).filter({ hasText: 'Garden' }).last();
    await expect(garden).toBeVisible();
    c.assertClean();
  });

  test('inside a dialog: Escape closes only the list, not the dialog; a click outside the list does not reach the dialog', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's10', '/receipts');
    await page.getByRole('button', { name: 'Add vendor invoice' }).click();
    const dlg = page.getByRole('dialog', { name: 'Add vendor invoice' });
    const box = dlg.getByRole('combobox', { name: 'Section' });
    await box.click();
    await expect(page.getByRole('option').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('option')).toHaveCount(0);
    await expect(dlg).toBeVisible();
    await box.click();
    await page.getByRole('option', { name: 'Operations', exact: true }).click();
    await expect(box).toContainText('Operations');
    await expect(dlg).toBeVisible();
    await page.keyboard.press('Escape'); // now the dialog itself closes
    await expect(dlg).toBeHidden();
    c.assertClean();
  });
});

test.describe('DateField', () => {
  test('a calendar popover: today marked, future days off, month arrows, keyboard, Today button, Escape', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's10', '/receipts');
    await page.getByRole('button', { name: 'Snap a receipt (nota)' }).first().click();
    const trigger = fieldText(page, 'Date');
    await expect(trigger).toContainText('Wed 21 Oct 2026');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const grid = page.getByRole('grid', { name: 'October 2026' });
    await expect(grid).toBeVisible();
    await expect(calendarDay(page, '2026-10-21')).toHaveAttribute('aria-current', 'date');
    await expect(calendarDay(page, '2026-10-21')).toHaveAttribute('aria-label', 'Wednesday 21 October 2026');
    await expect(calendarDay(page, '2026-10-22')).toHaveAttribute('aria-disabled', 'true'); // a receipt cannot be from the future
    await expect(page.getByRole('columnheader')).toHaveCount(7);
    await expect(page.getByRole('columnheader').first()).toHaveAttribute('aria-label', 'Monday'); // the week starts on Monday
    await expect(page.getByRole('button', { name: 'Next month' })).toHaveAttribute('aria-disabled', 'true'); // nothing after today to go to
    // the popover fits the screen; a sheet on the phone, under the field on the laptop
    await inScreen(page, page.getByRole('dialog', { name: 'Date' }));
    await assertNoHorizontalScroll(page);

    await calendarDay(page, '2026-10-22').click({ force: true }); // ignored: still open, nothing changed
    await expect(grid).toBeVisible();
    await expect(trigger).toContainText('Wed 21 Oct 2026');
    await page.getByRole('button', { name: 'Previous month' }).click();
    await expect(page.getByRole('grid', { name: 'September 2026' })).toBeVisible();
    await calendarDay(page, '2026-09-30').click();
    await expect(grid).toBeHidden();
    await expect(trigger).toContainText(/Wed 30 Sep(t)? 2026/);
    await expect(trigger).toBeFocused();

    // keyboard: Enter opens on the chosen day, arrows move, Enter chooses
    await page.keyboard.press('Enter');
    await expect(calendarDay(page, '2026-09-30')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(calendarDay(page, '2026-09-29')).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(calendarDay(page, '2026-09-22')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(trigger).toContainText(/Tue 29 Sep(t)? 2026/);

    // Escape closes without changing it; Today picks the demo clock's day
    await trigger.click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('grid')).toBeHidden();
    await expect(trigger).toContainText(/Tue 29 Sep(t)? 2026/);
    await trigger.click();
    await page.getByRole('button', { name: 'Today', exact: true }).click();
    await expect(trigger).toContainText('Wed 21 Oct 2026');
    c.assertClean();
  });

  test('far dates through the month and year pickers; a jump to a week on the budget page', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's10', '/receipts');
    await page.getByRole('button', { name: 'Add vendor invoice' }).click();
    await expect(fieldText(page, 'Due date')).toContainText('Choose a date');
    await pickDate(page, 'Due date', '2024-03-09'); // two and a half years back: month picker, year picker, month, day
    await expect(fieldText(page, 'Due date')).toContainText('Sat 9 Mar 2024');
    await pickDate(page, 'Due date', '2026-12-31'); // and forward again (a vendor invoice can fall due later)
    await expect(fieldText(page, 'Due date')).toContainText('Thu 31 Dec 2026');
    await page.keyboard.press('Escape');

    await signIn(page, 's10', '/budget');
    await expect(page.getByTestId('budget-week')).toHaveText('Mon 19 Oct – Sun 25 Oct');
    await pickDate(page, 'Go to the week of', '2026-10-28'); // a Wednesday: the whole week shows
    await expect(page.getByTestId('budget-week')).toHaveText('Mon 26 Oct – Sun 1 Nov');
    await assertNoHorizontalScroll(page);
    c.assertClean();
  });

  test('Indonesian: month and day names come from the locale, and the kit has no raw keys', async ({ page }) => {
    await signIn(page, 's10', '/budget', 'id');
    await page.locator('[aria-haspopup="dialog"]').first().click();
    await expect(page.getByRole('grid', { name: 'Oktober 2026' })).toBeVisible();
    await expect(page.getByRole('columnheader').first()).toHaveAttribute('aria-label', 'Senin');
    await expect(page.getByRole('button', { name: 'Bulan sebelumnya' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hari ini', exact: true })).toBeVisible();
    expect(await page.locator('body').innerText()).not.toMatch(/\bcommon\.[a-zA-Z]+\b/);
  });
});

test.describe('Pager', () => {
  test('payments are paged 15 at a time: next, previous, numbered pages, the last page; a search starts again on page 1', async ({ page }) => {
    const c = watchConsole(page);
    // 18 new cash payments sit on top of the seeded history (about 6 months of paid invoices), newest first
    for (let i = 1; i <= 18; i++) {
      const r = await post(page, 's10', 'payment.record', { memberId: 'm46', amount: 1000, method: 'cash', ref: `T${i}`, invoiceId: 'INV-2610-046' });
      expect(r.ok()).toBeTruthy();
    }
    await signIn(page, 's10', '/payments');
    const rows = page.getByText(/ · Cash · ref T\d+$/);
    const nav = page.getByRole('navigation', { name: 'Payments as they arrive: pages' });
    const prev = nav.getByRole('button', { name: 'Previous page' });
    const next = nav.getByRole('button', { name: 'Next page' });
    await expect(rows).toHaveCount(15);
    await expect(prev).toHaveAttribute('aria-disabled', 'true');
    const pages = Number(((await nav.textContent()) ?? '').match(/Page 1 of (\d+)/)?.[1]);
    expect(pages).toBeGreaterThanOrEqual(2); // 18 new + the seeded payments: more than one page, however much history the seed holds
    if (isPhone(page)) await expect(nav).toContainText(`Page 1 of ${pages}`);
    else await expect(nav.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
    await assertNoHorizontalScroll(page);

    await next.click();
    await expect(rows).toHaveCount(3); // the 3 oldest of the new cash rows; the rest of page 2 is the seeded history
    await expect(prev).not.toHaveAttribute('aria-disabled', 'true');
    await prev.click();
    await expect(rows).toHaveCount(15);
    await goToPage(page, 2, 'Payments as they arrive: pages');
    await expect(rows).toHaveCount(3);
    await goToPage(page, pages, 'Payments as they arrive: pages'); // the last page: older seeded payments, and nowhere further to go
    await expect(rows).toHaveCount(pages === 2 ? 3 : 0);
    await expect(next).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByText(/^INV-\d{4}-\d{3}( · |$)/).first()).toBeVisible(); // seeded payments of earlier months

    await page.getByRole('searchbox', { name: 'Search by member, invoice, reference or bank' }).fill('T7');
    await expect(rows).toHaveCount(1); // one hit, so one page: the pager is gone and the list is back at the start
    await expect(nav).toHaveCount(0);
    await page.getByRole('searchbox', { name: 'Search by member, invoice, reference or bank' }).fill('');
    await expect(rows).toHaveCount(15); // page 1 again, not the last page
    c.assertClean();
  });

  test('the notification bell and the demo accounts are paged too', async ({ page }) => {
    const c = watchConsole(page);
    // twelve "payment received" updates for finance
    for (let i = 1; i <= 12; i++) {
      const r = await post(page, 's10', 'payment.record', { memberId: 'm46', amount: 1000, method: 'cash', ref: `N${i}`, invoiceId: 'INV-2610-046' });
      expect(r.ok()).toBeTruthy();
    }
    await signIn(page, 's9', '/arrivals');
    await page.getByRole('button', { name: /Notifications/ }).first().click();
    const panel = page.getByRole('dialog', { name: 'Notifications' });
    await panel.getByRole('tab', { name: /Updates/ }).click();
    const nav = panel.getByRole('navigation', { name: 'Updates' });
    await expect(nav).toBeVisible();
    const count = async () => panel.locator('button:has(span[style*="border-radius: 999px"])').count();
    expect(await count()).toBeGreaterThan(0);
    await goToPage(page, 2, 'Updates');
    await expect(nav.getByRole('button', { name: 'Previous page' })).not.toHaveAttribute('aria-disabled', 'true');
    c.assertClean();
  });
});

test.describe('CameraCapture (no camera in a headless browser: the file picker takes over)', () => {
  test('a receipt photo: choose a file, preview, retake, use it; it is uploaded, kept and shown', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's10', '/receipts');
    await page.getByRole('button', { name: 'Snap a receipt (nota)' }).first().click();
    await page.getByRole('button', { name: 'Tap to take the photo' }).click();
    const cam = page.getByRole('dialog', { name: 'Camera' });
    await expect(cam).toBeVisible();
    await expect(cam.getByText(/No camera was found here|Camera access is blocked/)).toBeVisible();
    await inScreen(page, cam);

    // a file that is not a picture is refused, with a message
    await cam.locator('input[type="file"]').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a photo') });
    await expect(cam.getByRole('alert')).toHaveText('Please use a JPEG, PNG or WebP photo.');
    // a big picture: previewed, then retaken once
    const big = await page.evaluate(async () => {
      const cv = document.createElement('canvas');
      cv.width = 3200; cv.height = 2400;
      const g = cv.getContext('2d')!;
      const grad = g.createLinearGradient(0, 0, 3200, 2400);
      grad.addColorStop(0, '#caa'); grad.addColorStop(1, '#357');
      g.fillStyle = grad; g.fillRect(0, 0, 3200, 2400);
      const blob: Blob = await new Promise((ok) => cv.toBlob((b) => ok(b!), 'image/png'));
      let s = ''; const u = new Uint8Array(await blob.arrayBuffer());
      for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
      return btoa(s);
    });
    await cam.locator('input[type="file"]').setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: Buffer.from(big, 'base64') });
    await expect(cam.getByRole('img', { name: 'Preview of the photo' })).toBeVisible();
    await cam.getByRole('button', { name: 'Retake' }).click();
    await expect(cam.getByRole('button', { name: 'Choose a photo' })).toBeVisible();
    await cam.locator('input[type="file"]').setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: Buffer.from(big, 'base64') });
    const uploaded = page.waitForResponse((r) => r.url().endsWith('/api/media') && r.request().method() === 'POST');
    await cam.getByRole('button', { name: 'Use photo' }).click();
    const res = await uploaded;
    expect(res.status()).toBe(201);
    const { id, bytes } = await res.json();
    expect(bytes).toBeLessThan(5 * 1024 * 1024);
    await expect(cam).toBeHidden();
    await expect(page.getByRole('img', { name: /Photo of receipt nota_2110\.jpg/ })).toBeVisible();

    // what was stored is a JPEG of at most 1600px, readable without any sign-in header (an <img> tag has none)
    const shape = await page.evaluate(async (url) => {
      const r = await fetch(url);
      const b = await r.blob();
      const bmp = await createImageBitmap(b);
      return { type: r.headers.get('content-type'), cache: r.headers.get('cache-control'), w: bmp.width, h: bmp.height };
    }, `/api/media/${id}`);
    expect(shape).toMatchObject({ type: 'image/jpeg', w: 1600, h: 1200 });
    expect(shape.cache).toContain('immutable');
    await expect(page.locator(`img[src="/api/media/${id}"]`)).toBeVisible();
    expect(await page.locator(`img[src="/api/media/${id}"]`).evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth === 1600)).toBe(true);

    // send the receipt: the row keeps the photo
    await page.getByLabel('Supplier', { exact: true }).fill('Toko Foto');
    await page.getByLabel('Amount (Rp)').fill('50000');
    await page.getByRole('button', { name: 'Send to finance' }).click();
    await toast(page, /Receipt sent to finance/);
    await expect(page.getByText('Toko Foto · Rp 50.000')).toBeVisible();
    await expect(page.locator(`img[src="/api/media/${id}"]`)).toHaveCount(1);
    c.assertClean();
  });

  test('Escape and the close button leave without a photo; the tiny PNG helper works too', async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's10', '/receipts');
    await page.getByRole('button', { name: 'Snap a receipt (nota)' }).first().click();
    await page.getByRole('button', { name: 'Tap to take the photo' }).click();
    const cam = page.getByRole('dialog', { name: 'Camera' });
    await expect(cam).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(cam).toBeHidden();
    await expect(page.getByRole('button', { name: 'Tap to take the photo' })).toBeVisible(); // still no photo
    await page.getByRole('button', { name: 'Tap to take the photo' }).click();
    await cam.getByRole('button', { name: 'Close' }).click();
    await expect(cam).toBeHidden();
    await page.getByRole('button', { name: 'Tap to take the photo' }).click();
    await takePhotoWithFile(page, { name: 'one.png', mimeType: 'image/png', buffer: TINY_PNG });
    await expect(page.getByRole('img', { name: /Photo of receipt/ })).toBeVisible();
    await page.getByRole('button', { name: 'Retake' }).click(); // the tile's own retake opens the camera again
    await expect(cam).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('img', { name: /Photo of receipt/ })).toBeVisible(); // the first photo stays
    c.assertClean();
  });
});
