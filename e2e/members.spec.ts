// Members and Reviews: the compact paged list, every profile tab, the review flow end to end (submit, approve, reject, withdraw), health edits that
// apply at once, adding a member, family contacts with usernames and password reset, the Photos tab (real camera flow, pending photos), the Photos
// section of Reviews (select, approve with the notify switch, reject with a reason), ending a membership, role visibility, Indonesian,
// no console errors, no horizontal scroll.
// The club is drop-in: nobody is "expected", nothing is booked, and Flex counts visits (the 11th in a month is an extra day).
// Run in its own environment:  pnpm e2e:env members 8804 5204   then   E2E_BASE_URL=http://localhost:5204 pnpm exec playwright test e2e/members.spec.ts
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { resetDemo, signIn, watchConsole, isPhone } from './helpers';
import { TINY_PNG, goToPage, pickDate, pickOption, takePhotoWithFile } from './kit';

/** A members filter with its count: chips on tablet and laptop, one dropdown on a phone (its options carry the counts). */
async function expectFilter(page: Page, name: string) {
  if (isPhone(page)) {
    await page.getByRole('combobox').click();
    await expect(page.getByRole('option', { name })).toBeVisible();
    await page.keyboard.press('Escape');
  } else await expect(page.getByRole('button', { name })).toBeVisible();
}

// The dev server serves the shared source tree, which other areas edit while this runs; one retry absorbs a hot-reload that lands mid-test.
test.describe.configure({ retries: 1 });
test.beforeEach(async ({ request }) => { await resetDemo(request); });

const RAW_KEY = /\b(profile|members|reviews|common|status|err|review|health|family|nav|roles|notif|feed)\.[a-zA-Z_]+/;
const TABS = ['Overview', 'Health', 'Care log', 'Photos', 'Attendance', 'Documents', 'Plan and billing', 'Family', 'Notes', 'History'];
const main = (page: Page) => page.locator('#main');
const toast = (page: Page) => page.getByRole('status');
/** Open a member's profile from the list (the way a person does). */
async function openFromList(page: Page, name: string) {
  await page.goto('/members');
  await page.getByRole('button', { name: new RegExp(name) }).first().click();
  await expect(page).toHaveURL(/\/members\/m\d+/);
}
const dialog = (page: Page) => page.getByRole('dialog').last();
/** No horizontal page scroll. Polled: until the icon font has loaded, icon names show as text for a moment and can widen a row; a real overflow still fails. */
const noHScroll = (page: Page) =>
  expect.poll(() => page.evaluate(() => { const el = (document.querySelector('#main') || document.documentElement) as HTMLElement; return el.scrollWidth - el.clientWidth; }), { timeout: 5000 }).toBeLessThanOrEqual(1);
/** Words that belong to the retired booking model. None of them may appear anywhere in the members area. */
const RETIRED = /Expected around|Not booked today|On leave|Not coming today|Running late|Book a day|Plan leave|Brought by|Collected by|brought by|Usual days|Comes with the club driver/;
/** The front desk checks someone in (the lobby screen belongs to another area; the action is the contract). */
const checkIn = (request: APIRequestContext, memberId: string, id: string) =>
  request.post('/api/actions/attendance.checkIn', { headers: { 'x-user-id': 's1' }, data: { mutationId: id, club: 'citra', input: { memberId, method: 'manual' } } });

/** Run an action as a signed-in user (the e2e servers trust the x-user-id header). */
const doAct = (request: APIRequestContext, user: string, name: string, input: unknown, id: string) =>
  request.post(`/api/actions/${name}`, { headers: { 'x-user-id': user }, data: { mutationId: id, club: 'citra', input } });
const newMemberInput = (name: string, phone: string) => ({
  title: 'Oma', name, dob: '1945-05-05', address: '', usualArrival: '', nanny: null, spouseId: null, plan: 'flex', start: '2026-10-26',
  contact: { name: `Family of ${name}`, phone, relation: 'daughter', primary: true }, health: {}, careInstructions: '', docs: [], consent: { data: true, face: true },
});
/** More members than one page of the list (created as management: active at once; as the lobby: waiting for approval). */
async function addMembers(request: APIRequestContext, n: number, as = 's9') {
  for (let i = 0; i < n; i++) {
    const r = await doAct(request, as, 'members.create', newMemberInput(`Sinta ${String.fromCharCode(65 + i)}`, `+62813400${String(1000 + i)}`), `e2e-members-add-${as}-${i}`);
    expect(r.ok(), await r.text()).toBeTruthy();
  }
}
/** A photo taken by a teacher (pending) or by management (visible). Resolves with its id. */
async function takePhoto(request: APIRequestContext, user: string, memberId: string, id: string, over: Record<string, unknown> = {}) {
  const r = await doAct(request, user, 'photo.take', { kind: 'solo', memberIds: [memberId], media: 'photo', ...over }, id);
  expect(r.ok(), await r.text()).toBeTruthy();
  return String((await r.json()).result.photoId);
}
/** What the family's own snapshot holds (families only ever receive what they may see). */
async function familySnapshot(request: APIRequestContext, user: string) {
  const r = await request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': user } });
  expect(r.ok()).toBeTruthy();
  return (await r.json()).state as { photos: Record<string, { id: string; visibility: string; memberIds: string[]; mediaId?: string }>; notifications: Record<string, { kind: string; toUsers: string[] }> };
}

