// Enquiries and the public membership form: the board on every viewport (paged columns), new / edit / archive / restore, visits and trials with a picked day and time,
// Move to and drag, lost and reopen, the form link, the family's form end to end with no sign-in (drafts, uploads, signature, Spouse), staff review / return,
// Approve = Join in one flow (plan and first day; management creates the member and the family login, other staff send it for approval), Indonesian.
// Isolated env: E2E_NAME=mgmt E2E_PORT=8881 scripts/e2e-all.sh 1 "phone laptop" mgmt enquiries
import { test, expect, type Browser, type Page } from '@playwright/test';
import { resetDemo, signIn, watchConsole, isPhone, assertNoHorizontalScroll } from './helpers';
import { fieldText, goToPage, pickDate, pickOption, pickTime } from './kit';

test.beforeEach(async ({ request }) => { boardLang = 'en'; await resetDemo(request); });

type Stage = 'new' | 'visit' | 'trial' | 'joined' | 'lost';
const STAGES: Stage[] = ['new', 'visit', 'trial', 'joined', 'lost'];
const STAGE_NAME: Record<Stage, string> = { new: 'New', visit: 'Visit', trial: 'Trial booked', joined: 'Joined', lost: 'Lost' };
const STAGE_NAME_ID: Record<Stage, string> = { new: 'Baru', visit: 'Kunjungan', trial: 'Percobaan terjadwal', joined: 'Bergabung', lost: 'Batal' };
let boardLang: 'en' | 'id' = 'en'; // the language the current test shows the board in (phone chips carry the stage name)

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

