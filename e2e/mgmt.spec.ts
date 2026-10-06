// Management: broadcast, venue, people (staff records, usernames, reset password), surveys (choose recipients), plans and pricing, Indonesian, every viewport.
// (The Overview is no longer a screen: management lands on Arrivals. Its numbers are covered by unit and component tests.)
// Isolated env: E2E_NAME=mgmt E2E_PORT=8881 scripts/e2e-all.sh 1 "phone laptop" mgmt enquiries
import { test, expect, type Browser, type Page } from '@playwright/test';
import { resetDemo, signIn, watchConsole, isPhone, assertNoHorizontalScroll } from './helpers';
import { goToPage, pickDate, pickOption, pickTime } from './kit';

test.beforeEach(async ({ request }) => { await resetDemo(request); });

const toast = (page: Page, re: RegExp | string) => page.getByRole('status').filter({ hasText: re }).first();
/** Raw i18n keys of this area that leaked into the UI. */
const RAW_KEY = /\b(?:mgmt|people|enq|form)\.[A-Za-z][A-Za-z0-9_.]*/;
const noRawKeys = async (page: Page) => {
  const text = await page.locator('body').innerText();
  expect(text.match(RAW_KEY)?.[0] ?? null, 'raw i18n key on screen').toBeNull();
};
/** A second, separate browser session (own storage) with the same viewport as this test. */
async function otherSession(browser: Browser) {
  const u = test.info().project.use;
  const ctx = await browser.newContext({ baseURL: u.baseURL, viewport: u.viewport ?? undefined, isMobile: u.isMobile, hasTouch: u.hasTouch, userAgent: u.userAgent, deviceScaleFactor: u.deviceScaleFactor });
  return { ctx, page: await ctx.newPage() };
}
/** A staff row in the People list (eight a page): look on the pages until it shows. */
async function staffRow(page: Page, id: string) {
  const row = page.locator(`[data-staff="${id}"]`);
  for (const n of [0, 1, 2]) {
    if (n) await goToPage(page, n, 'Staff pages');
    if (await row.count()) return row;
  }
  throw new Error(`no row for ${id}`);
}
const SCREENS: [string, string][] = [['/today', 'Arrivals'], ['/broadcast', 'Broadcast'], ['/venue', 'Venue bookings'], ['/hr', 'People'], ['/surveys', 'Surveys'], ['/plans', 'Plans and pricing'], ['/enquiries', 'Enquiries']];

// ---------------------------------------------------------------- landing
test('management lands on Arrivals; the Overview is not a screen any more', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9');
  await expect(page.getByRole('heading', { name: 'Arrivals', level: 1 })).toBeVisible();
  await expect(page.locator('[data-nav-key="overview"]')).toHaveCount(0);
  await page.goto('/overview'); // an old link goes home
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole('heading', { name: 'Arrivals', level: 1 })).toBeVisible();
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