test('members list: compact rows (name, status, plan), search finds family names, filters count, rows open the profile', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's1', '/members');
  await expect(page.getByRole('heading', { name: 'Members', level: 1 })).toBeVisible();
  await expect(page.locator('[data-member]')).toHaveCount(5);
  await expectFilter(page, 'Active · 5');
  await expectFilter(page, 'In the club · 3');
  await expectFilter(page, 'Needs attention · 2');
  await expectFilter(page, 'Gold · 3');
  if (isPhone(page)) {
    await page.getByRole('combobox').click();
    await expect(page.getByRole('option', { name: 'Ended · 0' })).toBeVisible();
    await expect(page.getByRole('option')).toHaveCount(6); // no "On leave" filter
    await page.keyboard.press('Escape');
  } else {
    await expect(page.getByRole('button', { name: 'Ended · 0' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Filter members' }).getByRole('button')).toHaveCount(6); // no "On leave" filter
  }
  // compact rows: avatar, name, status ("in the club" or the last visit) and the plan chip; the detail lives on the profile
  await expect(page.locator('[data-member="m1"]')).toContainText('Last visit Tue 20 Oct');
  await expect(page.locator('[data-member="m1"]')).toContainText('Flex 10/10');
  await expect(page.locator('[data-member="m10"]')).toContainText('In the club since 09:48');
  await expect(page.locator('[data-member="m10"]')).toContainText('Flex 8/10');
  await expect(page.locator('[data-member="m10"]')).not.toContainText(/Usually arrives|Last visit/);
  await expect(page.locator('[data-member="m46"]')).toContainText('Gold');
  await expect(page.locator('[data-member="m46"]')).toContainText('Last visit Tue 20 Oct');
  await expect(page.locator('[data-member="m1"]')).not.toContainText(/years|Walker|Walking|allerg|Amlodipine|Penicillin|Shellfish|Peanuts|new member/i);
  for (const id of ['m1', 'm2', 'm10', 'm20', 'm46']) expect((await page.locator(`[data-member="${id}"]`).boundingBox())!.height, id).toBeLessThanOrEqual(isPhone(page) ? 104 : 80); // a compact row
  // what needs a look is an icon, with the reading or the reason as its name
  await expect(page.locator('[data-member="m2"]').getByRole('img', { name: /^Watch · BP \d+\/\d+$/ })).toBeVisible();
  await expect(page.locator('[data-member="m20"]').getByRole('img', { name: 'Payment overdue' })).toBeVisible();
  await expect(page.locator('[data-member="m1"]').getByRole('img')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Members pages' })).toHaveCount(0); // five members: one page
  await expect(main(page)).not.toContainText(RETIRED);
  await page.getByLabel('Search members').fill('Laras');
  await expect(page.locator('[data-member]')).toHaveCount(1);
  await expect(page.locator('[data-member="m10"]')).toContainText('Bambang');
  await page.getByLabel('Search members').fill('0816 1436');
  await expect(page.locator('[data-member="m10"]')).toBeVisible();
  await page.getByLabel('Search members').fill('zzzz');
  await expect(page.getByText('No members match')).toBeVisible();
  await page.getByLabel('Search members').fill('');
  if (isPhone(page)) {
    await pickOption(page, 'Filter members', /^Needs attention/);
    await expect(page.locator('[data-member]')).toHaveCount(2);
    await pickOption(page, 'Filter members', /^Active/);
  } else {
    await page.getByRole('group', { name: 'Filter members' }).getByRole('button', { name: /Needs attention/ }).click();
    await expect(page.locator('[data-member]')).toHaveCount(2);
    await page.getByRole('button', { name: /^Active/ }).click();
  }
  await noHScroll(page);
  await expect(main(page)).not.toContainText(RAW_KEY);
  await page.locator('[data-member="m1"]').click();
  await expect(page).toHaveURL(/\/members\/m1$/);
  c.assertClean();
});

test("Lina's profile: every tab renders, back returns to the list", async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's1', '/members');
  await openFromList(page, 'Oma Lina');
  await expect(page.getByRole('heading', { name: 'Oma Lina Wijaya', level: 1 })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(10);
  for (const name of TABS) {
    await page.getByRole('tab', { name, exact: true }).click();
    await expect(page.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel')).not.toBeEmpty();
    await expect(main(page)).not.toContainText(RAW_KEY);
    await noHScroll(page);
  }
  // facts that come from real data
  await page.getByRole('tab', { name: 'Overview' }).click();
  await expect(page.getByText('14 May 1945')).toBeVisible();
  await expect(page.getByText('Jl. Bangka Raya no. 18')).toBeVisible();
  // drop-in: usual arrival as information, visits instead of days, no brought-by or collected-by, but the nanny stays
  await expect(page.getByText('Usually arrives around 10:05').first()).toBeVisible();
  await expect(page.getByText('10 of 10 visits used')).toBeVisible();
  if (!isPhone(page)) await expect(page.getByText('with Mbak Sari, her nanny').first()).toBeVisible(); // a phone's header keeps just the age
  await expect(main(page)).not.toContainText(RETIRED);
  await page.getByRole('tab', { name: 'Health' }).click();
  await expect(page.getByText('Care instructions')).toBeVisible();
  await expect(page.getByText('Amlodipine 5 mg')).toBeVisible();
  await page.getByRole('tab', { name: 'Care log' }).click();
  await expect(page.getByText(/Reviewed by Ns. Dewi/)).toBeVisible();
  await page.getByRole('tab', { name: 'Family' }).click();
  await expect(page.getByText('Maria Wijaya')).toBeVisible();
  await expect(page.locator('a[href^="tel:"]').first()).toBeVisible();
  await expect(page.getByText('Uses the app').first()).toBeVisible();
  await page.getByRole('tab', { name: 'Plan and billing' }).click();
  await expect(page.getByText('Rp 5.500.000').first()).toBeVisible();
  await page.getByRole('tab', { name: 'Documents' }).click();
  await expect(page.getByText('Use of information')).toBeVisible();
  await expect(page.getByText('Face recognition at the door')).toBeVisible();
  await page.getByRole('tab', { name: 'Attendance' }).click();
  await expect(page.getByRole('heading', { name: 'October 2026' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).or(page.getByRole('button', { name: 'Members' })).first().click();
  await expect(page).toHaveURL(/\/members$/);
  c.assertClean();
});

test('attendance: a visits calendar for any month; no booking, leave or absence actions', async ({ page }) => {
  await signIn(page, 's9', '/members/m1/att');
  await expect(page.getByRole('heading', { name: 'October 2026' })).toBeVisible();
  // Flex: 10 visits a month, counted from check-ins. Lina has used all 10 by the 20th.
  await expect(page.getByText('Visits used in October')).toBeVisible();
  await expect(page.getByText('10/10')).toBeVisible();
  await expect(page.getByText('Flex plan · 10 visits included')).toBeVisible();
  await expect(page.getByText('Visits left')).toBeVisible();
  await expect(page.getByText('Extra days in October')).toBeVisible();
  await expect(page.getByText('Nothing extra so far')).toBeVisible();
  await expect(page.locator('[data-visit="visit"]')).toHaveCount(10);
  await expect(page.locator('[data-visit="extra"]')).toHaveCount(0);
  await expect(page.locator('[data-visit="visit"]').first()).toContainText(/In \d\d:\d\d/);
  // any month can be browsed
  await page.getByRole('button', { name: 'Previous month' }).click();
  await expect(page.getByRole('heading', { name: 'September 2026' })).toBeVisible();
  await expect(page.locator('[data-visit="visit"]')).toHaveCount(3);
  await expect(page.getByText('3/10')).toBeVisible();
  await page.getByRole('button', { name: 'Back to this month' }).click();
  await expect(page.getByRole('heading', { name: 'October 2026' })).toBeVisible();
  await page.getByRole('button', { name: 'Next month' }).click();
  await expect(page.getByRole('heading', { name: 'November 2026' })).toBeVisible();
  await page.getByRole('button', { name: 'Next month' }).click();
  await expect(page.getByRole('heading', { name: 'December 2026' })).toBeVisible();
  await expect(page.getByText('Holiday').first()).toBeVisible(); // 25 Dec
  await expect(page.locator('[data-visit]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to this month' }).click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Previous month' }).click();
  await expect(page.getByRole('heading', { name: 'July 2026' })).toBeVisible();
  await noHScroll(page);
  // the retired model is gone, for the front desk too
  await signIn(page, 's1', '/members/m1/att');
  for (const name of ['Book a day', 'Plan leave', 'Not coming today', 'Running late']) await expect(page.getByRole('button', { name })).toHaveCount(0);
  await expect(main(page)).not.toContainText(RETIRED);
  await expect(main(page)).not.toContainText(/Booked|Leave|Absent|Expected|Missed/);
  // Gold is unlimited: visits are counted, never limited
  await page.goto('/members/m46/att');
  await expect(page.getByText('Gold plan · no limit')).toBeVisible();
  await expect(page.getByText('Gold has no limit', { exact: false })).toBeVisible();
  await expect(page.getByText('Visits used in October')).toHaveCount(0);
  await expect(page.locator('[data-visit="extra"]')).toHaveCount(0);
  await noHScroll(page);
});

test('an extra visit: the 11th Flex visit is marked "Extra day" on the calendar and billed on the end-of-membership invoice', async ({ page, request }) => {
  const c = watchConsole(page);
  const r = await checkIn(request, 'm1', 'e2e-members-in-1');
  expect(r.ok()).toBeTruthy();
  expect((await r.json()).result.extra).toBe(true);
  await signIn(page, 's9', '/members/m1/att');
  await expect(page.locator('[data-visit="visit"]')).toHaveCount(10);
  await expect(page.locator('[data-visit="extra"]')).toHaveCount(1);
  await expect(page.locator('[data-visit="extra"]')).toContainText('Extra day');
  await expect(page.locator('[data-visit="extra"]')).toContainText('21');
  await expect(page.getByText('Extra days in October')).toBeVisible();
  await expect(page.getByText('Rp 650.000 on next month’s invoice')).toBeVisible();
  await expect(page.locator('[data-visit="extra"]')).toHaveAttribute('title', /In \d\d:\d\d · Extra day/);
  await noHScroll(page);
  // the overview counts the extra day separately from the 10 included visits
  await page.getByRole('tab', { name: 'Overview' }).click();
  await expect(page.getByText('10 of 10 visits used')).toBeVisible();
  await expect(page.getByText('+1 extra day this month')).toBeVisible();
  await expect(page.getByText('In the club since').first()).toBeVisible();
  await expect(page.getByText(/Usually arrives around/)).toHaveCount(0); // she is in the club: nothing about arriving
  // ending the membership bills that day on a final invoice (the dialog says so first)
  await page.getByRole('button', { name: 'End membership' }).click();
  const d = dialog(page);
  await d.getByRole('button', { name: 'Moved away' }).click();
  await pickDate(page, 'Another date', '2026-10-28');
  await expect(d).toContainText('A final invoice of Rp 650.000 for extra days will be created.');
  await expect(d).toContainText('They can still check in until');
  await expect(d).not.toContainText(/bookings|lobby board/);
  await d.getByRole('button', { name: 'End membership' }).click();
  await expect(dialog(page)).toHaveCount(0);
  await page.getByRole('tab', { name: 'Plan and billing' }).click();
  await expect(page.getByText('Final invoice').first()).toBeVisible();
  await expect(page.getByText('Rp 650.000').first()).toBeVisible();
  c.assertClean();
});

test('edit details: a pending-review chip shows the proposal, values stay; management approves and the values change', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's1', '/members/m1');
  await page.getByRole('button', { name: 'Edit details' }).click();
  await expect(dialog(page)).toBeVisible();
  await dialog(page).getByLabel('Home address').fill('Jl. Kemang Baru 99, Jakarta');
  await dialog(page).getByLabel('Note for management (optional)').fill('Family moved house');
  await dialog(page).getByRole('button', { name: 'Submit for review' }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(toast(page)).toContainText(/goes to management|Sent|approval/i);
  // chip with the proposed value; the current value is unchanged
  const chip = page.getByRole('group', { name: 'Pending review' });
  await expect(chip).toBeVisible();
  await expect(chip).toContainText('Jl. Kemang Baru 99, Jakarta');
  await expect(chip.getByRole('button', { name: 'Withdraw' })).toBeVisible();
  await expect(page.getByText('Jl. Bangka Raya no. 18, Kemang, Jakarta Selatan', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Overview/ })).toHaveAccessibleName(/Pending review/);
  await noHScroll(page);
  // management reviews
  await signIn(page, 's9', '/reviews');
  const card = page.locator('[data-cr]').filter({ hasText: 'Jl. Kemang Baru 99' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('Oma Lina Wijaya');
  await expect(card).toContainText('Caca');
  await expect(card).toContainText('Home address');
  await expect(card).toContainText('Jl. Bangka Raya no. 18');
  await expect(card).toContainText('Family moved house');
  await card.getByRole('button', { name: 'Approve' }).click();
  await expect(card).toHaveCount(0);
  await page.goto('/members/m1');
  await expect(page.getByText('Jl. Kemang Baru 99, Jakarta')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Pending review' })).toHaveCount(0);
  // the submitter sees the outcome in the history
  await page.getByRole('tab', { name: 'History' }).click();
  await expect(page.getByText(/details updated/i).first()).toBeVisible();
  c.assertClean();
});

test('reviews: the seeded request shows who, when, section and old → new; reject needs a note; withdraw clears the chip', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/reviews');
  await expect(page.getByRole('heading', { name: 'Reviews', level: 1 })).toBeVisible();
  const card = page.locator('[data-cr="cr-seed-1"]');
  await expect(card).toContainText('Bapak Bambang Purnomo');
  await expect(card).toContainText('Caca');
  await expect(card).toContainText('Usual arrival time');
  await expect(card).toContainText('09:48');
  await expect(card).toContainText('09:30');
  await expect(card).toContainText('Laras says Papa will come earlier');
  await card.getByRole('button', { name: 'Reject' }).click();
  await dialog(page).getByRole('button', { name: 'Reject' }).click();
  await expect(dialog(page)).toContainText('Please add a note.');
  await dialog(page).getByLabel('Why is it not approved?').fill('Please ask Laras to confirm in writing');
  await dialog(page).getByRole('button', { name: 'Reject' }).click();
  await expect(card).toHaveCount(0);
  await page.getByRole('tab', { name: /History/ }).click();
  await expect(page.getByText('Rejected').first()).toBeVisible();
  await expect(page.getByText(/Please ask Laras to confirm/)).toBeVisible();
  await noHScroll(page);
  // lobby: edit, then withdraw
  await signIn(page, 's1', '/members/m10');
  await page.getByRole('button', { name: 'Edit details' }).click();
  await dialog(page).getByLabel('Home address').fill('Jl. Withdraw 1');
  await dialog(page).getByRole('button', { name: 'Submit for review' }).click();
  const chip = page.getByRole('group', { name: 'Pending review' });
  await expect(chip).toBeVisible();
  await chip.getByRole('button', { name: 'Withdraw' }).click();
  await expect(chip).toHaveCount(0);
  c.assertClean();
});

test('reviews: a conflict is flagged and can be approved anyway', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's1', '/members/m1');
  await page.getByRole('button', { name: 'Edit details' }).click();
  await dialog(page).getByLabel('Home address').fill('Jl. Proposal 1');
  await dialog(page).getByRole('button', { name: 'Submit for review' }).click();
  await expect(page.getByRole('group', { name: 'Pending review' })).toBeVisible();
  // management changes the same field directly while the request waits
  await signIn(page, 's9', '/members/m1');
  await page.getByRole('button', { name: 'Edit details' }).click();
  await dialog(page).getByLabel('Home address').fill('Jl. Direct 2');
  await dialog(page).getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog(page)).toHaveCount(0);
  await page.goto('/reviews');
  const card = page.locator('[data-cr]').filter({ hasText: 'Jl. Proposal 1' });
  await card.getByRole('button', { name: 'Approve' }).click();
  await expect(card).toContainText('The details changed since this was submitted');
  await card.getByRole('button', { name: 'Approve anyway' }).click();
  await expect(card).toHaveCount(0);
  await page.goto('/members/m1');
  await expect(page.getByText('Jl. Proposal 1', { exact: true })).toBeVisible();
  c.assertClean();
});

test('nurse changes an allergy: applies at once, appears under Applied review; management acknowledges', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's8', '/members/m1/health');
  await page.getByRole('button', { name: 'Edit health record' }).click();
  const d = dialog(page);
  await d.getByRole('button', { name: 'Peanuts', exact: true }).click();
  await d.getByLabel('Other food allergy').fill('Kiwi');
  await d.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByText('Peanuts').first()).toBeVisible();
  await expect(page.getByText('Kiwi').first()).toBeVisible();
  await expect(page.getByRole('group', { name: 'Pending review' }).first()).toContainText('Applied');
  await signIn(page, 's9', '/reviews');
  await page.getByRole('tab', { name: /Applied, review/ }).click();
  const card = page.locator('[data-cr]').first();
  await expect(card).toContainText('Oma Lina Wijaya');
  await expect(card).toContainText('Food allergies');
  await expect(card).toContainText('Peanuts');
  await expect(card).toContainText('Dewi');
  await card.getByRole('button', { name: 'Acknowledge' }).click();
  await expect(page.locator('[data-cr]')).toHaveCount(0);
  c.assertClean();
});