// ---- the board: a phone shows one stage at a time (a "Stage" dropdown with the counts), wider screens show all five columns
const stageName = (st: Stage) => (boardLang === 'id' ? STAGE_NAME_ID : STAGE_NAME)[st];
const stageBox = (page: Page) => page.getByRole('combobox', { name: boardLang === 'id' ? 'Tahap' : 'Stage' });
/** Phone: choose a stage in the dropdown. */
async function pickStage(page: Page, st: Stage) { await pickOption(page, boardLang === 'id' ? 'Tahap' : 'Stage', new RegExp(`^${stageName(st)} ·`)); }
async function openStage(page: Page, st: Stage) {
  if (isPhone(page)) await pickStage(page, st);
  return isPhone(page) ? page.locator('#main') : page.locator(`[data-stage="${st}"]`);
}
const lead = (page: Page, id: string) => page.locator(`[data-lead="${id}"]`);
async function counts(page: Page) {
  const out = {} as Record<Stage, number>;
  for (const st of STAGES) {
    if (isPhone(page)) {
      await stageBox(page).click();
      out[st] = Number(((await page.getByRole('option', { name: new RegExp(`^${stageName(st)} ·`) }).innerText()).match(/· (\d+)/) ?? [])[1]);
      await page.keyboard.press('Escape');
    } else out[st] = await page.locator(`[data-stage="${st}"] [data-lead]`).count();
  }
  return out;
}
/** Move a card to another stage with its own control (phone: the chips on the card; wider: the Move to dialog). */
async function moveCard(page: Page, id: string, from: Stage, to: Stage, who: string) {
  await openStage(page, from);
  const card = lead(page, id);
  if (isPhone(page)) await card.locator(`[data-move="${to}"]`).click();
  else {
    await card.getByRole('button', { name: 'Move to' }).click();
    await page.getByRole('dialog', { name: who }).getByRole('button', { name: STAGE_NAME[to], exact: true }).click();
  }
}
const snapshot = async (page: Page, as = 's9') => (await (await page.request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': as } })).json()).state;
let mut = 0;
const act = (page: Page, name: string, input: unknown, as = 's9') =>
  page.request.post(`/api/actions/${name}`, { headers: { 'x-user-id': as }, data: { mutationId: `e2e-enq-${test.info().workerIndex}-${Date.now().toString(36)}-${++mut}`, input } });

// ---------------------------------------------------------------- the board
test('board: five stages with the right leads, cards that read in words, and a deep link that opens the lead', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/enquiries');
  await expect(page.getByRole('heading', { name: 'Enquiries', level: 1 })).toBeVisible();
  await expect(page.getByText('Wednesday 21 October', { exact: true })).toBeVisible();
  if (!isPhone(page)) await expect(page.getByText(/^Move a card with its button, or drag it\./)).toBeVisible(); // a phone has no intro line
  await expect.poll(() => counts(page)).toEqual({ new: 1, visit: 2, trial: 1, joined: 0, lost: 1 });
  if (!isPhone(page)) {
    await expect(page.locator('[data-stage="joined"]')).toContainText('Drop a card here');
    await expect(page.locator('[data-stage="trial"]')).toContainText('Booked at least 1 day ahead');
  } else {
    await pickStage(page, 'joined');
    await expect(page.getByText('Nobody at this stage.')).toBeVisible();
  }

  // trial today, the family's form is waiting for review
  await openStage(page, 'trial');
  const e1 = lead(page, 'e1');
  await expect(e1).toContainText('Oma Siu Lan Tjandra');
  await expect(e1).toContainText('Melinda Tjandra · daughter');
  await expect(e1).toContainText('Referral');
  await expect(e1).toContainText('Form ready to review');
  await expect(e1).toContainText(/Trial day Wed 21 Oct/);
  // approving the form is the join, so there is no separate Join button next to a form that waits for review
  for (const b of ['Review form', 'Change day', 'Lost']) await expect(e1.getByRole('button', { name: b, exact: true }).first()).toBeVisible();
  await expect(e1.getByRole('button', { name: 'Join', exact: true })).toHaveCount(0);
  await expect(e1.getByRole('button', { name: 'Edit lead' })).toBeVisible();

  // two visits: one has a form link out, the other has none yet
  await openStage(page, 'visit');
  await expect(lead(page, 'e2')).toContainText('Bapak Yusuf Hamid');
  await expect(lead(page, 'e2')).toContainText('Ilham Hamid · son');
  await expect(lead(page, 'e2')).toContainText('Instagram');
  await expect(lead(page, 'e2')).toContainText('Visit Wed 21 Oct, 14:00');
  await expect(lead(page, 'e2').getByRole('button', { name: 'Send form link' })).toBeVisible();
  await expect(lead(page, 'e2').getByRole('button', { name: 'Book trial' })).toBeVisible();
  await expect(lead(page, 'e5')).toContainText('Opa Leo Gunadi');
  await expect(lead(page, 'e5')).toContainText('Visit Fri 23 Oct, 11:00');
  await expect(lead(page, 'e5')).toContainText('Form sent');
  for (const b of ['Book trial', 'Form link', 'Fill as family (demo)', 'Change time']) await expect(lead(page, 'e5').getByRole('button', { name: b, exact: true })).toBeVisible();
  await expect(lead(page, 'e5').getByRole('button', { name: 'Send form link' })).toHaveCount(0);

  await openStage(page, 'new');
  await expect(lead(page, 'e3')).toContainText('Oma Ellen Sutanto');
  await expect(lead(page, 'e3')).toContainText('Kevin Sutanto · grandson');
  await expect(lead(page, 'e3')).toContainText('Website');
  await expect(lead(page, 'e3')).toContainText('Call back Thu 22 Oct');
  await expect(lead(page, 'e3').getByRole('button', { name: 'Book visit' })).toBeVisible();

  // a lost lead shows why, and can be reopened (not booked)
  await openStage(page, 'lost');
  await expect(lead(page, 'e9')).toContainText('Ibu Nyoman Sari');
  await expect(lead(page, 'e9')).toContainText('Chose another place');
  await expect(lead(page, 'e9')).toContainText('Chose a place closer to family in Bali');
  await expect(lead(page, 'e9').getByRole('button', { name: 'Reopen' })).toBeVisible();
  await expect(lead(page, 'e9').getByRole('button', { name: 'Book visit' })).toHaveCount(0);
  await assertNoHorizontalScroll(page);

  // another screen can open a lead straight away
  await page.goto('/enquiries?e=e3');
  const edit = page.getByRole('dialog', { name: 'Oma Ellen Sutanto' });
  await expect(edit).toBeVisible();
  await expect(edit.getByLabel(/^Name/)).toHaveValue('Ellen Sutanto');
  await expect(edit.getByLabel(/^Contact person/)).toHaveValue('Kevin Sutanto');
  await expect(edit.getByLabel(/^Mobile/)).toHaveValue('+62 811-9034-2215');
  await expect(page).toHaveURL(/\/enquiries$/);
  c.assertClean();
});

// ---------------------------------------------------------------- new lead, edit, archive, restore
test('new lead: needs a name, a contact and a number; lands in New; can be edited, archived and restored', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/enquiries');
  await page.getByRole('button', { name: 'New lead' }).click();
  const d = page.getByRole('dialog', { name: 'New lead' });
  await d.getByRole('button', { name: 'Add lead' }).click(); // nothing filled in
  await expect(d.getByText('Please check the highlighted fields.')).toHaveCount(3);
  if (isPhone(page)) await expect(page.locator('#main')).toContainText('New · 1'); // the dialog is open: read the selected stage, not the list
  else await expect.poll(() => counts(page)).toMatchObject({ new: 1 });

  await d.getByRole('button', { name: 'Opa', exact: true }).click();
  await d.getByLabel(/^Name/).fill('Hartono Wijaya');
  await d.getByLabel(/^Contact person/).fill('Sinta Wijaya');
  await d.getByLabel(/^Mobile/).fill('0812 5500 1234');
  await d.getByRole('button', { name: 'Instagram', exact: true }).click();
  await d.getByLabel(/^Notes/).fill('Prefers mornings');
  await d.getByRole('button', { name: 'Add lead' }).click();
  await expect(toast(page, 'Lead added: Opa Hartono Wijaya.')).toBeVisible();
  await expect.poll(() => counts(page)).toMatchObject({ new: 2 });
  await openStage(page, 'new');
  const card = page.locator('[data-lead]').filter({ hasText: 'Hartono Wijaya' });
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('Sinta Wijaya · daughter');
  await expect(card).toContainText('Instagram');
  await expect(card).toContainText('Call back Thu 22 Oct'); // the next open day
  await expect(card).toContainText('Prefers mornings');
  const state = await snapshot(page);
  const row = Object.values(state.enquiries as Record<string, { senior: { name: string }; contact: { phone: string }; stage: string }>).find((x) => x.senior.name === 'Hartono Wijaya')!;
  expect(row).toMatchObject({ stage: 'new', contact: { phone: '+6281255001234' } });

  // edit
  await card.getByRole('button', { name: 'Edit lead' }).click();
  const e = page.getByRole('dialog', { name: 'Opa Hartono Wijaya' });
  await e.getByLabel(/^Name/).fill('Hartono Wijaya Senior');
  await e.getByRole('button', { name: 'Son', exact: true }).click();
  await e.getByRole('button', { name: 'Save changes' }).click();
  await expect(toast(page, 'Lead saved.')).toBeVisible();
  await expect(page.locator('[data-lead]').filter({ hasText: 'Hartono Wijaya Senior' })).toContainText('Sinta Wijaya · son');

  // archive: it leaves the board, and can be restored from the archive
  await page.locator('[data-lead]').filter({ hasText: 'Hartono Wijaya Senior' }).getByRole('button', { name: 'Edit lead' }).click();
  await page.getByRole('dialog', { name: 'Opa Hartono Wijaya Senior' }).getByRole('button', { name: 'Archive' }).click();
  await expect(toast(page, 'Opa Hartono Wijaya Senior archived.')).toBeVisible();
  await expect.poll(() => counts(page)).toMatchObject({ new: 1 });
  await page.getByRole('button', { name: 'Archived · 1' }).click();
  await expect(page.getByText('Archived leads')).toBeVisible();
  await expect(page.getByText('Opa Hartono Wijaya Senior', { exact: true })).toBeVisible();
  await expect(page.getByText('Sinta Wijaya · New · Wed 21 Oct')).toBeVisible();
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(toast(page, 'Opa Hartono Wijaya Senior is back on the board.')).toBeVisible();
  await expect.poll(() => counts(page)).toMatchObject({ new: 2 });
  await expect(page.getByRole('button', { name: /^Archived/ })).toHaveCount(0);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

// ---------------------------------------------------------------- visits
test('visit: pick any open day and a time; closed days, outings and times already passed are refused; change the time; it shows on the calendar', async ({ page }) => {
  test.setTimeout(90_000);
  const c = watchConsole(page);
  await signIn(page, 's9', '/enquiries');
  await openStage(page, 'new');
  await lead(page, 'e3').getByRole('button', { name: 'Book visit' }).click();
  const d = page.getByRole('dialog', { name: 'Oma Ellen Sutanto' });
  await expect(d.getByRole('button', { name: 'Pick a day and time' })).toBeDisabled();
  await d.getByRole('radio', { name: '14:00', exact: true }).click();
  await expect(d.getByRole('radio', { name: /^Wed 21 Oct Today/ })).toBeVisible();
  await expect(d.getByRole('radio', { name: /^Thu 22 Oct Tomorrow/ })).toBeVisible();
  await expect(d.getByRole('radio', { name: /^Sat 24 Oct/ })).toHaveCount(0); // weekends are not offered
  await expect(d.getByRole('radio', { name: /^Thu 29 Oct/ })).toHaveCount(0); // the outing day
  // another date: the calendar greys out the days nobody is at the club (weekend, outing, closure)
  await fieldText(page, /^Another date/).click();
  for (const iso of ['2026-10-24', '2026-10-25', '2026-10-29', '2026-10-30']) await expect(page.locator(`[data-date="${iso}"]`), iso).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('[data-date="2026-10-23"]')).not.toHaveAttribute('aria-disabled', 'true');
  await page.locator('[data-date="2026-10-21"]').click(); // today, with 14:00 chosen before: that can be booked
  await expect(d.getByRole('button', { name: 'Book visit · Wed 21 Oct, 14:00' })).toBeVisible();
  // another time: today's times that have passed cannot be picked
  await fieldText(page, /^Another time/).click();
  await expect(page.getByRole('listbox', { name: 'Hour' }).getByRole('option', { name: '08', exact: true })).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await d.getByRole('radio', { name: '14:00', exact: true }).click();
  await d.getByRole('radio', { name: /^Thu 22 Oct Tomorrow/ }).click();
  await d.getByRole('button', { name: 'Book visit · Thu 22 Oct, 14:00' }).click();
  await expect(toast(page, 'Visit booked for Oma Ellen Sutanto: Thu 22 Oct, 14:00. Kevin got the details on WhatsApp (demo).')).toBeVisible();
  await expect.poll(() => counts(page)).toEqual({ new: 0, visit: 3, trial: 1, joined: 0, lost: 1 });
  await openStage(page, 'visit');
  await expect(lead(page, 'e3')).toContainText('Visit Thu 22 Oct, 14:00');

  // the calendar shows it for the day
  await page.goto('/calendar');
  const day = page.locator('div[data-date="2026-10-22"]');
  await expect(day).toContainText('Oma Ellen Sutanto');
  await expect(day).toContainText('14:00');

  // change the time: the dialog starts from what was booked
  await page.goto('/enquiries');
  await openStage(page, 'visit');
  await lead(page, 'e3').getByRole('button', { name: 'Change time' }).click();
  const ch = page.getByRole('dialog', { name: 'Oma Ellen Sutanto' });
  await expect(ch.getByText('Change the visit')).toBeVisible();
  await expect(ch.getByRole('radio', { name: /^Thu 22 Oct/ })).toHaveAttribute('aria-checked', 'true');
  await expect(ch.getByRole('radio', { name: '14:00', exact: true })).toHaveAttribute('aria-checked', 'true');
  await ch.getByRole('radio', { name: '15:00', exact: true }).click();
  await ch.getByRole('button', { name: 'Book visit · Thu 22 Oct, 15:00' }).click();
  await expect(toast(page, /Visit booked for Oma Ellen Sutanto: Thu 22 Oct, 15:00\./)).toBeVisible();
  await expect(lead(page, 'e3')).toContainText('Visit Thu 22 Oct, 15:00');
  const guests = Object.values((await snapshot(page)).guestVisits as Record<string, { enquiryId: string; kind: string; time: string; status: string }>).filter((g) => g.enquiryId === 'e3' && g.status === 'booked');
  expect(guests.map((g) => [g.kind, g.time])).toEqual([['visit', '15:00']]); // one booking, not two
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('visit today: the front desk sees the guest in "Also today"', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/enquiries');
  await openStage(page, 'visit');
  await lead(page, 'e5').getByRole('button', { name: 'Change time' }).click();
  const d = page.getByRole('dialog', { name: 'Opa Leo Gunadi' });
  await d.getByRole('radio', { name: /^Wed 21 Oct Today/ }).click();
  await d.getByRole('radio', { name: '15:00', exact: true }).click();
  await d.getByRole('button', { name: 'Book visit · Wed 21 Oct, 15:00' }).click();
  await expect(toast(page, /Visit booked for Opa Leo Gunadi: Wed 21 Oct, 15:00\./)).toBeVisible();
  await signIn(page, 's1', '/today');
  const also = page.getByRole('region', { name: 'Also today' });
  await expect(also.getByText('Visit: Opa Leo Gunadi')).toBeVisible();
  await expect(also.getByText('Visit: Bapak Yusuf Hamid')).toBeVisible();
  c.assertClean();
});

// ---------------------------------------------------------------- trials
test('trial: a day pass booked at least a day ahead on an open day (no time, lunch and health check included); allergies and mobility go to the kitchen and nurse; it shows on the calendar', async ({ page }) => {
  test.setTimeout(90_000);
  const c = watchConsole(page);
  await signIn(page, 's9', '/enquiries');
  await openStage(page, 'visit');
  await lead(page, 'e2').getByRole('button', { name: 'Book trial' }).click();
  const d = page.getByRole('dialog', { name: 'Bapak Yusuf Hamid' });
  await expect(d.getByText('Book a trial day')).toBeVisible();
  await expect(d.getByRole('radio', { name: /^Wed 21 Oct/ })).toHaveCount(0); // today is not offered
  await expect(d.getByRole('radio', { name: /^Thu 22 Oct Tomorrow/ })).toBeVisible();
  // a trial has a day and nothing else to pick: no time, no lunch or health check switches (they are always included)
  await expect(d.getByText('Lunch and a health check are included.')).toBeVisible();
  await expect(d.getByText('Time', { exact: true })).toHaveCount(0);
  await expect(d.getByRole('radio', { name: '10:00', exact: true })).toHaveCount(0);
  await expect(d.getByRole('switch')).toHaveCount(0);
  await fieldText(page, /^Another date/).click();
  for (const iso of ['2026-10-21', '2026-10-29', '2026-10-30']) await expect(page.locator(`[data-date="${iso}"]`), iso).toHaveAttribute('aria-disabled', 'true'); // today (a day's notice), the outing, the closure
  await expect(page.locator('[data-date="2026-10-22"]')).not.toHaveAttribute('aria-disabled', 'true');
  await page.locator('[data-date="2026-10-22"]').click();
  await expect(d.getByRole('button', { name: 'Book trial · Thu 22 Oct', exact: true })).toBeVisible(); // a day alone is enough
  await expect(d.getByRole('radio', { name: /^Thu 22 Oct Tomorrow/ })).toHaveAttribute('aria-checked', 'true');
  // the kitchen is told about the allergy
  await d.getByRole('button', { name: 'Peanuts', exact: true }).click();
  await d.getByRole('button', { name: 'Walker', exact: true }).click();
  await d.getByRole('button', { name: 'Soft food', exact: true }).click();
  await d.getByRole('button', { name: 'Book trial · Thu 22 Oct', exact: true }).click();
  await expect(toast(page, 'Trial booked for Bapak Yusuf Hamid: Thu 22 Oct. Ilham got the details on WhatsApp (demo).')).toBeVisible();
  await expect.poll(() => counts(page)).toEqual({ new: 1, visit: 1, trial: 2, joined: 0, lost: 1 });
  await openStage(page, 'trial');
  await expect(lead(page, 'e2')).toContainText('Trial day Thu 22 Oct');
  await expect(lead(page, 'e2')).not.toContainText('Trial day Thu 22 Oct,'); // no time
  await expect(lead(page, 'e2').getByRole('button', { name: 'Change day' })).toBeVisible();

  const state = await snapshot(page);
  const guest = (Object.values(state.guestVisits) as { enquiryId: string; kind: string; status: string; food: string[]; mobility: string; diet: string[]; lunch: boolean; healthCheck: boolean; date: string }[]).find((g) => g.enquiryId === 'e2' && g.kind === 'trial')!;
  expect(guest).toMatchObject({ status: 'booked', date: '2026-10-22', food: ['peanuts'], mobility: 'walker', diet: ['softFood'], lunch: true, healthCheck: true });
  expect(guest).not.toHaveProperty('time');
  const kinds = async (as: string) => (Object.values((await snapshot(page, as)).notifications as Record<string, { kind: string; params?: { name?: string } }>)).filter((n) => n.params?.name === 'Bapak Yusuf Hamid').map((n) => n.kind);
  expect(await kinds('s3')).toContain('enq.notif.trialLunchAllergy'); // the chef is told about the peanut allergy
  expect(await kinds('s8')).toContain('enq.notif.trialHealth'); // the nurse is told to do an arrival check

  await page.goto('/calendar');
  await expect(page.locator('div[data-date="2026-10-22"]')).toContainText('Bapak Yusuf Hamid');
  await expect(page.locator('div[data-date="2026-10-22"]')).toContainText('Trial day');
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

// ---------------------------------------------------------------- move, lost, reopen, drag
test('Move to: any stage from the card; Lost asks for a reason; Reopen brings it back; Trial asks for a day first', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/enquiries');
  // New to Lost needs a reason
  await moveCard(page, 'e3', 'new', 'lost', 'Oma Ellen Sutanto');
  const lost = page.getByRole('dialog', { name: 'Oma Ellen Sutanto' });
  await expect(lost.getByRole('button', { name: 'Mark as lost' })).toBeDisabled();
  await lost.getByRole('button', { name: 'Price', exact: true }).click();
  await lost.getByLabel(/^Note/).fill('Too expensive for now');
  await lost.getByRole('button', { name: 'Mark as lost' }).click();
  await expect(toast(page, 'Oma Ellen Sutanto moved to Lost.')).toBeVisible();
  await expect.poll(() => counts(page)).toEqual({ new: 0, visit: 2, trial: 1, joined: 0, lost: 2 });
  await openStage(page, 'lost');
  await expect(lead(page, 'e3')).toContainText('Price');
  await expect(lead(page, 'e3')).toContainText('Too expensive for now');
  await lead(page, 'e3').getByRole('button', { name: 'Reopen' }).click();
  await expect(toast(page, 'Oma Ellen Sutanto is back as an open lead.')).toBeVisible();
  await expect.poll(() => counts(page)).toEqual({ new: 1, visit: 2, trial: 1, joined: 0, lost: 1 });

  // a visit goes back to New
  await moveCard(page, 'e2', 'visit', 'new', 'Bapak Yusuf Hamid');
  await expect(toast(page, 'Bapak Yusuf Hamid moved to New.')).toBeVisible();
  await expect.poll(() => counts(page)).toEqual({ new: 2, visit: 1, trial: 1, joined: 0, lost: 1 });
  // the visit that was booked for him today is gone from the lobby list
  await signIn(page, 's1', '/today');
  await expect(page.getByRole('region', { name: 'Also today' }).getByText('Visit: Bapak Yusuf Hamid')).toHaveCount(0);

  // Move to Trial opens the booking (a day is needed), and Cancel leaves everything as it was
  await page.goto('/enquiries');
  await moveCard(page, 'e3', 'new', 'trial', 'Oma Ellen Sutanto');
  const book = page.getByRole('dialog', { name: 'Oma Ellen Sutanto' });
  await expect(book.getByText('Book a trial day')).toBeVisible();
  await book.getByRole('button', { name: 'Cancel' }).click();
  await expect.poll(() => counts(page)).toEqual({ new: 2, visit: 1, trial: 1, joined: 0, lost: 1 });
  // reopening a lost lead by moving it
  await moveCard(page, 'e9', 'lost', 'new', 'Ibu Nyoman Sari');
  await expect(toast(page, 'Ibu Nyoman Sari is back as an open lead.')).toBeVisible();
  await expect.poll(() => counts(page)).toEqual({ new: 3, visit: 1, trial: 1, joined: 0, lost: 0 });
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

test('drag: a card dropped on another column moves it (wide screens)', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1280, 'phones and tablets move cards with the Move to button (five columns scroll sideways there)');
  const c = watchConsole(page);
  await signIn(page, 's9', '/enquiries');
  const card = lead(page, 'e3');
  const from = (await card.boundingBox())!;
  const to = (await page.locator('[data-stage="visit"]').boundingBox())!; // the Visit column is on screen; the Lost column may be scrolled out of view
  await page.mouse.move(from.x + 40, from.y + 20);
  await page.mouse.down();
  await page.mouse.move(from.x + 60, from.y + 40, { steps: 5 });
  await page.waitForTimeout(150); // let the drag start and the columns be measured
  await page.mouse.move(to.x + to.width / 2, to.y + 100, { steps: 25 });
  await page.waitForTimeout(150);
  await page.mouse.up();
  // dropping on Visit asks for the day and time of the visit; nothing moves until it is booked
  const d = page.getByRole('dialog', { name: 'Oma Ellen Sutanto' });
  await expect(d.getByText('Book a visit')).toBeVisible();
  await expect.poll(() => counts(page)).toEqual({ new: 1, visit: 2, trial: 1, joined: 0, lost: 1 });
  await d.getByRole('radio', { name: /^Thu 22 Oct Tomorrow/ }).click();
  await d.getByRole('radio', { name: '14:00', exact: true }).click();
  await d.getByRole('button', { name: 'Book visit · Thu 22 Oct, 14:00' }).click();
  await expect(toast(page, /Visit booked for Oma Ellen Sutanto/)).toBeVisible();
  await expect.poll(() => counts(page)).toEqual({ new: 0, visit: 3, trial: 1, joined: 0, lost: 1 });
  // a card dropped back where it came from does nothing
  const again = (await lead(page, 'e1').boundingBox())!;
  await page.mouse.move(again.x + 40, again.y + 20);
  await page.mouse.down();
  await page.mouse.move(again.x + 60, again.y + 40, { steps: 5 });
  await page.waitForTimeout(150);
  await page.mouse.move(again.x + 30, again.y + 120, { steps: 10 });
  await page.mouse.up();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => counts(page)).toEqual({ new: 0, visit: 3, trial: 1, joined: 0, lost: 1 });
  c.assertClean();
});

// ---------------------------------------------------------------- the form link
test('form link: send it, copy it, send it on WhatsApp (demo); the family opening it is seen on the card; staff can fill it as the family', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/enquiries');
  await openStage(page, 'new');
  await lead(page, 'e3').getByRole('button', { name: 'Send form link' }).click();
  await expect(toast(page, 'Membership form link ready for Kevin Sutanto.')).toBeVisible();
  const d = page.getByRole('dialog', { name: 'Kevin Sutanto' });
  await expect(d.getByText('Link sent to Kevin Sutanto on WhatsApp (+62 811-9034-2215) (demo).')).toBeVisible();
  const url = await d.getByTestId('form-link').inputValue();
  expect(url).toMatch(/\/form\/[0-9a-f]{8}$/);
  await d.getByRole('button', { name: 'Copy link' }).click();
  await expect(toast(page, 'Link copied.')).toBeVisible();
  await d.getByRole('button', { name: 'Send on WhatsApp (demo)' }).click();
  await expect(toast(page, 'Sent to Kevin on WhatsApp (demo).')).toBeVisible();
  await d.getByRole('button', { name: 'Close', exact: true }).last().click();
  await expect(lead(page, 'e3')).toContainText('Form sent');
  await expect(lead(page, 'e3').getByRole('button', { name: 'Send form link' })).toHaveCount(0);

  // the family opens the link on their own phone: no sign-in, and the card says so
  const fam = await otherSession(page.context().browser()!);
  const opened = fam.page.waitForResponse((r) => /\/api\/form\/[^/]+\/open$/.test(r.url()));
  await fam.page.goto(new URL(url).pathname);
  await expect(fam.page.getByRole('heading', { name: 'About the member', level: 1 })).toBeVisible();
  await expect(fam.page.getByText('Kevin, CitraPremier sent you this form for Oma Ellen.')).toBeVisible();
  expect((await opened).ok()).toBeTruthy();
  await fam.ctx.close();
  await page.reload();
  await openStage(page, 'new');
  await expect(lead(page, 'e3')).toContainText('Form opened');

  // staff can also fill it as the family (demo): the same form, with a way back
  await lead(page, 'e3').getByRole('button', { name: 'Fill as family (demo)' }).click();
  await expect(page).toHaveURL(/\/form\/[0-9a-f]{8}$/);
  await expect(page.getByRole('heading', { name: 'About the member', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Close form' }).click();
  await expect(page).toHaveURL(/\/enquiries$/);
  c.assertClean();
});

// ---------------------------------------------------------------- the family's form, end to end
test('the family fills in the form from the link with no sign-in: seven steps, a saved draft, uploads, signature, Spouse; staff review and approve it', async ({ page, browser }) => {
  test.setTimeout(150_000);
  const c = watchConsole(page);
  const next = page.getByTestId('form-next');
  const h1 = (n: string) => page.getByRole('heading', { name: n, level: 1 });
  await page.goto('/form/b4c9e5');

  // 1 · details: the name and the contact are known from the enquiry
  await expect(h1('About the member')).toBeVisible();
  await expect(page.getByRole('img', { name: /CitraPremier/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'EN', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Felicia, CitraPremier sent you this form for Opa Leo.')).toBeVisible();
  await expect(page.getByText('Step 1 of 7', { exact: true })).toBeVisible();
  await expect(page.getByLabel(/^Full name/)).toHaveValue('Leo Gunadi');
  await expect(page.getByLabel(/^Your name/)).toHaveValue('Felicia Gunadi');
  await assertNoHorizontalScroll(page);
  await next.click({ force: true }); // date of birth is missing
  await expect(page.getByText('Pick a valid date of birth.').first()).toBeVisible();
  await expect(h1('About the member')).toBeVisible();
  await pickDate(page, /^Date of birth/, '1948-03-12');
  await expect(fieldText(page, /^Date of birth/)).toContainText('12 Mar 1948');
  await page.getByLabel(/^Home address/).fill('Jl. Melati 12, Bogor');
  await page.getByRole('radio', { name: 'Spouse', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Spouse', exact: true })).toHaveAttribute('aria-checked', 'true');
  await next.click();

  // what they typed is kept: closing the page and coming back resumes at the same step
  await expect(h1('ID card (KTP)')).toBeVisible();
  await expect(page.getByText('Draft saved')).toBeVisible();
  await page.reload();
  await expect(h1('ID card (KTP)')).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(fieldText(page, /^Date of birth/)).toContainText('12 Mar 1948');
  await expect(page.getByLabel(/^Home address/)).toHaveValue('Jl. Melati 12, Bogor');
  await expect(page.getByRole('radio', { name: 'Spouse', exact: true })).toHaveAttribute('aria-checked', 'true');
  await next.click();

  // 2 · KTP: a simulated upload
  await page.getByRole('button', { name: /Take a photo of the KTP/ }).click();
  await expect(page.getByText('KTP_front.jpg')).toBeVisible();
  await expect(page.getByText('Uploaded · tap to remove')).toBeVisible();
  await next.click();

  // 3 · nanny: the question has to be answered
  await expect(h1('Nanny or carer')).toBeVisible();
  await next.click({ force: true });
  await expect(page.getByText('Please pick one.')).toBeVisible();
  await page.getByRole('radio', { name: 'Yes', exact: true }).click();
  await page.getByLabel(/^Nanny.s name/).fill('Sari Dewi');
  await page.getByRole('button', { name: /nanny.s KTP/ }).click();
  await expect(page.getByText('KTP_nanny.jpg')).toBeVisible();
  await next.click();

  // 4 · health: photo, conditions, medicines with when they are taken
  await expect(h1('Health information')).toBeVisible();
  await page.getByRole('button', { name: /Photo of his health information/ }).click();
  await expect(page.getByText('health_summary.jpg')).toBeVisible();
  await page.getByLabel(/^Health conditions/).fill('High blood pressure, diabetes');
  await page.getByRole('button', { name: 'Amlodipine 5 mg', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Morning, at home', exact: true })).toHaveAttribute('aria-checked', 'true');
  await page.getByLabel('Another medicine', { exact: true }).fill('Vitamin B12 500 mcg');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('Vitamin B12 500 mcg')).toBeVisible();
  await next.click();

  // 5 · allergies and mobility
  await expect(h1('Allergies and mobility')).toBeVisible();
  await next.click({ force: true }); // a mobility choice is needed (None counts)
  await expect(page.getByText('Please pick one.')).toBeVisible();
  await page.getByRole('button', { name: 'Peanuts', exact: true }).click();
  await page.getByLabel('Another food allergy', { exact: true }).fill('Kiwi');
  await page.getByRole('button', { name: 'Penicillin', exact: true }).click();
  await page.getByLabel('Another medicine allergy', { exact: true }).fill('Latex');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('radio', { name: 'Walking stick', exact: true }).click();
  await page.getByRole('button', { name: 'Low salt', exact: true }).click();
  await next.click();

  // 6 · consent and signature
  await expect(h1('Sign and consent')).toBeVisible();
  await next.click({ force: true });
  await expect(page.getByText('The use of information must be agreed to continue.')).toBeVisible();
  await expect(page.getByText('Please sign above.')).toBeVisible();
  await page.getByRole('switch', { name: /Use of his information/ }).click();
  await expect(page.getByRole('switch', { name: /Use of his information/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('switch', { name: /Face recognition at the door/ })).toHaveAttribute('aria-checked', 'false');
  const pad = page.getByTestId('signature-pad');
  await pad.scrollIntoViewIfNeeded();
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + 40, box.y + 110);
  await page.mouse.down();
  await page.mouse.move(box.x + 110, box.y + 40, { steps: 6 });
  await page.mouse.move(box.x + 180, box.y + 130, { steps: 6 });
  await page.mouse.move(box.x + 250, box.y + 60, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Clear', exact: true })).toBeEnabled();
  await next.click();

  // 7 · check and send: everything is listed, and Edit jumps back to a section
  await expect(h1('Check and send')).toBeVisible();
  await expect(page.getByText('Opa Leo Gunadi', { exact: true })).toBeVisible();
  await expect(page.getByText('Felicia Gunadi · spouse')).toBeVisible();
  await expect(page.getByText('Peanuts, Kiwi')).toBeVisible();
  await expect(page.getByText('Penicillin, Latex')).toBeVisible();
  await expect(page.getByText('Signed', { exact: true })).toBeVisible();
  await expect(page.getByText('No · checked in by name')).toBeVisible();
  await page.getByRole('button', { name: 'Edit: Allergies and mobility' }).click();
  await expect(h1('Allergies and mobility')).toBeVisible();
  await page.getByRole('button', { name: 'Soft food', exact: true }).click();
  await next.click();
  await next.click();
  await expect(h1('Check and send')).toBeVisible();
  await expect(page.getByText('Low salt, Soft food')).toBeVisible();
  await assertNoHorizontalScroll(page);
  await next.click();
  await expect(page.getByTestId('form-done')).toHaveText('Thank you, Felicia');
  await expect(page.getByText(/The club team will review the form before Opa Leo.s visit/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Back to the staff view/ })).toHaveCount(0); // not signed in
  // the link now only shows that it was sent
  await page.goto('/form/b4c9e5');
  await expect(page.getByTestId('form-done')).toBeVisible();
  c.assertClean();

  // staff: the card says the form is ready; the review shows everything the family entered
  const staff = await otherSession(browser);
  const sp = staff.page;
  const sc = watchConsole(sp);
  await signIn(sp, 's9', '/enquiries');
  await openStage(sp, 'visit');
  await expect(lead(sp, 'e5')).toContainText('Form ready to review');
  await lead(sp, 'e5').getByRole('button', { name: 'Review form' }).click();
  const rv = sp.getByRole('dialog', { name: 'Opa Leo Gunadi' });
  await expect(rv.getByText(/^Step 1 of 2 · Online form · sent /)).toBeVisible();
  for (const text of ['12 March 1948', 'Jl. Melati 12, Bogor', 'Felicia Gunadi · spouse', 'High blood pressure, diabetes', 'Amlodipine 5 mg (morning, at home), Vitamin B12 500 mcg (as prescribed)', 'Peanuts, Kiwi', 'Penicillin, Latex', 'Walking stick', 'Low salt, Soft food', 'Declined · lobby checks in by name']) {
    await expect(rv.getByText(text, { exact: true }), text).toBeVisible();
  }
  await expect(rv.getByText('Nanny’s KTP · Sari Dewi')).toBeVisible();
  await expect(rv.getByRole('img').first()).toBeVisible(); // the signature
  // approving the form is the join: the same dialog goes on to the plan and the first day
  await rv.getByRole('button', { name: 'Approve and join' }).click();
  await expect(rv.getByText('Step 2 of 2 · Plan and first day')).toBeVisible();
  await expect(rv.getByText('Approving the form joins Opa Leo Gunadi as a member. Pick a plan and a first day. This creates the member record and Felicia’s family login.')).toBeVisible();
  await rv.getByRole('radio', { name: /^Gold/ }).click();
  await rv.getByRole('radio', { name: /^Mon 2 Nov/ }).click();
  await rv.getByRole('button', { name: 'Approve and create member · Gold' }).click();
  await expect(toast(sp, 'Opa Leo Gunadi is now a member, starting Mon 2 Nov. A family login was created for Felicia.')).toBeVisible();
  // no dead end: the lead is a member, not an "approved" card
  await openStage(sp, 'joined');
  await expect(lead(sp, 'e5')).toContainText('Opa Leo Gunadi');
  await expect(lead(sp, 'e5')).toContainText('Starts Mon 2 Nov');
  await expect(lead(sp, 'e5')).not.toContainText('Form approved');
  await expect(lead(sp, 'e5')).not.toContainText('Pending approval');
  await expect(lead(sp, 'e5').getByRole('button', { name: 'Open profile' })).toBeVisible();
  await expect(lead(sp, 'e5').getByRole('button', { name: 'Review form' })).toHaveCount(0);
  const snap = await snapshot(sp);
  const gunadi = (Object.values(snap.members) as { id: string; lastName: string; plans: { plan: string; from: string }[] }[]).find((x) => x.lastName === 'Gunadi')!;
  expect(gunadi.plans[0]).toMatchObject({ plan: 'gold', from: '2026-11-02' });
  const felicia = (Object.values(snap.familyContacts) as { id: string; name: string; activatedAt?: string }[]).find((x) => x.name === 'Felicia Gunadi')!;
  expect(felicia.activatedAt).toBeTruthy();
  expect((Object.values(snap.familyLinks) as { familyId: string; memberId: string; appAccess: boolean; primary: boolean }[]).find((l) => l.familyId === felicia.id)).toMatchObject({ memberId: gunadi.id, appAccess: true, primary: true });
  expect(snap.formRequests['fr-e5'].status).toBe('approved');
  // her login exists: the username is her first name and the default password works
  await expect.poll(async () => ((await snapshot(sp)).familyContacts[felicia.id] as { username?: string }).username).toBe('felicia');
  expect((await sp.request.post('/api/login', { data: { username: 'felicia', password: 'citra123' } })).ok()).toBeTruthy();
  // the family, opening the link later, is thanked and sees it was approved
  await page.goto('/form/b4c9e5');
  await expect(page.getByText('The club has approved this form. Thank you.')).toBeVisible();
  sc.assertClean();
  await staff.ctx.close();
});

// ---------------------------------------------------------------- return for changes
test('review: a form can be sent back with a note; the family sees it, fixes it and sends it again', async ({ page, browser }) => {
  test.setTimeout(90_000);
  const staff = await otherSession(browser);
  const sp = staff.page;
  const sc = watchConsole(sp);
  await signIn(sp, 's9', '/enquiries');
  await openStage(sp, 'trial');
  await lead(sp, 'e1').getByRole('button', { name: 'Review form' }).click();
  const rv = sp.getByRole('dialog', { name: 'Oma Siu Lan Tjandra' });
  await expect(rv.getByText('Mbak Wati', { exact: false })).toBeVisible();
  await rv.getByRole('button', { name: 'Return for changes' }).click();
  await expect(rv.getByRole('button', { name: 'Send back' })).toBeDisabled(); // a note is needed
  await rv.getByLabel(/^What should the family change/).fill('Please add the doctor’s summary photo.');
  await rv.getByRole('button', { name: 'Send back' }).click();
  await expect(toast(sp, 'Returned. Melinda got your note on WhatsApp (demo).')).toBeVisible();
  await expect(lead(sp, 'e1')).toContainText('Returned for changes');
  await expect(lead(sp, 'e1').getByRole('button', { name: 'Review form' })).toHaveCount(0);

  // the family opens the same link: the note is on top, everything they entered is still there
  const c = watchConsole(page);
  await page.goto('/form/f7e1a2');
  await expect(page.getByText('The club asked for a change: Please add the doctor’s summary photo.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Check and send', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Edit: Documents' }).click();
  await expect(page.getByRole('heading', { name: 'ID card (KTP)', level: 1 })).toBeVisible();
  await page.getByTestId('form-next').click(); // Nanny
  await page.getByTestId('form-next').click(); // Health
  await expect(page.getByRole('heading', { name: 'Health information', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Aspirin 80 mg', exact: true }).click();
  for (let i = 0; i < 3; i++) await page.getByTestId('form-next').click(); // Allergies, Consent, Check
  await expect(page.getByRole('heading', { name: 'Check and send', level: 1 })).toBeVisible();
  await page.getByTestId('form-next').click();
  await expect(page.getByTestId('form-done')).toHaveText('Thank you, Melinda');
  c.assertClean();

  // staff see the form ready again, with the change in it
  await sp.reload();
  await openStage(sp, 'trial');
  await expect(lead(sp, 'e1')).toContainText('Form ready to review');
  await lead(sp, 'e1').getByRole('button', { name: 'Review form' }).click();
  await expect(sp.getByRole('dialog', { name: 'Oma Siu Lan Tjandra' }).getByText('Amlodipine 5 mg (morning, at home), Aspirin 80 mg (morning, at home)', { exact: true })).toBeVisible();
  sc.assertClean();
  await staff.ctx.close();
});

// ---------------------------------------------------------------- joining
test('join: management approves the form and joins the lead in one flow (plan, first day), with everything copied across', async ({ page }) => {
  test.setTimeout(120_000);
  const c = watchConsole(page);
  await signIn(page, 's9', '/enquiries');
  // the family's form for Opa Leo, sent through the public link (the screens for it are covered above)
  const data = {
    title: 'Opa', name: 'Leo Gunadi', dob: '1948-03-12', address: 'Jl. Melati 12, Bogor', contact: { name: 'Felicia Gunadi', relation: 'spouse', phone: '+6281244107781' }, nanny: null,
    docs: { ktp: true, nannyKtp: false, healthInfo: true }, conditions: ['High blood pressure'], meds: [{ name: 'Amlodipine', dose: '5 mg', timing: 'morningHome' }], food: ['peanuts'], drugs: ['penicillin'], mobility: 'walkingStick', diet: ['lowSalt'],
    consent: { data: true, face: false }, signature: { svgPath: 'M10 40 L 60 10 L 110 70', at: '', by: '' },
  };
  const sub = await page.request.post('/api/form/b4c9e5/submit', { data: { input: { data }, mutationId: 'e2e-form-submit-1' } });
  expect(sub.ok()).toBeTruthy();
  await page.reload();
  await openStage(page, 'visit');
  // a trial first: the health details come from the form that is waiting for review
  await lead(page, 'e5').getByRole('button', { name: 'Book trial' }).click();
  const t = page.getByRole('dialog', { name: 'Opa Leo Gunadi' });
  await expect(t.getByText('Health details are filled in from the family’s form.')).toBeVisible();
  await expect(t.getByRole('button', { name: 'Peanuts', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(t.getByRole('button', { name: 'Walking stick', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await t.getByRole('radio', { name: /^Fri 23 Oct/ }).click();
  await t.getByRole('button', { name: 'Book trial · Fri 23 Oct', exact: true }).click();
  await expect(toast(page, /Trial booked for Opa Leo Gunadi: Fri 23 Oct\./)).toBeVisible();

  // Review form -> Approve and join: the details are the form's, nothing is typed again
  await openStage(page, 'trial');
  await expect(lead(page, 'e5').getByRole('button', { name: 'Join', exact: true })).toHaveCount(0);
  await lead(page, 'e5').getByRole('button', { name: 'Review form' }).click();
  const j = page.getByRole('dialog', { name: 'Opa Leo Gunadi' });
  await expect(j.getByText('Peanuts', { exact: true })).toBeVisible();
  await expect(j.getByText('Penicillin', { exact: true })).toBeVisible();
  await j.getByRole('button', { name: 'Approve and join' }).click();
  await expect(j.getByText('Step 2 of 2 · Plan and first day')).toBeVisible();
  await expect(j.getByText('Your request goes to management.', { exact: false })).toHaveCount(0); // management creates it directly
  // members come on any open day: a plan and a start date are all that is asked (no usual days, no transport, no escort)
  await expect(j.getByRole('radio', { name: /^Flex.*10 visits a month/ })).toHaveAttribute('aria-checked', 'true');
  await expect(j.getByRole('radio', { name: /^Gold.*unlimited/ })).toBeVisible();
  await expect(j.getByRole('radio', { name: /^Mon 26 Oct/ })).toHaveAttribute('aria-checked', 'true'); // the next open Monday
  await expect(j.getByText(/usual days|transport|escort|brought by/i)).toHaveCount(0);
  // another first day through the calendar: weekends and closures are greyed out
  await fieldText(page, /^Another date/).click();
  for (const iso of ['2026-10-24', '2026-10-30']) await expect(page.locator(`[data-date="${iso}"]`), iso).toHaveAttribute('aria-disabled', 'true');
  await page.locator('[data-date="2026-10-27"]').click();
  await expect(j.getByRole('radio', { name: /^Mon 26 Oct/ })).toHaveAttribute('aria-checked', 'false'); // the calendar day replaced the Monday chip
  // back to the form and forward again keeps the choice
  await j.getByRole('button', { name: 'Back to the form' }).click();
  await expect(j.getByText(/^Step 1 of 2/)).toBeVisible();
  await j.getByRole('button', { name: 'Approve and join' }).click();
  await j.getByRole('radio', { name: /^Gold/ }).click();
  await j.getByRole('radio', { name: /^Mon 2 Nov/ }).click();
  await j.getByRole('button', { name: 'Approve and create member · Gold' }).click();
  await expect(toast(page, 'Opa Leo Gunadi is now a member, starting Mon 2 Nov. A family login was created for Felicia.')).toBeVisible();
  await expect.poll(() => counts(page)).toEqual({ new: 1, visit: 1, trial: 1, joined: 1, lost: 1 }); // Opa Leo left Visit, passed through Trial and is now a member
  await openStage(page, 'joined');
  await expect(lead(page, 'e5')).toContainText('Opa Leo Gunadi');
  await expect(lead(page, 'e5')).not.toContainText('Pending approval');
  await expect(lead(page, 'e5').getByRole('button', { name: 'Open profile' })).toBeVisible();
  await expect(lead(page, 'e5').getByRole('button', { name: 'Move to' })).toHaveCount(0); // a member cannot be moved back
  if (isPhone(page)) await expect(lead(page, 'e5').locator('[data-move]')).toHaveCount(0);

  const state = await snapshot(page);
  const m = (Object.values(state.members) as { id: string; lastName: string; dob: string; address: string; usualArrival: string; health: { food: string[]; drugs: string[]; mobility: string; diet: string[]; meds: { name: string }[] }; consents: { kind: string; granted: boolean }[]; plans: { plan: string; from: string; usualDays?: unknown }[]; review?: unknown }[]).find((x) => x.lastName === 'Gunadi')!;
  expect(m).toMatchObject({ dob: '1948-03-12', address: 'Jl. Melati 12, Bogor', health: { food: ['peanuts'], drugs: ['penicillin'], mobility: 'walkingStick', diet: ['lowSalt'] } });
  expect(m.plans[0]).toMatchObject({ plan: 'gold', from: '2026-11-02' });
  expect(m).toMatchObject({ usualArrival: '10:00' });
  expect(m).not.toHaveProperty('escortDefaults');
  expect(m).not.toHaveProperty('transport');
  expect(m.plans[0]).not.toHaveProperty('usualDays');
  expect(m.consents.map((x) => [x.kind, x.granted])).toEqual([['data', true], ['face', false]]);
  expect(m.review).toBeUndefined(); // created by management, so no approval is needed
  await lead(page, 'e5').getByRole('button', { name: 'Open profile' }).click();
  await expect(page).toHaveURL(new RegExp(`/members/${m.id}$`));
  c.assertClean();
});

test('join by other staff goes to management for approval (Approve and join in one flow); the lead shows Pending approval until they approve', async ({ page, browser }) => {
  test.setTimeout(90_000);
  const c = watchConsole(page);
  await signIn(page, 's1', '/enquiries'); // front desk
  await openStage(page, 'trial');
  await lead(page, 'e1').getByRole('button', { name: 'Review form' }).click();
  const j = page.getByRole('dialog', { name: 'Oma Siu Lan Tjandra' });
  await j.getByRole('button', { name: 'Approve and join' }).click();
  await expect(j.getByText('Your request goes to management. The member becomes active, and the family can sign in, once they approve.')).toBeVisible();
  await j.getByRole('button', { name: 'Approve and send to management · Flex' }).click();
  await expect(toast(page, 'Oma Siu Lan Tjandra is waiting for management approval. The family can sign in once it is approved.')).toBeVisible();
  await expect.poll(() => counts(page)).toMatchObject({ trial: 0, joined: 1 });
  await openStage(page, 'joined');
  await expect(lead(page, 'e1')).toContainText('Pending approval');
  await expect(lead(page, 'e1')).not.toContainText('Form approved');

  // management sees one more thing to review, and the new member is not active yet
  const mg = await otherSession(browser);
  await signIn(mg.page, 's9', '/enquiries');
  const before = await snapshot(mg.page);
  const cr = (Object.values(before.changeRequests) as { id: string; action: string; status: string }[]).find((x) => x.action === 'enquiry.convert')!;
  expect(cr.status).toBe('pending');
  expect(Object.values(before.members as Record<string, { lastName: string; review?: { status: string } }>).find((x) => x.lastName === 'Tjandra')!.review?.status).toBe('pending');
  expect(before.formRequests['fr-e1'].status).toBe('approved'); // approving and joining are one step
  // the lead card says what is happening instead of showing an approved form with no member
  await openStage(mg.page, 'joined');
  await expect(lead(mg.page, 'e1')).toContainText('Pending approval');
  // approving it (the Reviews screen does this call)
  const ok = await act(mg.page, 'review.approve', { crId: cr.id });
  expect(ok.ok()).toBeTruthy();
  await page.reload();
  await openStage(page, 'joined');
  await expect(lead(page, 'e1')).not.toContainText('Pending approval');
  await expect(lead(page, 'e1').getByRole('button', { name: 'Open profile' })).toBeVisible();
  // the family login exists once management approves (username from the first name, default password)
  await expect.poll(async () => (Object.values((await snapshot(page)).familyContacts) as { name: string; username?: string }[]).find((x) => x.name === 'Melinda Tjandra')?.username).toBe('melinda');
  await mg.ctx.close();
  c.assertClean();
});

test('a join that management does not approve puts the lead back, and its form is ready to review again', async ({ page, browser }) => {
  test.setTimeout(90_000);
  const c = watchConsole(page);
  await signIn(page, 's1', '/enquiries');
  await openStage(page, 'trial');
  await lead(page, 'e1').getByRole('button', { name: 'Review form' }).click();
  const j = page.getByRole('dialog', { name: 'Oma Siu Lan Tjandra' });
  await j.getByRole('button', { name: 'Approve and join' }).click();
  await j.getByRole('button', { name: 'Approve and send to management · Flex' }).click();
  await expect.poll(() => counts(page)).toMatchObject({ trial: 0, joined: 1 });
  const mg = await otherSession(browser);
  await signIn(mg.page, 's9', '/enquiries');
  const cr = (Object.values((await snapshot(mg.page)).changeRequests) as { id: string; action: string }[]).find((x) => x.action === 'enquiry.convert')!;
  expect((await act(mg.page, 'review.reject', { crId: cr.id, note: 'Waiting for the deposit' })).ok()).toBeTruthy();
  await mg.ctx.close();
  // back in Trial with a form that is ready to review, not an approved form without a member
  await page.reload();
  await expect.poll(() => counts(page)).toMatchObject({ trial: 1, joined: 0 });
  await openStage(page, 'trial');
  await expect(lead(page, 'e1')).toContainText('Form ready to review');
  await expect(lead(page, 'e1')).not.toContainText('Form approved');
  await expect(lead(page, 'e1').getByRole('button', { name: 'Review form' })).toBeVisible();
  expect((await snapshot(page)).formRequests['fr-e1'].status).toBe('submitted');
  c.assertClean();
});

test('join without a form: the lead joins with its own details; moving a card with a ready form to Joined opens the review first', async ({ page }) => {
  test.setTimeout(90_000);
  const c = watchConsole(page);
  await signIn(page, 's9', '/enquiries');
  // e1's form is waiting: Move to Joined goes through Approve and join
  await moveCard(page, 'e1', 'trial', 'joined', 'Oma Siu Lan Tjandra');
  const rv = page.getByRole('dialog', { name: 'Oma Siu Lan Tjandra' });
  await expect(rv.getByRole('button', { name: 'Approve and join' })).toBeVisible();
  await page.keyboard.press('Escape'); // not now
  // e3 has no form: the plain Join dialog (plan and first day), then the member exists
  await moveCard(page, 'e3', 'new', 'joined', 'Oma Ellen Sutanto');
  const j = page.getByRole('dialog', { name: 'Oma Ellen Sutanto' });
  await expect(j.getByText('From the enquiry')).toBeVisible();
  await expect(j.getByText('No online form yet.', { exact: false })).toBeVisible();
  await j.getByRole('button', { name: 'Create member · Flex' }).click();
  await expect(toast(page, 'Oma Ellen Sutanto is now a member, starting Mon 26 Oct. A family login was created for Kevin.')).toBeVisible();
  await expect.poll(() => counts(page)).toMatchObject({ new: 0, joined: 1 });
  await openStage(page, 'joined');
  await expect(lead(page, 'e3')).toContainText('Starts Mon 26 Oct');
  await expect(lead(page, 'e3').getByRole('button', { name: 'Open profile' })).toBeVisible();
  c.assertClean();
});

// ---------------------------------------------------------------- search
test('search: by the senior’s name or the contact’s name; it narrows every stage, works with paging and starts over on a new search', async ({ page }) => {
  test.setTimeout(90_000);
  const c = watchConsole(page);
  await signIn(page, 's9', '/enquiries');
  const search = page.getByLabel('Search by name');
  await expect.poll(() => counts(page)).toEqual({ new: 1, visit: 2, trial: 1, joined: 0, lost: 1 });
  await search.fill('melinda'); // e1's contact (the senior is Siu Lan Tjandra)
  await expect.poll(() => counts(page)).toEqual({ new: 0, visit: 0, trial: 1, joined: 0, lost: 0 });
  await search.fill('SIU lan'); // the senior, any case, any part
  await expect.poll(() => counts(page)).toEqual({ new: 0, visit: 0, trial: 1, joined: 0, lost: 0 });
  await search.fill('hamid'); // Bapak Yusuf Hamid and his son Ilham Hamid: one lead
  await expect.poll(() => counts(page)).toEqual({ new: 0, visit: 1, trial: 0, joined: 0, lost: 0 });
  await search.fill('sutanto'); // e3: Oma Ellen Sutanto, contact Kevin Sutanto
  await expect.poll(() => counts(page)).toEqual({ new: 1, visit: 0, trial: 0, joined: 0, lost: 0 });
  await search.fill('zzz');
  await expect.poll(() => counts(page)).toEqual({ new: 0, visit: 0, trial: 0, joined: 0, lost: 0 });
  await expect(page.getByText('No leads match “zzz”.').first().or(page.getByText('No match').first())).toBeVisible();
  await search.fill('');
  await expect.poll(() => counts(page)).toEqual({ new: 1, visit: 2, trial: 1, joined: 0, lost: 1 });

  // with paging: eight leads in New, six a page; the search narrows them and goes back to page 1
  for (let i = 1; i <= 7; i++) {
    const r = await act(page, 'enquiry.create', { senior: { title: 'Oma', name: `Paged Lead ${i}` }, contact: { name: `Contact ${i}`, relation: 'daughter', phone: `0812 5500 20${String(i).padStart(2, '0')}` }, source: 'website' });
    expect(r.ok()).toBeTruthy();
  }
  await page.reload();
  await openStage(page, 'new');
  const cards = isPhone(page) ? page.locator('#main [data-lead]') : page.locator('[data-stage="new"] [data-lead]');
  await expect(cards).toHaveCount(6);
  await goToPage(page, 2, 'New pages');
  await expect(cards).toHaveCount(2);
  await page.getByLabel('Search by name').fill('paged'); // seven match: page 1 again
  await expect(cards).toHaveCount(6);
  await goToPage(page, 2, 'New pages');
  await expect(cards).toHaveCount(1);
  await page.getByLabel('Search by name').fill('contact 7');
  await expect(cards).toHaveCount(1);
  await expect(page.locator('[data-lead]').filter({ hasText: 'Paged Lead 7' })).toHaveCount(1);
  await expect(page.getByRole('navigation', { name: 'New pages' })).toHaveCount(0); // one page: no pager
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

// ---------------------------------------------------------------- paged columns
test('a column that grows is paged; the phone list too', async ({ page }) => {
  test.setTimeout(90_000);
  const c = watchConsole(page);
  await signIn(page, 's9', '/enquiries');
  for (let i = 1; i <= 7; i++) {
    const r = await act(page, 'enquiry.create', { senior: { title: 'Oma', name: `Paged Lead ${i}` }, contact: { name: `Contact ${i}`, relation: 'daughter', phone: `0812 5500 10${String(i).padStart(2, '0')}` }, source: 'website' });
    expect(r.ok()).toBeTruthy();
  }
  await page.reload();
  await openStage(page, 'new');
  const cards = isPhone(page) ? page.locator('#main [data-lead]') : page.locator('[data-stage="new"] [data-lead]');
  await expect(cards).toHaveCount(6); // eight leads in New, six a page
  await goToPage(page, 2, 'New pages');
  await expect(cards).toHaveCount(2);
  await goToPage(page, 1, 'New pages');
  await expect(cards).toHaveCount(6);
  await assertNoHorizontalScroll(page);
  c.assertClean();
});

// ---------------------------------------------------------------- the public form: links that do not work, other languages, small screens
test('form: a wrong link says so; the language toggle translates every step of the form; nothing overflows a small screen', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/form/zzzzzzzz');
  await expect(page.getByRole('heading', { name: /This link doesn.t work/ })).toBeVisible();
  await expect(page.getByText('The form link may be old or mistyped. Ask the club to send you a new one.')).toBeVisible();

  // a complete draft saved through the same public route the form uses, so every step can be walked through in Indonesian
  const draft = {
    title: 'Opa', name: 'Leo Gunadi', dob: '1948-03-12', address: 'Jl. Melati 12, Bogor', contact: { name: 'Felicia Gunadi', relation: 'spouse', phone: '+6281244107781' }, nanny: { name: 'Sari Dewi' },
    docs: { ktp: true, nannyKtp: true, healthInfo: true }, conditions: ['High blood pressure'], meds: [{ name: 'Amlodipine', dose: '5 mg', timing: 'morningHome' }], food: ['peanuts'], drugs: ['penicillin'],
    mobility: 'walkingStick', diet: ['lowSalt'], consent: { data: true, face: true }, signature: { svgPath: 'M10 40 L 60 10 L 110 70', at: '', by: '' },
  };
  const saved = await page.request.post('/api/form/b4c9e5/saveDraft', { data: { input: { step: 0, draft }, mutationId: 'e2e-form-draft-1' } });
  expect(saved.ok()).toBeTruthy();
  const c = watchConsole(page);
  await page.goto('/form/b4c9e5');
  await expect(page.getByRole('heading', { name: 'About the member', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'ID', exact: true }).click();
  const titles = ['Tentang anggota', 'Kartu identitas (KTP)', 'Pengasuh atau pendamping', 'Informasi kesehatan', 'Alergi dan alat bantu jalan', 'Tanda tangan dan persetujuan', 'Periksa dan kirim'];
  for (let i = 0; i < 7; i++) {
    await expect(page.getByRole('heading', { name: titles[i], level: 1 })).toBeVisible();
    await expect(page.getByText(`Langkah ${i + 1} dari 7`, { exact: true })).toBeVisible();
    await noRawKeys(page);
    await assertNoHorizontalScroll(page);
    if (i === 0) await expect(page.getByRole('radio', { name: 'Pasangan', exact: true })).toHaveAttribute('aria-checked', 'true'); // Spouse
    if (i < 6) await page.getByTestId('form-next').click();
  }
  await expect(page.getByTestId('form-next')).toHaveText('Kirim ke CitraPremier');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Check and send', level: 1 })).toBeVisible();
  await expect(page.getByTestId('form-next')).toHaveText('Send to CitraPremier');
  c.assertClean();
});

// ---------------------------------------------------------------- Indonesian, board and dialogs
test('Indonesian: the board, its dialogs and the stage names are translated, with no raw keys and no sideways scroll', async ({ page }) => {
  test.setTimeout(90_000);
  const c = watchConsole(page);
  boardLang = 'id';
  await signIn(page, 's9', '/enquiries', 'id');
  await expect(page.getByRole('heading', { name: 'Calon anggota', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Calon baru' })).toBeVisible();
  if (isPhone(page)) { await stageBox(page).click(); for (const s of ['Baru', 'Kunjungan', 'Percobaan terjadwal', 'Bergabung', 'Batal']) await expect(page.getByRole('option', { name: new RegExp(`^${s} ·`) })).toBeVisible(); await page.keyboard.press('Escape'); }
  else for (const s of ['Baru', 'Kunjungan', 'Percobaan terjadwal', 'Bergabung', 'Batal']) await expect(page.getByRole('region', { name: s, exact: true })).toBeVisible();
  await noRawKeys(page);
  await assertNoHorizontalScroll(page);

  await openStage(page, 'trial');
  await expect(lead(page, 'e1')).toContainText('Formulir siap ditinjau');
  await expect(lead(page, 'e1')).toContainText('Hari percobaan');
  await lead(page, 'e1').getByRole('button', { name: 'Tinjau formulir' }).click();
  const rv = page.getByRole('dialog', { name: 'Oma Siu Lan Tjandra' });
  await expect(rv.getByText(/^Langkah 1 dari 2 · Formulir daring/)).toBeVisible();
  await noRawKeys(page);
  await rv.getByRole('button', { name: 'Setujui dan gabungkan' }).click(); // Approve and join: step two
  await expect(rv.getByText('Langkah 2 dari 2 · Paket dan hari pertama')).toBeVisible();
  await expect(rv.getByRole('button', { name: 'Setujui dan buat anggota · Flex' })).toBeVisible();
  await noRawKeys(page);
  await assertNoHorizontalScroll(page);
  await page.keyboard.press('Escape');

  await openStage(page, 'visit');
  await lead(page, 'e2').getByRole('button', { name: 'Jadwalkan percobaan' }).click();
  const d = page.getByRole('dialog', { name: 'Bapak Yusuf Hamid' });
  await expect(d.getByText('Jadwalkan hari percobaan')).toBeVisible();
  await expect(d.getByRole('radio', { name: /^Kam 22 Okt/ })).toBeVisible();
  await noRawKeys(page);
  await assertNoHorizontalScroll(page);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Calon baru' }).click();
  await expect(page.getByRole('dialog', { name: 'Calon baru' })).toBeVisible();
  await noRawKeys(page);
  c.assertClean();
});