// ---------------------------------------------------------------- venue
test('venue: book any future date with a time range, price and deposit; a clash is refused; edit; invoice; cancel', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/venue');
  await expect(page.getByRole('heading', { name: 'Venue bookings', level: 1 })).toBeVisible();
  await expect(page.getByText('PT Arunika Farma caregiver seminar')).toBeVisible();
  await expect(page.getByText('Rotary Club Jakarta Selatan breakfast')).toBeVisible();
  await assertNoHorizontalScroll(page);

  // a date far outside the old ten-day window
  await page.getByRole('button', { name: 'New booking' }).click();
  await page.getByLabel('Organisation').fill('Yayasan Kasih Bunda choir');
  await page.getByLabel('Contact person').fill('Ibu Lusi Tan');
  await page.getByLabel('Mobile').fill('0813 6611 2290');
  await page.getByLabel('Guests').fill('25');
  await pickDate(page, /^Day/, '2027-03-13'); // a Saturday, months ahead
  await page.getByRole('button', { name: /^08:00–12:00/ }).click();
  await page.getByRole('button', { name: 'Music room', exact: true }).click();
  await page.getByLabel(/^Price/).fill('2500000');
  await page.getByLabel(/^Deposit/).fill('500000');
  await expect(page.getByTestId('venue-error')).toHaveCount(0);
  await page.getByRole('button', { name: 'Confirm booking' }).click();
  await expect(toast(page, /Booked\. .*08:00–12:00 is now blocked on the club calendar/)).toBeVisible();
  const row = page.locator('[data-venue="v5"]');
  await expect(row).toContainText('Yayasan Kasih Bunda choir');
  await expect(row).toContainText('25 guests · Music room');
  await expect(row).toContainText('Price Rp 2.500.000 · Deposit Rp 500.000');

  // the same room at an overlapping time: refused with the reason, before it is sent
  await page.getByRole('button', { name: 'New booking' }).click();
  await page.getByLabel('Organisation').fill('Second event');
  await page.getByLabel('Contact person').fill('Someone');
  await pickDate(page, /^Day/, '2027-03-13');
  await pickTime(page, /^From/, '11:00');
  await pickTime(page, /^To\b/, '13:00');
  await page.getByRole('button', { name: 'Music room', exact: true }).click();
  await expect(page.getByTestId('venue-error')).toContainText('Music room is already booked from 08:00 to 12:00 by Yayasan Kasih Bunda choir');
  await expect(page.getByRole('button', { name: 'Confirm booking' })).toHaveAttribute('aria-disabled', 'true');
  // "Whole club" clashes with every room; another room is fine
  await page.getByRole('button', { name: 'Whole club', exact: true }).click();
  await expect(page.getByTestId('venue-error')).toContainText('already booked');
  await page.getByRole('button', { name: 'Lounge', exact: true }).click();
  await expect(page.getByTestId('venue-error')).toHaveCount(0);
  // club hours: a weekday 10:00–12:00 is members' time
  await pickDate(page, /^Day/, '2026-10-22');
  await expect(page.getByTestId('venue-error')).toContainText('The club is open 08:30–16:30 that day');
  // an outing and a closure block the day
  await pickDate(page, /^Day/, '2026-10-29');
  await expect(page.getByTestId('venue-error')).toContainText('outing');
  await pickTime(page, /^From/, '17:00');
  await pickTime(page, /^To\b/, '19:00');
  await pickDate(page, /^Day/, '2026-10-30');
  await expect(page.getByTestId('venue-error')).toContainText('closed that day');
  // the seeded Whole-club seminar blocks a room at the same time
  await pickDate(page, /^Day/, '2026-10-24');
  await pickTime(page, /^From/, '12:00');
  await pickTime(page, /^To\b/, '14:00');
  await expect(page.getByTestId('venue-error')).toContainText('already booked from 09:00 to 13:00 by PT Arunika Farma caregiver seminar');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();

  // edit price and contact
  await row.getByRole('button', { name: 'Edit' }).click();
  const dlg = page.getByRole('dialog', { name: 'Yayasan Kasih Bunda choir' });
  await dlg.getByLabel(/^Price/).fill('3000000');
  await dlg.getByLabel('Contact person').fill('Ibu Lusi T.');
  await dlg.getByRole('button', { name: 'Save changes' }).click();
  await expect(toast(page, 'Booking updated.')).toBeVisible();
  await expect(row).toContainText('Price Rp 3.000.000');
  await expect(row).toContainText('Ibu Lusi T.');

  // invoice (simulated)
  await row.getByRole('button', { name: 'Create invoice' }).click();
  await expect(toast(page, /Invoice VEN-2703-001 created \(demo\)/)).toBeVisible();
  await expect(row).toContainText('Invoice VEN-2703-001');
  await expect(row.getByRole('button', { name: 'Create invoice' })).toHaveCount(0);

  // cancel
  await row.getByRole('button', { name: 'Cancel booking' }).click();
  await page.getByRole('dialog', { name: 'Cancel this booking?' }).getByRole('button', { name: 'Cancel booking' }).click();
  await expect(toast(page, 'Booking cancelled. The time is free again.')).toBeVisible();
  await expect(page.locator('[data-venue="v5"]')).toContainText('Cancelled');
  // the slot is free again
  await page.getByRole('button', { name: 'New booking' }).click();
  await pickDate(page, /^Day/, '2027-03-13');
  await page.getByRole('button', { name: /^08:00–12:00/ }).click();
  await page.getByRole('button', { name: 'Music room', exact: true }).click();
  await expect(page.getByTestId('venue-error')).toHaveCount(0);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('venue: after the event, ask for a review and record it', async ({ page, request }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/venue');
  const past = page.locator('[data-venue="v4"]'); // Rotary breakfast, 17 Oct, already reviewed in the seed
  await expect(past).toContainText('Reviewed 5/5');
  await expect(past).toContainText('Spotless rooms');
  await expect(past.getByRole('button', { name: 'Record review' })).toHaveCount(0);
  // an evening event today; once the demo clock passes its end the event is done and can be reviewed
  const r = await request.post('/api/actions/venue.book', { headers: { 'x-user-id': 's9' }, data: { mutationId: 'e2e-v', input: { org: 'Evening choir', contactName: 'Bu Lusi', phone: '', guests: 20, roomId: 'room-lounge', date: '2026-10-21', from: '17:00', to: '20:00' } } });
  expect(r.ok()).toBeTruthy();
  const row = page.locator('[data-venue="v5"]');
  await expect(row).toContainText('Confirmed · on calendar');
  await expect(row.getByRole('button', { name: 'Send review link' })).toHaveCount(0); // not over yet
  expect((await request.post('/api/demo/clock', { data: { hm: '20:30' } })).ok()).toBeTruthy();
  await expect(row).toContainText('Event done');
  await row.getByRole('button', { name: 'Send review link' }).click();
  await expect(toast(page, 'Review link sent to Bu Lusi on WhatsApp (demo).')).toBeVisible();
  await expect(row).toContainText('Review link sent');
  await row.getByRole('button', { name: 'Record review' }).click();
  const dlg = page.getByRole('dialog', { name: 'Record review' });
  await dlg.getByRole('radio', { name: '4 of 5' }).click();
  await dlg.getByLabel('What they said').fill('Lovely room, thank you');
  await dlg.getByRole('button', { name: 'Save' }).click();
  await expect(toast(page, 'Review recorded.')).toBeVisible();
  await expect(row).toContainText('Reviewed 4/5');
  await expect(row).toContainText('Lovely room, thank you');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

// ---------------------------------------------------------------- broadcast
test('broadcast: audiences are people, the preview follows the chosen recipient, schedule then cancel', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/broadcast');
  await expect(page.getByRole('heading', { name: 'Broadcast', level: 1 })).toBeVisible();
  // audience counts are real people with a phone (6 families, 4 open leads, 10 staff)
  await expect(page.getByRole('button', { name: 'Families · 6' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Enquiries · 4' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Staff · 10' })).toBeVisible();
  await page.getByRole('button', { name: 'Staff · 10' }).click();
  await expect(page.getByRole('button', { name: 'Families · 6' })).toBeVisible();
  await page.getByRole('button', { name: 'Staff · 10' }).click(); // off again
  // the preview is for a chosen recipient, not a fixed name
  await page.getByRole('button', { name: 'Club update' }).click();
  await page.getByPlaceholder('Our new garden room opens on Monday.').fill('the garden room opens on Monday');
  const preview = page.getByTestId('bc-preview');
  await expect(preview).toContainText('Hello Cynthia, news from CitraPremier: the garden room opens on Monday');
  await pickOption(page, 'Preview as', 'Maria Wijaya · Families');
  await expect(preview).toContainText('Hello Maria, news from CitraPremier');
  await page.getByRole('button', { name: 'Club closed' }).click();
  await expect(preview).toContainText('a reminder that CitraPremier is closed on the garden room opens on Monday');
  // dates are computed from today (Wed 21 Oct): Tomorrow 08:00 and the next Friday 15:00
  await expect(page.getByRole('button', { name: 'Fri 23 Oct, 15:00' })).toBeVisible();
  await page.getByRole('button', { name: 'Tomorrow, 08:00' }).click();
  await page.getByRole('button', { name: 'Schedule for 6 people' }).click();
  await expect(toast(page, 'Scheduled for Thu 22 Oct, 08:00.')).toBeVisible();
  const row = page.locator('[data-bc="scheduled"]');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Club closed: the garden room opens on Monday');
  await expect(row).toContainText('Families · 6 people · Scheduled · Thu 22 Oct, 08:00');
  // edit the scheduled message
  await row.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByText('You are editing a scheduled message.')).toBeVisible();
  await page.getByPlaceholder('Friday 30 October, for staff first-aid training').fill('Friday 6 November, for maintenance');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(toast(page, 'Scheduled message updated.')).toBeVisible();
  await expect(page.locator('[data-bc="scheduled"]')).toContainText('Friday 6 November, for maintenance');
  // cancel it
  await page.locator('[data-bc="scheduled"]').getByRole('button', { name: 'Cancel send' }).click();
  await expect(toast(page, 'Scheduled message cancelled.')).toBeVisible();
  await expect(page.locator('[data-bc="scheduled"]')).toHaveCount(0);
  await expect(page.locator('[data-bc="cancelled"]')).toContainText('Cancelled');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('broadcast: send now; a scheduled message goes out when the demo clock passes it; templates are editable', async ({ page, request }) => {
  test.setTimeout(100_000);
  const c = watchConsole(page);
  await signIn(page, 's9', '/broadcast');
  await page.getByPlaceholder('Our new garden room opens on Monday.').fill('the bus leaves at 09:00');
  await page.getByRole('button', { name: 'Event invitation' }).click();
  await page.getByRole('button', { name: 'Send to 6 people' }).click();
  await expect(toast(page, 'Sent to 6 people on WhatsApp (demo).')).toBeVisible();
  await expect(page.locator('[data-bc="sent"]').first()).toContainText('Event invitation: the bus leaves at 09:00');
  // schedule for 11:00 today, then move the clock past it
  await page.getByRole('button', { name: 'Club update' }).click();
  await page.getByPlaceholder('Our new garden room opens on Monday.').fill('lunch is early today');
  await page.getByRole('button', { name: 'Pick a date and time' }).click();
  await pickDate(page, /^Date/, '2026-10-21');
  await pickTime(page, /^Time/, '11:00');
  await page.getByRole('button', { name: 'Schedule for 6 people' }).click();
  await expect(toast(page, 'Scheduled for Wed 21 Oct, 11:00.')).toBeVisible();
  await expect(page.locator('[data-bc="scheduled"]')).toHaveCount(1);
  const clock = await request.post('/api/demo/clock', { data: { hm: '11:05' } });
  expect(clock.ok()).toBeTruthy();
  await expect(page.locator('[data-bc="scheduled"]')).toHaveCount(0, { timeout: 45_000 });
  await expect(page.locator('[data-bc="sent"]').filter({ hasText: 'Club update: lunch is early today' })).toBeVisible();
  // families get it in the app too
  const fam = await request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': 'f1' } });
  const snap = await fam.json();
  expect(Object.values(snap.state.notifications as Record<string, { kind: string }>).some((n) => n.kind === 'mgmt.notif.bc_update')).toBe(true);

  // templates: edit a default, add your own
  await page.getByRole('button', { name: 'Edit templates' }).click();
  const dlg = page.getByRole('dialog', { name: 'Edit templates' });
  await dlg.getByRole('button', { name: 'Edit' }).first().click();
  await dlg.getByLabel('Template name').fill('News');
  await dlg.getByLabel('Message text').fill('Dear {name}, {msg}');
  await dlg.getByRole('button', { name: 'Save' }).click();
  await expect(toast(page, 'Template saved.')).toBeVisible();
  await dlg.getByRole('button', { name: 'New template' }).click();
  await dlg.getByLabel('Template name').fill('Reminder');
  await dlg.getByLabel('Message text').fill('no placeholder');
  await expect(dlg.getByText('The text needs {msg} so that your message goes in.')).toBeVisible();
  await expect(dlg.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-disabled', 'true');
  await dlg.getByLabel('Message text').fill('Hello {name}, reminder: {msg}');
  await dlg.getByRole('button', { name: 'Save' }).click();
  await dlg.getByRole('button', { name: 'Close', exact: true }).last().click();
  await expect(page.getByRole('button', { name: 'News', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reminder', exact: true })).toBeVisible();
  c.assertClean();
});

// ---------------------------------------------------------------- people
test('people: add a staff member with a contract, edit, deactivate and reactivate', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/hr');
  await expect(page.getByRole('heading', { name: 'People', level: 1 })).toBeVisible();
  if (!isPhone(page)) await expect(page.getByText('Management only. Contracts, salaries, bank details and disciplinary notes are hidden from every other role.')).toBeVisible(); // a phone drops the helper note
  await expect(page.locator('[data-staff]')).toHaveCount(8); // eight a page, ten people
  await goToPage(page, 2, 'Staff pages');
  await expect(page.locator('[data-staff]')).toHaveCount(2);
  await goToPage(page, 1, 'Staff pages');
  await assertNoHorizontalScroll(page);

  await page.getByRole('button', { name: 'Add staff member' }).click();
  const dlg = page.getByRole('dialog', { name: 'Add staff member' });
  await dlg.getByRole('button', { name: 'Add staff member' }).click(); // empty: nothing is saved
  await expect(dlg.getByText('Please check the highlighted fields.').first()).toBeVisible();
  await dlg.getByLabel(/^Name/).fill('Wulan Sari');
  await dlg.getByLabel('Known as').fill('Bu Wulan');
  await dlg.getByLabel('Job title').fill('Housekeeping');
  await dlg.getByLabel('Mobile (WhatsApp)').fill('0811 2201 7788');
  await dlg.getByRole('button', { name: 'Housekeeping', exact: true }).click();
  await pickDate(page, /^End/, '2027-10-31');
  await dlg.getByLabel('KTP, last 4 digits').fill('4411');
  await dlg.getByLabel('Monthly salary').fill('4800000');
  await dlg.getByRole('button', { name: 'BNI', exact: true }).click();
  await dlg.getByLabel('Account number').fill('1234 5678 90');
  await dlg.getByRole('button', { name: 'Add staff member' }).click();
  await expect(toast(page, 'Wulan Sari added to the team.')).toBeVisible();
  await expect(page.locator('[data-staff="s11"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Wulan Sari', level: 2 })).toBeVisible();
  await expect(page.getByText('Housekeeping · +62 811-2201-7788')).toBeVisible();

  // duplicate numbers are refused (one number, one sign-in)
  if (isPhone(page)) await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Add staff member' }).first().click();
  const dlg2 = page.getByRole('dialog', { name: 'Add staff member' });
  await dlg2.getByLabel(/^Name/).fill('Copy Cat');
  await dlg2.getByLabel('Job title').fill('Nurse');
  await dlg2.getByLabel('Mobile (WhatsApp)').fill('+62 811-2201-3345');
  await pickDate(page, /^End/, '2027-10-31');
  await dlg2.getByRole('button', { name: 'Add staff member' }).click();
  await expect(toast(page, 'That mobile number already belongs to someone else.')).toBeVisible();
  await dlg2.getByRole('button', { name: 'Cancel' }).click();

  // edit the new record
  await (await staffRow(page, 's11')).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Wulan Sari' });
  await edit.getByLabel('Job title').fill('Head of housekeeping');
  await edit.getByLabel('Salary').first().fill('5200000');
  await edit.getByRole('button', { name: 'Save changes' }).click();
  await expect(toast(page, 'Staff record saved.')).toBeVisible();
  await expect(page.getByText('Head of housekeeping · +62 811-2201-7788')).toBeVisible();

  // deactivate, then reactivate
  await page.getByRole('button', { name: 'Deactivate' }).click();
  await page.getByRole('dialog', { name: 'Deactivate Wulan Sari?' }).getByRole('button', { name: 'Deactivate' }).click();
  await expect(toast(page, 'Wulan Sari is deactivated.')).toBeVisible();
  await expect(page.locator('[data-staff="s11"]')).toContainText('Inactive');
  await page.getByRole('button', { name: 'Reactivate' }).click();
  await expect(toast(page, 'Wulan Sari is active again.')).toBeVisible();
  // you cannot deactivate yourself
  if (isPhone(page)) await page.getByRole('button', { name: 'Back' }).click();
  await (await staffRow(page, 's9')).click();
  await expect(page.getByRole('button', { name: 'Deactivate' })).toHaveAttribute('aria-disabled', 'true');
  c.assertClean();
});

test('people: give housekeeping (s4) app access and she signs in to Requests; switch it off and she cannot', async ({ page, browser, request }) => {
  const c = watchConsole(page);
  // before: no access
  const before = await request.post('/api/verify', { data: { userId: 's4', code: '000000' } });
  expect(before.status()).toBe(401);
  await signIn(page, 's9', '/hr');
  await (await staffRow(page, 's4')).click();
  await expect(page.getByRole('heading', { name: 'Siti Aminah', level: 2 })).toBeVisible();
  await expect(page.getByText('No app access').first()).toBeVisible();
  const sw = page.getByRole('switch', { name: /Can sign in to the app/ });
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByText('Requests becomes their home screen.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset password' })).toHaveCount(0); // no account, nothing to reset
  await sw.click();
  await expect(toast(page, 'Siti Aminah can now sign in.')).toBeVisible();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  // the server gives her a username from her first name; it shows read-only, and the password can now be reset
  await expect(page.getByText('siti', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset password' })).toBeVisible();

  // she signs in (own session) and lands on Requests
  const s4 = await otherSession(browser);
  const w = watchConsole(s4.page);
  await signIn(s4.page, 's4');
  await expect(s4.page).toHaveURL(/\/today$/);
  await expect(s4.page.locator('[data-nav-key="today"]').first()).toContainText('Requests');
  await expect(s4.page.locator('[data-nav-key="enquiries"]')).toHaveCount(0);
  await expect(s4.page.locator('[data-nav-key="hr"]')).toHaveCount(0);
  await s4.page.goto('/hr'); // forbidden for housekeeping: back to her home
  await expect(s4.page).toHaveURL(/\/today$/);
  w.assertClean();
  await s4.ctx.close();

  // switch it off again
  await sw.click();
  await expect(toast(page, 'Siti Aminah can no longer sign in.')).toBeVisible();
  const after = await request.post('/api/verify', { data: { userId: 's4', code: '000000' } });
  expect(after.status()).toBe(401);
  c.assertClean();
});

test('people: each staff member shows a read-only username; management resets a password to the default', async ({ page, request }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/hr?staff=s1');
  await expect(page.getByRole('heading', { name: 'Caca', level: 2 })).toBeVisible();
  await expect(page.getByText('Username', { exact: true })).toBeVisible();
  await expect(page.getByText('caca', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Username')).toHaveCount(0); // never an input: the username cannot change
  await expect(page.getByText('Set automatically from their first name. It cannot be changed.')).toBeVisible();
  // Caca changes her own password (through the account route), so the default no longer works
  const login = (password: string) => request.post('/api/login', { data: { username: 'caca', password } });
  const own = await login('citra123');
  expect(own.ok()).toBeTruthy();
  const { token } = await own.json();
  const changed = await request.post('/api/account/password', { headers: { authorization: `Bearer ${token}` }, data: { current: 'citra123', next: 'rinas-own-secret' } });
  expect(changed.ok()).toBeTruthy();
  expect((await login('citra123')).status()).toBe(401);
  // management resets it: a confirmation first, then the default is back
  await page.getByRole('button', { name: 'Reset password' }).click();
  const dlg = page.getByRole('dialog', { name: 'Reset the password of Caca?' });
  await expect(dlg.getByText('signs in with the default password again')).toBeVisible();
  await dlg.getByRole('button', { name: 'Cancel' }).click();
  expect((await login('citra123')).status()).toBe(401); // cancelled: nothing changed
  await page.getByRole('button', { name: 'Reset password' }).click();
  await page.getByRole('dialog', { name: 'Reset the password of Caca?' }).getByRole('button', { name: 'Reset password' }).click();
  await expect(toast(page, 'The password of Caca is back to the default: citra123')).toBeVisible();
  expect((await login('citra123')).ok()).toBeTruthy();
  expect((await login('rinas-own-secret')).status()).toBe(401);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('people: pay is masked until shown, contract expiry warns, notes and warnings can be added and deleted, family ratings come from surveys', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/hr');
  // Dinar's fixed-term contract ends within 30 days: warned in the list and on the record (and the notification links here)
  await (await staffRow(page, 's5')).click();
  await expect(page.getByText(/Contract ends in 9 days/)).toBeVisible();
  await page.getByRole('tab', { name: 'Contract and KTP' }).click();
  await expect(page.getByText('This contract ends in 9 days, on 30 October 2026.')).toBeVisible();
  await expect(page.getByText('Fixed term (PKWT)')).toBeVisible();
  await expect(page.getByText('•••• •••• •••• ').first()).toBeVisible();
  // pay
  await page.getByRole('tab', { name: 'Salary and bank' }).click();
  await expect(page.getByText('Rp ••••••••')).toBeVisible();
  await expect(page.getByText(/6\.800\.000/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Show amounts and account number' }).click();
  await expect(page.getByText('Rp 6.800.000')).toBeVisible();
  await page.getByRole('button', { name: 'Hide amounts and account number' }).click();
  await expect(page.getByText(/6\.800\.000/)).toHaveCount(0);
  // ratings from surveys
  await page.getByRole('tab', { name: 'Notes and ratings' }).click();
  await expect(page.getByText('5.0 / 5')).toBeVisible();
  await expect(page.getByText('Dinar makes Papa laugh every day.')).toBeVisible();
  await expect(page.getByText('From 6 family ratings in surveys')).toBeVisible();
  await expect(page.getByText('October check-in')).toBeVisible();
  // notes: Siti has a verbal warning on file
  if (isPhone(page)) await page.getByRole('button', { name: 'Back' }).click();
  await (await staffRow(page, 's4')).click();
  await page.getByRole('tab', { name: 'Notes and ratings' }).click();
  await expect(page.getByText('Verbal warning: arrived 40 minutes late twice in one week.')).toBeVisible();
  await page.getByRole('button', { name: 'Praise', exact: true }).click();
  await page.getByLabel('What happened').fill('Stayed late to help with the move');
  await page.getByRole('button', { name: 'Add note' }).click();
  await expect(toast(page, 'Note added.')).toBeVisible();
  await expect(page.getByText('Stayed late to help with the move')).toBeVisible();
  await page.getByRole('button', { name: 'Delete note' }).first().click();
  await page.getByRole('dialog', { name: 'Delete this note?' }).getByRole('button', { name: 'Delete' }).click();
  await expect(toast(page, 'Note deleted.')).toBeVisible();
  await expect(page.getByText('Stayed late to help with the move')).toHaveCount(0);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('people: attendance tab clocks in and out and edits a day; the contract-expiry link opens that person', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/hr?staff=s1');
  await expect(page.getByRole('heading', { name: 'Caca', level: 2 })).toBeVisible();
  await page.getByRole('tab', { name: 'Attendance' }).click();
  await expect(page.getByText('Days worked')).toBeVisible();
  await expect(page.locator('[data-att="2026-10-20"]')).toContainText('08:00 – 17:00 · 9:00');
  await page.getByRole('button', { name: 'Clock in now' }).click();
  await expect(toast(page, /Clocked in at \d\d:\d\d\./)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Clock out now' })).toBeVisible();
  await expect(page.locator('[data-att="2026-10-21"]')).toContainText('still in');
  // correct yesterday's clock-out
  await page.locator('[data-att="2026-10-20"]').click();
  const dlg = page.getByRole('dialog', { name: 'Tuesday 20 October' });
  await pickTime(page, /^Clock out/, '16:30');
  await dlg.getByRole('button', { name: 'Save' }).click();
  await expect(toast(page, 'Day saved.')).toBeVisible();
  await expect(page.locator('[data-att="2026-10-20"]')).toContainText('08:00 – 16:30 · 8:30');
  // mark a day as sick, then remove the entry
  await page.locator('[data-att="2026-10-19"]').click();
  const d2 = page.getByRole('dialog', { name: 'Monday 19 October' });
  await d2.getByRole('button', { name: 'Sick' }).click();
  await d2.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('[data-att="2026-10-19"]')).toContainText('Sick');
  await page.locator('[data-att="2026-10-19"]').click();
  await page.getByRole('dialog', { name: 'Monday 19 October' }).getByRole('button', { name: 'Remove' }).click();
  await expect(toast(page, 'Entry removed.')).toBeVisible();
  await expect(page.locator('[data-att="2026-10-19"]')).toContainText('No entry');
  // a future day cannot be worked
  await page.goto('/hr?staff=s5');
  await expect(page.getByRole('heading', { name: 'Dinar', level: 2 })).toBeVisible();
  c.assertClean();
});

// ---------------------------------------------------------------- surveys
test('surveys: open a closed survey in full; create, edit as a draft and send a new survey; the old one closes', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/surveys');
  await expect(page.getByRole('heading', { name: 'Surveys', level: 1 })).toBeVisible();
  // the live survey: ratings per person, response rate by family (never over 100%)
  await expect(page.getByText('October check-in').first()).toBeVisible();
  await expect(page.getByText('3 of 4 families').first()).toBeVisible();
  await expect(page.getByText('75%')).toBeVisible();
  await expect(page.getByText('Caca', { exact: true })).toBeVisible();
  // closed survey in detail
  await page.locator('[data-survey="sv0"]').click();
  const dlg = page.getByRole('dialog', { name: 'September check-in' });
  await expect(dlg).toBeVisible();
  await expect(dlg.getByText('Closed 19 October 2026')).toBeVisible();
  await expect(dlg.getByText('3 of 4 families').first()).toBeVisible();
  await expect(dlg.getByText('Would recommend')).toBeVisible();
  await expect(dlg.getByText('Team ratings · shown in People')).toBeVisible();
  await expect(dlg.getByText('Caca', { exact: true })).toBeVisible();
  await expect(dlg.getByText('Answered · 5/5').first()).toBeVisible();
  await expect(dlg.getByText('Not yet')).toBeVisible(); // Maria has not answered it
  await dlg.getByRole('button', { name: 'Close', exact: true }).last().click();

  // new survey: team picked from staff, who gets it chosen, saved as a draft, edited, then sent
  await page.getByLabel('Title').fill('November check-in');
  await page.getByRole('button', { name: 'Anything we could do better?' }).click(); // off
  await page.getByRole('button', { name: /^Chef Agus · / }).click(); // take Chef Agus out of the team
  const count = page.getByTestId('survey-count');
  const picked = page.getByTestId('survey-picked');
  await expect(count).toHaveText('Goes to 6 families'); // every family with the app is the default
  // families of chosen members: nobody until someone is picked, then the count follows
  await page.getByRole('button', { name: 'Families of chosen members' }).click();
  await expect(count).toHaveText('Goes to 0 families');
  await expect(page.getByText('Choose who gets it before you send.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Send to 0 families/ })).toBeDisabled();
  await page.getByLabel('Search members').fill('lina');
  await expect(page.getByRole('checkbox')).toHaveCount(1);
  await page.getByRole('checkbox', { name: /Oma Lina Wijaya/ }).click();
  await expect(count).toHaveText('Goes to 2 families'); // Maria and Daniel
  await page.getByLabel('Search members').fill('zzz');
  await expect(page.getByText('Nobody matches your search.')).toBeVisible();
  await page.getByLabel('Search members').fill('');
  await page.getByRole('checkbox', { name: /Opa Budi Wijaya/ }).click(); // Oma Lina's family again: still two
  await expect(count).toHaveText('Goes to 2 families');
  await page.getByRole('checkbox', { name: /Opa Budi Wijaya/ }).click(); // off again
  await page.getByRole('checkbox', { name: /Opa Hendra Gunawan/ }).click();
  await expect(count).toHaveText('Goes to 4 families');
  await expect(picked).toHaveText('2 members chosen');
  // chosen people: six contacts over two pages of five, searchable; the picks of the other choice are kept
  await page.getByRole('button', { name: 'Chosen people' }).click();
  await expect(count).toHaveText('Goes to 0 families');
  await expect(page.getByRole('checkbox')).toHaveCount(5);
  await goToPage(page, 2, 'Search result pages');
  await page.getByRole('checkbox', { name: /Yohana Lim/ }).click();
  await expect(count).toHaveText('Goes to 1 family');
  await expect(picked).toHaveText('1 person chosen');
  await page.getByLabel('Search family contacts').fill('gunawan');
  await expect(page.getByRole('checkbox')).toHaveCount(2); // Cynthia and Stephanie
  await page.getByRole('button', { name: 'Select all in the list' }).click();
  await expect(count).toHaveText('Goes to 3 families');
  await page.getByRole('button', { name: 'Clear selection' }).click();
  await expect(count).toHaveText('Goes to 0 families');
  await page.getByRole('button', { name: 'Families of chosen members' }).click();
  await expect(count).toHaveText('Goes to 4 families'); // switching back kept the member picks
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(toast(page, 'Draft saved. Edit it before sending.')).toBeVisible();
  await expect(page.getByText('Drafts', { exact: true })).toBeVisible();
  await expect(page.getByText('November check-in').first()).toBeVisible();
  await expect(page.locator('[data-draft-audience]')).toContainText('Families of 2 members · 4 families');
  // the draft can be edited: its audience comes back, and it can change
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Title')).toHaveValue('November check-in');
  await expect(count).toHaveText('Goes to 4 families');
  await expect(picked).toHaveText('2 members chosen');
  await page.getByLabel('Title').fill('November check-in 2026');
  await page.getByRole('button', { name: 'Send to 4 families' }).click();
  await expect(toast(page, 'Survey sent to 4 families on WhatsApp (demo), with a link into the app.')).toBeVisible();
  await expect(page.getByText('Live · sent Wed 21 Oct')).toBeVisible();
  await expect(page.getByText('Sent to: Families of 2 members · 4 families')).toBeVisible();
  await expect(page.getByText('November check-in 2026').first()).toBeVisible();
  await expect(page.getByText('0 of 4 families').first()).toBeVisible();
  // October is now an earlier survey
  await expect(page.locator('[data-survey="sv1"]')).toContainText('October check-in');
  // a family sees it and answers once
  const r = await page.request.post('/api/actions/survey.answer', { headers: { 'x-user-id': 'f1' }, data: { mutationId: 'e2e-sv-1', input: { surveyId: 'sv2', overall: 5, team: { s1: 5 }, recommend: true, comment: 'Lovely' } } });
  expect(r.ok()).toBeTruthy();
  const again = await page.request.post('/api/actions/survey.answer', { headers: { 'x-user-id': 'f1' }, data: { mutationId: 'e2e-sv-2', input: { surveyId: 'sv2', overall: 4 } } });
  expect(again.status()).toBe(422);
  // a family that was not chosen has nothing to answer
  const notChosen = await page.request.post('/api/actions/survey.answer', { headers: { 'x-user-id': 'fm20_0' }, data: { mutationId: 'e2e-sv-3', input: { surveyId: 'sv2', overall: 4 } } });
  expect(notChosen.status()).toBe(403);
  await expect(page.getByText('1 of 4 families').first()).toBeVisible();
  // the answer is counted: overall, recommend and the rating for Caca (the comment question was switched off, so nothing is kept for it)
  await expect(page.getByText('1 answer', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('5.0 / 5').first()).toBeVisible();
  await expect(page.getByText('Lobby · 1 rating')).toBeVisible();
  await expect(page.getByText('Lovely')).toHaveCount(0);
  // close it
  await page.getByRole('button', { name: 'Close survey' }).click();
  await expect(toast(page, 'November check-in 2026 is closed.')).toBeVisible();
  await expect(page.locator('[data-survey="sv2"]')).toBeVisible();
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

// ---------------------------------------------------------------- plans and pricing
test('surveys: your own questions (stars, yes or no, choice, text): build, check, reorder, edit, remove, send; families answer; results per question', async ({ page, browser }) => {
  const c = watchConsole(page);
  const shot = async (p: Page, name: string, el?: ReturnType<Page['locator']>) => { if (process.env.E2E_SHOTS) await (el ?? p).screenshot({ path: `artifacts/shots/${test.info().project.name}-${name}.png` }); };
  await signIn(page, 's9', '/surveys');
  await page.getByLabel('Title').fill('Menu check');
  // the presets are optional now: keep only "Overall"
  for (const name of ['Rate the team', 'Would you recommend us?', 'Anything we could do better?']) await page.getByRole('button', { name }).click();
  const section = page.getByTestId('survey-custom');
  const rows = page.locator('[data-custom-q]');
  const dlg = page.getByRole('dialog', { name: /^(New|Edit) question$/ });
  await expect(page.getByRole('button', { name: /^Send to 6 families/ })).toBeEnabled(); // overall alone is a survey
  // a mistake shows when Save is tapped, and nothing is added
  await section.getByRole('button', { name: 'Add a question' }).click();
  await dlg.getByRole('button', { name: 'Add question' }).click();
  await expect(dlg.getByText('Write the question, up to 200 characters.')).toBeVisible();
  await dlg.getByLabel('Question').fill('How was the new menu?');
  await dlg.getByRole('switch', { name: /Families must answer this/ }).click();
  await shot(page, 'q-dialog-stars');
  await dlg.getByRole('button', { name: 'Add question' }).click();
  await expect(rows).toHaveCount(1);
  // yes or no (optional)
  await section.getByRole('button', { name: 'Add a question' }).click();
  await dlg.getByLabel('Question').fill('Did Oma enjoy the Thursday outing?');
  await pickOption(page, 'Answer type', /^Yes or no/);
  await dlg.getByRole('button', { name: 'Add question' }).click();
  // a choice needs 2 to 8 different options
  await section.getByRole('button', { name: 'Add a question' }).click();
  await dlg.getByLabel('Question').fill('Which evening suits the family?');
  await pickOption(page, 'Answer type', /^Pick one option/);
  await dlg.getByLabel('Options').fill('Friday');
  await dlg.getByRole('switch', { name: /Families must answer this/ }).click();
  await dlg.getByRole('button', { name: 'Add question' }).click();
  await expect(dlg.getByText('Write 2 to 8 different options, one on each line.')).toBeVisible();
  await dlg.getByLabel('Options').fill('Friday\nSaturday\nsaturday\nSunday');
  await expect(dlg.getByText('3 options')).toBeVisible(); // the repeat is ignored
  await shot(page, 'q-dialog-choice');
  await dlg.getByRole('button', { name: 'Add question' }).click();
  // free text (optional), and one that is removed again
  await section.getByRole('button', { name: 'Add a question' }).click();
  await dlg.getByLabel('Question').fill('What should we cook next month?');
  await pickOption(page, 'Answer type', /^Free text/);
  await dlg.getByRole('button', { name: 'Add question' }).click();
  await section.getByRole('button', { name: 'Add a question' }).click();
  await dlg.getByLabel('Question').fill('Remove me');
  await dlg.getByRole('button', { name: 'Add question' }).click();
  await expect(rows).toHaveCount(5);
  await page.getByRole('button', { name: /^Remove question: Remove me/ }).click();
  await expect(rows).toHaveCount(4);
  // reorder: the choice moves up one place; the first has no "Move up" and the last no "Move down"
  await page.getByRole('button', { name: /^Move up: Which evening/ }).click();
  await expect(rows).toHaveText([/How was the new menu\?/, /Which evening suits the family\?/, /Did Oma enjoy/, /What should we cook/]);
  await expect(rows.first().getByRole('button', { name: /^Move up/ })).toHaveCount(0);
  await expect(rows.last().getByRole('button', { name: /^Move down/ })).toHaveCount(0);
  await expect(rows.nth(1)).toContainText('Friday · Saturday · Sunday');
  // edit one: its values come back in the dialog
  await page.getByRole('button', { name: /^Edit question: Did Oma/ }).click();
  await expect(dlg).toBeVisible();
  await expect(dlg.getByLabel('Question')).toHaveValue('Did Oma enjoy the Thursday outing?');
  await dlg.getByLabel('Question').fill('Did Oma enjoy the Thursday outing at the temple?');
  await dlg.getByRole('button', { name: 'Save question' }).click();
  await expect(rows.nth(2)).toContainText('Did Oma enjoy the Thursday outing at the temple?');
  await section.scrollIntoViewIfNeeded();
  await shot(page, 'q-list', section);
  // saved as a draft, edited again (the questions come back in order), then sent
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(toast(page, 'Draft saved. Edit it before sending.')).toBeVisible();
  await expect(page.locator('[data-draft-audience]').locator('xpath=..')).toContainText('4 questions of your own');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(1)).toContainText('Which evening suits the family?');
  await page.getByRole('button', { name: 'Send to 6 families' }).click();
  await expect(toast(page, 'Survey sent to 6 families on WhatsApp (demo), with a link into the app.')).toBeVisible();

  // Maria answers on her phone: required questions first
  const fam = await otherSession(browser);
  await signIn(fam.page, 'f1', '/today?survey=1');
  const sheet = fam.page.getByRole('dialog', { name: 'Menu check' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('group', { name: 'Overall' }).getByRole('button', { name: '5 of 5' }).click();
  await expect(sheet.getByRole('button', { name: 'Send answers' })).toHaveAttribute('aria-disabled', 'true');
  await expect(sheet.getByText('Answer the questions marked Required to send.')).toBeVisible();
  await sheet.getByRole('group', { name: 'How was the new menu?' }).getByRole('button', { name: '4 of 5' }).click();
  await expect(sheet.getByRole('button', { name: 'Send answers' })).toHaveAttribute('aria-disabled', 'true'); // the choice is still open
  await sheet.getByRole('radio', { name: 'Saturday' }).click();
  await sheet.getByRole('radiogroup', { name: 'Did Oma enjoy the Thursday outing at the temple?' }).getByRole('radio', { name: 'Yes' }).click();
  await sheet.getByLabel('What should we cook next month?').fill('More soto please');
  await shot(fam.page, 'family-sheet-top', sheet);
  await sheet.getByRole('button', { name: 'Send answers' }).click();
  await expect(fam.page.getByTestId('survey-card')).toContainText('Thank you. Your answers went to the club team.');
  // the other five families answer through the API; a required question cannot be skipped
  const send = (uid: string, input: object, n: string) => page.request.post('/api/actions/survey.answer', { headers: { 'x-user-id': uid }, data: { mutationId: `e2e-cq-${n}`, input: { surveyId: 'sv2', overall: 4, ...input } } });
  // the draft was saved in this order, so the questions are q1 stars, q2 choice, q3 yes or no, q4 text
  expect((await send('f2', { answers: { q1: 5 } }, 'miss')).status()).toBe(422); // the choice is required
  expect((await send('f2', { answers: { q1: 5, q2: 'Monday' } }, 'bad')).status()).toBe(422); // not one of the options
  const rest: [string, number, string, boolean, string][] /* uid, stars, choice, yes or no, text */ = [['f2', 5, 'Friday', false, 'Answer two'], ['fm10_0', 3, 'Friday', true, 'Answer three'], ['fm20_0', 4, 'Sunday', true, 'Answer four'], ['fm2_0', 5, 'Friday', false, 'Answer five'], ['fm2_1', 5, 'Saturday', true, 'Answer six']];
  for (const [uid, q1, q2, q3, q4] of rest) expect((await send(uid, { answers: { q1, q2, q3, q4 } }, uid)).ok()).toBeTruthy();

  // management: a summary per question
  await page.getByRole('button', { name: 'See details' }).click();
  const detail = page.getByRole('dialog', { name: 'Menu check' });
  await expect(detail.getByText('6 of 6 families').first()).toBeVisible();
  const res = detail.getByTestId('survey-results');
  await expect(res.locator('[data-result="q1"]')).toContainText('4.3 / 5'); // 4, 5, 3, 4, 5, 5
  await expect(res.locator('[data-result="q1"]')).toContainText('6 answers');
  await expect(res.locator('[data-result="q1"]')).toContainText('Required');
  await expect(res.locator('[data-result="q3"]')).toContainText('4 · 67%'); // four of six said yes
  await expect(res.locator('[data-result="q3"]')).toContainText('2 · 33%');
  const choice = res.locator('[data-result="q2"]');
  await expect(choice.getByText('Friday')).toBeVisible();
  await expect(choice).toContainText('3 · 50%');
  await expect(choice).toContainText('2 · 33%');
  await expect(choice).toContainText('1 · 17%');
  await expect(choice.getByRole('img', { name: 'Sunday: 1' })).toBeVisible();
  // written answers: five a page, newest first, then a second page
  const text = res.locator('[data-result="q4"]');
  await expect(text.getByText(/“Answer \w+”/)).toHaveCount(5);
  await expect(text.getByText('“More soto please”')).toHaveCount(0);
  await goToPage(page, 2, 'Answer pages');
  await expect(text.getByText(/“.+”/)).toHaveCount(1);
  await expect(text.getByText('“More soto please”')).toBeVisible();
  await shot(page, 'results', res);
  await expect(detail.getByText('Answered · 5/5').first()).toBeVisible(); // Maria's overall rating still shows per family
  await detail.getByRole('button', { name: 'Close', exact: true }).last().click();
  await expect(page.getByText('Live · sent Wed 21 Oct')).toBeVisible();
  await fam.ctx.close();
  c.assertClean();
});

test('plans: prices change only on Save, with validation; the Flex visits rule is editable; the preview follows a chosen member', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/plans');
  await expect(page.getByRole('heading', { name: 'Plans and pricing', level: 1 })).toBeVisible();
  const flex = page.getByLabel('Flex price in rupiah');
  await expect(flex).toHaveValue('5.500.000');
  await expect(page.getByText('Sample price')).toHaveCount(3);
  // Flex is a number of visits a month, counted from check-ins; there is nothing about booked days or leave
  if (!isPhone(page)) { // a phone drops the plan descriptions
    await expect(page.getByText('10 visits a month. A visit counts when the member checks in.')).toBeVisible();
    await expect(page.getByText('Charged for each Flex visit beyond 10 in a month.')).toBeVisible();
  }
  await expect(page.getByText('On next month’s invoice')).toBeVisible();
  await expect(page.getByLabel('Flex visits per month')).toHaveValue('10');
  await expect(page.getByLabel(/Leave days/)).toHaveCount(0);
  await expect(page.getByText(/leave|booked by|club days/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
  await expect(page.getByTestId('plan-preview-total')).toHaveText('Rp 5.500.000'); // Oma Lina, 15 November: 10 visits in October, so nothing extra
  await expect(page.getByText('Oma Lina Wijaya · invoice of 15 November')).toBeVisible();

  // typing changes nothing until Save; the preview shows what it would be
  await flex.fill('6000000');
  await expect(flex).toHaveValue('6.000.000');
  await expect(page.getByTestId('plan-preview-total')).toHaveText('Rp 6.000.000');
  await expect(page.getByText('Showing what you typed. Not saved yet.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Flex price in rupiah')).toHaveValue('5.500.000');
  // Cancel throws the edit away
  await page.getByLabel('Flex price in rupiah').fill('7000000');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByLabel('Flex price in rupiah')).toHaveValue('5.500.000');
  await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);

  // validation
  await page.getByLabel('Flex price in rupiah').fill('0');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Enter a price above zero.')).toBeVisible();
  await page.getByLabel('Flex price in rupiah').fill('6000000');
  await page.getByLabel('Flex visits per month').fill('30');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Use a whole number from 1 to 23.')).toBeVisible();

  // save the prices
  await page.getByLabel('Flex visits per month').fill('10');
  await page.getByLabel('Extra day price in rupiah').fill('700000');
  await expect(page.getByRole('switch', { name: 'Notify the team' })).toHaveAttribute('aria-checked', 'true'); // on by default
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0); // saved: the bar is gone (the toast only lasts a few seconds, too short to rely on when the machine is busy)
  await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
  await expect(page.getByText('Sample price')).toHaveCount(1); // only Gold is still a sample; Flex and Extra day are now the club's own
  await expect(page.getByTestId('plan-preview-total')).toHaveText('Rp 6.000.000');
  await page.reload();
  await expect(page.getByLabel('Flex price in rupiah')).toHaveValue('6.000.000');
  await expect(page.getByLabel('Extra day price in rupiah')).toHaveValue('700.000');

  // the rule: Flex visits per month
  await page.getByLabel('Flex visits per month').fill('8');
  await expect(page.getByText('8 visits a month', { exact: true })).toBeVisible(); // the cards follow as you type
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0); // saved: the bar is gone (the toast only lasts a few seconds, too short to rely on when the machine is busy)
  // Oma Lina made 10 visits in October: with a quota of 8, two are extra days on the next invoice
  await expect(page.getByText('Extra days · October (2)')).toBeVisible();
  await expect(page.getByTestId('plan-preview-total')).toHaveText('Rp 7.400.000');
  await page.reload();
  await expect(page.getByLabel('Flex visits per month')).toHaveValue('8');
  const snap = await (await page.request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': 's9' } })).json();
  expect(snap.state.club.settings.flexQuota).toBe(8);
  expect(snap.state.club.settings).not.toHaveProperty('leavePerYear');
  expect(Object.values(snap.state.prices as Record<string, { flex: number; extra: number }>).some((p) => p.flex === 6000000 && p.extra === 700000)).toBe(true);

  // preview for another member: Opa Budi is Gold
  await pickOption(page, 'Preview for', 'Opa Budi Wijaya');
  await expect(page.getByText('Opa Budi Wijaya · invoice of 15 November')).toBeVisible();
  await expect(page.getByTestId('plan-preview-total')).toHaveText('Rp 9.500.000');
  await assertNoHorizontalScroll(page);

  // the notify toggle: finance was told about the first change; with the toggle off the next change is silent
  const priceNotes = async () => Object.values((await (await page.request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': 's10' } })).json()).state.notifications as Record<string, { kind: string }>).filter((n) => n.kind === 'mgmt.notif.pricesChanged').length;
  expect(await priceNotes()).toBe(1);
  await page.getByLabel('Gold price in rupiah').fill('9600000');
  await page.getByRole('switch', { name: 'Notify the team' }).click();
  await expect(page.getByRole('switch', { name: 'Notify the team' })).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('Gold price in rupiah')).toHaveValue('9.600.000');
  expect(await priceNotes()).toBe(1); // no new notification
  c.assertClean();
});

test('plans: an extra visit from a check-in is on the member’s next invoice at the extra-day price (with the unsaved price while typing)', async ({ page, request }) => {
  const c = watchConsole(page);
  // Oma Lina has made 10 visits this October. The front desk checks her in today: her 11th visit.
  const r = await request.post('/api/actions/attendance.checkIn', { headers: { 'x-user-id': 's1' }, data: { mutationId: 'e2e-lina-11', input: { memberId: 'm1', method: 'manual' } } });
  expect(r.ok()).toBeTruthy();
  await signIn(page, 's9', '/plans');
  await expect(page.getByText('Oma Lina Wijaya · invoice of 15 November')).toBeVisible();
  await expect(page.getByText('Extra days · October (1)')).toBeVisible();
  await expect(page.getByTestId('plan-preview-total')).toHaveText('Rp 6.150.000'); // Flex 5.500.000 + 1 extra day at 650.000
  await page.getByLabel('Extra day price in rupiah').fill('700000');
  await expect(page.getByTestId('plan-preview-total')).toHaveText('Rp 6.200.000');
  await page.getByLabel('Flex visits per month').fill('11');
  await expect(page.getByText('Extra days · October')).toHaveCount(0); // with 11 visits a month, her 11th is not extra
  await expect(page.getByTestId('plan-preview-total')).toHaveText('Rp 5.500.000');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByText('Extra days · October (1)')).toBeVisible();
  await pickOption(page, 'Preview for', 'Opa Budi Wijaya'); // Gold: unlimited, never extra
  await expect(page.getByTestId('plan-preview-total')).toHaveText('Rp 9.500.000');
  await expect(page.getByText(/Extra days/)).toHaveCount(0);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

// ---------------------------------------------------------------- every screen, every viewport
for (const [path, heading] of SCREENS) {
  test(`renders without console errors or sideways scroll: ${path}`, async ({ page }) => {
    const c = watchConsole(page);
    await signIn(page, 's9', path);
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
    await expect(page.getByText('Build in progress')).toHaveCount(0);
    await assertNoHorizontalScroll(page);
    await noRawKeys(page);
    c.assertClean();
  });
}

// While the icon font is still loading, icon names show as wide text. No screen of this area may depend on it to fit the width.
test('layout holds while the icon font has not loaded: no screen of this area scrolls sideways', async ({ page }) => {
  await page.route(/\.woff2?(\?.*)?$/, (r) => r.abort());
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push((e.stack || String(e)).split('\n').slice(0, 6).join(' | ')));
  await signIn(page, 's9', '/today');
  for (const [path, heading] of SCREENS) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, level: 1 }), errors.join('\n')).toBeVisible();
    await assertNoHorizontalScroll(page);
  }
  expect(errors, errors.join('\n')).toEqual([]);
});

test('the shell navigation reaches each management screen of this area', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9');
  for (const key of ['broadcast', 'venue', 'hr', 'surveys', 'plans', 'enquiries']) {
    if (isPhone(page)) {
      await page.locator('[data-nav-key="more"]').click();
      await page.getByRole('dialog').locator(`[data-nav-key="${key}"]`).click();
    } else await page.locator(`[data-nav-key="${key}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`/${key}$`));
    await expect(page.locator('#main h1')).toBeVisible();
  }
  c.assertClean();
});

// ---------------------------------------------------------------- Indonesian
test('Indonesian: every management screen is translated, with no raw keys and no sideways scroll', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/today', 'id');
  await expect(page.getByRole('heading', { name: 'Kedatangan', level: 1 })).toBeVisible(); // management lands on Arrivals
  await noRawKeys(page);
  await assertNoHorizontalScroll(page);
  const checks: [string, string, RegExp[]][] = [
    ['/broadcast', 'Siaran', [/Templat WhatsApp/, /Keluarga · 6/, /Kirim ke 6 orang/]],
    ['/venue', 'Pemesanan venue', [/Acara luar/, /Pemesanan baru/, /Terkonfirmasi · di kalender/]],
    ['/hr', 'SDM', isPhone(page) ? [/Data staf/, /Tambah staf/] : [/Data staf/, /Tambah staf/, /Hanya manajemen/]], // a phone drops the management-only note
    ['/surveys', 'Survei', [/Keluarga · kepuasan/, /Tingkat respons/, /Survei sebelumnya/, /Siapa yang menerima/, /Semua keluarga yang memakai aplikasi/, /Dikirim ke 6 keluarga/]],
    ['/plans', 'Paket dan harga', [/Pengaturan klub/, /Pratinjau tagihan berikutnya/, /Harga contoh/, ...(isPhone(page) ? [] : [/10 kunjungan sebulan\./]), /Kunjungan Flex per bulan/]],
    ['/enquiries', 'Calon anggota', [/Calon baru/, /Percobaan terjadwal/]],
  ];
  for (const [path, heading, texts] of checks) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
    for (const re of texts) await expect(page.getByText(re).first()).toBeVisible();
    await noRawKeys(page);
    await assertNoHorizontalScroll(page);
  }
  // dialogs in Indonesian too
  await page.goto('/venue');
  await page.getByRole('button', { name: 'Pemesanan baru' }).click();
  await expect(page.getByText('Organisasi')).toBeVisible();
  await expect(page.getByText('Pilih hari').first()).toBeVisible();
  await noRawKeys(page);
  await page.goto('/hr');
  await page.getByRole('button', { name: 'Tambah staf' }).click();
  await expect(page.getByRole('dialog').getByText('Kontrak dan KTP')).toBeVisible();
  await noRawKeys(page);
  c.assertClean();
});