test('nurse edits a medicine dose and the care instructions (staff only)', async ({ page }) => {
  await signIn(page, 's8', '/members/m1/health');
  await page.getByRole('button', { name: 'Edit health record' }).click();
  const d = dialog(page);
  await d.getByLabel('Dose').first().fill('10 mg');
  await d.getByLabel('Care instructions').fill('Use her right arm. Offer tea first.');
  await d.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByText('Amlodipine 10 mg', { exact: true })).toBeVisible();
  await expect(page.getByText('Use her right arm. Offer tea first.', { exact: true })).toBeVisible();
  await expect(page.getByText('Staff only').first()).toBeVisible();
});

test('lobby adds a new member: pending approval; management approves; the new contact can sign in', async ({ page, request }) => {
  const c = watchConsole(page);
  await signIn(page, 's1', '/members');
  await page.getByRole('button', { name: 'Add member' }).click();
  const d = dialog(page);
  await expect(d).toBeVisible();
  // no usual days, no transport: the club is drop-in; the usual arrival is optional information
  await expect(d.getByRole('button', { name: 'Club driver' })).toHaveCount(0);
  await expect(d).not.toContainText(/Usual days|Who brings/);
  await expect(d).toContainText('Usual arrival time (optional)');
  await expect(d).toContainText('Flex includes 10 visits a month');
  await d.getByRole('button', { name: 'Create member' }).click(); // empty form: validation messages
  await expect(d).toContainText('Please enter the full name.');
  await expect(d).not.toContainText('usual arrival');
  await expect(d).toContainText('Please enter the date of birth.');
  await expect(d).toContainText('Consent to the use of information is required.');
  await d.getByLabel('Full name, as on the KTP').fill('Siti Rahma');
  await pickDate(page, 'Date of birth', '1946-03-12');
  await d.getByRole('textbox', { name: /^Name/ }).fill('Rudi Rahma');
  await d.getByLabel('Mobile (WhatsApp)').fill('0813 4000 7777');
  await d.getByRole('switch', { name: /Use of information/ }).click();
  await d.getByRole('button', { name: 'Create member' }).click();
  await expect(page).toHaveURL(/\/members\/m47$/);
  await expect(page.getByRole('heading', { name: 'Oma Siti Rahma', level: 1 })).toBeVisible();
  await expect(page.getByText(/waiting for management approval/)).toBeVisible();
  // listed as pending; the family cannot sign in yet
  await page.goto('/members');
  await expect(page.locator('[data-member="m47"]')).toContainText('Pending approval');
  const before = await request.post('/api/login', { data: { username: 'rudi', password: 'citra123' } });
  expect(before.status()).toBe(401); // no username or password yet
  // management approves
  await signIn(page, 's9', '/reviews');
  const card = page.locator('[data-cr]').filter({ hasText: 'Siti Rahma' });
  await expect(card).toContainText('Rudi Rahma');
  await expect(card).toContainText('12 March 1946');
  await card.getByRole('button', { name: 'Approve' }).click();
  await expect(card).toHaveCount(0);
  // approval activates the login: the server gives Rudi a username (first name) and the default password
  await expect.poll(async () => (await (await request.post('/api/login', { data: { username: 'rudi', password: 'citra123' } })).json()).ok).toBe(true);
  await page.goto('/members');
  await expect(page.locator('[data-member="m47"]')).not.toContainText('Pending approval');
  await expect(page.locator('[data-member="m47"]')).toContainText('Starts Mon 26 Oct');
  await expectFilter(page, 'Active · 6');
  c.assertClean();
});

test('family contacts: add a contact, make them the primary billing contact', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/members/m10/family');
  await page.getByRole('button', { name: 'Add family contact' }).click();
  const d = dialog(page);
  await d.getByRole('textbox', { name: /^Name/ }).fill('Dewi Purnomo');
  await d.getByLabel('Mobile (WhatsApp)').fill('0813 4000 1122');
  await d.getByRole('button', { name: 'Add contact' }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByText('Dewi Purnomo').first()).toBeVisible();
  await page.getByRole('button', { name: 'Edit Dewi Purnomo' }).click();
  await dialog(page).getByRole('switch', { name: /Primary billing contact/ }).click();
  await dialog(page).getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByText(/Primary billing contact$/)).toHaveCount(1);
  await expect(page.getByText(/Uses the app$/)).toHaveCount(2);
  await noHScroll(page);
  c.assertClean();
});

test('end membership with a future last day, then cancel the ending', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/members/m1');
  await page.getByRole('button', { name: 'End membership' }).click();
  const d = dialog(page);
  await d.getByRole('button', { name: 'End membership' }).click();
  await expect(d).toContainText('Choose a reason.');
  await d.getByRole('button', { name: 'Moved away' }).click();
  // the calendar greys out the days the club is closed (24 Oct is a Saturday); an open day can be picked
  await page.getByRole('button', { name: 'Another date' }).and(page.locator('[aria-haspopup="dialog"]')).click();
  await expect(page.locator('[data-date="2026-10-24"]')).toHaveAttribute('aria-disabled', 'true');
  await page.locator('[data-date="2026-10-28"]').click();
  await expect(d).toContainText('They can still check in until');
  await expect(d).toContainText('No final invoice: there are no unbilled extra days.');
  await d.getByRole('button', { name: 'End membership' }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByText(/Ending Wed 28 Oct/)).toBeVisible();
  // still listed as active until the last day
  await page.goto('/members');
  await expect(page.locator('[data-member="m1"]')).toContainText('ends');
  await expectFilter(page, 'Active · 5');
  await page.goto('/members/m1');
  await page.getByRole('button', { name: 'Cancel ending' }).click();
  await expect(page.getByText(/Ending Wed 28 Oct/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'End membership' })).toBeVisible();
  c.assertClean();
});

test('plan and billing: finance applies an upgrade request, management approves; invoices open', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's10', '/members');
  await expect(page.locator('[data-member]')).toHaveCount(5);
  await page.locator('[data-member="m10"]').click();
  await expect(page.getByRole('tab')).toHaveCount(5); // finance: overview, attendance, plan, family, history
  await page.getByRole('tab', { name: 'Plan and billing' }).click();
  await expect(page.getByText(/asked to change from Flex to Gold/)).toBeVisible();
  await page.getByRole('button', { name: 'Apply request' }).click();
  await expect(page.getByRole('group', { name: 'Pending review' })).toContainText('Apply plan request');
  await signIn(page, 's9', '/reviews');
  const card = page.locator('[data-cr]').filter({ hasText: 'Apply plan request' });
  await expect(card).toContainText('Flex');
  await expect(card).toContainText('Gold');
  await card.getByRole('button', { name: 'Approve' }).click();
  await page.goto('/members/m10/plan');
  await expect(page.getByText(/Next plan change/)).toBeVisible();
  await expect(page.getByText(/asked to change from/)).toHaveCount(0);
  c.assertClean();
});

test('notes: add a staff-only and a shared note, edit and delete; only the author or management may', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's1', '/members/m1/notes');
  await page.getByLabel('Note', { exact: true }).fill('Prefers the seat by the window');
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  const staffRow = page.locator('[data-note]').filter({ hasText: 'Prefers the seat by the window' });
  await expect(staffRow).toBeVisible();
  await page.getByLabel('Note', { exact: true }).fill('Enjoys the garden walk before lunch');
  await page.getByRole('radio', { name: 'Shared with family' }).click();
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  const sharedRow = page.locator('[data-note]').filter({ hasText: 'Enjoys the garden walk before lunch' });
  await expect(sharedRow).toBeVisible();
  await expect(sharedRow).toContainText('Pinned');
  // edit
  await staffRow.getByRole('button', { name: 'Edit note' }).click();
  await page.getByRole('textbox', { name: 'Edit note' }).fill('Prefers the seat by the garden window');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const edited = page.locator('[data-note]').filter({ hasText: 'Prefers the seat by the garden window' });
  await expect(edited).toBeVisible();
  await expect(edited).toContainText(/edited by Caca/);
  // delete (with a confirmation)
  await edited.getByRole('button', { name: 'Delete note' }).click();
  await dialog(page).getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('Prefers the seat by the garden window')).toHaveCount(0);
  await expect(sharedRow).toBeVisible();
  // the nurse can read the lobby's staff-only note but not change or delete it; management can
  await signIn(page, 's8', '/members/m1/notes');
  const seeded = page.locator('[data-note="n-m1-2"]');
  await expect(seeded).toContainText('Mbak Sari waits in the lounge');
  await expect(seeded.getByRole('button', { name: 'Delete note' })).toHaveCount(0);
  await expect(seeded.getByRole('button', { name: 'Edit note' })).toHaveCount(0);
  await signIn(page, 's9', '/members/m1/notes');
  await expect(page.locator('[data-note="n-m1-2"]').getByRole('button', { name: 'Delete note' })).toBeVisible();
  c.assertClean();
});

test('role visibility: teachers do not see plan or documents; finance sees no clinical tabs', async ({ page }) => {
  await signIn(page, 's5', '/members/m1');
  await expect(page.getByRole('tab', { name: 'Plan and billing' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Documents' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Care log' })).toBeVisible();
  await page.goto('/members/m1/plan');
  await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
  await signIn(page, 's10', '/members/m1');
  for (const hidden of ['Health', 'Care log', 'Photos', 'Documents', 'Notes']) await expect(page.getByRole('tab', { name: hidden, exact: true })).toHaveCount(0);
  await expect(page.getByText('Condition summary')).toHaveCount(0);
});

test('edit bar: lock note for roles that cannot edit; family contact edit for the lobby', async ({ page }) => {
  await signIn(page, 's5', '/members/m1/care');
  await expect(page.getByRole('button', { name: 'Edit cognitive status' })).toBeVisible();
  await page.getByRole('tab', { name: 'Health' }).click();
  if (!isPhone(page)) await expect(page.getByText('Only the nurse and management can edit this.')).toBeVisible(); // a phone drops the helper note
  await expect(page.getByRole('button', { name: 'Edit health record' })).toHaveCount(0);
  await signIn(page, 's1', '/members/m1/family');
  await page.getByRole('button', { name: 'Edit Daniel Wijaya' }).click();
  await dialog(page).getByRole('textbox', { name: /^Name/ }).fill('Daniel W. Wijaya');
  await dialog(page).getByRole('button', { name: 'Submit for review' }).click();
  await expect(page.getByRole('group', { name: 'Pending review' })).toContainText('Daniel W. Wijaya');
  await expect(page.getByText('Daniel Wijaya').first()).toBeVisible();
});

test('documents: upload, request from the family, send the form link', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/members/m46/docs');
  await expect(page.getByText('Missing').first()).toBeVisible().catch(() => undefined);
  await page.getByRole('button', { name: 'Remind the family' }).click(); // the seed already asked for the health-info photo
  await expect(toast(page)).toContainText('WhatsApp');
  await page.getByTestId('doc-file').last().setInputFiles({ name: 'ringkasan-dokter.pdf', mimeType: 'application/pdf', buffer: Buffer.from('demo') });
  await expect(page.getByText('ringkasan-dokter.pdf')).toBeVisible();
  await expect(page.getByText(/Health-info photo/).first()).toBeVisible();
  // lobby upload is reviewed
  await signIn(page, 's1', '/members/m1/docs');
  await page.getByTestId('doc-file').first().setInputFiles({ name: 'ktp-baru.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('demo') });
  await expect(page.getByRole('group', { name: 'Pending review' })).toContainText('ktp-baru.jpg');
  c.assertClean();
});

test('family audience: no staff-only fields, no history, no edit bars; visits instead of days, no booking; an upload goes to review', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 'f1', '/health');
  const fh = page.getByTestId('family-health');
  await expect(fh).toBeVisible();
  await expect(page.getByRole('tablist', { name: 'Member profile' }).getByRole('tab')).toHaveCount(9); // the member switcher is another tablist
  await expect(page.getByRole('tab', { name: 'History' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Health', exact: true })).toHaveAttribute('aria-selected', 'true');
  // nothing staff-only or editable
  await expect(fh.getByText('Care instructions')).toHaveCount(0);
  await expect(fh.getByText('Staff only')).toHaveCount(0);
  await expect(fh.getByText('Use her right arm')).toHaveCount(0);
  await expect(fh.getByRole('button', { name: /^Edit/ })).toHaveCount(0);
  await expect(fh.getByText('Medications')).toBeVisible();
  await noHScroll(page);
  await page.getByRole('tab', { name: 'Care log' }).click();
  await expect(fh.getByText('Staff only')).toHaveCount(0);
  await expect(fh.getByText(/Reviewed by Ns. Dewi/)).toBeVisible();
  await page.getByRole('tab', { name: 'Plan and billing' }).click();
  await expect(fh.getByText(/Xero/)).toHaveCount(0);
  await expect(fh.getByText('Rp 5.500.000').first()).toBeVisible();
  await expect(fh.getByRole('button', { name: 'Change plan' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Notes' }).click();
  await expect(fh.getByText('Loves keroncong')).toBeVisible();
  await expect(fh.getByText('Mbak Sari waits in the lounge')).toHaveCount(0); // a staff-only note
  await expect(fh.getByLabel('Note', { exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Family' }).click();
  await expect(fh.getByRole('button', { name: 'Message family' })).toHaveCount(0);
  await expect(fh.locator('a[href^="tel:"]').first()).toBeVisible();
  // the plan card counts visits; there is nothing to book and no leave to take
  await page.getByRole('tab', { name: 'Overview' }).click();
  await expect(fh.getByText('10 of 10 visits used')).toBeVisible();
  await expect(fh.getByText('Usually arrives around 10:05').first()).toBeVisible();
  for (const name of ['Book a day', 'Plan leave']) await expect(fh.getByRole('button', { name })).toHaveCount(0);
  await expect(fh).not.toContainText(RETIRED);
  await page.getByRole('tab', { name: 'Attendance' }).click();
  await expect(fh.getByText('Visits used in October')).toBeVisible();
  await expect(fh.locator('[data-visit="visit"]')).toHaveCount(10);
  // an upload is gated: it waits for review and the family sees the chip
  await page.getByRole('tab', { name: 'Documents' }).click();
  await page.getByTestId('doc-file').first().setInputFiles({ name: 'ktp-baru.pdf', mimeType: 'application/pdf', buffer: Buffer.from('demo') });
  await expect(page.getByRole('group', { name: 'Pending review' })).toContainText('ktp-baru.pdf');
  await expect(fh.getByRole('button', { name: /^Request from family/ })).toHaveCount(0);
  await expect(fh.getByRole('button', { name: 'Send form link' })).toHaveCount(0);
  // management approves; the document is on file, added by the family
  await signIn(page, 's9', '/reviews');
  const card = page.locator('[data-cr]').filter({ hasText: 'ktp-baru.pdf' });
  await expect(card).toContainText('Document uploaded by the family');
  await expect(card).toContainText('Maria Wijaya');
  await card.getByRole('button', { name: 'Approve' }).click();
  await expect(card).toHaveCount(0);
  await signIn(page, 'f1', '/health?tab=docs');
  await expect(page.getByText(/by Maria Wijaya · by the family/).first()).toBeVisible();
  c.assertClean();
});

test('a lead that joins: Reviews summarises the new member and History shows how the record started', async ({ page, request }) => {
  const c = watchConsole(page);
  // the lobby converts a lead (the enquiries screen belongs to another area; the action is the contract)
  const r = await request.post('/api/actions/enquiry.convert', { headers: { 'x-user-id': 's1' }, data: { mutationId: 'e2e-members-conv', club: 'citra', input: { enquiryId: 'e3', plan: 'flex', start: '2026-10-26' } } });
  expect(r.ok()).toBeTruthy();
  const id = String((await r.json()).result.memberId);
  await signIn(page, 's1', '/members');
  await expect(page.locator(`[data-member="${id}"]`)).toContainText('Pending approval');
  await signIn(page, 's9', '/reviews');
  const card = page.locator('[data-cr]').filter({ hasText: 'Ellen Sutanto' });
  await expect(card).toContainText('Lead joining');
  await expect(card.getByRole('button', { name: /Ellen Sutanto/ })).toBeVisible(); // like a new member: the lead's name opens the pending profile
  await expect(card).toContainText('Kevin Sutanto');
  await expect(card).toContainText('Plan');
  await expect(card).toContainText('Flex');
  await card.getByRole('button', { name: 'Approve' }).click();
  await expect(card).toHaveCount(0);
  await page.goto(`/members/${id}/history`);
  await expect(page.getByText(/joined as a member/).first()).toBeVisible();
  await expect(page.getByText(/added from an enquiry/).first()).toBeVisible();
  c.assertClean();
});

/** A real 1x1 image on the server, as the camera flow leaves it (the id goes on the photo as `mediaId`). */
async function uploadPng(request: APIRequestContext, user: string) {
  const r = await request.post('/api/media', { headers: { 'x-user-id': user }, data: { mime: 'image/png', data: TINY_PNG.toString('base64') } });
  expect(r.ok(), await r.text()).toBeTruthy();
  return String((await r.json()).id);
}

test('members list: more than a page is paged; a search or filter goes back to page 1', async ({ page, request }) => {
  const c = watchConsole(page);
  await addMembers(request, 7); // five seeded members and seven more: twelve, and a page holds ten
  await signIn(page, 's1', '/members');
  await expect(page.locator('[data-member]')).toHaveCount(10);
  await expect(page.getByRole('navigation', { name: 'Members pages' })).toBeVisible();
  const first = await page.locator('[data-member]').first().getAttribute('data-member');
  await goToPage(page, 2, 'Members pages');
  await expect(page.locator('[data-member]')).toHaveCount(2);
  expect(await page.locator('[data-member]').first().getAttribute('data-member')).not.toBe(first);
  await noHScroll(page);
  // a search shows what matches from page 1; clearing it goes back to the first page of everyone
  await page.getByLabel('Search members').fill('Sinta');
  await expect(page.locator('[data-member]')).toHaveCount(7);
  await expect(page.getByRole('navigation', { name: 'Members pages' })).toHaveCount(0);
  await page.getByLabel('Search members').fill('');
  await expect(page.locator('[data-member]')).toHaveCount(10);
  await expect(page.locator('[data-member]').first()).toHaveAttribute('data-member', first!);
  c.assertClean();
});

test('photos tab: Take photo uses the camera flow; a teacher’s photo waits for approval and families never see it; management’s publishes at once', async ({ page, request }) => {
  const c = watchConsole(page);
  await signIn(page, 's5', '/members/m1/photos');
  await expect(page.getByRole('button', { name: 'Take photo' })).toBeVisible();
  await page.getByRole('button', { name: 'Take photo' }).click();
  await takePhotoWithFile(page); // no camera in the test browser: the file picker, then "Use photo"; the picture is uploaded and tagged to Oma Lina
  await expect(toast(page)).toContainText(/waits for management.s approval/);
  const tile = page.locator('[data-photo][data-visibility="pending"]');
  await expect(tile).toHaveCount(1);
  await expect(tile).toContainText('Waiting for approval');
  await expect(tile).toHaveAttribute('aria-label', /waiting for approval/i);
  await expect(tile.locator('img')).toHaveAttribute('src', /\/api\/media\/[A-Za-z0-9_.-]+/);
  await expect.poll(() => tile.locator('img').evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true); // the real image shows, not a placeholder
  await noHScroll(page);
  // the family's own data does not hold it
  const snap = await familySnapshot(request, 'f1');
  expect(Object.values(snap.photos).filter((p) => p.visibility === 'pending')).toHaveLength(0);
  expect(Object.values(snap.photos).filter((p) => p.mediaId)).toHaveLength(0);
  await signIn(page, 'f1', '/health?tab=photos');
  const fh = page.getByTestId('family-health');
  await expect(fh.locator('[data-photo]').first()).toBeVisible();
  await expect(fh.locator('[data-visibility="pending"]')).toHaveCount(0);
  await expect(fh).not.toContainText('Waiting for approval');
  await expect(fh.getByRole('button', { name: 'Take photo' })).toHaveCount(0);
  // the front desk may take a profile photo too (it waits for approval); management's photo is visible at once, with no waiting tag
  await signIn(page, 's1', '/members/m1/photos');
  await expect(page.getByRole('button', { name: 'Take photo' })).toHaveCount(1);
  await signIn(page, 's9', '/members/m1/photos');
  await page.getByRole('button', { name: 'Take photo' }).click();
  await takePhotoWithFile(page);
  await expect(toast(page)).toContainText('Photo saved.');
  await expect(page.locator('[data-photo][data-visibility="visible"] img[src^="/api/media/"]')).toHaveCount(1);
  await expect(page.locator('[data-photo][data-visibility="pending"]')).toHaveCount(1); // the teacher's one still waits
  expect(Object.values((await familySnapshot(request, 'f1')).photos).filter((p) => p.mediaId)).toHaveLength(1);
  c.assertClean();
});

test('reviews → Photos: select, approve with the notify switch on or off, reject with a reason', async ({ page, request }) => {
  const c = watchConsole(page);
  const media = await uploadPng(request, 's5');
  const a = await takePhoto(request, 's5', 'm1', 'e2e-p-a', { mediaId: media });
  const b = await takePhoto(request, 's6', 'm10', 'e2e-p-b');
  const g = await takePhoto(request, 's5', 'm1', 'e2e-p-g', { kind: 'group', memberIds: ['m1', 'm10'] });
  const newPhotoNotes = async (user: string) => Object.values((await familySnapshot(request, user)).notifications).filter((n) => n.kind === 'activity.notif.newPhoto' && n.toUsers.includes(user)).length;
  expect(await newPhotoNotes('f1')).toBe(0);
  await signIn(page, 's9', '/reviews');
  await expect(page.getByRole('tab', { name: 'Photos · 3' })).toBeVisible();
  await page.getByRole('tab', { name: /^Photos/ }).click();
  await expect(page.getByText('3 photos waiting')).toBeVisible();
  await expect(page.locator('[data-photo-review]')).toHaveCount(3);
  const ta = page.locator(`[data-photo-review="${a}"]`), tb = page.locator(`[data-photo-review="${b}"]`), tg = page.locator(`[data-photo-review="${g}"]`);
  await expect(ta).toContainText('Lina');
  await expect(ta).toContainText('by Dinar');
  await expect(ta.locator('img[src^="/api/media/"]')).toBeVisible();
  await expect(tb).toContainText('Bambang');
  await expect(tg).toContainText('Oma Lina, Bapak Bambang');
  await expect(tg).toContainText('Group photo');
  await noHScroll(page);
  // nothing is selected: the buttons wait; "Notify families" is on by default
  const notify = page.getByRole('switch', { name: /Notify families/ });
  await expect(notify).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('button', { name: 'Approve (0)' })).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('button', { name: 'Reject (0)' })).toHaveAttribute('aria-disabled', 'true');
  // approve one with the families told
  await ta.getByRole('checkbox').click();
  await expect(ta).toHaveAttribute('data-selected', 'true');
  await expect(page.getByText('1 selected')).toBeVisible();
  await page.getByRole('button', { name: 'Approve (1)' }).click();
  await expect(toast(page)).toContainText('Photo approved. The family is told.');
  await expect(ta).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Photos · 2' })).toBeVisible();
  await expect.poll(() => newPhotoNotes('f1')).toBe(1);
  const f1 = await familySnapshot(request, 'f1');
  expect(f1.photos[a]).toMatchObject({ visibility: 'visible', mediaId: media });
  expect(f1.photos[g]).toBeUndefined(); // still waiting
  // approve another with the switch off: visible, but nobody is told
  await notify.click();
  await expect(notify).toHaveAttribute('aria-checked', 'false');
  await tb.getByRole('checkbox').click();
  await page.getByRole('button', { name: 'Approve (1)' }).click();
  await expect(toast(page)).toContainText(/Photo approved\.$/);
  await expect(tb).toHaveCount(0);
  const laras = await familySnapshot(request, 'fm10_0');
  expect(laras.photos[b]?.visibility).toBe('visible');
  expect(await newPhotoNotes('fm10_0')).toBe(0);
  // reject the last one: a reason is required
  await page.getByRole('button', { name: 'Select all (1)' }).click();
  await page.getByRole('button', { name: 'Reject (1)' }).click();
  const d = dialog(page);
  await expect(d).toContainText('Reject this photo');
  await d.getByRole('button', { name: 'Reject' }).click();
  await expect(d).toContainText('Please add a note.');
  await d.getByLabel('Why are they not approved?').fill('Out of focus');
  await d.getByRole('button', { name: 'Reject' }).click();
  await expect(toast(page)).toContainText('Photo rejected.');
  await expect(page.getByText('No photos to approve')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Photos · 0' })).toBeVisible();
  expect((await familySnapshot(request, 'f1')).photos[g]).toBeUndefined();
  // the approved ones are on the profile for staff, without a waiting tag
  await page.goto('/members/m1/photos');
  await expect(page.locator(`[data-photo="${a}"]`)).toHaveAttribute('data-visibility', 'visible');
  await expect(page.locator(`[data-photo="${g}"]`)).toHaveCount(0);
  c.assertClean();
});

test('reviews → Photos: the kitchen’s lunch photo is in the grid (deep link) and approving it publishes it', async ({ page, request }) => {
  const c = watchConsole(page);
  const r = await doAct(request, 's2', 'menu.postLunchPhoto', { date: '2026-10-21' }, 'e2e-lunch-1');
  expect(r.ok(), await r.text()).toBeTruthy();
  const pid = String((await r.json()).result.photoId);
  expect((await familySnapshot(request, 'f1')).photos[pid]).toBeUndefined();
  await signIn(page, 's9', '/reviews?tab=photos'); // the link from "needs action" opens the Photos section
  await expect(page.getByRole('tab', { name: 'Photos · 1' })).toHaveAttribute('aria-selected', 'true');
  const tile = page.locator(`[data-photo-review="${pid}"]`);
  await expect(tile).toContainText('Lunch photo');
  await expect(tile).not.toContainText('Lunch photo · ');
  await expect(tile).toContainText('by Pak Yohanes');
  await tile.getByRole('checkbox').click();
  await page.getByRole('button', { name: 'Approve (1)' }).click();
  await expect(toast(page)).toContainText('Photo approved. The family is told.');
  await expect(tile).toHaveCount(0);
  expect((await familySnapshot(request, 'f1')).photos[pid]).toMatchObject({ visibility: 'visible' });
  c.assertClean();
});

test('reviews → Photos: a page holds twelve; "Select all" covers every page; approving clears them', async ({ page, request }) => {
  const c = watchConsole(page);
  for (let i = 0; i < 13; i++) await takePhoto(request, 's5', 'm1', `e2e-p-bulk-${i}`);
  await signIn(page, 's9', '/reviews');
  await page.getByRole('tab', { name: /^Photos/ }).click();
  await expect(page.locator('[data-photo-review]')).toHaveCount(12);
  await goToPage(page, 2, 'Photo pages');
  await expect(page.locator('[data-photo-review]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Select all (13)' }).click();
  await expect(page.getByText('13 selected')).toBeVisible();
  await expect(page.locator('[data-photo-review][data-selected="true"]')).toHaveCount(1); // the tile on this page
  await page.getByRole('button', { name: 'Approve (13)' }).click();
  await expect(toast(page)).toContainText('13 photos approved. Families are told.');
  await expect(page.getByText('No photos to approve')).toBeVisible();
  await noHScroll(page);
  c.assertClean();
});

test('reviews: requests to approve are paged (five a page)', async ({ page, request }) => {
  const c = watchConsole(page);
  await addMembers(request, 6, 's1'); // the lobby's new members each wait for approval; with the seeded request that makes seven
  await signIn(page, 's9', '/reviews');
  await expect(page.locator('[data-cr]')).toHaveCount(5);
  await goToPage(page, 2, 'Requests to approve pages');
  await expect(page.locator('[data-cr]')).toHaveCount(2);
  // approving one on the last page keeps the paging right: seven requests become six, and the last page holds one
  await page.locator('[data-cr]').first().getByRole('button', { name: 'Approve' }).click();
  await expect(page.locator('[data-cr]')).toHaveCount(1);
  await noHScroll(page);
  c.assertClean();
});

test('family tab: usernames are shown read-only; management resets a password to the default; the lobby cannot', async ({ page, request }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/members/m1/family');
  await expect(page.getByText('Username: maria', { exact: true })).toBeVisible();
  await expect(page.getByText('Username: daniel', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /username/i })).toHaveCount(0); // read-only text
  await expect(page.getByRole('button', { name: /^Reset password for/ })).toHaveCount(2);
  // Maria changes her password, then management puts it back to the default
  const login = async (password: string) => (await (await request.post('/api/login', { data: { username: 'maria', password } })).json()) as { ok: boolean; token?: string };
  const first = await login('citra123');
  expect(first.ok).toBe(true);
  const ch = await request.post('/api/account/password', { headers: { authorization: `Bearer ${first.token}` }, data: { current: 'citra123', next: 'Maria-own-1' } });
  expect(ch.ok()).toBeTruthy();
  expect((await login('citra123')).ok).toBe(false);
  expect((await login('Maria-own-1')).ok).toBe(true);
  await page.getByRole('button', { name: 'Reset password for Maria Wijaya' }).click();
  const sheet = dialog(page);
  await expect(sheet).toContainText('will sign in with the default password again');
  await sheet.getByRole('button', { name: 'Cancel' }).click();
  expect((await login('citra123')).ok).toBe(false); // cancelled: nothing changed
  await page.getByRole('button', { name: 'Reset password for Maria Wijaya' }).click();
  await dialog(page).getByRole('button', { name: 'Reset password' }).click();
  await expect(toast(page)).toContainText('Password reset. Maria Wijaya can sign in with the default password.');
  await expect.poll(async () => (await login('citra123')).ok).toBe(true);
  expect((await login('Maria-own-1')).ok).toBe(false);
  await noHScroll(page);
  // the front desk sees the usernames but has no reset button
  await signIn(page, 's1', '/members/m1/family');
  await expect(page.getByText('Username: maria', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Reset password/ })).toHaveCount(0);
  // a family member sees only their own username
  await signIn(page, 'f1', '/health?tab=family');
  const fh = page.getByTestId('family-health');
  await expect(fh.getByText('Username: maria', { exact: true })).toBeVisible();
  await expect(fh.getByText('Username: daniel')).toHaveCount(0);
  await expect(fh.getByRole('button', { name: /Reset password/ })).toHaveCount(0);
  c.assertClean();
});

test('Indonesian: no raw keys on the list, profile tabs and reviews', async ({ page, request }) => {
  const c = watchConsole(page);
  await takePhoto(request, 's5', 'm1', 'e2e-p-id'); // a teacher's photo waits for approval
  await signIn(page, 's1', '/members', 'id');
  await expect(page.getByRole('heading', { name: 'Anggota', level: 1 })).toBeVisible();
  await expectFilter(page, 'Aktif · 5');
  await expect(main(page)).not.toContainText(RAW_KEY);
  await page.locator('[data-member="m1"]').click();
  const tabs = ['Ringkasan', 'Kesehatan', 'Catatan harian', 'Foto', 'Kehadiran', 'Dokumen', 'Paket dan tagihan', 'Keluarga', 'Catatan', 'Riwayat'];
  for (const name of tabs) {
    await page.getByRole('tab', { name, exact: true }).click();
    await expect(page.getByRole('tabpanel')).not.toBeEmpty();
    await expect(main(page)).not.toContainText(RAW_KEY);
    await noHScroll(page);
  }
  await page.getByRole('tab', { name: 'Ringkasan' }).click();
  await expect(page.getByText('Biasanya tiba sekitar 10:05').first()).toBeVisible();
  await expect(page.getByText('10 dari 10 kunjungan terpakai')).toBeVisible();
  await page.getByRole('tab', { name: 'Kehadiran' }).click();
  await expect(page.getByText('Kunjungan terpakai di Oktober')).toBeVisible();
  await expect(page.getByText('Hari tambahan di Oktober')).toBeVisible();
  await page.getByRole('tab', { name: 'Foto', exact: true }).click();
  await expect(page.locator('[data-photo][data-visibility="pending"]')).toContainText('Menunggu persetujuan');
  await page.getByRole('tab', { name: 'Ringkasan' }).click();
  await expect(page.getByRole('button', { name: 'Ubah data diri' })).toBeVisible(); // a phone shows the edit button as an icon with this name
  await page.getByRole('button', { name: 'Ubah data diri' }).click();
  await expect(dialog(page)).toContainText('Dikirim ke manajemen untuk disetujui');
  await expect(dialog(page)).not.toContainText(RAW_KEY);
  await page.keyboard.press('Escape');
  await signIn(page, 's9', '/reviews', 'id');
  await expect(page.getByRole('heading', { name: 'Tinjauan', level: 1 })).toBeVisible();
  await expect(main(page)).toContainText('Jam kedatangan biasa');
  await expect(main(page)).not.toContainText(RAW_KEY);
  // the Photos section: counts, select, notify switch, reject dialog
  await page.getByRole('tab', { name: 'Foto · 1' }).click();
  await expect(page.getByText('1 foto menunggu')).toBeVisible();
  await expect(page.getByRole('switch', { name: /Beri tahu keluarga/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('button', { name: 'Setujui (0)' })).toBeVisible();
  await page.getByRole('button', { name: 'Pilih semua (1)' }).click();
  await expect(page.getByText('1 dipilih')).toBeVisible();
  await expect(main(page)).not.toContainText(RAW_KEY);
  await page.getByRole('button', { name: 'Tolak (1)' }).click();
  await expect(dialog(page)).toContainText('Tolak foto ini');
  await expect(dialog(page)).not.toContainText(RAW_KEY);
  await dialog(page).getByRole('button', { name: 'Tolak' }).click();
  await expect(dialog(page)).toContainText('Mohon tambahkan catatan.');
  await page.keyboard.press('Escape');
  // the family tab shows usernames
  await page.goto('/members/m1/family');
  await expect(page.getByText('Nama pengguna: maria', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Atur ulang kata sandi Maria Wijaya' })).toBeVisible();
  await expect(main(page)).not.toContainText(RAW_KEY);
  c.assertClean();
});

test('layout: the tab bar is one scrolling row on every device (a phone swipes it, wider screens get arrows); nothing overflows', async ({ page }) => {
  await signIn(page, 's9', '/members/m1');
  const tablist = page.getByRole('tablist');
  const box = await tablist.boundingBox();
  expect(box).toBeTruthy();
  if (isPhone(page)) {
    const tabs = page.getByRole('tab');
    const first = await tabs.first().boundingBox();
    const last = await tabs.last().boundingBox();
    expect(Math.abs(last!.y - first!.y)).toBeLessThan(4); // one row, not wrapped
    expect(await tablist.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true); // …that scrolls sideways
    expect(first!.height).toBeLessThanOrEqual(40); // compact pills
    expect((await tablist.boundingBox())!.y).toBeLessThan(300); // the tab content starts on the first screen
  } else {
    const scrollable = await tablist.evaluate((el) => el.scrollWidth > el.clientWidth);
    if (scrollable) {
      await expect(page.getByRole('button', { name: 'Scroll tabs right' })).toBeVisible();
      await page.getByRole('button', { name: 'Scroll tabs right' }).click();
      await expect(page.getByRole('button', { name: 'Scroll tabs left' })).toBeVisible();
    }
  }
  await noHScroll(page);
});

// ---------------------------------------------------------------- Care log: day by day, with the health readings, and the log written on its day
test('Care log: one card per day with that day’s readings and log; the activity team writes today’s log right on its card', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's5', '/members/m2');
  await page.getByRole('tab', { name: 'Care log' }).click();
  const days = page.getByTestId('care-day');
  await expect(days.first()).toHaveAttribute('data-date', '2026-10-21'); // today first: he is in the club
  await expect(days.first()).toContainText(/In the club since \d\d:\d\d/);
  await expect(page.getByTestId('care-days').getByTestId('care-reading').first()).toBeVisible(); // earlier days carry their readings
  await expect(page.getByTestId('care-reading').first()).toContainText(/Blood pressure \d+\/\d+/);
  const today = days.first();
  await today.getByRole('button', { name: /^(Write|Edit) the log$/ }).click();
  await today.getByRole('group', { name: 'Mood' }).getByRole('button', { name: 'Quiet' }).click();
  await today.getByLabel('Note', { exact: true }).fill('Enjoyed the music');
  await today.getByRole('button', { name: /^(Save log|Save changes)$/ }).click();
  const logOfToday = async () => {
    const st = (await (await page.request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': 's9' } })).json()).state;
    return Object.values(st.dailyLogs as Record<string, { memberId: string; date: string; mood: string; note: string }>).find((l) => l.memberId === 'm2' && l.date === '2026-10-21');
  };
  await expect.poll(async () => (await logOfToday())?.mood).toBe('quiet');
  expect((await logOfToday())?.note).toBe('Enjoyed the music');
  await expect(today).toContainText('Enjoyed the music');
  await expect(today.getByRole('button', { name: 'Edit the log' })).toBeVisible();
  c.assertClean();
});

// ---------------------------------------------------------------- profile photo
test('profile photo: management taps the avatar and takes one; it shows on the profile and in the list; the edit dialog can remove it', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's9', '/members/m46');
  await page.getByTestId('profile-avatar').click();
  const sheet = page.getByRole('dialog', { name: 'Profile photo' });
  await sheet.getByRole('button', { name: 'Take or choose a photo' }).click();
  await takePhotoWithFile(page);
  await expect(sheet).toHaveCount(0);
  const photoOf = async () => (await (await page.request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': 's9' } })).json()).state.members.m46.photoMediaId as string | undefined;
  await expect.poll(photoOf).toMatch(/^md_/);
  await expect.poll(() => page.getByTestId('profile-avatar').evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('/api/media/');
  // the edit dialog shows it, and removes it
  await page.getByRole('button', { name: /Edit details/ }).first().click();
  const dlg = page.getByRole('dialog').filter({ has: page.getByTestId('profile-photo') });
  await dlg.getByRole('button', { name: 'Remove photo' }).click();
  await dlg.getByRole('button', { name: /^Save/ }).click();
  await expect.poll(photoOf).toBeUndefined();
  c.assertClean();
});

test('profile photo: the front desk’s new photo waits for management', async ({ page }) => {
  const c = watchConsole(page);
  await signIn(page, 's1', '/members/m1');
  await page.getByTestId('profile-avatar').click();
  await page.getByRole('dialog', { name: 'Profile photo' }).getByRole('button', { name: 'Take or choose a photo' }).click();
  await takePhotoWithFile(page);
  const st = async () => (await (await page.request.get('/api/snapshot?club=citra', { headers: { 'x-user-id': 's9' } })).json()).state;
  await expect.poll(async () => Object.values((await st()).changeRequests as Record<string, { status: string; target: { memberId: string }; section: string }>).some((r) => r.status === 'pending' && r.target.memberId === 'm1' && r.section === 'details')).toBe(true);
  expect((await st()).members.m1.photoMediaId).toBeUndefined(); // not until approved
  c.assertClean();
});
